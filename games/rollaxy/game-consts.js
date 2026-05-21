'use strict';

// ============================================================
// GAME-CONSTS — ランキング・シェアページ共通定数
// game.js (CFG.BODIES) と src/constants.js と内容を同期すること。
// ES モジュール非対応のページから <script> タグで読み込む用途。
// ============================================================

const BODY_EMOJIS = ['💫','🪨','🌙','🌍','🪐','☀️','🔴','⭐','💠','🌑','🌌','🌐'];

function getTitle(score, highestTier) {
  if (highestTier >= 11) return '銀河団創造者';
  if (score >= 2000)     return '宇宙の覇者';
  if (score >= 1000)     return '銀河の探検家';
  if (score >=  600)     return '太陽の支配者';
  if (score >=  300)     return '惑星の開拓者';
  if (score >=  100)     return '星の冒険者';
  return '宇宙の旅人';
}

// ranking ページでは fmtScore、src/constants.js では scoreWithComma として使われている。
// どちらの呼び名でも使えるようにエイリアスを張る。
function fmtScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
const scoreWithComma = fmtScore;
