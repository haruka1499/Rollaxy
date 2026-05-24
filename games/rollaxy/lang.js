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
    menuTitle:   'メニュー',
    settingsBack: '← 戻る',
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
    rankingBtn:    '🏆 ランキング',
    gamesLink:     '🎮 ゲーム一覧',
    displayNameLabel: '表示名',
    displayNamePlaceholder: '15文字以内（日本語OK）',
    displayNameSave: '保存',
    displayNameSaved: '✓ 保存しました',
    displayNameEmpty: '1文字以上入力してください',
    profileLink: '👤 プロフィール',
    startNameHint:   'ここで名前を変えられます ✎',
    startNameHintOk: 'わかった',
    achievements:   '🏆 実績',
    achNewUnlock:   '実績解除！',
    achBack:        '← 戻る',
    tutHint:        'タップして強化！',
    tweetText:     n => `ころころ宇宙で ${n} 点獲得！ #ころころ宇宙`,
    shareNote:     '📥 盤面画像をダウンロードしました。ツイートに添付してください。',
    rankPct:       pct => `全体の上位 ${pct}% ✨`,
    skillHintBomb:    '💣 次の投下に爆弾を使います。着地後に爆発！',
    skillHintUpgrade: '⬆ 天体を1つタップして1段階強化します',
    skillHintDelete:  '✕ 天体を1つタップして削除します',
    forcedTitleBomb:    '爆弾モード',
    forcedDescBomb:     '爆弾を落とせ！',
    forcedTitleUpgrade: '進化モード',
    forcedDescUpgrade:  '天体を進化させよ',
    forcedTitleDelete:  '消去モード',
    forcedDescDelete:   '削除する天体を選択せよ',
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
    menuTitle:   'Menu',
    settingsBack: '← Back',
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
    rankingBtn:    '🏆 Ranking',
    gamesLink:     '🎮 Games',
    displayNameLabel: 'Display Name',
    displayNamePlaceholder: 'Up to 15 chars',
    displayNameSave: 'Save',
    displayNameSaved: '✓ Saved',
    displayNameEmpty: 'Please enter at least 1 character',
    profileLink: '👤 Profile',
    startNameHint:   'You can change your name here ✎',
    startNameHintOk: 'Got it',
    achievements:   '🏆 Achievements',
    achNewUnlock:   'Achievement Unlocked!',
    achBack:        '← Back',
    tutHint:        'Tap to Upgrade!',
    tweetText:     n => `I scored ${n} in Rollaxy! #Rollaxy`,
    shareNote:     '📥 Image downloaded. Please attach it to your tweet.',
    rankPct:       pct => `Top ${pct}% overall ✨`,
    skillHintBomb:    '💣 Bomb drops as your next body. Explodes on landing!',
    skillHintUpgrade: '⬆ Tap a body to upgrade it by 1 tier',
    skillHintDelete:  '✕ Tap a body to remove it',
    forcedTitleBomb:    'Bomb Mode',
    forcedDescBomb:     'Drop the bomb!',
    forcedTitleUpgrade: 'Evolve Mode',
    forcedDescUpgrade:  'Evolve a body!',
    forcedTitleDelete:  'Erase Mode',
    forcedDescDelete:   'Select a body to erase',
  },
  zh: {
    name:        '中文',
    score:       '分数',
    best:        '最高',
    next:        '下一个',
    gameOver:    '游戏结束',
    scoreResult: '分数',
    newRecord:   '🏆 新纪录！',
    retry:       '再来一次',
    menuTitle:   '菜单',
    settingsBack: '← 返回',
    settings:    '设置',
    resume:      '返回游戏',
    reset:       '重置',
    title:       'Rollaxy',
    start:       '开始',
    skillBomb:    '炸弹',
    skillUpgrade: '强化',
    skillDelete:  '删除',
    chain: n => `${n}连锁！`,
    rouletteTitle: '4连锁！ 获得技能',
    rouletteStop: '停止',
    bombDesc:    '消除范围内的天体',
    upgradeDesc: '天体升级1阶',
    deleteDesc:  '删除天体',
    chooseSkill:   '选择技能',
    confirmDelete: ' 删除',
    queueWaiting:  n => `还有 ${n} 个等待`,
    queueMore:     n => `还有 ${n} 个`,
    reward:        '奖励',
    autoshow:      on => `自动显示奖励: ${on ? '开' : '关'}`,
    sfxVolume:     '音效',
    shareBtn:      '分享到 X',
    sharePreparing: '准备中...',
    rankingBtn:    '🏆 排行榜',
    gamesLink:     '🎮 游戏列表',
    displayNameLabel: '显示名称',
    displayNamePlaceholder: '最多15个字符',
    displayNameSave: '保存',
    displayNameSaved: '✓ 已保存',
    displayNameEmpty: '请至少输入1个字符',
    profileLink: '👤 个人资料',
    startNameHint:   '点击 ✎ 可以修改名字',
    startNameHintOk: '知道了',
    achievements:   '🏆 实绩',
    achNewUnlock:   '成就解锁！',
    achBack:        '← 返回',
    tutHint:        '点击强化！',
    tweetText:     n => `我在 Rollaxy 获得了 ${n} 分！ #Rollaxy`,
    shareNote:     '📥 已下载盘面图片，请将其附加到推文中。',
    rankPct:       pct => `全服前 ${pct}% ✨`,
    skillHintBomb:    '💣 将炸弹作为下一个投放物使用，落地后爆炸！',
    skillHintUpgrade: '⬆ 点击一个天体将其升级一阶',
    skillHintDelete:  '✕ 点击一个天体将其删除',
    forcedTitleBomb:    '炸弹模式',
    forcedDescBomb:     '投下炸弹！',
    forcedTitleUpgrade: '进化模式',
    forcedDescUpgrade:  '让天体进化！',
    forcedTitleDelete:  '消除模式',
    forcedDescDelete:   '选择要删除的天体',
  },
};

// 言語ボタンの表示順
const LANG_ORDER = ['ja', 'en', 'zh'];

// 現在の言語（localStorage で永続化）— novora_lang キーに統一（旧 rollaxy_lang からも移行）
// 明示的な保存がない初回アクセス時は navigator.language から自動検出する。
// 自動検出結果は localStorage に書かない（設定画面での明示操作と区別するため）。
function _detectLang() {
  const stored = localStorage.getItem('novora_lang') || localStorage.getItem('rollaxy_lang');
  if (stored && LANGS[stored]) return stored;
  const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
  for (const code of LANG_ORDER) {
    if (nav === code || nav.startsWith(code + '-')) return code;
  }
  return LANG_ORDER[LANG_ORDER.length - 1]; // 対応言語なし → 最後の言語（英語）
}
let currentLang = _detectLang();
document.documentElement.lang = currentLang;

// キーから現在言語の文字列を取得
function T(key) {
  return (LANGS[currentLang] || LANGS.ja)[key];
}

// 言語を切り替えて画面に反映
function setLang(code) {
  if (!LANGS[code]) return;
  currentLang = code;
  localStorage.setItem('novora_lang', code);
  localStorage.removeItem('rollaxy_lang'); // 旧キーを削除
  document.documentElement.lang = code;
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
