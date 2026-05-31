'use strict';
/* =====================================================
   7 Wonders Duel — game.js
===================================================== */

// ── Constants ─────────────────────────────────────
const CW = 68, CH = 96, CU = 38, RU = 56;
const RAW_RES = ['wood','stone','clay','ore'];
const MFG_RES = ['glass','papyrus'];
const ALL_RES  = [...RAW_RES, ...MFG_RES];
const RES_JP   = { wood:'木', stone:'石', clay:'土', ore:'鉄', glass:'ガ', papyrus:'紙', coins:'🪙' };
const SCI_SYM  = { tablet:'📜', compass:'🧭', gear:'⚙', mortar:'⚗', wheel:'⊙', astrolabe:'✦', law:'⚖' };
const TOKEN_ICON = { agriculture:'🌾', architecture:'🏛', economy:'💰', law:'⚖', masonry:'🪨',
                     mathematics:'📐', philosophy:'📚', strategy:'⚔', theology:'✝', urbanism:'🏙' };
// Draft order: P1,P2,P2,P1 then P2,P1,P1,P2
const DRAFT_ORDER = [1,2,2,1, 2,1,1,2];

// ── State ─────────────────────────────────────────
let G = {};

// ── Multiplayer globals ────────────────────────────
let _rng        = () => Math.random(); // seeded RNG (initGame でセット)
let mpMode      = 'local';             // 'local' | 'host' | 'guest'
let mpPeer      = null;
let mpConn      = null;
let myPlayerNum = 1;                   // host=1, guest=2

/** Mulberry32 シード付き擬似乱数 */
function makePRNG(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function mkPlayer() {
  return { coins:7, builtCards:[], wonders:[], progressTokens:[], chainSymbols:new Set() };
}

// ── Init ──────────────────────────────────────────
function initGame(seed) {
  // シード付き乱数セット（MP時は両端末が同じseedを使い同一シャッフル）
  if (seed === undefined) seed = (Math.random() * 0xFFFFFFFF) | 0;
  _rng = makePRNG(seed);

  G = {
    phase: 'draft',
    age: 0,
    turn: 1,
    players: { 1: mkPlayer(), 2: mkPlayer() },
    militaryPawn: 0,
    milUsed: new Set(),
    boardTokens: [],
    ageCards: [],
    discard: [],
    flipV: true,
    draftPick: 0,
    draftPool: [],
    draftWonders: [],
    draftIdx: 0,
    pendingCard: null,
    afterPick: null,
  };

  // 5 random progress tokens on board
  G.boardTokens = shuffle([...PROGRESS_TOKENS]).slice(0, 5).map(t => ({ ...t, taken: false }));

  // Shuffle wonders for draft
  G.draftWonders = shuffle([...WONDER_CARDS].map(w => ({ ...w, built: false, picked: false })));

  document.getElementById('victory-overlay').classList.add('hidden');
  document.getElementById('draft-overlay').classList.add('hidden');
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('log-list').innerHTML = '';
  document.getElementById('discard-count').textContent = '0';

  renderAll();
  startDraftRound();
  addLog('ゲーム開始！ワンダーを選んでください。', 'sys');

  // MP: ホストがseedをゲストに送信（同一シャッフル保証）
  if (mpMode === 'host' && mpConn?.open) {
    mp_sendEvent({ type: 'game_start', seed });
  }
  mp_updateIndicator();
}

// ── Wonder Draft ──────────────────────────────────
function startDraftRound() {
  const from = G.draftIdx;
  G.draftPool = G.draftWonders.slice(from, from + 4);
  G.draftIdx += 4;
  showDraftModal();
}

function showDraftModal() {
  const pNum  = DRAFT_ORDER[G.draftPick];
  const ov    = document.getElementById('draft-overlay');

  // MP: 自分のターンでなければオーバーレイを隠す
  if (mpMode !== 'local' && pNum !== myPlayerNum) {
    ov.classList.add('hidden');
    return;
  }

  document.getElementById('draft-title').textContent = `Player ${pNum} — ワンダーを選択`;
  document.getElementById('draft-sub').textContent   = `(${8 - G.draftPick}回 残り)`;
  const cards = document.getElementById('draft-cards');
  cards.innerHTML = '';
  G.draftPool.filter(w => !w.picked).forEach(w => {
    const el = document.createElement('div');
    el.className = 'draft-card';
    el.innerHTML = `<div class="draft-card-name">${w.nameJP}</div>
      <div class="draft-card-cost">${costHTML(w.cost)}</div>
      <div class="draft-card-effect">${fxText(w.effect)}</div>`;
    el.onclick = () => {
      if (mpMode !== 'local' && !G._replicating) mp_sendEvent({ type: 'wonder_draft', wonderId: w.id });
      pickWonder(w, pNum);
    };
    cards.appendChild(el);
  });
  ov.classList.remove('hidden');
}

function pickWonder(w, pNum) {
  w.picked = true;
  G.players[pNum].wonders.push({ ...w });
  addLog(`P${pNum} → ${w.nameJP}`, `p${pNum}`);
  G.draftPick++;
  if (G.draftPick === 4) { startDraftRound(); return; }
  if (G.draftPick >= 8) {
    document.getElementById('draft-overlay').classList.add('hidden');
    addLog('ドラフト完了！', 'sys');
    startAge(1);
    return;
  }
  showDraftModal();
}

// ── Age Setup ─────────────────────────────────────
function startAge(n) {
  G.age = n;
  G.phase = 'play';
  G.flipV = (n !== 2); // Age II wide-at-top → not flipped

  let pool, layout;
  if (n === 1) { pool = shuffle([...AGE1_CARDS]); layout = AGE1_LAYOUT; }
  else if (n === 2) { pool = shuffle([...AGE2_CARDS]); layout = AGE2_LAYOUT; }
  else {
    const guilds = shuffle([...GUILD_CARDS]).slice(0, 3);
    pool = shuffle([...AGE3_CARDS, ...guilds]);
    layout = AGE3_LAYOUT;
  }

  G.ageCards = layout.map(([row,col,faceUp], i) => ({
    ...pool[i], _lid: `${n}_${i}`, row, col, faceUp, available: false
  }));

  // Reset Olympia free-build
  [1,2].forEach(p => G.players[p].wonders.forEach(w => {
    if (w.id === 'olympia' && w.built) w._freeLeft = 1;
  }));

  // Strategy token: +1 shield after each Age start
  [1,2].forEach(p => {
    if (G.players[p].progressTokens.find(t => t.id === 'strategy')) {
      moveConflict(1, p);
    }
  });

  updateAvail();
  document.getElementById('age-label').textContent = `Age ${'III'.slice(0, n === 3 ? 3 : n === 2 ? 2 : 1)}`;
  addLog(`─── Age ${['I','II','III'][n-1]} 開始 ───`, 'sys');
  renderAll();
}

// ── Availability ──────────────────────────────────
function updateAvail() {
  const pos = new Set(G.ageCards.map(c => `${c.row},${c.col}`));
  G.ageCards.forEach(c => {
    const blocked = pos.has(`${c.row-1},${c.col-1}`) || pos.has(`${c.row-1},${c.col+1}`);
    c.available = !blocked;
    if (!blocked && !c.faceUp) c.faceUp = true;
  });
}

// ── Render ────────────────────────────────────────
function renderAll() {
  renderPyramid();
  renderMilitary();
  renderTokensBoard();
  renderZone(1);
  renderZone(2);
  updateTurnLabel();
}

function renderPyramid() {
  const lay = document.getElementById('card-layout');
  lay.innerHTML = '';
  if (!G.ageCards.length) return;
  const maxRow = Math.max(...G.ageCards.map(c => c.row));
  const maxCol = Math.max(...G.ageCards.map(c => c.col));
  lay.style.width  = (maxCol * CU + CW) + 'px';
  lay.style.height = (maxRow * RU + CH) + 'px';

  G.ageCards.forEach(c => {
    const x = c.col * CU;
    const y = G.flipV ? (maxRow - c.row) * RU : c.row * RU;
    const el = document.createElement('div');
    el.className = ['game-card',
      c.faceUp ? c.color : 'face-down',
      c.available ? 'available' : 'covered'
    ].join(' ');
    el.style.cssText = `left:${x}px;top:${y}px`;
    el.dataset.lid = c._lid;
    if (c.faceUp) {
      el.innerHTML = `
        <div class="card-top">
          <div class="card-name">${c.nameJP}</div>
          ${c.chainTo ? `<div class="card-chain-dot"></div>` : ''}
        </div>
        <div class="card-bottom">
          <div class="card-cost-row">${costHTML(c.cost)}</div>
          <div class="card-effect-row">${fxIcons(c.effect)}</div>
        </div>`;
    }
    if (c.faceUp) {
      el.addEventListener('mouseenter', () => tipShow(el, cardTipHTML(c)));
    }
    if (c.available && c.faceUp && G.phase === 'play') {
      const myTurn = mpMode === 'local' || G.turn === myPlayerNum;
      if (myTurn) el.addEventListener('click', () => { _tipHide(); openCardModal(c); });
      else el.style.cursor = 'default';
    }
    lay.appendChild(el);
  });
}

function renderMilitary() {
  const track = document.getElementById('military-track');
  track.innerHTML = '';
  for (let i = -9; i <= 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'track-cell';
    cell.id = `tc${i}`;
    if (i === 0)  cell.classList.add('t-center');
    if (i ===  3) { cell.classList.add('t-3-p1');  cell.innerHTML = '<span class="loss-label">2</span>'; }
    if (i ===  6) { cell.classList.add('t-6-p1');  cell.innerHTML = '<span class="loss-label">5</span>'; }
    if (i === -3) { cell.classList.add('t-3-p2');  cell.innerHTML = '<span class="loss-label">2</span>'; }
    if (i === -6) { cell.classList.add('t-6-p2');  cell.innerHTML = '<span class="loss-label">5</span>'; }
    if (i ===  9) cell.classList.add('t-sup-p1');
    if (i === -9) cell.classList.add('t-sup-p2');
    track.appendChild(cell);
  }
  const pawn = document.createElement('div');
  pawn.id = 'conflict-pawn';
  pawn.textContent = '⚔';
  track.appendChild(pawn);
  placePawn();
}

function placePawn() {
  const pawn = document.getElementById('conflict-pawn');
  const cell = document.getElementById(`tc${G.militaryPawn}`);
  if (!pawn || !cell) return;
  const tr = document.getElementById('military-track').getBoundingClientRect();
  const cr = cell.getBoundingClientRect();
  pawn.style.left = (cr.left - tr.left + cr.width/2 - 13) + 'px';
  pawn.classList.remove('pawn-moved');
  void pawn.offsetWidth; // force reflow to restart animation
  pawn.classList.add('pawn-moved');
}

function renderTokensBoard() {
  const board = document.getElementById('progress-board');
  board.innerHTML = '';
  G.boardTokens.forEach(t => {
    const el = document.createElement('div');
    el.className = 'prog-token' + (t.taken ? ' taken' : '');
    el.innerHTML = `<div class="prog-token-icon">${TOKEN_ICON[t.id]||'?'}</div>
                    <div class="prog-token-name">${t.nameJP}</div>`;
    el.addEventListener('mouseenter', () => tipShow(el, tokenTipHTML(t)));
    board.appendChild(el);
  });
}

function renderZone(n) {
  const p = G.players[n];
  document.getElementById(`p${n}-coins`).textContent = p.coins;
  document.getElementById(`p${n}-vp`).textContent    = liveVP(n);
  renderTableau(n);
  renderWonders(n);
  renderPlayerTokens(n);
}

function renderPlayerTokens(n) {
  const p = G.players[n];
  // Show owned progress tokens as small chips next to the wonder row
  let bar = document.getElementById(`p${n}-token-bar`);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = `p${n}-token-bar`;
    bar.style.cssText = 'display:flex;gap:3px;flex-wrap:wrap;';
    const pzTop = document.querySelector(`#p${n}-zone .pz-top`);
    if (pzTop) pzTop.appendChild(bar);
  }
  bar.innerHTML = '';
  p.progressTokens.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'player-token-chip';
    chip.textContent = TOKEN_ICON[t.id] || t.nameJP[0];
    chip.title = t.nameJP;
    chip.addEventListener('mouseenter', () => tipShow(chip, tokenTipHTML(t)));
    bar.appendChild(chip);
  });
}

function renderTableau(n) {
  ['brown','grey','yellow','red','green','blue'].forEach(col => {
    const el = document.getElementById(`p${n}-${col}`);
    if (!el) return;
    el.innerHTML = '';
    G.players[n].builtCards.filter(c => c.color === col).forEach(c => {
      const m = document.createElement('div');
      m.className = `mini-card ${col}`;
      m.title = c.nameJP;
      m.textContent = c.nameJP.slice(0,3);
      el.appendChild(m);
    });
  });
  // Purple separate - append to blue col for now
  const blueEl = document.getElementById(`p${n}-blue`);
  if (blueEl) G.players[n].builtCards.filter(c => c.color === 'purple').forEach(c => {
    const m = document.createElement('div');
    m.className = `mini-card purple`;
    m.title = c.nameJP;
    m.textContent = c.nameJP.slice(0,3);
    blueEl.appendChild(m);
  });
}

function renderWonders(n) {
  const row = document.getElementById(`p${n}-wonders`);
  row.innerHTML = '';
  G.players[n].wonders.forEach(w => {
    const slot = document.createElement('div');
    slot.className = 'wonder-slot' + (w.built ? ' built' : '');
    slot.innerHTML = `<div class="wonder-name">${w.nameJP}</div>
      <div class="wonder-cost-row">${costHTML(w.cost)}</div>`;
    slot.addEventListener('mouseenter', () => tipShow(slot, wonderTipHTML(w)));
    row.appendChild(slot);
  });
}

function updateTurnLabel() {
  const el = document.getElementById('turn-indicator');
  if (G.phase !== 'play') { el.textContent = ''; return; }
  el.textContent = `Player ${G.turn} のターン`;
  el.style.color = G.turn === 1 ? 'var(--p1-col)' : 'var(--p2-col)';
}

// ── Card Modal ────────────────────────────────────
function openCardModal(card) {
  if (G.phase !== 'play') return;
  G.selectedCard = card;
  const p = G.players[G.turn];
  const cr = calcCost(card, G.turn);
  const hasWonder = p.wonders.some(w => !w.built);

  document.getElementById('modal-preview-wrap').innerHTML =
    `<div class="modal-card-big ${card.color}" style="display:flex;flex-direction:column;justify-content:space-between;padding:10px;border-radius:8px;border:2px solid rgba(255,255,255,.25)">
       <div class="big-name" style="font-size:13px;font-weight:700;color:#fff;text-align:center">${card.nameJP}</div>
       <div style="display:flex;flex-direction:column;gap:4px">
         <div>${costHTML(card.cost)}</div>
         <div>${fxIcons(card.effect)}</div>
       </div>
     </div>`;

  document.getElementById('modal-card-name').textContent = card.nameJP;
  document.getElementById('modal-cost').innerHTML = cr.free
    ? '<span style="color:var(--green-l)">チェーン（無料）</span>'
    : costHTML(card.cost) || '<span style="color:var(--text-dim)">無料</span>';
  document.getElementById('modal-effect').innerHTML = fxText(card.effect);

  const chainRow = document.getElementById('modal-chain-row');
  if (card.chainFrom || card.chainTo) {
    chainRow.style.display = '';
    document.getElementById('modal-chain').textContent =
      [card.chainFrom && `← ${card.chainFrom}`, card.chainTo && `→ ${card.chainTo}`].filter(Boolean).join(' ');
  } else {
    chainRow.style.display = 'none';
  }

  const btnBuild = document.getElementById('btn-build');
  btnBuild.textContent = cr.free ? '建設（無料）' : `建設（${cr.cost}🪙）`;
  btnBuild.disabled = !cr.canAfford;
  document.getElementById('btn-wonder').disabled = !hasWonder;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  G.selectedCard = null;
}

// ── Actions ───────────────────────────────────────
function doBuild() {
  const card = G.selectedCard;
  if (!card) return;
  if (mpMode !== 'local' && !G._replicating) mp_sendEvent({ type: 'build', lid: card._lid });
  const p  = G.players[G.turn];
  const cr = calcCost(card, G.turn);

  // Olympia free build
  const olympia = p.wonders.find(w => w.built && w.id === 'olympia' && (w._freeLeft||0) > 0);
  const totalCost = olympia ? 0 : cr.cost;
  if (olympia) olympia._freeLeft--;

  // Economy token: opponent gains trade coins
  const tradePaid = cr.tradePart || 0;
  if (tradePaid > 0) {
    const opp = G.turn === 1 ? 2 : 1;
    if (G.players[opp].progressTokens.find(t => t.id === 'economy')) {
      G.players[opp].coins += tradePaid;
      addLog(`P${opp} 経済+${tradePaid}🪙`, `p${opp}`);
    }
  }

  // Urbanism token: chain build → +4 coins
  if (cr.free && p.progressTokens.find(t => t.id === 'urbanism')) {
    p.coins += 4;
    addLog(`P${G.turn} 都市計画+4🪙`, `p${G.turn}`);
  }

  p.coins -= totalCost;
  p.builtCards.push(card);
  if (card.chainTo) p.chainSymbols.add(card.id);
  removeCard(card);
  const needPick = applyFx(card.effect, G.turn);
  addLog(`P${G.turn} 建設: ${card.nameJP}（${totalCost}🪙）`, `p${G.turn}`);
  closeModal();
  if (!needPick) afterAction();
}

function doSell() {
  const card = G.selectedCard;
  if (!card) return;
  if (mpMode !== 'local' && !G._replicating) mp_sendEvent({ type: 'sell', lid: card._lid });
  G.players[G.turn].coins += 2;
  removeCard(card);
  G.discard.push(card);
  document.getElementById('discard-count').textContent = G.discard.length;
  addLog(`P${G.turn} 売却: ${card.nameJP} +2🪙`, `p${G.turn}`);
  closeModal();
  afterAction();
}

function doWonder() {
  const card = G.selectedCard;
  if (!card) return;
  G.pendingCard = card;
  closeModal();
  showWonderBuildPicker();
}

function showWonderBuildPicker() {
  const p = G.players[G.turn];
  document.getElementById('draft-title').textContent = 'ワンダーを建設';
  document.getElementById('draft-sub').textContent   = 'どのワンダーを建設しますか？';
  const cards = document.getElementById('draft-cards');
  cards.innerHTML = '';
  p.wonders.filter(w => !w.built).forEach(w => {
    const cr = calcCost(w, G.turn);
    const el = document.createElement('div');
    el.className = 'draft-card';
    el.style.opacity = cr.canAfford ? '1' : '0.5';
    el.innerHTML = `<div class="draft-card-name">${w.nameJP}</div>
      <div class="draft-card-cost">${costHTML(w.cost)}</div>
      <div style="font-size:11px;color:${cr.canAfford?'var(--green-l)':'var(--red-l)'}">
        ${cr.canAfford ? `建設（${cr.cost}🪙）` : `不足（${cr.cost}🪙）`}
      </div>
      <div class="draft-card-effect">${fxText(w.effect)}</div>`;
    if (cr.canAfford) el.onclick = () => {
      if (mpMode !== 'local' && !G._replicating)
        mp_sendEvent({ type: 'wonder_build', lid: G.pendingCard._lid, wonderId: w.id });
      doBuildWonder(w);
    };
    cards.appendChild(el);
  });
  // Cancel — separate from the wonder cards, shown below them
  const cancelWrap = document.createElement('div');
  cancelWrap.style.cssText = 'grid-column:1/-1;display:flex;justify-content:center;margin-top:4px';
  const cx = document.createElement('button');
  cx.id = 'btn-wonder-cancel';
  cx.className = 'mbutton cancel';
  cx.textContent = 'キャンセル';
  cx.onclick = () => {
    document.getElementById('draft-overlay').classList.add('hidden');
    G.selectedCard = G.pendingCard;
    G.pendingCard = null;
    openCardModal(G.selectedCard);
  };
  cancelWrap.appendChild(cx);
  cards.appendChild(cancelWrap);
  document.getElementById('draft-overlay').classList.remove('hidden');
}

function doBuildWonder(wonder) {
  const card = G.pendingCard;
  const p    = G.players[G.turn];
  const cr   = calcCost(wonder, G.turn);
  p.coins -= cr.cost;
  wonder.built = true;
  removeCard(card);
  G.discard.push(card);
  document.getElementById('discard-count').textContent = G.discard.length;
  addLog(`P${G.turn} ワンダー建設: ${wonder.nameJP}（${card.nameJP} 使用）`, `p${G.turn}`);
  document.getElementById('draft-overlay').classList.add('hidden');
  G.pendingCard = null;
  const playAgain = applyWonderFx(wonder, G.turn);
  if (!playAgain) afterAction();
}

// ── Resource & Cost ───────────────────────────────
function getRes(n) {
  const p = G.players[n];
  const fixed = { wood:0,stone:0,clay:0,ore:0,glass:0,papyrus:0 };
  const choices = [];
  const ft = new Set(); // fixed trades
  p.builtCards.forEach(c => {
    const e = c.effect||{};
    if (e.res) Object.entries(e.res).forEach(([r,a]) => fixed[r] = (fixed[r]||0)+a);
    if (e.choice) choices.push([...e.choice]);
    if (e.fixedTrade) ft.add(e.fixedTrade);
  });
  p.wonders.filter(w => w.built).forEach(w => {
    const e = w.effect||{};
    if (e.produceAnyRawMaterial)  choices.push([...RAW_RES]);
    if (e.produceAnyManufactured) choices.push([...MFG_RES]);
  });
  return { fixed, choices, ft };
}

function tradeRate(res, playerNum) {
  const { ft } = getRes(playerNum);
  const oppFixed = getRes(playerNum === 1 ? 2 : 1).fixed;
  if (ft.has(res)) return 1;
  if (RAW_RES.includes(res) && ft.has('raw')) return 1;
  if (MFG_RES.includes(res) && ft.has('manufactured')) return 1;
  return 2 + (oppFixed[res] || 0);
}

function calcCost(item, n) {
  const p    = G.players[n];
  const cost = item.cost || {};

  // Chain
  if (item.chainFrom && p.chainSymbols.has(item.chainFrom))
    return { free:true, cost:0, tradePart:0, canAfford:true };

  // Architecture token (wonder costs -2 resource trade)
  let archDiscount = 0;
  const isWonder = WONDER_CARDS.some(w => w.id === item.id);
  if (isWonder && p.progressTokens.find(t => t.id === 'architecture'))
    archDiscount = 2;

  // Masonry (-2 cost on civilian cards)
  let masonDiscount = 0;
  if (item.color === 'blue' && p.progressTokens.find(t => t.id === 'masonry'))
    masonDiscount = 2;

  const { fixed, choices } = getRes(n);
  const need = {};
  Object.entries(cost).forEach(([r,a]) => {
    if (r === 'coins' || !a) return;
    const still = Math.max(0, a - (fixed[r]||0));
    if (still > 0) need[r] = still;
  });

  // Apply choices greedily (fill most expensive unfulfilled first)
  const ch = choices.map(g => [...g]);
  ch.forEach(group => {
    let best = null, bestRate = -1;
    group.forEach(r => {
      if (need[r] && tradeRate(r,n) > bestRate) { best = r; bestRate = tradeRate(r,n); }
    });
    if (best) { need[best]--; if (need[best] <= 0) delete need[best]; }
  });

  let trade = 0;
  Object.entries(need).forEach(([r,a]) => trade += tradeRate(r,n) * a);
  trade = Math.max(0, trade - archDiscount);

  const coinBase = cost.coins || 0;
  const total    = Math.max(0, coinBase + trade - masonDiscount);

  return { free:false, cost:total, tradePart:trade, canAfford: p.coins >= total };
}

// ── Apply Effects ─────────────────────────────────
function applyFx(e, n) {
  if (!e) return false;
  const p    = G.players[n];
  const oppN = n===1 ? 2 : 1;
  const opp  = G.players[oppN];

  if (e.coins) { p.coins += e.coins; addLog(`P${n} +${e.coins}🪙`, `p${n}`); }

  if (e.coinsPerBrown) {
    const cnt = p.builtCards.filter(c=>c.color==='brown'||c.color==='grey').length
              + opp.builtCards.filter(c=>c.color==='brown'||c.color==='grey').length;
    if (cnt) { p.coins += e.coinsPerBrown * cnt; addLog(`P${n} +${e.coinsPerBrown*cnt}🪙（茶/灰）`, `p${n}`); }
  }
  if (e.coinsPerYellow) {
    const cnt = p.builtCards.filter(c=>c.color==='yellow').length
              + opp.builtCards.filter(c=>c.color==='yellow').length;
    if (cnt) { p.coins += e.coinsPerYellow * cnt; addLog(`P${n} +${e.coinsPerYellow*cnt}🪙（黄）`, `p${n}`); }
  }
  if (e.coinsPerGrey) {
    const cnt = p.builtCards.filter(c=>c.color==='grey').length
              + opp.builtCards.filter(c=>c.color==='grey').length;
    if (cnt) { p.coins += e.coinsPerGrey * cnt; addLog(`P${n} +${e.coinsPerGrey*cnt}🪙（灰）`, `p${n}`); }
  }
  if (e.coinsPerWonder) {
    const wc = p.wonders.filter(w=>w.built).length + opp.wonders.filter(w=>w.built).length;
    if (wc) { p.coins += e.coinsPerWonder * wc; addLog(`P${n} +${e.coinsPerWonder*wc}🪙（ワンダー）`, `p${n}`); }
  }

  if (e.shields) moveConflict(e.shields, n);

  if (e.science) {
    if (gainScience(e.science, n)) return true;
  }
  return false;
}

function applyWonderFx(w, n) {
  const e   = w.effect || {};
  const p   = G.players[n];
  const opp = n===1?2:1;

  if (e.coins)             { p.coins += e.coins; addLog(`P${n} +${e.coins}🪙`, `p${n}`); }
  if (e.shields)           moveConflict(e.shields, n);
  if (e.opponentLosesCoins) {
    const lost = Math.min(G.players[opp].coins, e.opponentLosesCoins);
    G.players[opp].coins = Math.max(0, G.players[opp].coins - e.opponentLosesCoins);
    addLog(`P${opp} -${lost}🪙（${w.nameJP}）`, `p${opp}`);
  }

  renderAll();

  if (e.destroyOpponentCard) {
    const targets = G.players[opp].builtCards.filter(c => c.color === e.destroyOpponentCard);
    if (targets.length) { showDestroyPicker(targets, opp, w.nameJP, e.playAgain, e.looteCoinsPerDestroyed||false, n); return e.playAgain||false; }
  }
  if (e.draw3ProgressTokens) {
    const avail = G.boardTokens.filter(t => !t.taken);
    const pool  = shuffle([...avail]).slice(0, Math.min(3, avail.length));
    G.afterPick = () => afterAction(e.playAgain);
    showTokenPicker(pool, n);
    return true;
  }
  if (e.buildFromDiscard) {
    G.afterPick = () => afterAction(e.playAgain);
    showDiscardPicker(n);
    return true;
  }
  if (checkVictory()) return false;
  return e.playAgain || false;
}

// ── Military ──────────────────────────────────────
function moveConflict(shields, n) {
  const dir  = n === 1 ? 1 : -1;
  const prev = G.militaryPawn;
  G.militaryPawn = Math.max(-9, Math.min(9, G.militaryPawn + shields * dir));
  addLog(`⚔ 位置 ${prev}→${G.militaryPawn}（P${n}+${shields}🛡）`, `p${n}`);

  const checkPts = n === 1 ? [3,6,9] : [-3,-6,-9];
  checkPts.forEach(pos => {
    if (!G.milUsed.has(pos)) {
      const crossed = n === 1 ? (prev < pos && G.militaryPawn >= pos)
                               : (prev > pos && G.militaryPawn <= pos);
      if (crossed) triggerMilToken(pos);
    }
  });
  placePawn();
}

function triggerMilToken(pos) {
  G.milUsed.add(pos);
  const loser  = pos > 0 ? 2 : 1;
  const amount = [3,-3].includes(pos) ? 2 : [6,-6].includes(pos) ? 5 : 0;
  if (amount) {
    const lost = Math.min(G.players[loser].coins, amount);
    G.players[loser].coins = Math.max(0, G.players[loser].coins - amount);
    addLog(`P${loser} 軍事ペナルティ -${lost}🪙`, `p${loser}`);
  }
  if (Math.abs(pos) === 9) {
    endGame(pos > 0 ? 1 : 2, '軍事覇権による勝利');
  }
}

// ── Science ───────────────────────────────────────
function gainScience(sym, n) {
  const p   = G.players[n];
  const syms = [
    ...p.builtCards.filter(c => c.effect?.science).map(c => c.effect.science),
    ...p.progressTokens.filter(t => t.effect?.science).map(t => t.effect.science),
  ];
  const counts = {};
  syms.forEach(s => counts[s] = (counts[s]||0)+1);

  if (Object.keys(counts).length >= 6) {
    endGame(n, '科学覇権による勝利');
    return false;
  }

  if (counts[sym] >= 2) {
    const avail = G.boardTokens.filter(t => !t.taken);
    if (avail.length) {
      addLog(`P${n} 科学ペア(${SCI_SYM[sym]}) → トークン選択`, `p${n}`);
      G.afterPick = () => afterAction();
      showTokenPicker(avail, n);
      return true;
    }
  }
  return false;
}

// ── Progress Token Picker ─────────────────────────
function showTokenPicker(pool, n) {
  // MP: 複製中（相手のアクション適用中）はオーバーレイを表示しない
  if (G._replicating) return;

  document.getElementById('draft-title').textContent = 'プログレストークン選択';
  document.getElementById('draft-sub').textContent   = `Player ${n} — 1つ選んでください`;
  const cards = document.getElementById('draft-cards');
  cards.innerHTML = '';
  pool.forEach(t => {
    const el = document.createElement('div');
    el.className = 'draft-card';
    el.innerHTML = `<div class="prog-token-icon" style="font-size:28px">${TOKEN_ICON[t.id]||'?'}</div>
      <div class="draft-card-name">${t.nameJP}</div>
      <div class="draft-card-effect">${fxText(t.effect)}</div>`;
    el.onclick = () => {
      if (mpMode !== 'local') mp_sendEvent({ type: 'token_pick', tokenId: t.id });
      gainToken(t, n);
      document.getElementById('draft-overlay').classList.add('hidden');
      if (G.afterPick) { G.afterPick(); G.afterPick = null; }
    };
    cards.appendChild(el);
  });
  document.getElementById('draft-overlay').classList.remove('hidden');
}

function gainToken(token, n) {
  token.taken = true;
  G.players[n].progressTokens.push(token);
  addLog(`P${n} トークン獲得: ${token.nameJP}`, `p${n}`);
  const e = token.effect || {};
  if (e.immediateCoins) { G.players[n].coins += e.immediateCoins; addLog(`P${n} +${e.immediateCoins}🪙（農業）`, `p${n}`); }
  if (e.science) gainScience(e.science, n);
  renderAll();
}

// ── Destroy Picker ────────────────────────────────
function showDestroyPicker(targets, victimN, wonderName, playAgain, loot=false, attackerN=null) {
  // コンテキストを保存（MP時に相手側で復元するため）
  G._pickerCtx = { type:'destroy', victimN, playAgain, loot, attackerN };
  // MP: 複製中はオーバーレイを表示しない（相手が選択するため）
  if (G._replicating) return;

  document.getElementById('draft-title').textContent = `${wonderName} — カード破壊`;
  document.getElementById('draft-sub').textContent   = `P${victimN} のカードを1枚選択`;
  const cards = document.getElementById('draft-cards');
  cards.innerHTML = '';
  targets.forEach(card => {
    const el = document.createElement('div');
    el.className = `draft-card game-card ${card.color}`;
    el.style.cssText = 'width:110px;padding:10px';
    const lootAmt = loot ? (card.effect?.coins || 0) : 0;
    el.innerHTML = `<div style="font-size:12px;font-weight:700;color:#fff">${card.nameJP}</div>
      <div style="margin-top:4px">${fxIcons(card.effect)}</div>
      ${loot && lootAmt ? `<div style="font-size:9px;color:var(--yellow-l);margin-top:3px">略奪+${lootAmt}🪙</div>` : ''}`;
    el.onclick = () => {
      if (mpMode !== 'local') mp_sendEvent({ type: 'destroy_pick', cardId: card.id });
      G.players[victimN].builtCards = G.players[victimN].builtCards.filter(c => c !== card);
      G.discard.push(card);
      addLog(`P${victimN} ${card.nameJP} 破壊`, `p${victimN}`);
      if (loot && attackerN && lootAmt > 0) {
        G.players[attackerN].coins += lootAmt;
        addLog(`P${attackerN} 略奪+${lootAmt}🪙`, `p${attackerN}`);
      }
      document.getElementById('draft-overlay').classList.add('hidden');
      G._pickerCtx = null;
      renderAll();
      afterAction(playAgain);
    };
    cards.appendChild(el);
  });
  document.getElementById('draft-overlay').classList.remove('hidden');
}

// ── Discard Picker ────────────────────────────────
function showDiscardPicker(n) {
  if (!G.discard.length) { addLog('捨て札なし', 'sys'); afterAction(); return; }
  // MP: 複製中はオーバーレイを表示しない（discard_pick イベントを待つ）
  if (G._replicating) return;

  document.getElementById('draft-title').textContent = 'マウソロス — 捨て札から建設';
  document.getElementById('draft-sub').textContent   = '1枚選んで無料で建設';
  const cards = document.getElementById('draft-cards');
  cards.innerHTML = '';
  G.discard.forEach(card => {
    const el = document.createElement('div');
    el.className = `draft-card game-card ${card.color}`;
    el.style.cssText = 'width:110px;padding:10px';
    el.innerHTML = `<div style="font-size:11px;font-weight:700;color:#fff">${card.nameJP}</div>`;
    el.onclick = () => {
      if (mpMode !== 'local') mp_sendEvent({ type: 'discard_pick', cardId: card.id });
      G.discard = G.discard.filter(c => c !== card);
      G.players[n].builtCards.push(card);
      if (card.chainTo) G.players[n].chainSymbols.add(card.id);
      applyFx(card.effect, n);
      addLog(`P${n} 捨て札から建設: ${card.nameJP}`, `p${n}`);
      document.getElementById('draft-overlay').classList.add('hidden');
      renderAll();
      afterAction();
    };
    cards.appendChild(el);
  });
  document.getElementById('draft-overlay').classList.remove('hidden');
}

// ── Turn Flow ─────────────────────────────────────
function afterAction(playAgain = false) {
  renderAll();
  if (checkVictory()) return;
  if (!checkAgeEnd() && G.phase === 'play' && !playAgain) switchTurn();
}

function switchTurn() {
  G.turn = G.turn === 1 ? 2 : 1;
  updateTurnLabel();
}

function checkAgeEnd() {
  if (G.ageCards.length === 0 && G.phase === 'play') {
    if (G.age < 3) {
      if (G.militaryPawn > 0) G.turn = 2;
      else if (G.militaryPawn < 0) G.turn = 1;
      startAge(G.age + 1);
    } else {
      finalScoring();
    }
    return true;
  }
  return false;
}

function checkVictory() { return G.phase === 'end'; }

// ── Scoring ───────────────────────────────────────
function liveVP(n) {
  const p = G.players[n];
  const theologyMult = p.progressTokens.some(t=>t.id==='theology') ? 2 : 1;
  let v = p.builtCards.filter(c=>c.color==='blue').reduce((s,c)=>s+(c.effect?.vp||0),0);
  v += p.wonders.filter(w=>w.built).reduce((s,w)=>s+(w.effect?.vp||0)*theologyMult,0);
  v += Math.floor(p.coins/3);
  const pos = n===1 ? G.militaryPawn : -G.militaryPawn;
  if (pos>=9) v+=10; else if (pos>=6) v+=5; else if (pos>=3) v+=2; else if (pos>=1) v+=1;
  p.progressTokens.forEach(t => { if (t.effect?.endVP) v += t.effect.endVP; });
  return v;
}

function finalScoring() {
  const s1 = fullScore(1), s2 = fullScore(2);
  let winner = s1.total > s2.total ? 1 : s2.total > s1.total ? 2 : 0;
  if (winner === 0) { // tiebreak: more civilian VPs
    winner = s1.blue > s2.blue ? 1 : s2.blue > s1.blue ? 2 : 0;
  }
  endGame(winner, `最終得点: P1 ${s1.total}VP / P2 ${s2.total}VP`, s1, s2);
}

function fullScore(n) {
  const p   = G.players[n];
  const opp = G.players[n===1?2:1];
  const s   = { blue:0, wonder:0, coin:0, military:0, token:0, guild:0, total:0 };
  const theologyMult = p.progressTokens.some(t=>t.id==='theology') ? 2 : 1;

  s.blue   = p.builtCards.filter(c=>c.color==='blue').reduce((x,c)=>x+(c.effect?.vp||0),0);
  s.wonder = p.wonders.filter(w=>w.built).reduce((x,w)=>x+(w.effect?.vp||0)*theologyMult,0);
  s.coin   = Math.floor(p.coins/3);

  const pos = n===1 ? G.militaryPawn : -G.militaryPawn;
  if (pos>=9) s.military=10; else if (pos>=6) s.military=5;
  else if (pos>=3) s.military=2; else if (pos>=1) s.military=1;

  p.progressTokens.forEach(t => {
    const e = t.effect||{};
    if (e.endVP) s.token += e.endVP;
    if (t.id === 'mathematics') s.token += 3 * p.progressTokens.length;
  });

  // Guilds & end-game yellow effects
  p.builtCards.forEach(card => {
    const e = card.effect||{};
    const both = (col) => p.builtCards.filter(c=>c.color===col).length + opp.builtCards.filter(c=>c.color===col).length;
    const bothW = () => p.wonders.filter(w=>w.built).length + opp.wonders.filter(w=>w.built).length;
    if (card.color === 'purple') {
      if (e.vpPerYellow)    { const k=both('yellow'); s.guild+=k; p.coins+=k; }
      if (e.vpPerBlue)      { const k=both('blue');   s.guild+=k; p.coins+=k; }
      if (e.vpPerRed)       { const k=both('red');    s.guild+=k; p.coins+=k; }
      if (e.vpPerThreeCoins){ s.guild += Math.floor(p.coins/3); }
      if (e.vpPerWonder)    { const k=bothW(); s.guild+=k*2; p.coins+=k; }
      if (e.vpPerColorCard) { e.vpPerColorCard.colors.forEach(col => { s.guild += both(col); }); }
    }
    // Yellow end-game VPs (count both players)
    if (card.id === 'arena' || card.id === 'lighthouse' || card.id === 'port' || card.id === 'chamber') {
      s.guild += card.effect?.vp || 0;
      if (card.id === 'arena')     { const k=bothW();          s.guild+=k;   p.coins+=k*2; }
      if (card.id === 'lighthouse'){ const k=both('yellow');   s.guild+=k;   p.coins+=k;   }
      if (card.id === 'port')      { const k=p.builtCards.filter(c=>c.color==='brown'||c.color==='grey').length
                                             + opp.builtCards.filter(c=>c.color==='brown'||c.color==='grey').length;
                                     s.guild+=k; p.coins+=k; }
      if (card.id === 'chamber')   { const k=both('grey');     s.guild+=k*2; p.coins+=k*2; }
    }
  });

  s.total = s.blue + s.wonder + s.coin + s.military + s.token + s.guild;
  return s;
}

// ── End Game ──────────────────────────────────────
function endGame(winner, reason, s1, s2) {
  G.phase = 'end';
  document.getElementById('victory-title').textContent  = winner ? `🏆 Player ${winner} の勝利！` : '引き分け！';
  document.getElementById('victory-reason').textContent = reason;

  const scoreEl = document.getElementById('victory-scores');
  if (s1 && s2) {
    const rows = [['文明',s1.blue,s2.blue],['ワンダー',s1.wonder,s2.wonder],['コイン',s1.coin,s2.coin],
                  ['軍事',s1.military,s2.military],['トークン',s1.token,s2.token],['ギルド/黄',s1.guild,s2.guild],
                  ['合計',s1.total,s2.total]];
    scoreEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr auto auto;gap:3px 12px;font-size:13px">
      <span></span><span style="color:var(--p1-col);font-weight:700">P1</span><span style="color:var(--p2-col);font-weight:700">P2</span>
      ${rows.map(([l,a,b])=>`<span${l==='合計'?' style="font-weight:700"':''}>${l}</span>
        <span${l==='合計'?' style="font-weight:700;color:var(--p1-col)"':''}>${a}</span>
        <span${l==='合計'?' style="font-weight:700;color:var(--p2-col)"':''}>${b}</span>`).join('')}
    </div>`;
  } else { scoreEl.innerHTML = ''; }

  document.getElementById('victory-overlay').classList.remove('hidden');
  renderAll();
}

// ── Helpers ───────────────────────────────────────
function removeCard(card) {
  G.ageCards = G.ageCards.filter(c => c._lid !== card._lid);
  updateAvail();
}

function shuffle(a) {
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(_rng()*(i+1));   // _rng = seeded in MP, Math.random in local
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function addLog(msg, cls='sys') {
  const li = document.createElement('li');
  li.className = cls;
  li.textContent = msg;
  document.getElementById('log-list').prepend(li);
  const list = document.getElementById('log-list');
  while (list.children.length > 60) list.lastElementChild.remove();
}

// ── Icon / Text helpers ───────────────────────────
function costHTML(cost) {
  if (!cost) return '';
  const map = { coins:'icon-coin round', wood:'icon-wood', stone:'icon-stone', clay:'icon-clay',
                ore:'icon-ore', glass:'icon-glass', papyrus:'icon-papyrus' };
  return Object.entries(cost).filter(([,a])=>a).map(([r,a]) =>
    `<span class="icon ${map[r]||''}">${r==='coins'?a:(a>1?a:'')+(RES_JP[r]||r[0])}</span>`
  ).join('');
}

function fxIcons(e) {
  if (!e) return '';
  const parts = [];
  if (e.vp)             parts.push(`<span class="icon icon-vp">${e.vp}</span>`);
  if (e.shields)        parts.push(`<span class="icon icon-shield">${e.shields}</span>`);
  if (e.coins)          parts.push(`<span class="icon icon-coin round">+${e.coins}</span>`);
  if (e.science)        parts.push(`<span class="icon icon-sci-${e.science}">${SCI_SYM[e.science]||'?'}</span>`);
  if (e.res)            Object.entries(e.res).forEach(([r,a]) =>
    parts.push(`<span class="icon icon-${r}">${a>1?a:''}${RES_JP[r]||r[0]}</span>`));
  if (e.choice)         parts.push(`<span style="font-size:8px;color:rgba(255,255,255,.7)">${e.choice.map(r=>RES_JP[r]).join('/')}</span>`);
  if (e.fixedTrade)     parts.push(`<span style="font-size:8px;color:var(--yellow-l)">${e.fixedTrade==='raw'?'原料':'商品'}1🪙</span>`);
  if (e.vpPerWonder)    parts.push(`<span style="font-size:8px;color:var(--yellow-l)">W×VP</span>`);
  if (e.vpPerYellow)    parts.push(`<span style="font-size:8px;color:var(--yellow-l)">黄×VP</span>`);
  if (e.vpPerBlue)      parts.push(`<span style="font-size:8px;color:var(--blue-l)">青×VP</span>`);
  if (e.vpPerRed)       parts.push(`<span style="font-size:8px;color:var(--red-l)">赤×VP</span>`);
  if (e.vpPerColorCard) parts.push(`<span style="font-size:8px;color:var(--purple-l)">色×VP</span>`);
  if (e.vpPerThreeCoins)parts.push(`<span style="font-size:8px;color:var(--yellow-l)">💰×VP</span>`);
  if (e.coinsPerWonder) parts.push(`<span style="font-size:8px;color:var(--yellow-l)">W×🪙</span>`);
  if (e.coinsPerGrey)   parts.push(`<span style="font-size:8px;color:var(--grey-l)">灰×🪙</span>`);
  if (e.playAgain)      parts.push(`<span style="font-size:8px;color:var(--green-l)">+手番</span>`);
  if (e.destroyOpponentCard) parts.push(`<span style="font-size:8px;color:var(--red-l)">💥${e.destroyOpponentCard}</span>`);
  if (e.buildFromDiscard)    parts.push(`<span style="font-size:8px;color:var(--text-dim)">捨→建</span>`);
  if (e.draw3ProgressTokens) parts.push(`<span style="font-size:8px;color:var(--yellow-l)">T3択</span>`);
  return parts.join('');
}

function fxText(e) {
  if (!e) return '—';
  const p = [];
  if (e.vp)                  p.push(`+${e.vp}VP`);
  if (e.shields)             p.push(`+${e.shields}🛡`);
  if (e.coins)               p.push(`+${e.coins}🪙`);
  if (e.science)             p.push(`科学:${SCI_SYM[e.science]}`);
  if (e.res)                 p.push(Object.entries(e.res).map(([r,a])=>`+${a}${RES_JP[r]}`).join(' '));
  if (e.choice)              p.push(e.choice.map(r=>RES_JP[r]).join('/'));
  if (e.fixedTrade)          p.push(`${e.fixedTrade}取引コスト1固定`);
  if (e.playAgain)           p.push('もう1手番');
  if (e.destroyOpponentCard) p.push(`相手の${e.destroyOpponentCard}破壊`);
  if (e.buildFromDiscard)    p.push('捨て札から無料建設');
  if (e.draw3ProgressTokens) p.push('トークン3択1');
  if (e.buildOneFreeOncePerAge) p.push('毎Ageに1回無料建設');
  if (e.opponentLosesCoins)  p.push(`相手-${e.opponentLosesCoins}🪙`);
  if (e.produceAnyRawMaterial)  p.push('原料どれか1');
  if (e.produceAnyManufactured) p.push('商品どれか1');
  if (e.immediateCoins)      p.push(`即時+${e.immediateCoins}🪙`);
  if (e.endVP)               p.push(`終了時+${e.endVP}VP`);
  if (e.wonderCostReduction) p.push(`ワンダーコスト-${e.wonderCostReduction}`);
  if (e.civilianCostReduction)p.push(`文明コスト-${e.civilianCostReduction}`);
  if (e.gainOpponentTradeCost)p.push('相手の取引コイン獲得');
  if (e.chainBuildCoins)     p.push(`チェーン建設+${e.chainBuildCoins}🪙`);
  if (e.extraShieldAfterAge) p.push(`各Age後+${e.extraShieldAfterAge}🛡`);
  if (e.vpPer3Tokens)        p.push('トークン×3VP');
  if (e.vpPerWonder)         p.push('ワンダー×2VP+1🪙');
  if (e.vpPerYellow)         p.push('黄×1VP+1🪙');
  if (e.vpPerBlue)           p.push('青×1VP+1🪙');
  if (e.vpPerRed)            p.push('赤×1VP+1🪙');
  if (e.vpPerColorCard)      p.push((e.vpPerColorCard.colors||[]).join('/') + '×1VP');
  if (e.vpPerThreeCoins)     p.push('3🪙=1VP');
  if (e.coinsPerWonder)      p.push(`ワンダー×${e.coinsPerWonder}🪙`);
  if (e.coinsPerGrey)        p.push(`灰×${e.coinsPerGrey}🪙`);
  if (e.wondersCountDouble)  p.push('ワンダーVP×2');
  if (e.looteCoinsPerDestroyed) p.push('破壊→コイン略奪');
  return p.join(' | ') || '—';
}

// ── Tooltip ───────────────────────────────────────
const _tip = document.getElementById('tooltip');
let _tipTarget = null;

function tipShow(el, html) {
  _tipTarget = el;
  _tip.innerHTML = html;
  _tip.classList.remove('hidden');
  el.addEventListener('mousemove',  _tipMove);
  el.addEventListener('mouseleave', _tipHide);
}
function _tipMove(e) {
  const W = window.innerWidth, H = window.innerHeight;
  const tw = _tip.offsetWidth + 16, th = _tip.offsetHeight + 16;
  _tip.style.left = (e.clientX + 14 + tw > W ? e.clientX - tw + 14 : e.clientX + 14) + 'px';
  _tip.style.top  = (e.clientY + 14 + th > H ? e.clientY - th + 14 : e.clientY + 14) + 'px';
}
function _tipHide() {
  _tip.classList.add('hidden');
  if (_tipTarget) {
    _tipTarget.removeEventListener('mousemove',  _tipMove);
    _tipTarget.removeEventListener('mouseleave', _tipHide);
    _tipTarget = null;
  }
}

function cardTipHTML(card) {
  const cr = calcCost(card, G.turn);
  const chainInfo = [card.chainFrom && `← ${card.chainFrom}`, card.chainTo && `→ ${card.chainTo}`]
    .filter(Boolean).join('  ');
  const costPart = cr.free
    ? `<span style="color:var(--green-l)">チェーン（無料）</span>`
    : (costHTML(card.cost) || `<span style="color:var(--green-l)">無料</span>`);
  const canAffordStyle = cr.canAfford ? 'color:var(--green-l)' : 'color:var(--red-l)';
  return `<div style="font-weight:700;font-size:12px;margin-bottom:4px">${card.nameJP}</div>
    <div style="margin-bottom:3px">コスト: ${costPart}
      ${!cr.free && cr.cost > 0 ? `<span style="${canAffordStyle};font-size:10px"> (${cr.cost}🪙)</span>` : ''}
    </div>
    <div style="color:var(--text-dim);font-size:10px;margin-bottom:3px">${fxText(card.effect)}</div>
    ${chainInfo ? `<div style="color:#888;font-size:9px">${chainInfo}</div>` : ''}`;
}

function wonderTipHTML(w) {
  return `<div style="font-weight:700;font-size:12px;margin-bottom:4px">${w.nameJP}</div>
    <div style="margin-bottom:3px">コスト: ${costHTML(w.cost)||'無料'}</div>
    <div style="color:var(--text-dim);font-size:10px">${fxText(w.effect)}</div>
    ${w.built ? '<div style="color:var(--yellow-l);font-size:10px;margin-top:3px">✓ 建設済</div>' : ''}`;
}

function tokenTipHTML(t) {
  return `<div style="font-weight:700;font-size:12px;margin-bottom:4px">${TOKEN_ICON[t.id]||'?'} ${t.nameJP}</div>
    <div style="color:var(--text-dim);font-size:10px">${fxText(t.effect)}</div>
    ${t.taken ? '<div style="color:var(--text-dim);font-size:9px;margin-top:3px">取得済み</div>' : ''}`;
}

// ── Multiplayer (PeerJS P2P) ─────────────────────────────────────────
// 完全無料: PeerJS公式CDNのシグナリングサーバー経由でWebRTC直接接続
// ─────────────────────────────────────────────────────────────────────

/** ロビー表示 */
function mp_init() {
  document.getElementById('mp-overlay').classList.remove('hidden');

  document.getElementById('btn-local').onclick = () => {
    mpMode = 'local'; myPlayerNum = 1;
    document.getElementById('mp-overlay').classList.add('hidden');
    initGame();
  };

  document.getElementById('btn-host').onclick = () => {
    document.getElementById('mp-host-panel').classList.remove('hidden');
    document.getElementById('mp-join-panel').classList.add('hidden');
    mp_createRoom();
  };

  document.getElementById('btn-join-open').onclick = () => {
    document.getElementById('mp-join-panel').classList.remove('hidden');
    document.getElementById('mp-host-panel').classList.add('hidden');
  };

  document.getElementById('btn-join-room').onclick = () => {
    const code = document.getElementById('mp-room-input').value.trim().toUpperCase();
    if (code.length >= 4) mp_joinRoom(code);
    else mp_setStatus('ルームコードを入力してください');
  };

  document.getElementById('mp-room-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-join-room').click();
  });

  document.getElementById('btn-copy-code').onclick = () => {
    const code = document.getElementById('mp-room-display').textContent;
    navigator.clipboard?.writeText(code).then(() => mp_setStatus('コピーしました！'));
  };
}

/** ルーム作成（ホスト） */
function mp_createRoom() {
  mp_setStatus('接続中...');
  const code = Math.random().toString(36).substr(2, 6).toUpperCase();

  // PeerJS公式サーバー（無料・登録不要）を使用
  mpPeer = new Peer('7wd-' + code.toLowerCase());

  mpPeer.on('open', () => {
    document.getElementById('mp-room-display').textContent = code;
    document.getElementById('mp-room-code-wrap').classList.remove('hidden');
    document.getElementById('mp-waiting-msg').classList.remove('hidden');
    mp_setStatus('');
    mpMode = 'host'; myPlayerNum = 1;
  });

  mpPeer.on('connection', conn => {
    mpConn = conn;
    mp_setupConn(conn, () => {
      document.getElementById('mp-overlay').classList.add('hidden');
      mp_updateIndicator();
      initGame();
    });
  });

  mpPeer.on('error', err => mp_setStatus('エラー: ' + (err.message || err.type)));
}

/** ルーム参加（ゲスト） */
function mp_joinRoom(code) {
  mp_setStatus('接続中...');
  mpMode = 'guest'; myPlayerNum = 2;

  mpPeer = new Peer();
  mpPeer.on('open', () => {
    mpConn = mpPeer.connect('7wd-' + code.toLowerCase());
    mp_setupConn(mpConn, () => {
      document.getElementById('mp-overlay').classList.add('hidden');
      mp_setStatus('ゲームを待っています...');
      mp_updateIndicator();
    });
  });
  mpPeer.on('error', err => {
    mp_setStatus('接続失敗: ' + (err.message || err.type));
    mpMode = 'local';
  });
}

/** DataConnection の共通セットアップ */
function mp_setupConn(conn, onOpen) {
  conn.on('open', onOpen);

  conn.on('data', data => {
    if (data.type === 'game_start') {
      // ゲスト: ホストから受け取ったseedで同一ゲームを再現
      initGame(data.seed);
    } else {
      mp_applyEvent(data);
    }
  });

  conn.on('close', () => {
    mp_updateIndicator(true);
    addLog('⚠ 相手が切断しました', 'sys');
  });
  conn.on('error', err => {
    mp_updateIndicator(true);
    addLog('⚠ 接続エラー: ' + (err.message || err), 'sys');
  });
}

/** イベントを相手に送信 */
function mp_sendEvent(ev) {
  if (mpConn?.open) mpConn.send(ev);
}

/** 受信イベントを適用（replicatingフラグ付き） */
function mp_applyEvent(ev) {
  G._replicating = true;
  try {
    switch (ev.type) {

      case 'wonder_draft': {
        const w = G.draftPool.find(w => w.id === ev.wonderId && !w.picked);
        if (w) pickWonder(w, DRAFT_ORDER[G.draftPick]);
        break;
      }

      case 'build': {
        const card = G.ageCards.find(c => c._lid === ev.lid);
        if (card) { G.selectedCard = card; doBuild(); }
        break;
      }

      case 'sell': {
        const card = G.ageCards.find(c => c._lid === ev.lid);
        if (card) { G.selectedCard = card; doSell(); }
        break;
      }

      case 'wonder_build': {
        const card   = G.ageCards.find(c => c._lid === ev.lid);
        const wonder = card && G.players[G.turn].wonders.find(w => w.id === ev.wonderId);
        if (card && wonder) { G.pendingCard = card; doBuildWonder(wonder); }
        break;
      }

      case 'token_pick': {
        const token = G.boardTokens.find(t => t.id === ev.tokenId && !t.taken);
        if (token) {
          gainToken(token, G.turn);
          document.getElementById('draft-overlay').classList.add('hidden');
          if (G.afterPick) { G.afterPick(); G.afterPick = null; }
        }
        break;
      }

      case 'destroy_pick': {
        const ctx = G._pickerCtx;
        if (!ctx) break;
        const card = G.players[ctx.victimN].builtCards.find(c => c.id === ev.cardId);
        if (!card) break;
        G.players[ctx.victimN].builtCards = G.players[ctx.victimN].builtCards.filter(c => c !== card);
        G.discard.push(card);
        addLog(`P${ctx.victimN} ${card.nameJP} 破壊`, `p${ctx.victimN}`);
        if (ctx.loot && ctx.attackerN) {
          const lootAmt = card.effect?.coins || 0;
          if (lootAmt > 0) { G.players[ctx.attackerN].coins += lootAmt; addLog(`P${ctx.attackerN} 略奪+${lootAmt}🪙`, `p${ctx.attackerN}`); }
        }
        document.getElementById('draft-overlay').classList.add('hidden');
        G._pickerCtx = null;
        renderAll();
        afterAction(ctx.playAgain);
        break;
      }

      case 'discard_pick': {
        const n    = G.turn;
        const card = G.discard.find(c => c.id === ev.cardId);
        if (!card) break;
        G.discard = G.discard.filter(c => c !== card);
        G.players[n].builtCards.push(card);
        if (card.chainTo) G.players[n].chainSymbols.add(card.id);
        applyFx(card.effect, n);
        addLog(`P${n} 捨て札から建設: ${card.nameJP}`, `p${n}`);
        document.getElementById('draft-overlay').classList.add('hidden');
        renderAll();
        if (G.afterPick) { G.afterPick(); G.afterPick = null; }
        else afterAction();
        break;
      }
    }
  } finally {
    G._replicating = false;
  }
}

/** ヘッダーの接続インジケーター更新 */
function mp_updateIndicator(disconnected = false) {
  const el = document.getElementById('mp-indicator');
  if (!el) return;
  if (mpMode === 'local') { el.style.display = 'none'; return; }
  el.style.display = 'inline-block';
  if (disconnected) {
    el.textContent = '⚠ 切断'; el.style.color = 'var(--red-l)';
  } else {
    el.textContent = mpMode === 'host' ? '🟢 P1 (ホスト)' : '🟢 P2 (ゲスト)';
    el.style.color = mpMode === 'host' ? 'var(--p1-col)' : 'var(--p2-col)';
  }
}

function mp_setStatus(msg) {
  const el = document.getElementById('mp-status');
  if (el) el.textContent = msg;
}

// ── Event listeners ───────────────────────────────
document.getElementById('btn-new-game').addEventListener('click', initGame);
document.getElementById('btn-build').addEventListener('click', doBuild);
document.getElementById('btn-sell').addEventListener('click', doSell);
document.getElementById('btn-wonder').addEventListener('click', doWonder);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('btn-play-again').addEventListener('click', initGame);

// ── Boot ──────────────────────────────────────────
mp_init();
