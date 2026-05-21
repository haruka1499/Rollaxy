// ============================================================
// 共通定数（フロントエンド config.js と同期すること）
// ============================================================
export const GAME_ID  = 'rollaxy';
export const SITE_URL = 'https://novoragame.com';

// tier n を達成するには最低限これだけのスコアが必要（粗い整合性チェック用）
// 計算根拠: tier n を作るには tier 0 が 2^n 個必要 → スコアの合計下限
export const MIN_SCORE_FOR_TIER = [0, 1, 3, 6, 11, 20, 35, 60, 100, 160, 250, 380];

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

// 英語フォールバック称号
export const TITLE_EN = [
  'Space Wanderer','Star Explorer','Planet Pioneer',
  'Solar Sovereign','Galaxy Explorer','Cosmic Ruler','Cluster Creator',
];

export function scoreWithComma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
