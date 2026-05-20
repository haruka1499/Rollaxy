'use strict';

// ============================================================
// LANG — 多言語対応。新言語追加は LANGS にエントリを追加するだけ。
// LANG_ORDER で表示順を制御。
// ============================================================
const LANGS = {
  ja: {
    name:        '日本語',
    score:       'スコア',
    best:        '最高',
    next:        '次の天体',
    gameOver:    'ゲームオーバー',
    scoreResult: 'スコア',
    newRecord:   '🏆 新記録！',
    retry:       'もう一度',
    settings:    '設定',
    resume:      'ゲームに戻る',
    reset:       'リセット',
    title:       'ころころ宇宙',
    start:       'スタート',
    skillBomb:    '爆弾',
    skillUpgrade: '強化',
    skillDelete:  '削除',
    chain: n => `${n}連鎖！`,
    rouletteTitle: '4連鎖！ スキル獲得',
    rouletteStop: '停止',
    bombDesc:    '範囲内の天体を消去',
    upgradeDesc: '天体を1段階強化',
    deleteDesc:  '天体を削除',
    chooseSkill:   'スキルを選択',
    confirmDelete: 'を削除',
    queueWaiting:  n => `あと ${n} 件待機中`,
    queueMore:     n => `あと ${n} 件`,
    reward:        '報酬',
    autoshow:      on => `報酬自動表示: ${on ? 'ON' : 'OFF'}`,
    sfxVolume:     '効果音',
    shareBtn:      'X でシェア',
    sharePreparing: '準備中...',
    tweetText:     n => `ころころ宇宙で ${n} 点獲得！ #ころころ宇宙`,
    shareNote:     '📥 盤面画像をダウンロードしました。ツイートに添付してください。',
  },
  en: {
    name:        'English',
    score:       'Score',
    best:        'Best',
    next:        'Next',
    gameOver:    'Game Over',
    scoreResult: 'Score',
    newRecord:   '🏆 New Record!',
    retry:       'Play Again',
    settings:    'Settings',
    resume:      'Resume',
    reset:       'Reset',
    title:       'Rollaxy',
    start:       'Start',
    skillBomb:    'Bomb',
    skillUpgrade: 'Upgrade',
    skillDelete:  'Delete',
    chain: n => `${n} Chain!`,
    rouletteTitle: '4 Chain! Skill Reward',
    rouletteStop: 'STOP',
    bombDesc:    'Destroy nearby bodies',
    upgradeDesc: 'Upgrade a body by 1',
    deleteDesc:  'Remove a body',
    chooseSkill:   'Choose Skill',
    confirmDelete: ' Delete',
    queueWaiting:  n => `+${n} queued`,
    queueMore:     n => `+${n} more`,
    reward:        'Reward',
    autoshow:      on => `Auto Reward: ${on ? 'ON' : 'OFF'}`,
    sfxVolume:     'SFX',
    shareBtn:      'Share on X',
    sharePreparing: 'Preparing...',
    tweetText:     n => `I scored ${n} in Rollaxy! #Rollaxy`,
    shareNote:     '📥 Image downloaded. Please attach it to your tweet.',
  },
};

// 言語ボタンの表示順
const LANG_ORDER = ['ja', 'en'];

// 現在の言語（localStorage で永続化）
let currentLang = localStorage.getItem('rollaxy_lang') || 'ja';
if (!LANGS[currentLang]) currentLang = 'ja';

// キーから現在言語の文字列を取得
function T(key) {
  return (LANGS[currentLang] || LANGS.ja)[key];
}

// 言語を切り替えて画面に反映
function setLang(code) {
  if (!LANGS[code]) return;
  currentLang = code;
  localStorage.setItem('rollaxy_lang', code);
  applyLang();
}

// data-i18n 属性を持つ全要素のテキストを更新し、langchange イベントを発火
function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = T(el.dataset.i18n);
    if (typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  // game.js 側でスコア表示など動的文字列を再描画させる
  document.dispatchEvent(new Event('langchange'));
}
