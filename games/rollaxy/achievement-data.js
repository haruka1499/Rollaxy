'use strict';

// ============================================================
// achievement-data.js — 実績データ定義ファイル
//
// ここを編集するだけで実績の名前・条件・サブテキスト・レア度・アイコンを変更できます。
// ロジックは game-achievements.js 側にあるので触らなくて OK。
//
// ⚠️ id は変更しないこと（変えると解除済みデータが引き継がれなくなる）
// ============================================================


// ============================================================
// レア度定義
// ============================================================
const ACH_RARITY = {
  common:    { ja: 'コモン',         en: 'Common',    zh: '普通', border: '#777777', text: '#aaaaaa', bg: 'rgba(120,120,120,0.10)' },
  uncommon:  { ja: 'アンコモン',     en: 'Uncommon',  zh: '非凡', border: '#33bb44', text: '#55dd66', bg: 'rgba(50,180,70,0.10)'   },
  rare:      { ja: 'レア',           en: 'Rare',      zh: '稀有', border: '#3399ff', text: '#66aaff', bg: 'rgba(50,130,255,0.10)'  },
  epic:      { ja: 'エピック',       en: 'Epic',      zh: '史诗', border: '#aa44ff', text: '#cc77ff', bg: 'rgba(150,50,255,0.10)'  },
  legendary: { ja: 'レジェンダリー', en: 'Legendary', zh: '传说', border: '#ffcc00', text: '#ffdd44', bg: 'rgba(255,200,0,0.10)'   },
  secret:    { ja: 'シークレット',   en: 'Secret',    zh: '秘密', border: null,      text: null,      bg: 'rgba(255,255,255,0.04)' },
};


// ============================================================
// スコア実績のレア度しきい値
// ============================================================
function _scoreRarity(s) {
  if (s <= 1000)  return 'common';
  if (s <= 3000)  return 'uncommon';
  if (s <= 7000)  return 'rare';
  if (s <= 10000) return 'epic';
  return 'legendary';
}

// 数字カンマ区切り
const _fmtN = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');


// ============================================================
// スコアマイルストーン（自動生成）
// ============================================================
const _sm = [];
for (let s = 500;   s <= 10000;  s += 500)  _sm.push(s);
for (let s = 12000; s <= 50000;  s += 2000) _sm.push(s);
for (let s = 55000; s <= 100000; s += 5000) _sm.push(s);


// ============================================================
// 実績カテゴリ定義
//
// 各実績のフィールド:
//   id              … 内部ID（変更不可）
//   icon            … アイコン絵文字
//   nameJa          … 実績名（日本語）
//   condJa          … 取得条件（日本語）
//   subJa           … サブテキスト・フレーバーテキスト（日本語）
//   rarity          … レア度キー
//   scoreThreshold  … スコア系のみ: この値以上で解除
//   mergeThreshold  … 合成系のみ: 累計合成数がこの値以上で解除
// ============================================================
const ACH_CATS = [

  // ── スコア系 ──────────────────────────────────────────────
  {
    id: 'score', icon: '🏆',
    nameJa: 'スコア', nameEn: 'Score', nameZh: '分数',
    items: _sm.map(s => {
      const n = _fmtN(s);
      return {
        id:     `score_${s}`,
        icon:   '🏆',
        nameJa: `${n}点突破！`,
        nameEn: `${n} Points!`,
        nameZh: `突破${n}分！`,
        condJa: `${n}点を達成する`,
        condEn: `Score ${n} points`,
        condZh: `获得${n}分`,
        subJa:  null, // スコア系はサブテキストなし（後で追加したければここへ）
        rarity: _scoreRarity(s),
        scoreThreshold: s,
      };
    }),
  },

  // ── 合成系 ──────────────────────────────────────────────
  {
    id: 'merge', icon: '⚡',
    nameJa: '合成', nameEn: 'Merge', nameZh: '合成',
    items: [
      {
        id: 'merge_1',      icon: '💫', rarity: 'common',
        nameJa: '宇宙塵',       condJa: '累計1回合成する',
        subJa: '「すべては、小さな粒子から始まる。」',
        mergeThreshold: 1,
      },
      {
        id: 'merge_5',      icon: '🪨', rarity: 'common',
        nameJa: '微惑星',       condJa: '累計5回合成する',
        subJa: '「塵は集まり、形を持ち始めた。」',
        mergeThreshold: 5,
      },
      {
        id: 'merge_10',     icon: '🌀', rarity: 'common',
        nameJa: '降着開始',     condJa: '累計10回合成する',
        subJa: '「重力が物質を引き寄せる。」',
        mergeThreshold: 10,
      },
      {
        id: 'merge_25',     icon: '🔄', rarity: 'common',
        nameJa: '軌道形成',     condJa: '累計25回合成する',
        subJa: '「秩序ある動きが生まれた。」',
        mergeThreshold: 25,
      },
      {
        id: 'merge_50',     icon: '⚡', rarity: 'common',
        nameJa: '重力反応',     condJa: '累計50回合成する',
        subJa: '「集積はさらに加速していく。」',
        mergeThreshold: 50,
      },
      {
        id: 'merge_100',    icon: '✨', rarity: 'common',
        nameJa: '星の欠片',     condJa: '累計100回合成する',
        subJa: '「小さな光が宇宙に散らばる。」',
        mergeThreshold: 100,
      },
      {
        id: 'merge_250',    icon: '🪨', rarity: 'uncommon',
        nameJa: '小惑星帯',     condJa: '累計250回合成する',
        subJa: '「無数の岩石が軌道を巡る。」',
        mergeThreshold: 250,
      },
      {
        id: 'merge_500',    icon: '🌙', rarity: 'uncommon',
        nameJa: '衛星形成',     condJa: '累計500回合成する',
        subJa: '「天体は互いに引かれ合う。」',
        mergeThreshold: 500,
      },
      {
        id: 'merge_1000',   icon: '🌍', rarity: 'uncommon',
        nameJa: '惑星誕生',     condJa: '累計1,000回合成する',
        subJa: '「新たな世界が誕生した。」',
        mergeThreshold: 1000,
      },
      {
        id: 'merge_2500',   icon: '🪐', rarity: 'uncommon',
        nameJa: '巨大惑星',     condJa: '累計2,500回合成する',
        subJa: '「圧倒的な質量が支配する。」',
        mergeThreshold: 2500,
      },
      {
        id: 'merge_5000',   icon: '☀️', rarity: 'rare',
        nameJa: '恒星形成',     condJa: '累計5,000回合成する',
        subJa: '「核融合の火が灯る。」',
        mergeThreshold: 5000,
      },
      {
        id: 'merge_7500',   icon: '🔥', rarity: 'rare',
        nameJa: '核融合開始',   condJa: '累計7,500回合成する',
        subJa: '「星の中心で反応が始まった。」',
        mergeThreshold: 7500,
      },
      {
        id: 'merge_10000',  icon: '🌟', rarity: 'rare',
        nameJa: '太陽活動',     condJa: '累計10,000回合成する',
        subJa: '「強烈なエネルギーが放出される。」',
        mergeThreshold: 10000,
      },
      {
        id: 'merge_15000',  icon: '🔴', rarity: 'rare',
        nameJa: '赤色巨星化',   condJa: '累計15,000回合成する',
        subJa: '「星は膨張し、終焉へ向かう。」',
        mergeThreshold: 15000,
      },
      {
        id: 'merge_20000',  icon: '💥', rarity: 'epic',
        nameJa: '星の終焉',     condJa: '累計20,000回合成する',
        subJa: '「ひとつの恒星が役目を終えた。」',
        mergeThreshold: 20000,
      },
      {
        id: 'merge_25000',  icon: '💫', rarity: 'epic',
        nameJa: '超新星爆発',   condJa: '累計25,000回合成する',
        subJa: '「莫大な光が宇宙を駆け抜ける。」',
        mergeThreshold: 25000,
      },
      {
        id: 'merge_30000',  icon: '🌑', rarity: 'epic',
        nameJa: '重力崩壊',     condJa: '累計30,000回合成する',
        subJa: '「重力は、すべてを押し潰す。」',
        mergeThreshold: 30000,
      },
      {
        id: 'merge_35000',  icon: '⭐', rarity: 'epic',
        nameJa: '特異点観測',   condJa: '累計35,000回合成する',
        subJa: '「既知の法則が意味を失う。」',
        mergeThreshold: 35000,
      },
      {
        id: 'merge_40000',  icon: '🌑', rarity: 'legendary',
        nameJa: '事象の地平面', condJa: '累計40,000回合成する',
        subJa: '「光すら、もう戻れない。」',
        mergeThreshold: 40000,
      },
      {
        id: 'merge_45000',  icon: '🌌', rarity: 'legendary',
        nameJa: '銀河形成',     condJa: '累計45,000回合成する',
        subJa: '「星々は巨大な渦を描く。」',
        mergeThreshold: 45000,
      },
      {
        id: 'merge_50000',  icon: '🌐', rarity: 'legendary',
        nameJa: '銀河団形成',   condJa: '累計50,000回合成する',
        subJa: '「宇宙規模の構造が完成した。」',
        mergeThreshold: 50000,
      },
      // 隠し実績（secret）— ロック中は名前・条件・サブテキストが ??? で表示される
      {
        id: 'merge_75000',   icon: '🔭', rarity: 'secret',
        nameJa: '深宇宙観測',   condJa: '累計75,000回合成する',
        subJa: '「観測は、さらに深部へ到達する。」',
        mergeThreshold: 75000,
      },
      {
        id: 'merge_100000',  icon: '📡', rarity: 'secret',
        nameJa: '宇宙背景放射', condJa: '累計100,000回合成する',
        subJa: '「宇宙誕生の痕跡が残されている。」',
        mergeThreshold: 100000,
      },
      {
        id: 'merge_250000',  icon: '🌑', rarity: 'secret',
        nameJa: '観測不能領域', condJa: '累計250,000回合成する',
        subJa: '「そこには誰も到達できない。」',
        mergeThreshold: 250000,
      },
      {
        id: 'merge_500000',  icon: '❄️', rarity: 'secret',
        nameJa: '熱的死',       condJa: '累計500,000回合成する',
        subJa: '「宇宙は静かに冷え続ける。」',
        mergeThreshold: 500000,
      },
      {
        id: 'merge_1000000', icon: '🌅', rarity: 'secret',
        nameJa: '新宇宙創生',   condJa: '累計1,000,000回合成する',
        subJa: '「終焉の先で、再び始まる。」',
        mergeThreshold: 1000000,
      },
    ],
  },

  // ── 小惑星系 ──────────────────────────────────────────────
  {
    id: 'asteroid', icon: '🪨', bodyIndex: 1,
    nameJa: '小惑星系', nameEn: 'Asteroid', nameZh: '小行星',
    items: [
      { id: 'asteroid_1',    icon: '🪨', rarity: 'common',
        nameJa: '小惑星接近',   condJa: '小惑星を1回合成する',
        subJa: '「岩石が宇宙を漂う。」', mergeThreshold: 1 },
      { id: 'asteroid_10',   icon: '🪨', rarity: 'common',
        nameJa: '飛来物注意',   condJa: '小惑星を10回合成する',
        subJa: '「軌道上の物体が増加する。」', mergeThreshold: 10 },
      { id: 'asteroid_50',   icon: '🪨', rarity: 'uncommon',
        nameJa: '小惑星帯形成', condJa: '小惑星を50回合成する',
        subJa: '「無数の岩塊が軌道を巡る。」', mergeThreshold: 50 },
      { id: 'asteroid_250',  icon: '🪨', rarity: 'rare',
        nameJa: '衝突危険域',   condJa: '小惑星を250回合成する',
        subJa: '「空間は危険で満たされる。」', mergeThreshold: 250 },
      { id: 'asteroid_1000', icon: '🪨', rarity: 'epic',
        nameJa: '岩石宇宙',     condJa: '小惑星を1,000回合成する',
        subJa: '「硬質な天体が広がり続ける。」', mergeThreshold: 1000 },
    ],
  },

  // ── 月系 ──────────────────────────────────────────────────
  {
    id: 'moon', icon: '🌙', bodyIndex: 2,
    nameJa: '月系', nameEn: 'Moon', nameZh: '月亮',
    items: [
      { id: 'moon_1',    icon: '🌙', rarity: 'common',
        nameJa: '衛星誕生', condJa: '月を1回合成する',
        subJa: '「小さな衛星が周回を始める。」', mergeThreshold: 1 },
      { id: 'moon_10',   icon: '🌙', rarity: 'common',
        nameJa: '静かな光', condJa: '月を10回合成する',
        subJa: '「淡い輝きが夜を照らす。」', mergeThreshold: 10 },
      { id: 'moon_50',   icon: '🌙', rarity: 'uncommon',
        nameJa: '周回軌道', condJa: '月を50回合成する',
        subJa: '「安定した軌道が形成される。」', mergeThreshold: 50 },
      { id: 'moon_250',  icon: '🌙', rarity: 'rare',
        nameJa: '潮汐の力', condJa: '月を250回合成する',
        subJa: '「重力が環境へ影響を与える。」', mergeThreshold: 250 },
      { id: 'moon_1000', icon: '🌙', rarity: 'epic',
        nameJa: '衛星群',   condJa: '月を1,000回合成する',
        subJa: '「無数の月が宇宙を巡る。」', mergeThreshold: 1000 },
    ],
  },

  // ── 地球系 ──────────────────────────────────────────────
  {
    id: 'earth', icon: '🌍', bodyIndex: 3,
    nameJa: '地球系', nameEn: 'Earth', nameZh: '地球',
    items: [
      { id: 'earth_1',   icon: '🌍', rarity: 'common',
        nameJa: '青い星',     condJa: '地球を1回合成する',
        subJa: '「生命の可能性が宿る。」', mergeThreshold: 1 },
      { id: 'earth_5',   icon: '🌍', rarity: 'uncommon',
        nameJa: '生命圏',     condJa: '地球を5回合成する',
        subJa: '「環境は豊かさを増していく。」', mergeThreshold: 5 },
      { id: 'earth_25',  icon: '🌍', rarity: 'rare',
        nameJa: '文明の兆し', condJa: '地球を25回合成する',
        subJa: '「知性の気配が現れる。」', mergeThreshold: 25 },
      { id: 'earth_100', icon: '🌍', rarity: 'epic',
        nameJa: '文明発展',   condJa: '地球を100回合成する',
        subJa: '「高度な存在が宇宙を見上げる。」', mergeThreshold: 100 },
      { id: 'earth_500', icon: '🌍', rarity: 'legendary',
        nameJa: '星々への憧れ', condJa: '地球を500回合成する',
        subJa: '「文明は宇宙進出を始めた。」', mergeThreshold: 500 },
    ],
  },

  // ── 木星系 ──────────────────────────────────────────────
  {
    id: 'jupiter', icon: '🪐', bodyIndex: 4,
    nameJa: '木星系', nameEn: 'Jupiter', nameZh: '木星',
    items: [
      { id: 'jupiter_1',   icon: '🪐', rarity: 'uncommon',
        nameJa: '巨大ガス惑星', condJa: '木星を1回合成する',
        subJa: '「巨大な重力が周囲を支配する。」', mergeThreshold: 1 },
      { id: 'jupiter_10',  icon: '🪐', rarity: 'rare',
        nameJa: '重力の王',     condJa: '木星を10回合成する',
        subJa: '「周囲の軌道が乱され始める。」', mergeThreshold: 10 },
      { id: 'jupiter_50',  icon: '🪐', rarity: 'rare',
        nameJa: '嵐の惑星',     condJa: '木星を50回合成する',
        subJa: '「巨大な嵐が吹き荒れる。」', mergeThreshold: 50 },
      { id: 'jupiter_250', icon: '🪐', rarity: 'epic',
        nameJa: '惑星支配者',   condJa: '木星を250回合成する',
        subJa: '「質量が宇宙空間を圧倒する。」', mergeThreshold: 250 },
    ],
  },

  // ── 太陽系 ──────────────────────────────────────────────
  {
    id: 'sun', icon: '☀️', bodyIndex: 5,
    nameJa: '太陽系', nameEn: 'Sun', nameZh: '太阳',
    items: [
      { id: 'sun_1',    icon: '☀️', rarity: 'rare',
        nameJa: '恒星点火', condJa: '太陽を1回合成する',
        subJa: '「核融合の火が灯る。」', mergeThreshold: 1 },
      { id: 'sun_3',    icon: '☀️', rarity: 'rare',
        nameJa: '若い恒星', condJa: '太陽を3回合成する',
        subJa: '「光は宇宙へ広がり始める。」', mergeThreshold: 3 },
      { id: 'sun_5',    icon: '☀️', rarity: 'rare',
        nameJa: '恒星活動', condJa: '太陽を5回合成する',
        subJa: '「莫大なエネルギーが放出される。」', mergeThreshold: 5 },
      { id: 'sun_10',   icon: '☀️', rarity: 'rare',
        nameJa: '太陽風',   condJa: '太陽を10回合成する',
        subJa: '「高エネルギー粒子が吹き荒れる。」', mergeThreshold: 10 },
      { id: 'sun_25',   icon: '☀️', rarity: 'epic',
        nameJa: '光の中心', condJa: '太陽を25回合成する',
        subJa: '「周囲の天体を照らし続ける。」', mergeThreshold: 25 },
      { id: 'sun_50',   icon: '☀️', rarity: 'epic',
        nameJa: '恒星群',   condJa: '太陽を50回合成する',
        subJa: '「宇宙に光源が増えていく。」', mergeThreshold: 50 },
      { id: 'sun_100',  icon: '☀️', rarity: 'epic',
        nameJa: '星の時代', condJa: '太陽を100回合成する',
        subJa: '「宇宙は恒星で満たされ始める。」', mergeThreshold: 100 },
      { id: 'sun_250',  icon: '☀️', rarity: 'legendary',
        nameJa: '恒星文明', condJa: '太陽を250回合成する',
        subJa: '「文明は恒星エネルギーを利用する。」', mergeThreshold: 250 },
      { id: 'sun_500',  icon: '☀️', rarity: 'legendary',
        nameJa: '輝く宇宙', condJa: '太陽を500回合成する',
        subJa: '「無数の恒星が宇宙を彩る。」', mergeThreshold: 500 },
      { id: 'sun_1000', icon: '☀️', rarity: 'secret',
        nameJa: '恒星観測者', condJa: '太陽を1,000回合成する',
        subJa: '「あなたは星々を生み出し続けた。」', mergeThreshold: 1000 },
    ],
  },

  // ── 赤色巨星系 ──────────────────────────────────────────
  {
    id: 'redgiant', icon: '🔴', bodyIndex: 6,
    nameJa: '赤色巨星系', nameEn: 'Red Giant', nameZh: '红巨星',
    items: [
      { id: 'redgiant_1',    icon: '🔴', rarity: 'rare',
        nameJa: '膨張開始',     condJa: '赤色巨星を1回合成する',
        subJa: '「星は終焉へ向かい始める。」', mergeThreshold: 1 },
      { id: 'redgiant_3',    icon: '🔴', rarity: 'epic',
        nameJa: '終末の赤光',   condJa: '赤色巨星を3回合成する',
        subJa: '「老いた恒星が膨れ上がる。」', mergeThreshold: 3 },
      { id: 'redgiant_5',    icon: '🔴', rarity: 'epic',
        nameJa: '恒星老化',     condJa: '赤色巨星を5回合成する',
        subJa: '「星の寿命は尽きつつある。」', mergeThreshold: 5 },
      { id: 'redgiant_10',   icon: '🔴', rarity: 'epic',
        nameJa: '崩壊前夜',     condJa: '赤色巨星を10回合成する',
        subJa: '「内部構造が不安定化する。」', mergeThreshold: 10 },
      { id: 'redgiant_25',   icon: '🔴', rarity: 'epic',
        nameJa: '赤色宇宙',     condJa: '赤色巨星を25回合成する',
        subJa: '「赤い光が宇宙を染める。」', mergeThreshold: 25 },
      { id: 'redgiant_50',   icon: '🔴', rarity: 'legendary',
        nameJa: '老星群',       condJa: '赤色巨星を50回合成する',
        subJa: '「終焉を迎える星々が増加する。」', mergeThreshold: 50 },
      { id: 'redgiant_100',  icon: '🔴', rarity: 'legendary',
        nameJa: '終焉の時代',   condJa: '赤色巨星を100回合成する',
        subJa: '「宇宙は静かに老いていく。」', mergeThreshold: 100 },
      { id: 'redgiant_250',  icon: '🔴', rarity: 'legendary',
        nameJa: '赤色の海',     condJa: '赤色巨星を250回合成する',
        subJa: '「無数の老星が広がる。」', mergeThreshold: 250 },
      { id: 'redgiant_500',  icon: '🔴', rarity: 'secret',
        nameJa: '終末観測者',   condJa: '赤色巨星を500回合成する',
        subJa: '「終焉の光景を見届け続けた。」', mergeThreshold: 500 },
      { id: 'redgiant_1000', icon: '🔴', rarity: 'secret',
        nameJa: '最後の恒星',   condJa: '赤色巨星を1,000回合成する',
        subJa: '「宇宙最後の光が燃えている。」', mergeThreshold: 1000 },
    ],
  },

  // ── 白色矮星系 ──────────────────────────────────────────
  {
    id: 'whitedwarf', icon: '⭐', bodyIndex: 7,
    nameJa: '白色矮星系', nameEn: 'White Dwarf', nameZh: '白矮星',
    items: [
      { id: 'whitedwarf_1',    icon: '⭐', rarity: 'epic',
        nameJa: '燃え尽きた星', condJa: '白色矮星を1回合成する',
        subJa: '「恒星の残骸が残された。」', mergeThreshold: 1 },
      { id: 'whitedwarf_3',    icon: '⭐', rarity: 'epic',
        nameJa: '冷えた残光',   condJa: '白色矮星を3回合成する',
        subJa: '「静かな高密度天体が漂う。」', mergeThreshold: 3 },
      { id: 'whitedwarf_5',    icon: '⭐', rarity: 'epic',
        nameJa: '星の遺骸',     condJa: '白色矮星を5回合成する',
        subJa: '「核融合は既に終わった。」', mergeThreshold: 5 },
      { id: 'whitedwarf_10',   icon: '⭐', rarity: 'epic',
        nameJa: '崩壊後の宇宙', condJa: '白色矮星を10回合成する',
        subJa: '「静寂だけが残される。」', mergeThreshold: 10 },
      { id: 'whitedwarf_25',   icon: '⭐', rarity: 'legendary',
        nameJa: '死星群',       condJa: '白色矮星を25回合成する',
        subJa: '「役目を終えた恒星が並ぶ。」', mergeThreshold: 25 },
      { id: 'whitedwarf_50',   icon: '⭐', rarity: 'legendary',
        nameJa: '終焉記録',     condJa: '白色矮星を50回合成する',
        subJa: '「宇宙は冷え始めている。」', mergeThreshold: 50 },
      { id: 'whitedwarf_100',  icon: '⭐', rarity: 'legendary',
        nameJa: '冷たい宇宙',   condJa: '白色矮星を100回合成する',
        subJa: '「熱は少しずつ失われていく。」', mergeThreshold: 100 },
      { id: 'whitedwarf_250',  icon: '⭐', rarity: 'secret',
        nameJa: '残光の海',     condJa: '白色矮星を250回合成する',
        subJa: '「淡い光だけが宇宙に残る。」', mergeThreshold: 250 },
      { id: 'whitedwarf_500',  icon: '⭐', rarity: 'secret',
        nameJa: '静かな終末',   condJa: '白色矮星を500回合成する',
        subJa: '「宇宙は沈黙へ向かう。」', mergeThreshold: 500 },
      { id: 'whitedwarf_1000', icon: '⭐', rarity: 'secret',
        nameJa: '熱的死の予兆', condJa: '白色矮星を1,000回合成する',
        subJa: '「エネルギーは尽きようとしている。」', mergeThreshold: 1000 },
    ],
  },

  // ── 中性子星系 ──────────────────────────────────────────
  {
    id: 'neutron', icon: '💠', bodyIndex: 8,
    nameJa: '中性子星系', nameEn: 'Neutron Star', nameZh: '中子星',
    items: [
      { id: 'neutron_1',    icon: '💠', rarity: 'epic',
        nameJa: '極限圧縮',     condJa: '中性子星を1回合成する',
        subJa: '「物質は限界まで押し潰された。」', mergeThreshold: 1 },
      { id: 'neutron_3',    icon: '💠', rarity: 'legendary',
        nameJa: '高密度天体',   condJa: '中性子星を3回合成する',
        subJa: '「莫大な質量が一点へ集約される。」', mergeThreshold: 3 },
      { id: 'neutron_5',    icon: '💠', rarity: 'legendary',
        nameJa: 'パルサー観測', condJa: '中性子星を5回合成する',
        subJa: '「強烈な電波が宇宙を貫く。」', mergeThreshold: 5 },
      { id: 'neutron_10',   icon: '💠', rarity: 'legendary',
        nameJa: '超高密度領域', condJa: '中性子星を10回合成する',
        subJa: '「常識的な物理法則が揺らぐ。」', mergeThreshold: 10 },
      { id: 'neutron_25',   icon: '💠', rarity: 'legendary',
        nameJa: '重力波',       condJa: '中性子星を25回合成する',
        subJa: '「空間そのものが震えている。」', mergeThreshold: 25 },
      { id: 'neutron_50',   icon: '💠', rarity: 'secret',
        nameJa: '中性子宇宙',   condJa: '中性子星を50回合成する',
        subJa: '「極限天体が増殖していく。」', mergeThreshold: 50 },
      { id: 'neutron_100',  icon: '💠', rarity: 'secret',
        nameJa: '超圧縮時代',   condJa: '中性子星を100回合成する',
        subJa: '「宇宙は異常な密度へ到達した。」', mergeThreshold: 100 },
      { id: 'neutron_250',  icon: '💠', rarity: 'secret',
        nameJa: '崩壊限界',     condJa: '中性子星を250回合成する',
        subJa: '「重力は物質の限界を超える。」', mergeThreshold: 250 },
      { id: 'neutron_500',  icon: '💠', rarity: 'secret',
        nameJa: 'パルサー銀河', condJa: '中性子星を500回合成する',
        subJa: '「宇宙全体に信号が響き渡る。」', mergeThreshold: 500 },
      { id: 'neutron_1000', icon: '💠', rarity: 'secret',
        nameJa: '極限宇宙',     condJa: '中性子星を1,000回合成する',
        subJa: '「あなたは極限の天体を量産した。」', mergeThreshold: 1000 },
    ],
  },

  // ── 基本連鎖系（最高連鎖数） ────────────────────────────────
  {
    id: 'chain_max', icon: '⛓️',
    nameJa: '連鎖記録', nameEn: 'Chain Record', nameZh: '连锁记录',
    items: [
      { id: 'chain_max_2',  icon: '⛓️', rarity: 'common',
        nameJa: '連鎖開始',   condJa: '2連鎖を達成する',
        subJa: '「反応は連続し始めた。」', mergeThreshold: 2 },
      { id: 'chain_max_3',  icon: '⛓️', rarity: 'common',
        nameJa: '軌道共鳴',   condJa: '3連鎖を達成する',
        subJa: '「天体同士が影響し合う。」', mergeThreshold: 3 },
      { id: 'chain_max_4',  icon: '⛓️', rarity: 'uncommon',
        nameJa: '重力連結',   condJa: '4連鎖を達成する',
        subJa: '「重力が次の反応を引き起こす。」', mergeThreshold: 4 },
      { id: 'chain_max_5',  icon: '⛓️', rarity: 'uncommon',
        nameJa: '恒星反応',   condJa: '5連鎖を達成する',
        subJa: '「エネルギーが連続して解放される。」', mergeThreshold: 5 },
      { id: 'chain_max_6',  icon: '⛓️', rarity: 'rare',
        nameJa: '連鎖暴走',   condJa: '6連鎖を達成する',
        subJa: '「反応は制御を離れ始めた。」', mergeThreshold: 6 },
      { id: 'chain_max_7',  icon: '⛓️', rarity: 'rare',
        nameJa: '超新星連鎖', condJa: '7連鎖を達成する',
        subJa: '「莫大なエネルギーが宇宙を駆ける。」', mergeThreshold: 7 },
      { id: 'chain_max_8',  icon: '⛓️', rarity: 'epic',
        nameJa: '重力崩壊',   condJa: '8連鎖を達成する',
        subJa: '「空間そのものが歪み始める。」', mergeThreshold: 8 },
      { id: 'chain_max_9',  icon: '⛓️', rarity: 'epic',
        nameJa: '特異点',     condJa: '9連鎖を達成する',
        subJa: '「既知の法則が崩れ去る。」', mergeThreshold: 9 },
      { id: 'chain_max_10', icon: '⛓️', rarity: 'legendary',
        nameJa: '銀河衝突',   condJa: '10連鎖を達成する',
        subJa: '「巨大構造同士が衝突する。」', mergeThreshold: 10 },
      { id: 'chain_max_12', icon: '⛓️', rarity: 'legendary',
        nameJa: '宇宙連鎖',   condJa: '12連鎖を達成する',
        subJa: '「反応は宇宙規模へ到達した。」', mergeThreshold: 12 },
      { id: 'chain_max_15', icon: '⛓️', rarity: 'secret',
        nameJa: 'ビッグバン', condJa: '15連鎖を達成する',
        subJa: '「すべてが始まるほどの爆発。」', mergeThreshold: 15 },
    ],
  },

  // ── 累計連鎖系 ────────────────────────────────────────────
  {
    id: 'chain_total', icon: '🔗',
    nameJa: '累計連鎖', nameEn: 'Total Chains', nameZh: '累计连锁',
    items: [
      { id: 'chain_total_10',   icon: '🔗', rarity: 'common',
        nameJa: '共鳴反応',   condJa: '累計10回連鎖を発生させる',
        subJa: '「小さな反応が積み重なる。」', mergeThreshold: 10 },
      { id: 'chain_total_50',   icon: '🔗', rarity: 'common',
        nameJa: '軌道干渉',   condJa: '累計50回連鎖を発生させる',
        subJa: '「天体同士の影響が増加する。」', mergeThreshold: 50 },
      { id: 'chain_total_100',  icon: '🔗', rarity: 'uncommon',
        nameJa: '重力波',     condJa: '累計100回連鎖を発生させる',
        subJa: '「宇宙に波が広がっていく。」', mergeThreshold: 100 },
      { id: 'chain_total_250',  icon: '🔗', rarity: 'uncommon',
        nameJa: '恒星活動',   condJa: '累計250回連鎖を発生させる',
        subJa: '「連続反応は日常となった。」', mergeThreshold: 250 },
      { id: 'chain_total_500',  icon: '🔗', rarity: 'rare',
        nameJa: '超新星観測', condJa: '累計500回連鎖を発生させる',
        subJa: '「爆発的反応が繰り返される。」', mergeThreshold: 500 },
      { id: 'chain_total_1000', icon: '🔗', rarity: 'epic',
        nameJa: '銀河共鳴',   condJa: '累計1,000回連鎖を発生させる',
        subJa: '「宇宙全体が連動を始める。」', mergeThreshold: 1000 },
      { id: 'chain_total_5000', icon: '🔗', rarity: 'legendary',
        nameJa: '宇宙振動',   condJa: '累計5,000回連鎖を発生させる',
        subJa: '「空間そのものが揺れ動く。」', mergeThreshold: 5000 },
    ],
  },

  // ── 連続連鎖系 ────────────────────────────────────────────
  {
    id: 'chain_consec', icon: '♾️',
    nameJa: '連続連鎖', nameEn: 'Chain Streak', nameZh: '连续连锁',
    items: [
      { id: 'chain_consec_3',  icon: '♾️', rarity: 'common',
        nameJa: '反応継続',     condJa: '3ターン連続で連鎖を発生させる',
        subJa: '「反応は止まらない。」', mergeThreshold: 3 },
      { id: 'chain_consec_5',  icon: '♾️', rarity: 'rare',
        nameJa: '止まらない宇宙', condJa: '5ターン連続で連鎖を発生させる',
        subJa: '「連続反応が空間を支配する。」', mergeThreshold: 5 },
      { id: 'chain_consec_10', icon: '♾️', rarity: 'epic',
        nameJa: '永久機関',     condJa: '10ターン連続で連鎖を発生させる',
        subJa: '「エネルギーは尽きることがない。」', mergeThreshold: 10 },
    ],
  },

  // ── 5連鎖系 ──────────────────────────────────────────────
  {
    id: 'chain5', icon: '💫', chainLevel: 5,
    nameJa: '5連鎖', nameEn: '5-Chain', nameZh: '5连锁',
    items: [
      { id: 'chain5_1',    icon: '💫', rarity: 'uncommon',
        nameJa: '連鎖反応', condJa: '5連鎖を1回達成する',
        subJa: '「反応は連続し始めた。」', mergeThreshold: 1 },
      { id: 'chain5_10',   icon: '💫', rarity: 'uncommon',
        nameJa: '共鳴加速', condJa: '5連鎖を10回達成する',
        subJa: '「連鎖は安定して発生する。」', mergeThreshold: 10 },
      { id: 'chain5_25',   icon: '💫', rarity: 'uncommon',
        nameJa: '恒星共鳴', condJa: '5連鎖を25回達成する',
        subJa: '「エネルギー循環が形成される。」', mergeThreshold: 25 },
      { id: 'chain5_50',   icon: '💫', rarity: 'rare',
        nameJa: '反応拡大', condJa: '5連鎖を50回達成する',
        subJa: '「連鎖は規模を増し始めた。」', mergeThreshold: 50 },
      { id: 'chain5_100',  icon: '💫', rarity: 'rare',
        nameJa: '重力連結', condJa: '5連鎖を100回達成する',
        subJa: '「天体同士が影響を与え合う。」', mergeThreshold: 100 },
      { id: 'chain5_250',  icon: '💫', rarity: 'rare',
        nameJa: '連鎖制御', condJa: '5連鎖を250回達成する',
        subJa: '「高連鎖は偶然ではない。」', mergeThreshold: 250 },
      { id: 'chain5_500',  icon: '💫', rarity: 'epic',
        nameJa: '恒常反応', condJa: '5連鎖を500回達成する',
        subJa: '「連鎖は日常となった。」', mergeThreshold: 500 },
      { id: 'chain5_1000', icon: '💫', rarity: 'legendary',
        nameJa: '永久連鎖', condJa: '5連鎖を1,000回達成する',
        subJa: '「反応は終わることなく続く。」', mergeThreshold: 1000 },
    ],
  },

  // ── 6連鎖系 ──────────────────────────────────────────────
  {
    id: 'chain6', icon: '⚡', chainLevel: 6,
    nameJa: '6連鎖', nameEn: '6-Chain', nameZh: '6连锁',
    items: [
      { id: 'chain6_1',    icon: '⚡', rarity: 'rare',
        nameJa: '連鎖増幅',   condJa: '6連鎖を1回達成する',
        subJa: '「反応はさらに加速する。」', mergeThreshold: 1 },
      { id: 'chain6_10',   icon: '⚡', rarity: 'rare',
        nameJa: '重力増大',   condJa: '6連鎖を10回達成する',
        subJa: '「空間全体へ影響が広がる。」', mergeThreshold: 10 },
      { id: 'chain6_25',   icon: '⚡', rarity: 'rare',
        nameJa: '軌道干渉',   condJa: '6連鎖を25回達成する',
        subJa: '「連鎖は互いに干渉し始めた。」', mergeThreshold: 25 },
      { id: 'chain6_50',   icon: '⚡', rarity: 'rare',
        nameJa: '恒星活動',   condJa: '6連鎖を50回達成する',
        subJa: '「莫大なエネルギーが放出される。」', mergeThreshold: 50 },
      { id: 'chain6_100',  icon: '⚡', rarity: 'epic',
        nameJa: '超反応領域', condJa: '6連鎖を100回達成する',
        subJa: '「制御限界へ近づいていく。」', mergeThreshold: 100 },
      { id: 'chain6_250',  icon: '⚡', rarity: 'epic',
        nameJa: '連鎖熟練者', condJa: '6連鎖を250回達成する',
        subJa: '「高度な連鎖を自在に操る。」', mergeThreshold: 250 },
      { id: 'chain6_500',  icon: '⚡', rarity: 'legendary',
        nameJa: '宇宙共振',   condJa: '6連鎖を500回達成する',
        subJa: '「空間そのものが共鳴する。」', mergeThreshold: 500 },
      { id: 'chain6_1000', icon: '⚡', rarity: 'legendary',
        nameJa: '銀河反応',   condJa: '6連鎖を1,000回達成する',
        subJa: '「巨大規模の反応が連続する。」', mergeThreshold: 1000 },
    ],
  },

  // ── 7連鎖系 ──────────────────────────────────────────────
  {
    id: 'chain7', icon: '🌟', chainLevel: 7,
    nameJa: '7連鎖', nameEn: '7-Chain', nameZh: '7连锁',
    items: [
      { id: 'chain7_1',    icon: '🌟', rarity: 'rare',
        nameJa: '超新星反応', condJa: '7連鎖を1回達成する',
        subJa: '「爆発的反応が発生した。」', mergeThreshold: 1 },
      { id: 'chain7_10',   icon: '🌟', rarity: 'epic',
        nameJa: '重力暴走',   condJa: '7連鎖を10回達成する',
        subJa: '「反応は制御を離れ始める。」', mergeThreshold: 10 },
      { id: 'chain7_25',   icon: '🌟', rarity: 'epic',
        nameJa: '空間歪曲',   condJa: '7連鎖を25回達成する',
        subJa: '「重力が空間を歪ませる。」', mergeThreshold: 25 },
      { id: 'chain7_50',   icon: '🌟', rarity: 'epic',
        nameJa: '恒星崩壊',   condJa: '7連鎖を50回達成する',
        subJa: '「星々が連続して崩壊する。」', mergeThreshold: 50 },
      { id: 'chain7_100',  icon: '🌟', rarity: 'epic',
        nameJa: '超新星群',   condJa: '7連鎖を100回達成する',
        subJa: '「宇宙中で爆発が連鎖する。」', mergeThreshold: 100 },
      { id: 'chain7_250',  icon: '🌟', rarity: 'legendary',
        nameJa: '重力支配',   condJa: '7連鎖を250回達成する',
        subJa: '「巨大反応を完全に制御した。」', mergeThreshold: 250 },
      { id: 'chain7_500',  icon: '🌟', rarity: 'legendary',
        nameJa: '宇宙暴走',   condJa: '7連鎖を500回達成する',
        subJa: '「反応は宇宙全域へ広がる。」', mergeThreshold: 500 },
      { id: 'chain7_1000', icon: '🌟', rarity: 'secret',
        nameJa: '銀河崩壊',   condJa: '7連鎖を1,000回達成する',
        subJa: '「巨大構造すら崩れ去る。」', mergeThreshold: 1000 },
    ],
  },

  // ── 8連鎖系 ──────────────────────────────────────────────
  {
    id: 'chain8', icon: '💥', chainLevel: 8,
    nameJa: '8連鎖', nameEn: '8-Chain', nameZh: '8连锁',
    items: [
      { id: 'chain8_1',   icon: '💥', rarity: 'epic',
        nameJa: '重力崩壊', condJa: '8連鎖を1回達成する',
        subJa: '「重力が空間を押し潰し始める。」', mergeThreshold: 1 },
      { id: 'chain8_5',   icon: '💥', rarity: 'epic',
        nameJa: '特異反応', condJa: '8連鎖を5回達成する',
        subJa: '「通常では起こりえない反応。」', mergeThreshold: 5 },
      { id: 'chain8_10',  icon: '💥', rarity: 'legendary',
        nameJa: '空間断裂', condJa: '8連鎖を10回達成する',
        subJa: '「空間構造に亀裂が走る。」', mergeThreshold: 10 },
      { id: 'chain8_25',  icon: '💥', rarity: 'legendary',
        nameJa: '極限連鎖', condJa: '8連鎖を25回達成する',
        subJa: '「連鎖は限界領域へ到達した。」', mergeThreshold: 25 },
      { id: 'chain8_50',  icon: '💥', rarity: 'legendary',
        nameJa: '宇宙震動', condJa: '8連鎖を50回達成する',
        subJa: '「宇宙全体が揺らぎ始める。」', mergeThreshold: 50 },
      { id: 'chain8_100', icon: '💥', rarity: 'secret',
        nameJa: '観測不能', condJa: '8連鎖を100回達成する',
        subJa: '「もはや通常の観測では捉えられない。」', mergeThreshold: 100 },
    ],
  },

  // ── 9連鎖系 ──────────────────────────────────────────────
  {
    id: 'chain9', icon: '🌀', chainLevel: 9,
    nameJa: '9連鎖', nameEn: '9-Chain', nameZh: '9连锁',
    items: [
      { id: 'chain9_1',   icon: '🌀', rarity: 'epic',
        nameJa: '特異点',       condJa: '9連鎖を1回達成する',
        subJa: '「既知の法則が崩れ始める。」', mergeThreshold: 1 },
      { id: 'chain9_5',   icon: '🌀', rarity: 'legendary',
        nameJa: '重力井戸',     condJa: '9連鎖を5回達成する',
        subJa: '「強大な重力が周囲を歪ませる。」', mergeThreshold: 5 },
      { id: 'chain9_10',  icon: '🌀', rarity: 'legendary',
        nameJa: '時空歪曲',     condJa: '9連鎖を10回達成する',
        subJa: '「時間と空間が乱れ始めた。」', mergeThreshold: 10 },
      { id: 'chain9_25',  icon: '🌀', rarity: 'legendary',
        nameJa: '事象侵食',     condJa: '9連鎖を25回達成する',
        subJa: '「因果関係が侵食されていく。」', mergeThreshold: 25 },
      { id: 'chain9_50',  icon: '🌀', rarity: 'secret',
        nameJa: '宇宙圧壊',     condJa: '9連鎖を50回達成する',
        subJa: '「宇宙構造そのものが崩壊する。」', mergeThreshold: 50 },
      { id: 'chain9_100', icon: '🌀', rarity: 'secret',
        nameJa: '物理法則崩壊', condJa: '9連鎖を100回達成する',
        subJa: '「常識は完全に意味を失った。」', mergeThreshold: 100 },
    ],
  },

  // ── 10連鎖系 ─────────────────────────────────────────────
  {
    id: 'chain10', icon: '🌌', chainLevel: 10,
    nameJa: '10連鎖', nameEn: '10-Chain', nameZh: '10连锁',
    items: [
      { id: 'chain10_1',   icon: '🌌', rarity: 'legendary',
        nameJa: '銀河衝突',     condJa: '10連鎖を1回達成する',
        subJa: '「巨大構造同士が激突する。」', mergeThreshold: 1 },
      { id: 'chain10_5',   icon: '🌌', rarity: 'legendary',
        nameJa: '銀河融合',     condJa: '10連鎖を5回達成する',
        subJa: '「銀河は互いに飲み込み合う。」', mergeThreshold: 5 },
      { id: 'chain10_10',  icon: '🌌', rarity: 'legendary',
        nameJa: '超巨大反応',   condJa: '10連鎖を10回達成する',
        subJa: '「宇宙規模の反応が発生した。」', mergeThreshold: 10 },
      { id: 'chain10_25',  icon: '🌌', rarity: 'secret',
        nameJa: '宇宙波動',     condJa: '10連鎖を25回達成する',
        subJa: '「時空に巨大な波が広がる。」', mergeThreshold: 25 },
      { id: 'chain10_50',  icon: '🌌', rarity: 'secret',
        nameJa: '宇宙再編',     condJa: '10連鎖を50回達成する',
        subJa: '「宇宙構造が再構築されていく。」', mergeThreshold: 50 },
      { id: 'chain10_100', icon: '🌌', rarity: 'secret',
        nameJa: '大規模宇宙崩壊', condJa: '10連鎖を100回達成する',
        subJa: '「宇宙全体が崩壊へ向かう。」', mergeThreshold: 100 },
    ],
  },

  // ── 11連鎖系 ─────────────────────────────────────────────
  {
    id: 'chain11', icon: '🔮', chainLevel: 11,
    nameJa: '11連鎖', nameEn: '11-Chain', nameZh: '11连锁',
    items: [
      { id: 'chain11_1',  icon: '🔮', rarity: 'legendary',
        nameJa: '宇宙連鎖', condJa: '11連鎖を1回達成する',
        subJa: '「反応は宇宙規模へ到達した。」', mergeThreshold: 1 },
      { id: 'chain11_5',  icon: '🔮', rarity: 'secret',
        nameJa: '次元干渉', condJa: '11連鎖を5回達成する',
        subJa: '「次元構造へ影響が及び始める。」', mergeThreshold: 5 },
      { id: 'chain11_10', icon: '🔮', rarity: 'secret',
        nameJa: '観測限界', condJa: '11連鎖を10回達成する',
        subJa: '「観測可能領域を超越した。」', mergeThreshold: 10 },
      { id: 'chain11_25', icon: '🔮', rarity: 'secret',
        nameJa: '宇宙侵食', condJa: '11連鎖を25回達成する',
        subJa: '「現実そのものが侵食される。」', mergeThreshold: 25 },
      { id: 'chain11_50', icon: '🔮', rarity: 'secret',
        nameJa: '因果崩壊', condJa: '11連鎖を50回達成する',
        subJa: '「原因と結果の境界が消失した。」', mergeThreshold: 50 },
    ],
  },

  // ── 12連鎖系 ─────────────────────────────────────────────
  {
    id: 'chain12', icon: '♾️', chainLevel: 12,
    nameJa: '12連鎖', nameEn: '12-Chain', nameZh: '12连锁',
    items: [
      { id: 'chain12_1',  icon: '♾️', rarity: 'secret',
        nameJa: '宇宙震央', condJa: '12連鎖を1回達成する',
        subJa: '「宇宙の中心で反応が発生した。」', mergeThreshold: 1 },
      { id: 'chain12_5',  icon: '♾️', rarity: 'secret',
        nameJa: '時空連結', condJa: '12連鎖を5回達成する',
        subJa: '「空間同士が結びつき始める。」', mergeThreshold: 5 },
      { id: 'chain12_10', icon: '♾️', rarity: 'secret',
        nameJa: '無限反応', condJa: '12連鎖を10回達成する',
        subJa: '「終わりなき反応が続いていく。」', mergeThreshold: 10 },
      { id: 'chain12_25', icon: '♾️', rarity: 'secret',
        nameJa: '宇宙崩落', condJa: '12連鎖を25回達成する',
        subJa: '「宇宙構造が一斉に崩れ落ちる。」', mergeThreshold: 25 },
      { id: 'chain12_50', icon: '♾️', rarity: 'secret',
        nameJa: '存在崩壊', condJa: '12連鎖を50回達成する',
        subJa: '「存在の定義そのものが揺らぐ。」', mergeThreshold: 50 },
    ],
  },

  // ── 13連鎖系 ─────────────────────────────────────────────
  {
    id: 'chain13', icon: '🌑', chainLevel: 13,
    nameJa: '13連鎖', nameEn: '13-Chain', nameZh: '13连锁',
    items: [
      { id: 'chain13_1',  icon: '🌑', rarity: 'secret',
        nameJa: '超次元反応', condJa: '13連鎖を1回達成する',
        subJa: '「高次元領域で反応が発生した。」', mergeThreshold: 1 },
      { id: 'chain13_5',  icon: '🌑', rarity: 'secret',
        nameJa: '因果逆転',   condJa: '13連鎖を5回達成する',
        subJa: '「結果が原因を上回り始める。」', mergeThreshold: 5 },
      { id: 'chain13_10', icon: '🌑', rarity: 'secret',
        nameJa: '宇宙終端',   condJa: '13連鎖を10回達成する',
        subJa: '「宇宙の果てへ到達した。」', mergeThreshold: 10 },
      { id: 'chain13_25', icon: '🌑', rarity: 'secret',
        nameJa: '空間消滅',   condJa: '13連鎖を25回達成する',
        subJa: '「空間そのものが消え去る。」', mergeThreshold: 25 },
      { id: 'chain13_50', icon: '🌑', rarity: 'secret',
        nameJa: '観測者消失', condJa: '13連鎖を50回達成する',
        subJa: '「観測する存在すら残されない。」', mergeThreshold: 50 },
    ],
  },

  // ── 14連鎖系 ─────────────────────────────────────────────
  {
    id: 'chain14', icon: '❄️', chainLevel: 14,
    nameJa: '14連鎖', nameEn: '14-Chain', nameZh: '14连锁',
    items: [
      { id: 'chain14_1',  icon: '❄️', rarity: 'secret',
        nameJa: '宇宙収縮',   condJa: '14連鎖を1回達成する',
        subJa: '「宇宙は内側へ崩れ始める。」', mergeThreshold: 1 },
      { id: 'chain14_3',  icon: '❄️', rarity: 'secret',
        nameJa: '終焉反応',   condJa: '14連鎖を3回達成する',
        subJa: '「すべての反応が終末へ向かう。」', mergeThreshold: 3 },
      { id: 'chain14_5',  icon: '❄️', rarity: 'secret',
        nameJa: '熱的死',     condJa: '14連鎖を5回達成する',
        subJa: '「宇宙から熱が失われていく。」', mergeThreshold: 5 },
      { id: 'chain14_10', icon: '❄️', rarity: 'secret',
        nameJa: '新宇宙理論', condJa: '14連鎖を10回達成する',
        subJa: '「既存理論では説明できない。」', mergeThreshold: 10 },
      { id: 'chain14_25', icon: '❄️', rarity: 'secret',
        nameJa: '全崩壊観測', condJa: '14連鎖を25回達成する',
        subJa: '「宇宙崩壊の瞬間を観測した。」', mergeThreshold: 25 },
    ],
  },

  // ── 15連鎖系 ─────────────────────────────────────────────
  {
    id: 'chain15', icon: '🌅', chainLevel: 15,
    nameJa: '15連鎖', nameEn: '15-Chain', nameZh: '15连锁',
    items: [
      { id: 'chain15_1',  icon: '🌅', rarity: 'secret',
        nameJa: 'ビッグバン',     condJa: '15連鎖を1回達成する',
        subJa: '「宇宙誕生級の爆発が発生した。」', mergeThreshold: 1 },
      { id: 'chain15_3',  icon: '🌅', rarity: 'secret',
        nameJa: '宇宙創世',       condJa: '15連鎖を3回達成する',
        subJa: '「新たな宇宙が形成され始める。」', mergeThreshold: 3 },
      { id: 'chain15_5',  icon: '🌅', rarity: 'secret',
        nameJa: '再創造',         condJa: '15連鎖を5回達成する',
        subJa: '「終焉の先で宇宙は再構築される。」', mergeThreshold: 5 },
      { id: 'chain15_10', icon: '🌅', rarity: 'secret',
        nameJa: '観測者の到達点', condJa: '15連鎖を10回達成する',
        subJa: '「あなたは宇宙の限界へ辿り着いた。」', mergeThreshold: 10 },
      { id: 'chain15_25', icon: '🌅', rarity: 'secret',
        nameJa: '新宇宙創生',     condJa: '15連鎖を25回達成する',
        subJa: '「すべては再び始まりへ戻る。」', mergeThreshold: 25 },
    ],
  },

  // ── スキル連鎖系 ─────────────────────────────────────────
  {
    id: 'skill_chain', icon: '🎯',
    nameJa: 'スキル連鎖', nameEn: 'Skill Chain', nameZh: '技能连锁',
    items: [
      { id: 'skill_chain_1',  icon: '🎯', rarity: 'common',
        nameJa: '人工反応',     condJa: 'スキル使用後に連鎖を発生させる',
        subJa: '「人の手で反応が誘発された。」', mergeThreshold: 1 },
      { id: 'skill_chain_3',  icon: '🎯', rarity: 'uncommon',
        nameJa: '誘導共鳴',     condJa: 'スキル使用後に3連鎖を達成する',
        subJa: '「人工的な連鎖が形成される。」', mergeThreshold: 3 },
      { id: 'skill_chain_5',  icon: '🎯', rarity: 'rare',
        nameJa: '強制干渉',     condJa: 'スキル使用後に5連鎖を達成する',
        subJa: '「通常を超える反応を引き起こした。」', mergeThreshold: 5 },
      { id: 'skill_chain_6',  icon: '🎯', rarity: 'rare',
        nameJa: '重力誘導',     condJa: 'スキル使用後に6連鎖を達成する',
        subJa: '「反応は連続的に増幅していく。」', mergeThreshold: 6 },
      { id: 'skill_chain_7',  icon: '🎯', rarity: 'epic',
        nameJa: '暴走誘発',     condJa: 'スキル使用後に7連鎖を達成する',
        subJa: '「制御不能な連鎖が始まった。」', mergeThreshold: 7 },
      { id: 'skill_chain_8',  icon: '🎯', rarity: 'epic',
        nameJa: '空間歪曲',     condJa: 'スキル使用後に8連鎖を達成する',
        subJa: '「空間構造に異常が発生する。」', mergeThreshold: 8 },
      { id: 'skill_chain_9',  icon: '🎯', rarity: 'legendary',
        nameJa: '特異干渉',     condJa: 'スキル使用後に9連鎖を達成する',
        subJa: '「既知法則への干渉が始まる。」', mergeThreshold: 9 },
      { id: 'skill_chain_10', icon: '🎯', rarity: 'legendary',
        nameJa: '人工銀河衝突', condJa: 'スキル使用後に10連鎖を達成する',
        subJa: '「巨大反応が人為的に引き起こされた。」', mergeThreshold: 10 },
      { id: 'skill_chain_11', icon: '🎯', rarity: 'secret',
        nameJa: '次元侵食',     condJa: 'スキル使用後に11連鎖を達成する',
        subJa: '「高次元領域へ影響が及び始める。」', mergeThreshold: 11 },
      { id: 'skill_chain_12', icon: '🎯', rarity: 'secret',
        nameJa: '宇宙操作',     condJa: 'スキル使用後に12連鎖を達成する',
        subJa: '「宇宙そのものへ介入した。」', mergeThreshold: 12 },
      { id: 'skill_chain_13', icon: '🎯', rarity: 'secret',
        nameJa: '因果崩壊',     condJa: 'スキル使用後に13連鎖を達成する',
        subJa: '「原因と結果の境界が崩れ去る。」', mergeThreshold: 13 },
      { id: 'skill_chain_14', icon: '🎯', rarity: 'secret',
        nameJa: '終焉誘発',     condJa: 'スキル使用後に14連鎖を達成する',
        subJa: '「宇宙終焉級の反応が発生した。」', mergeThreshold: 14 },
      { id: 'skill_chain_15', icon: '🎯', rarity: 'secret',
        nameJa: '人工ビッグバン', condJa: 'スキル使用後に15連鎖を達成する',
        subJa: '「創世級の反応が発生した。」', mergeThreshold: 15 },
    ],
  },

  // ── スキル5連鎖系 ────────────────────────────────────────
  {
    id: 'skill_chain5', icon: '🎯', skillChainLevel: 5,
    nameJa: 'スキル5連鎖', nameEn: 'Skill 5-Chain', nameZh: '技能5连锁',
    items: [
      { id: 'skill5_1',   icon: '🎯', rarity: 'rare',
        nameJa: '反応誘導', condJa: 'スキル経由で5連鎖を1回達成する',
        subJa: '「連鎖は操作可能となった。」', mergeThreshold: 1 },
      { id: 'skill5_10',  icon: '🎯', rarity: 'rare',
        nameJa: '人工共鳴', condJa: 'スキル経由で5連鎖を10回達成する',
        subJa: '「反応は安定して誘導される。」', mergeThreshold: 10 },
      { id: 'skill5_25',  icon: '🎯', rarity: 'rare',
        nameJa: '制御連鎖', condJa: 'スキル経由で5連鎖を25回達成する',
        subJa: '「高連鎖は偶然ではない。」', mergeThreshold: 25 },
      { id: 'skill5_50',  icon: '🎯', rarity: 'epic',
        nameJa: '重力制御', condJa: 'スキル経由で5連鎖を50回達成する',
        subJa: '「連鎖は計画的に発生する。」', mergeThreshold: 50 },
      { id: 'skill5_100', icon: '🎯', rarity: 'epic',
        nameJa: '宇宙工学', condJa: 'スキル経由で5連鎖を100回達成する',
        subJa: '「宇宙反応の設計が始まった。」', mergeThreshold: 100 },
      { id: 'skill5_250', icon: '🎯', rarity: 'legendary',
        nameJa: '人工宇宙', condJa: 'スキル経由で5連鎖を250回達成する',
        subJa: '「巨大反応は自在に構築される。」', mergeThreshold: 250 },
    ],
  },

  // ── スキル6連鎖系 ────────────────────────────────────────
  {
    id: 'skill_chain6', icon: '💫', skillChainLevel: 6,
    nameJa: 'スキル6連鎖', nameEn: 'Skill 6-Chain', nameZh: '技能6连锁',
    items: [
      { id: 'skill6_1',   icon: '💫', rarity: 'rare',
        nameJa: '連鎖増幅',   condJa: 'スキル経由で6連鎖を1回達成する',
        subJa: '「反応規模が急激に増大する。」', mergeThreshold: 1 },
      { id: 'skill6_10',  icon: '💫', rarity: 'epic',
        nameJa: '空間共鳴',   condJa: 'スキル経由で6連鎖を10回達成する',
        subJa: '「周囲空間へ影響が広がる。」', mergeThreshold: 10 },
      { id: 'skill6_25',  icon: '💫', rarity: 'epic',
        nameJa: '反応設計者', condJa: 'スキル経由で6連鎖を25回達成する',
        subJa: '「連鎖は構築される時代へ入った。」', mergeThreshold: 25 },
      { id: 'skill6_50',  icon: '💫', rarity: 'legendary',
        nameJa: '宇宙増幅',   condJa: 'スキル経由で6連鎖を50回達成する',
        subJa: '「反応は宇宙規模へ到達する。」', mergeThreshold: 50 },
      { id: 'skill6_100', icon: '💫', rarity: 'legendary',
        nameJa: '超反応炉',   condJa: 'スキル経由で6連鎖を100回達成する',
        subJa: '「莫大な連鎖エネルギーが循環する。」', mergeThreshold: 100 },
    ],
  },

  // ── スキル7連鎖系 ────────────────────────────────────────
  {
    id: 'skill_chain7', icon: '⚡', skillChainLevel: 7,
    nameJa: 'スキル7連鎖', nameEn: 'Skill 7-Chain', nameZh: '技能7连锁',
    items: [
      { id: 'skill7_1',  icon: '⚡', rarity: 'epic',
        nameJa: '超新星誘発', condJa: 'スキル経由で7連鎖を1回達成する',
        subJa: '「爆発的反応が誘発された。」', mergeThreshold: 1 },
      { id: 'skill7_5',  icon: '⚡', rarity: 'epic',
        nameJa: '暴走制御',   condJa: 'スキル経由で7連鎖を5回達成する',
        subJa: '「危険領域の反応を安定化した。」', mergeThreshold: 5 },
      { id: 'skill7_10', icon: '⚡', rarity: 'legendary',
        nameJa: '重力暴走',   condJa: 'スキル経由で7連鎖を10回達成する',
        subJa: '「空間全体が歪み始める。」', mergeThreshold: 10 },
      { id: 'skill7_25', icon: '⚡', rarity: 'legendary',
        nameJa: '人工崩壊',   condJa: 'スキル経由で7連鎖を25回達成する',
        subJa: '「巨大構造の崩壊が再現された。」', mergeThreshold: 25 },
      { id: 'skill7_50', icon: '⚡', rarity: 'secret',
        nameJa: '宇宙反応炉', condJa: 'スキル経由で7連鎖を50回達成する',
        subJa: '「宇宙級反応を継続生成する。」', mergeThreshold: 50 },
    ],
  },

  // ── スキル8連鎖系 ────────────────────────────────────────
  {
    id: 'skill_chain8', icon: '🌊', skillChainLevel: 8,
    nameJa: 'スキル8連鎖', nameEn: 'Skill 8-Chain', nameZh: '技能8连锁',
    items: [
      { id: 'skill8_1',  icon: '🌊', rarity: 'epic',
        nameJa: '空間誘爆', condJa: 'スキル経由で8連鎖を1回達成する',
        subJa: '「空間規模の連鎖が誘発された。」', mergeThreshold: 1 },
      { id: 'skill8_3',  icon: '🌊', rarity: 'epic',
        nameJa: '重力干渉', condJa: 'スキル経由で8連鎖を3回達成する',
        subJa: '「重力構造へ異常が発生する。」', mergeThreshold: 3 },
      { id: 'skill8_5',  icon: '🌊', rarity: 'legendary',
        nameJa: '空間断裂', condJa: 'スキル経由で8連鎖を5回達成する',
        subJa: '「空間そのものに裂け目が走る。」', mergeThreshold: 5 },
      { id: 'skill8_10', icon: '🌊', rarity: 'legendary',
        nameJa: '人工崩壊', condJa: 'スキル経由で8連鎖を10回達成する',
        subJa: '「巨大反応が安定して再現される。」', mergeThreshold: 10 },
      { id: 'skill8_25', icon: '🌊', rarity: 'legendary',
        nameJa: '宇宙歪曲', condJa: 'スキル経由で8連鎖を25回達成する',
        subJa: '「宇宙構造が継続的に歪み始める。」', mergeThreshold: 25 },
      { id: 'skill8_50', icon: '🌊', rarity: 'secret',
        nameJa: '極限誘導', condJa: 'スキル経由で8連鎖を50回達成する',
        subJa: '「限界領域の反応を自在に操る。」', mergeThreshold: 50 },
    ],
  },

  // ── スキル9連鎖系 ────────────────────────────────────────
  {
    id: 'skill_chain9', icon: '🔮', skillChainLevel: 9,
    nameJa: 'スキル9連鎖', nameEn: 'Skill 9-Chain', nameZh: '技能9连锁',
    items: [
      { id: 'skill9_1',  icon: '🔮', rarity: 'legendary',
        nameJa: '特異点誘導', condJa: 'スキル経由で9連鎖を1回達成する',
        subJa: '「特異反応が人工的に形成された。」', mergeThreshold: 1 },
      { id: 'skill9_3',  icon: '🔮', rarity: 'legendary',
        nameJa: '時空歪曲',   condJa: 'スキル経由で9連鎖を3回達成する',
        subJa: '「時空構造が乱れ始める。」', mergeThreshold: 3 },
      { id: 'skill9_5',  icon: '🔮', rarity: 'legendary',
        nameJa: '因果干渉',   condJa: 'スキル経由で9連鎖を5回達成する',
        subJa: '「反応は因果関係へ到達した。」', mergeThreshold: 5 },
      { id: 'skill9_10', icon: '🔮', rarity: 'secret',
        nameJa: '宇宙圧壊',   condJa: 'スキル経由で9連鎖を10回達成する',
        subJa: '「宇宙規模の崩壊反応が発生する。」', mergeThreshold: 10 },
      { id: 'skill9_25', icon: '🔮', rarity: 'secret',
        nameJa: '次元崩落',   condJa: 'スキル経由で9連鎖を25回達成する',
        subJa: '「次元境界が維持できなくなる。」', mergeThreshold: 25 },
      { id: 'skill9_50', icon: '🔮', rarity: 'secret',
        nameJa: '法則侵食',   condJa: 'スキル経由で9連鎖を50回達成する',
        subJa: '「既知法則が少しずつ侵食される。」', mergeThreshold: 50 },
    ],
  },

  // ── スキル10連鎖系 ───────────────────────────────────────
  {
    id: 'skill_chain10', icon: '🌌', skillChainLevel: 10,
    nameJa: 'スキル10連鎖', nameEn: 'Skill 10-Chain', nameZh: '技能10连锁',
    items: [
      { id: 'skill10_1',  icon: '🌌', rarity: 'legendary',
        nameJa: '人工銀河衝突', condJa: 'スキル経由で10連鎖を1回達成する',
        subJa: '「巨大構造同士が人為的に衝突した。」', mergeThreshold: 1 },
      { id: 'skill10_3',  icon: '🌌', rarity: 'legendary',
        nameJa: '銀河融合',     condJa: 'スキル経由で10連鎖を3回達成する',
        subJa: '「銀河規模の反応が連続する。」', mergeThreshold: 3 },
      { id: 'skill10_5',  icon: '🌌', rarity: 'secret',
        nameJa: '宇宙波動',     condJa: 'スキル経由で10連鎖を5回達成する',
        subJa: '「宇宙全体へ巨大な波が広がる。」', mergeThreshold: 5 },
      { id: 'skill10_10', icon: '🌌', rarity: 'secret',
        nameJa: '超巨大反応',   condJa: 'スキル経由で10連鎖を10回達成する',
        subJa: '「宇宙規模反応を安定化した。」', mergeThreshold: 10 },
      { id: 'skill10_25', icon: '🌌', rarity: 'secret',
        nameJa: '宇宙再編',     condJa: 'スキル経由で10連鎖を25回達成する',
        subJa: '「宇宙構造が書き換えられていく。」', mergeThreshold: 25 },
      { id: 'skill10_50', icon: '🌌', rarity: 'secret',
        nameJa: '創世干渉',     condJa: 'スキル経由で10連鎖を50回達成する',
        subJa: '「創世級反応へ干渉を始めた。」', mergeThreshold: 50 },
    ],
  },

  // ── 同時存在系（宇宙塵） ─────────────────────────────────────
  {
    id: 'sim_dust', icon: '💫', simIndex: 0,
    nameJa: '宇宙塵同時存在', nameEn: 'Cosmic Dust Coexist', nameZh: '宇宙尘共存',
    items: [
      { id: 'sim_dust_5',  icon: '💫', rarity: 'common',
        nameJa: '漂う粒子群', condJa: '宇宙塵を5個同時に存在させる',
        subJa: '「微細な粒子が空間を漂う。」', simThreshold: 5 },
      { id: 'sim_dust_10', icon: '💫', rarity: 'common',
        nameJa: '星間物質帯', condJa: '宇宙塵を10個同時に存在させる',
        subJa: '「宇宙は素材で満たされていく。」', simThreshold: 10 },
      { id: 'sim_dust_15', icon: '💫', rarity: 'uncommon',
        nameJa: '分子雲形成', condJa: '宇宙塵を15個同時に存在させる',
        subJa: '「新たな天体の種が集まり始めた。」', simThreshold: 15 },
      { id: 'sim_dust_20', icon: '💫', rarity: 'rare',
        nameJa: '原始宇宙',   condJa: '宇宙塵を20個同時に存在させる',
        subJa: '「始まりの宇宙が再現される。」', simThreshold: 20 },
    ],
  },

  // ── 同時存在系（小惑星） ─────────────────────────────────────
  {
    id: 'sim_asteroid', icon: '🪨', simIndex: 1,
    nameJa: '小惑星同時存在', nameEn: 'Asteroid Coexist', nameZh: '小行星共存',
    items: [
      { id: 'sim_aster_5',  icon: '🪨', rarity: 'common',
        nameJa: '漂流岩塊',   condJa: '小惑星を5個同時に存在させる',
        subJa: '「岩石群が宇宙を漂う。」', simThreshold: 5 },
      { id: 'sim_aster_10', icon: '🪨', rarity: 'uncommon',
        nameJa: '小惑星帯',   condJa: '小惑星を10個同時に存在させる',
        subJa: '「無数の岩塊が軌道を巡る。」', simThreshold: 10 },
      { id: 'sim_aster_15', icon: '🪨', rarity: 'rare',
        nameJa: '衝突危険域', condJa: '小惑星を15個同時に存在させる',
        subJa: '「危険な空間領域が形成される。」', simThreshold: 15 },
      { id: 'sim_aster_20', icon: '🪨', rarity: 'epic',
        nameJa: '岩石宇宙',   condJa: '小惑星を20個同時に存在させる',
        subJa: '「宇宙は岩塊で埋め尽くされた。」', simThreshold: 20 },
    ],
  },

  // ── 同時存在系（月） ─────────────────────────────────────────
  {
    id: 'sim_moon', icon: '🌙', simIndex: 2,
    nameJa: '月同時存在', nameEn: 'Moon Coexist', nameZh: '月亮共存',
    items: [
      { id: 'sim_moon_2',  icon: '🌙', rarity: 'common',
        nameJa: '双子衛星', condJa: '月を2個同時に存在させる',
        subJa: '「複数の衛星が周回を始める。」', simThreshold: 2 },
      { id: 'sim_moon_5',  icon: '🌙', rarity: 'uncommon',
        nameJa: '衛星群',   condJa: '月を5個同時に存在させる',
        subJa: '「静かな光が宇宙を照らす。」', simThreshold: 5 },
      { id: 'sim_moon_10', icon: '🌙', rarity: 'rare',
        nameJa: '潮汐領域', condJa: '月を10個同時に存在させる',
        subJa: '「重力が複雑に干渉し始める。」', simThreshold: 10 },
      { id: 'sim_moon_15', icon: '🌙', rarity: 'epic',
        nameJa: '月面宇宙', condJa: '月を15個同時に存在させる',
        subJa: '「無数の衛星が空間を埋める。」', simThreshold: 15 },
    ],
  },

  // ── 同時存在系（地球） ───────────────────────────────────────
  {
    id: 'sim_earth', icon: '🌍', simIndex: 3,
    nameJa: '地球同時存在', nameEn: 'Earth Coexist', nameZh: '地球共存',
    items: [
      { id: 'sim_earth_2',  icon: '🌍', rarity: 'uncommon',
        nameJa: '青い星々',   condJa: '地球を2個同時に存在させる',
        subJa: '「生命の可能性が複数誕生した。」', simThreshold: 2 },
      { id: 'sim_earth_5',  icon: '🌍', rarity: 'rare',
        nameJa: '生命圏群',   condJa: '地球を5個同時に存在させる',
        subJa: '「豊かな環境が宇宙へ広がる。」', simThreshold: 5 },
      { id: 'sim_earth_10', icon: '🌍', rarity: 'epic',
        nameJa: '文明領域',   condJa: '地球を10個同時に存在させる',
        subJa: '「知性が複数の星で芽生える。」', simThreshold: 10 },
      { id: 'sim_earth_15', icon: '🌍', rarity: 'legendary',
        nameJa: '多世界宇宙', condJa: '地球を15個同時に存在させる',
        subJa: '「生命は宇宙全域へ拡散した。」', simThreshold: 15 },
    ],
  },

  // ── 同時存在系（木星） ───────────────────────────────────────
  {
    id: 'sim_jupiter', icon: '🪐', simIndex: 4,
    nameJa: '木星同時存在', nameEn: 'Jupiter Coexist', nameZh: '木星共存',
    items: [
      { id: 'sim_jup_2',  icon: '🪐', rarity: 'rare',
        nameJa: '巨大惑星群',   condJa: '木星を2個同時に存在させる',
        subJa: '「巨大重力源が並び立つ。」', simThreshold: 2 },
      { id: 'sim_jup_5',  icon: '🪐', rarity: 'epic',
        nameJa: '重力支配域',   condJa: '木星を5個同時に存在させる',
        subJa: '「周囲空間が重力に支配される。」', simThreshold: 5 },
      { id: 'sim_jup_10', icon: '🪐', rarity: 'legendary',
        nameJa: 'ガス巨星時代', condJa: '木星を10個同時に存在させる',
        subJa: '「巨大惑星が宇宙を埋め尽くす。」', simThreshold: 10 },
    ],
  },

  // ── 同時存在系（太陽） ───────────────────────────────────────
  {
    id: 'sim_sun', icon: '☀️', simIndex: 5,
    nameJa: '太陽同時存在', nameEn: 'Sun Coexist', nameZh: '太阳共存',
    items: [
      { id: 'sim_sun_2',  icon: '☀️', rarity: 'rare',
        nameJa: '双子恒星', condJa: '太陽を2個同時に存在させる',
        subJa: '「複数の恒星が輝き始める。」', simThreshold: 2 },
      { id: 'sim_sun_5',  icon: '☀️', rarity: 'epic',
        nameJa: '恒星群',   condJa: '太陽を5個同時に存在させる',
        subJa: '「宇宙は光で満たされる。」', simThreshold: 5 },
      { id: 'sim_sun_10', icon: '☀️', rarity: 'legendary',
        nameJa: '恒星宇宙', condJa: '太陽を10個同時に存在させる',
        subJa: '「無数の恒星が空間を照らす。」', simThreshold: 10 },
    ],
  },

  // ── 同時存在系（赤色巨星） ───────────────────────────────────
  {
    id: 'sim_redgiant', icon: '🔴', simIndex: 6,
    nameJa: '赤色巨星同時存在', nameEn: 'Red Giant Coexist', nameZh: '红巨星共存',
    items: [
      { id: 'sim_red_2', icon: '🔴', rarity: 'epic',
        nameJa: '老いた恒星', condJa: '赤色巨星を2個同時に存在させる',
        subJa: '「終焉へ向かう星々が並ぶ。」', simThreshold: 2 },
      { id: 'sim_red_3', icon: '🔴', rarity: 'legendary',
        nameJa: '赤色宇宙',   condJa: '赤色巨星を3個同時に存在させる',
        subJa: '「赤い光が宇宙を染め上げる。」', simThreshold: 3 },
      { id: 'sim_red_5', icon: '🔴', rarity: 'secret',
        nameJa: '終末時代',   condJa: '赤色巨星を5個同時に存在させる',
        subJa: '「宇宙全体が老いていく。」', simThreshold: 5 },
    ],
  },

  // ── 同時存在系（白色矮星） ───────────────────────────────────
  {
    id: 'sim_whitedwarf', icon: '⭐', simIndex: 7,
    nameJa: '白色矮星同時存在', nameEn: 'White Dwarf Coexist', nameZh: '白矮星共存',
    items: [
      { id: 'sim_white_2', icon: '⭐', rarity: 'epic',
        nameJa: '燃え尽きた星々', condJa: '白色矮星を2個同時に存在させる',
        subJa: '「静かな残骸が漂う。」', simThreshold: 2 },
      { id: 'sim_white_3', icon: '⭐', rarity: 'legendary',
        nameJa: '冷えた宇宙',     condJa: '白色矮星を3個同時に存在させる',
        subJa: '「熱を失った星々が増加する。」', simThreshold: 3 },
      { id: 'sim_white_5', icon: '⭐', rarity: 'secret',
        nameJa: '熱的死の予兆',   condJa: '白色矮星を5個同時に存在させる',
        subJa: '「宇宙は静かな終焉へ向かう。」', simThreshold: 5 },
    ],
  },

  // ── 同時存在系（中性子星） ───────────────────────────────────
  {
    id: 'sim_neutron', icon: '💠', simIndex: 8,
    nameJa: '中性子星同時存在', nameEn: 'Neutron Star Coexist', nameZh: '中子星共存',
    items: [
      { id: 'sim_neu_2', icon: '💠', rarity: 'legendary',
        nameJa: '高密度天体群', condJa: '中性子星を2個同時に存在させる',
        subJa: '「極限密度の天体が並ぶ。」', simThreshold: 2 },
      { id: 'sim_neu_3', icon: '💠', rarity: 'secret',
        nameJa: '重力異常領域', condJa: '中性子星を3個同時に存在させる',
        subJa: '「空間構造そのものが歪み始める。」', simThreshold: 3 },
    ],
  },

  // ── 同時存在系（ブラックホール） ─────────────────────────────
  {
    id: 'sim_blackhole', icon: '🌑', simIndex: 9,
    nameJa: 'ブラックホール同時存在', nameEn: 'Black Hole Coexist', nameZh: '黑洞共存',
    items: [
      { id: 'sim_bh_2', icon: '🌑', rarity: 'legendary',
        nameJa: '双子特異点', condJa: 'ブラックホールを2個同時に存在させる',
        subJa: '「光すら逃れられない領域が増殖する。」', simThreshold: 2 },
      { id: 'sim_bh_3', icon: '🌑', rarity: 'secret',
        nameJa: '事象崩壊',   condJa: 'ブラックホールを3個同時に存在させる',
        subJa: '「宇宙構造が維持できなくなる。」', simThreshold: 3 },
    ],
  },

  // ── 同時存在系（銀河） ───────────────────────────────────────
  {
    id: 'sim_galaxy', icon: '🌌', simIndex: 10,
    nameJa: '銀河同時存在', nameEn: 'Galaxy Coexist', nameZh: '银河共存',
    items: [
      { id: 'sim_gal_2', icon: '🌌', rarity: 'secret',
        nameJa: '銀河共存', condJa: '銀河を2個同時に存在させる',
        subJa: '「巨大構造同士が並び立つ。」', simThreshold: 2 },
    ],
  },

  // ── 同時存在系（銀河団） ─────────────────────────────────────
  {
    id: 'sim_cluster', icon: '🌐', simIndex: 11,
    nameJa: '銀河団同時存在', nameEn: 'Galaxy Cluster Coexist', nameZh: '星系团共存',
    items: [
      { id: 'sim_clus_2', icon: '🌐', rarity: 'secret',
        nameJa: '宇宙網', condJa: '銀河団を2個同時に存在させる',
        subJa: '「宇宙規模の構造が形成された。」', simThreshold: 2 },
    ],
  },

  // ── スキル系（未実装・今後追加予定） ──────────────────────
  // {
  //   id: 'skill', icon: '🎯',
  //   nameJa: 'スキル', nameEn: 'Skill', nameZh: '技能',
  //   items: [
  //     {
  //       id: 'skill_bomb_first', icon: '💣',
  //       nameJa: '爆弾を使った', condJa: '爆弾スキルを使用する',
  //       subJa: '「...」',
  //       rarity: 'common',
  //     },
  //   ],
  // },

  // ── ログイン系（未実装・今後追加予定） ──────────────────────
  // {
  //   id: 'login', icon: '📅',
  //   nameJa: 'ログイン', nameEn: 'Login', nameZh: '登录',
  //   items: [],
  // },

];
