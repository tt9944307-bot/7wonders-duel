// 7 Wonders Duel — Game Data

// ── Science Symbols ──────────────────────────────────────────────
const SCI = { TABLET:'tablet', COMPASS:'compass', GEAR:'gear', MORTAR:'mortar', WHEEL:'wheel', ASTROLABE:'astrolabe', LAW:'law' };

// ── Age I Cards (23) ─────────────────────────────────────────────
const AGE1_CARDS = [
  // Brown – Raw Materials (6)
  { id:'lumber_yard',   nameJP:'材木置き場',  age:1, color:'brown',  cost:{},         effect:{res:{wood:1}},                chainTo:'sawmill'   },
  { id:'stone_pit',     nameJP:'石切り場',    age:1, color:'brown',  cost:{},         effect:{res:{stone:1}},               chainTo:'quarry'    },
  { id:'clay_pool',     nameJP:'粘土採掘場',  age:1, color:'brown',  cost:{},         effect:{res:{clay:1}},                chainTo:'brickyard' },
  { id:'ore_vein',      nameJP:'鉄鉱脈',      age:1, color:'brown',  cost:{},         effect:{res:{ore:1}},                 chainTo:'foundry'   },
  { id:'timber_yard',   nameJP:'製材所',      age:1, color:'brown',  cost:{coins:1},  effect:{choice:['wood','stone']},     chainTo:null        },
  { id:'excavation',    nameJP:'採掘場',      age:1, color:'brown',  cost:{coins:1},  effect:{choice:['clay','ore']},       chainTo:null        },

  // Grey – Manufactured Goods (2)
  { id:'glassworks',    nameJP:'ガラス工場',  age:1, color:'grey',   cost:{},         effect:{res:{glass:1}},               chainTo:'glassblower' },
  { id:'press',         nameJP:'出版社',      age:1, color:'grey',   cost:{},         effect:{res:{papyrus:1}},             chainTo:'drying_room' },

  // Yellow – Commercial (3)
  { id:'tavern',        nameJP:'居酒屋',      age:1, color:'yellow', cost:{},         effect:{coins:4},                     chainTo:'caravansery' },
  { id:'stone_reserve', nameJP:'石の確保',   age:1, color:'yellow', cost:{coins:3},  effect:{fixedTrade:'stone'},          chainTo:null          },
  { id:'clay_reserve',  nameJP:'粘土の確保', age:1, color:'yellow', cost:{coins:3},  effect:{fixedTrade:'clay'},           chainTo:null          },

  // Red – Military (3)
  { id:'guard_tower',   nameJP:'守衛塔',      age:1, color:'red',    cost:{},         effect:{shields:1},                   chainTo:'fortifications' },
  { id:'garrison',      nameJP:'駐屯地',      age:1, color:'red',    cost:{},         effect:{shields:1},                   chainTo:'barracks'       },
  { id:'palisade',      nameJP:'柵',          age:1, color:'red',    cost:{coins:2},  effect:{shields:1},                   chainTo:null             },

  // Green – Scientific (4)
  { id:'scriptorium',   nameJP:'写字室',      age:1, color:'green',  cost:{coins:2},  effect:{science:SCI.TABLET},          chainTo:'library'    },
  { id:'pharmacist',    nameJP:'薬局',        age:1, color:'green',  cost:{},         effect:{science:SCI.MORTAR},          chainTo:'dispensary' },
  { id:'workshop',      nameJP:'工房',        age:1, color:'green',  cost:{papyrus:1},effect:{science:SCI.GEAR},            chainTo:'laboratory' },
  { id:'apothecary',    nameJP:'薬屋',        age:1, color:'green',  cost:{glass:1},  effect:{science:SCI.COMPASS},         chainTo:'school'     },

  // Blue – Civilian (5)
  { id:'altar',         nameJP:'祭壇',        age:1, color:'blue',   cost:{},         effect:{vp:2},                        chainTo:'temple'    },
  { id:'theater',       nameJP:'劇場',        age:1, color:'blue',   cost:{},         effect:{vp:2},                        chainTo:'statue'    },
  { id:'pawnshop',      nameJP:'質屋',        age:1, color:'blue',   cost:{},         effect:{vp:3},                        chainTo:null        },
  { id:'baths',         nameJP:'浴場',        age:1, color:'blue',   cost:{stone:1},  effect:{vp:3},                        chainTo:'aqueduct'  },
  { id:'workshop_bl',   nameJP:'作業場',      age:1, color:'blue',   cost:{},         effect:{vp:1},                        chainTo:null        },
];

// ── Age II Cards (23) ────────────────────────────────────────────
const AGE2_CARDS = [
  // Brown – double production (4)
  { id:'sawmill',       nameJP:'鋸工場',      age:2, color:'brown',  cost:{coins:2},  effect:{res:{wood:2}},                chainFrom:'lumber_yard', chainTo:null },
  { id:'quarry',        nameJP:'採石場',      age:2, color:'brown',  cost:{coins:2},  effect:{res:{stone:2}},               chainFrom:'stone_pit',   chainTo:null },
  { id:'brickyard',     nameJP:'レンガ工場',  age:2, color:'brown',  cost:{coins:2},  effect:{res:{clay:2}},                chainFrom:'clay_pool',   chainTo:null },
  { id:'foundry',       nameJP:'鋳造所',      age:2, color:'brown',  cost:{coins:2},  effect:{res:{ore:2}},                 chainFrom:'ore_vein',    chainTo:null },

  // Grey (2)
  { id:'glassblower',   nameJP:'ガラス職人',  age:2, color:'grey',   cost:{},         effect:{res:{glass:2}},               chainFrom:'glassworks',  chainTo:null },
  { id:'drying_room',   nameJP:'乾燥室',      age:2, color:'grey',   cost:{},         effect:{res:{papyrus:2}},             chainFrom:'press',       chainTo:null },

  // Yellow (4)
  { id:'caravansery',   nameJP:'隊商宿',      age:2, color:'yellow', cost:{wood:2,glass:1,papyrus:1}, effect:{coinsPerBrown:1}, chainFrom:'tavern', chainTo:null },
  { id:'forum',         nameJP:'フォーラム',  age:2, color:'yellow', cost:{clay:1,ore:1},   effect:{fixedTrade:'manufactured'}, chainTo:null },
  { id:'customs_house', nameJP:'税関',        age:2, color:'yellow', cost:{coins:4},        effect:{fixedTrade:'raw'},          chainTo:null },
  { id:'brewery',       nameJP:'醸造所',      age:2, color:'yellow', cost:{},               effect:{coins:6},                   chainTo:null },

  // Red (4)
  { id:'walls',         nameJP:'城壁',        age:2, color:'red',    cost:{stone:3},        effect:{shields:2},                 chainTo:null },
  { id:'barracks',      nameJP:'兵舎',        age:2, color:'red',    cost:{},               effect:{shields:1},                 chainFrom:'garrison', chainTo:null },
  { id:'stables',       nameJP:'馬小屋',      age:2, color:'red',    cost:{clay:1,ore:1,wood:1}, effect:{shields:2},            chainTo:'siege_workshop' },
  { id:'archery_range', nameJP:'射撃場',      age:2, color:'red',    cost:{ore:1,wood:1,papyrus:1}, effect:{shields:2},         chainTo:'arsenal' },

  // Green (4)
  { id:'dispensary',    nameJP:'調剤室',      age:2, color:'green',  cost:{ore:2,glass:1},         effect:{science:SCI.MORTAR},   chainFrom:'pharmacist', chainTo:'lodge'     },
  { id:'laboratory',    nameJP:'実験室',      age:2, color:'green',  cost:{clay:2,papyrus:1},      effect:{science:SCI.GEAR},     chainFrom:'workshop',   chainTo:'observatory' },
  { id:'library',       nameJP:'図書館',      age:2, color:'green',  cost:{ore:2,glass:1},         effect:{science:SCI.TABLET},   chainFrom:'scriptorium',chainTo:'study'     },
  { id:'school',        nameJP:'学校',        age:2, color:'green',  cost:{wood:1,papyrus:1},      effect:{science:SCI.WHEEL},    chainFrom:'apothecary', chainTo:'university' },

  // Blue (5)
  { id:'aqueduct',      nameJP:'水道橋',      age:2, color:'blue',   cost:{stone:3},               effect:{vp:5},                 chainFrom:'baths',   chainTo:null },
  { id:'temple',        nameJP:'神殿',        age:2, color:'blue',   cost:{clay:1,wood:1,papyrus:1},effect:{vp:4},                chainFrom:'altar',   chainTo:'pantheon' },
  { id:'statue',        nameJP:'彫像',        age:2, color:'blue',   cost:{ore:1,glass:1},          effect:{vp:4},                chainFrom:'theater', chainTo:'gardens'  },
  { id:'courthouse',    nameJP:'裁判所',      age:2, color:'blue',   cost:{coins:4},                effect:{vp:5},                chainTo:null },
  { id:'rostrum',       nameJP:'演壇',        age:2, color:'blue',   cost:{stone:1,ore:1},          effect:{vp:3},                chainTo:'senate' },
];

// ── Age III Regular Cards (17) ───────────────────────────────────
const AGE3_CARDS = [
  // Brown / Grey (0) — none in Age III

  // Yellow (4)
  { id:'port',           nameJP:'港',        age:3, color:'yellow', cost:{wood:1,glass:1,papyrus:1}, effect:{vp:3, coinsPerBrown:1},   chainTo:null },
  { id:'lighthouse',     nameJP:'灯台',      age:3, color:'yellow', cost:{stone:1,glass:1},          effect:{vp:3, coinsPerYellow:1},  chainTo:null },
  { id:'arena',          nameJP:'闘技場',    age:3, color:'yellow', cost:{clay:1,ore:1,glass:1},     effect:{vpPerWonder:1, coinsPerWonder:2}, chainTo:null },
  { id:'chamber',        nameJP:'商工会議所',age:3, color:'yellow', cost:{papyrus:2,ore:1},          effect:{vp:3, coinsPerGrey:2},    chainTo:null },

  // Red (3)
  { id:'fortifications', nameJP:'要塞',      age:3, color:'red',    cost:{ore:2,stone:1,papyrus:1},  effect:{shields:2}, chainFrom:'guard_tower', chainTo:null },
  { id:'siege_workshop', nameJP:'攻城工場',  age:3, color:'red',    cost:{clay:3,papyrus:1},         effect:{shields:2}, chainFrom:'stables',     chainTo:null },
  { id:'arsenal',        nameJP:'武器庫',    age:3, color:'red',    cost:{clay:3,wood:1,ore:1},      effect:{shields:3}, chainFrom:'archery_range',chainTo:null },

  // Green (4)
  { id:'lodge',          nameJP:'ロッジ',    age:3, color:'green',  cost:{clay:2,papyrus:1,glass:1}, effect:{science:SCI.COMPASS},   chainFrom:'dispensary', chainTo:null },
  { id:'observatory',    nameJP:'天文台',    age:3, color:'green',  cost:{ore:2,glass:1,papyrus:1},  effect:{science:SCI.ASTROLABE}, chainFrom:'laboratory', chainTo:null },
  { id:'study',          nameJP:'研究所',    age:3, color:'green',  cost:{wood:1,glass:1,papyrus:1}, effect:{science:SCI.WHEEL},     chainFrom:'library',    chainTo:null },
  { id:'university',     nameJP:'大学',      age:3, color:'green',  cost:{clay:1,glass:1,papyrus:1}, effect:{science:SCI.TABLET},    chainFrom:'school',     chainTo:null },

  // Blue (6)
  { id:'pantheon',       nameJP:'万神殿',    age:3, color:'blue',   cost:{clay:1,wood:1,papyrus:2,glass:1}, effect:{vp:6}, chainFrom:'temple',    chainTo:null },
  { id:'gardens',        nameJP:'庭園',      age:3, color:'blue',   cost:{clay:2,wood:1},                    effect:{vp:6}, chainFrom:'statue',    chainTo:null },
  { id:'town_hall',      nameJP:'市庁舎',    age:3, color:'blue',   cost:{stone:3,wood:2},                   effect:{vp:6}, chainTo:null },
  { id:'senate',         nameJP:'元老院',    age:3, color:'blue',   cost:{clay:2,ore:1,papyrus:1},           effect:{vp:5}, chainFrom:'rostrum',   chainTo:null },
  { id:'palace',         nameJP:'宮殿',      age:3, color:'blue',   cost:{clay:1,stone:1,ore:1,wood:1,glass:1,papyrus:1}, effect:{vp:7}, chainTo:null },
  { id:'obelisk',        nameJP:'オベリスク', age:3, color:'blue',  cost:{stone:2,ore:1},                    effect:{vp:5}, chainTo:null },
];

// ── Guild Cards (7 — 3 chosen randomly) ─────────────────────────
const GUILD_CARDS = [
  { id:'merchants_guild',   nameJP:'商人ギルド',     age:3, color:'purple', cost:{clay:1,ore:1,glass:1,papyrus:1}, effect:{vpPerYellow:{both:1},coinsPerYellow:{both:1}} },
  { id:'shipowners_guild',  nameJP:'船主ギルド',     age:3, color:'purple', cost:{clay:1,stone:1,glass:1,papyrus:1},effect:{vpPerColorCard:{colors:['brown','grey','purple'],perSide:'both',vp:1}} },
  { id:'builders_guild',    nameJP:'建設者ギルド',   age:3, color:'purple', cost:{stone:2,clay:1,wood:1,glass:1},  effect:{vpPerWonder:{both:2}} },
  { id:'magistrates_guild', nameJP:'司法官ギルド',   age:3, color:'purple', cost:{wood:2,ore:1,papyrus:1},         effect:{vpPerBlue:{both:1}, coinsPerBlue:{both:1}} },
  { id:'scientists_guild',  nameJP:'学者ギルド',     age:3, color:'purple', cost:{clay:2,wood:2},                  effect:{science:SCI.GEAR} },
  { id:'moneylenders_guild',nameJP:'金融業者ギルド', age:3, color:'purple', cost:{stone:2,ore:1,papyrus:1},        effect:{vpPerThreeCoins:1} },
  { id:'tacticians_guild',  nameJP:'戦術家ギルド',   age:3, color:'purple', cost:{stone:2,ore:2,papyrus:1},        effect:{vpPerRed:{both:1}, coinsPerRed:{both:1}} },
];

// ── Wonder Cards (12 — 8 drafted per game) ───────────────────────
const WONDER_CARDS = [
  {
    id:'appian_way', nameJP:'アッピア街道',
    cost:{papyrus:2,clay:1,stone:1},
    effect:{ vp:3, coins:3, opponentLosesCoins:3, playAgain:true }
  },
  {
    id:'circus_maximus', nameJP:'チルコ・マッシモ',
    cost:{wood:1,ore:1,stone:1},
    effect:{ destroyOpponentCard:'grey', shields:1, vp:3 }
  },
  {
    id:'colosseum', nameJP:'コロッセオ',
    cost:{ore:2,stone:1,papyrus:1},
    effect:{ destroyOpponentCard:'yellow', looteCoinsPerDestroyed:true, vp:3 }
  },
  {
    id:'great_library', nameJP:'大図書館',
    cost:{wood:2,stone:1,glass:1},
    effect:{ draw3ProgressTokens:true }
  },
  {
    id:'great_lighthouse', nameJP:'大灯台',
    cost:{wood:1,stone:1,ore:1,papyrus:1},
    effect:{ produceAnyRawMaterial:true, vp:4 }
  },
  {
    id:'hanging_gardens', nameJP:'空中庭園',
    cost:{wood:2,glass:1,papyrus:1},
    effect:{ coins:6, vp:3, playAgain:true }
  },
  {
    id:'mausoleum', nameJP:'マウソロス霊廟',
    cost:{clay:2,ore:2,glass:1,papyrus:1},
    effect:{ buildFromDiscard:true, vp:2 }
  },
  {
    id:'olympia', nameJP:'オリンピア',
    cost:{wood:1,ore:1,stone:1},
    effect:{ buildOneFreeOncePerAge:true, vp:3 }
  },
  {
    id:'piraeus', nameJP:'ピレウス港',
    cost:{wood:2,clay:1,ore:1},
    effect:{ produceAnyManufactured:true, vp:2, playAgain:true }
  },
  {
    id:'pyramids', nameJP:'ピラミッド',
    cost:{stone:3,papyrus:1},
    effect:{ vp:9 }
  },
  {
    id:'sphinx', nameJP:'スフィンクス',
    cost:{ore:2,glass:1,papyrus:1},
    effect:{ vp:6, playAgain:true }
  },
  {
    id:'statue_of_zeus', nameJP:'ゼウス像',
    cost:{ore:1,wood:1,stone:1,papyrus:2},
    effect:{ destroyOpponentCard:'brown', vp:3, coins:3 }
  },
];

// ── Progress Tokens (10 — 5 chosen randomly) ─────────────────────
const PROGRESS_TOKENS = [
  { id:'agriculture',  nameJP:'農業',       effect:{ immediateCoins:6, endVP:4 } },
  { id:'architecture', nameJP:'建築',       effect:{ wonderCostReduction:2 } },
  { id:'economy',      nameJP:'経済',       effect:{ gainOpponentTradeCost:true } },
  { id:'law',          nameJP:'法律',       effect:{ science:SCI.LAW } },
  { id:'masonry',      nameJP:'石工',       effect:{ civilianCostReduction:2 } },
  { id:'mathematics',  nameJP:'数学',       effect:{ vpPer3Tokens:1, endBonus:true } },
  { id:'philosophy',   nameJP:'哲学',       effect:{ endVP:7 } },
  { id:'strategy',     nameJP:'戦略',       effect:{ extraShieldAfterAge:1 } },
  { id:'theology',     nameJP:'神学',       effect:{ wondersCountDouble:true } },
  { id:'urbanism',     nameJP:'都市計画',   effect:{ chainBuildCoins:4 } },
];

// ── Age Layouts (card positions & face-up/down) ───────────────────
// Each entry: [row, col, faceUp]
// row 0 = first accessible (bottom of Age I pyramid, top of Age II inverted).
// Coverage rule (handled in game.js):
//   card[r,c] is BLOCKED by cards at [r-1, c-1] and [r-1, c+1].
// col values are "half-card units" → pixel x = col * (CARD_W / 2)

// Age I — pyramid, base (row 0) accessible first  [23 cards]
const AGE1_LAYOUT = [
  // row 0 — base, 6 face-up
  [0,0,true],[0,2,true],[0,4,true],[0,6,true],[0,8,true],[0,10,true],
  // row 1 — 5 face-down
  [1,1,false],[1,3,false],[1,5,false],[1,7,false],[1,9,false],
  // row 2 — 4 face-up
  [2,2,true],[2,4,true],[2,6,true],[2,8,true],
  // row 3 — 3 face-down
  [3,3,false],[3,5,false],[3,7,false],
  // row 4 — 3 face-up  (cols 2,4,6 — left/right slightly exposed)
  [4,2,true],[4,4,true],[4,6,true],
  // row 5 — 2 face-down (apex)
  [5,3,false],[5,5,false],
];

// Age II — inverted pyramid, row 0 (top-wide) accessible first  [23 cards]
const AGE2_LAYOUT = [
  // row 0 — top, 5 face-up
  [0,0,true],[0,2,true],[0,4,true],[0,6,true],[0,8,true],
  // row 1 — 4 face-down
  [1,1,false],[1,3,false],[1,5,false],[1,7,false],
  // row 2 — 5 face-up
  [2,0,true],[2,2,true],[2,4,true],[2,6,true],[2,8,true],
  // row 3 — 4 face-down
  [3,1,false],[3,3,false],[3,5,false],[3,7,false],
  // row 4 — 3 face-up
  [4,2,true],[4,4,true],[4,6,true],
  // row 5 — 2 face-down (apex)
  [5,3,false],[5,5,false],
];

// Age III — fortress shape  [20 cards = 17 regular + 3 guilds]
const AGE3_LAYOUT = [
  // row 0 — base 6 face-up
  [0,0,true],[0,2,true],[0,4,true],[0,6,true],[0,8,true],[0,10,true],
  // row 1 — 5 face-down
  [1,1,false],[1,3,false],[1,5,false],[1,7,false],[1,9,false],
  // row 2 — 4 face-up
  [2,2,true],[2,4,true],[2,6,true],[2,8,true],
  // row 3 — 3 face-down
  [3,3,false],[3,5,false],[3,7,false],
  // row 4 — 2 face-up (apex)
  [4,4,true],[4,6,true],
];

// ── Military Token Positions ─────────────────────────────────────
// Conflict pawn starts at 0. Negative = P2 advantage, Positive = P1 advantage.
// Tokens: P1 loses coins at -3,-6; P2 loses coins at +3,+6; supremacy at ±9
const MILITARY_TOKENS = [
  { pos:-6, effect:'p1LosesCoins', amount:5 },
  { pos:-3, effect:'p1LosesCoins', amount:2 },
  { pos:3,  effect:'p2LosesCoins', amount:2 },
  { pos:6,  effect:'p2LosesCoins', amount:5 },
];
const MILITARY_SUPREMACY = 9; // |pawnPos| >= 9 → instant win

// ── Exports ───────────────────────────────────────────────────────
if (typeof module !== 'undefined') {
  module.exports = { SCI, AGE1_CARDS, AGE2_CARDS, AGE3_CARDS, GUILD_CARDS,
                     WONDER_CARDS, PROGRESS_TOKENS, AGE1_LAYOUT, AGE2_LAYOUT,
                     AGE3_LAYOUT, MILITARY_TOKENS, MILITARY_SUPREMACY };
}
