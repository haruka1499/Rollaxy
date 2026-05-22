// ============================================================
// 共通定数（フロントエンド config.js と同期すること）
// ============================================================
export const GAME_ID  = 'rollaxy';
export const SITE_URL = 'https://novoragame.com';

// tier n を達成するには最低限これだけのスコアが必要（粗い整合性チェック用）
// tier 0〜4 は MAX_SPAWN=4 によりマージなしで直接スポーン可能 → min=0
// tier 5〜11 はスポーン不可・合成必須 → その tier を生み出す合成1回分のスコアが下限
// （config.js BODIES[n].s と同値: sun=16, red_giant=22, ... galaxy_cluster=68）
export const MIN_SCORE_FOR_TIER = [0, 0, 0, 0, 0, 16, 22, 29, 37, 46, 56, 68];

export const BODY_EMOJIS = ['💫','🪨','🌙','🌍','🪐','☀️','🔴','⭐','💠','🌑','🌌','🌐'];
export const BODY_COLORS = [
  '#b0a090','#807060','#d0c8b0','#3388cc','#d4a870','#ffcc00',
  '#cc2200','#c8d8ff','#2244cc','#110022','#7744cc','#aa44ff',
];
export const BODY_RADII = [12,18,25,33,42,51,61,70,79,88,97,106];
// config.js の BODIES[].key と同順（tier インデックス対応）
export const BODY_KEYS = [
  'dust','asteroid','moon','earth','jupiter','sun',
  'red_giant','white_dwarf','neutron_star','black_hole','galaxy','galaxy_cluster',
];

// OGP・share ページの SVG 画像オーバーレイ調整値
// ogp-adjust.html で目視調整して得た値。scale: 画像径/円径、dx/dy: 中心オフセット（円半径比）
export const BODY_IMAGE_ADJUST = [
  { scale: 1.20, dx:  0.02, dy:  0.01 }, // 0:  ダスト
  { scale: 1.41, dx:  0.02, dy:  0.05 }, // 1:  小惑星
  { scale: 1.23, dx:  0.02, dy:  0.02 }, // 2:  月
  { scale: 1.18, dx:  0.03, dy:  0.02 }, // 3:  地球
  { scale: 1.10, dx:  0.00, dy:  0.02 }, // 4:  木星
  { scale: 1.18, dx: -0.01, dy:  0.00 }, // 5:  太陽
  { scale: 1.15, dx: -0.01, dy:  0.00 }, // 6:  赤色巨星
  { scale: 1.34, dx:  0.00, dy:  0.01 }, // 7:  白色矮星
  { scale: 2.15, dx:  0.00, dy:  0.00 }, // 8:  中性子星
  { scale: 1.28, dx:  0.01, dy:  0.08 }, // 9:  ブラックホール
  { scale: 1.03, dx:  0.00, dy:  0.03 }, // 10: 銀河
  { scale: 1.06, dx:  0.00, dy:  0.00 }, // 11: 銀河団
];

// score + highestTier → 称号文字列
export function getTitle(score, highestTier) {
  if (highestTier >= 11) return '銀河団創造者';
  if (score >= 2000)     return '宇宙の覇者';
  if (score >= 1000)     return '銀河の探検家';
  if (score >=  600)     return '太陽の支配者';
  if (score >=  300)     return '惑星の開拓者';
  if (score >=  100)     return '星の冒険者';
  return '宇宙の旅人';
}

// 称号レベル (0〜6)
export function getTitleLevel(score, highestTier) {
  if (highestTier >= 11) return 6;
  if (score >= 2000)     return 5;
  if (score >= 1000)     return 4;
  if (score >=  600)     return 3;
  if (score >=  300)     return 2;
  if (score >=  100)     return 1;
  return 0;
}

// 各言語の称号リスト（getTitleLevel のインデックスと対応）
const _TITLES = {
  ja: ['宇宙の旅人','星の冒険者','惑星の開拓者','太陽の支配者','銀河の探検家','宇宙の覇者','銀河団創造者'],
  en: ['Space Wanderer','Star Explorer','Planet Pioneer','Solar Sovereign','Galaxy Explorer','Cosmic Ruler','Cluster Creator'],
  zh: ['宇宙旅者','星际探险者','行星开拓者','太阳主宰者','银河探险家','宇宙霸主','星系团创造者'],
};
// 後方互換用
export const TITLE_EN = _TITLES.en;

// 多言語対応 getTitle
export function getTitleI18n(score, highestTier, lang = 'ja') {
  const level  = getTitleLevel(score, highestTier);
  const titles = _TITLES[lang] ?? _TITLES.ja;
  return titles[level];
}

export function scoreWithComma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
