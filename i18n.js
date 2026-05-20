'use strict';
// ============================================================
// NOVORA GAME — サイト共通 i18n
// ゲームページ（/games/rollaxy/）以外の全ページで読み込む
// ゲームの lang.js と同じ localStorage キー "novora_lang" を共有する
// ============================================================

const _I18N = {
  ja: {
    // ── ナビ ──
    navGames:    'ゲーム',
    navAbout:    'About',
    navPrivacy:  'Privacy',
    navRanking:  'ランキング',
    navProfile:  '👤 プロフィール',
    scoreUnit:   '点',
    navRollaxy:  'Rollaxy',
    // ── フッター ──
    footerHome:    'Home',
    footerGames:   'ゲーム',
    footerPrivacy: 'プライバシーポリシー',
    // ── トップページ ──
    siteDesc:    'ブラウザで遊べるゲーム集 — インストール不要',
    featured:    'Featured Games',
    rollaxyDesc: '宇宙をテーマにした落ちものパズル。天体を合体させて銀河団を目指せ。',
    // ── ランキングページ ──
    rankingTitle: '🏆 Rollaxy ランキング',
    tabAll:       '全期間',
    tabWeekly:    '今週',
    tabDaily:     '今日',
    myBestLabel:  '👤 あなたのベスト',
    rankLoading:  '読み込み中...',
    rankError:    '読み込みに失敗しました。しばらくしてから再試行してください。',
    rankEmpty:    'まだエントリーがありません。プレイして記録を作ろう！',
    backToGame:   '▶ ゲームに戻る',
    // ── プロフィールページ ──
    profileTitle:       '👤 プロフィール設定',
    profileNameCard:    '表示名',
    profileNamePh:      '15文字以内（日本語OK）',
    profileNameSave:    '保存',
    profileNameSaved:   '✓ 保存しました',
    profileNameEmpty:   '1文字以上入力してください',
    profileNameHint:    'ランキングに表示される名前です。日本語・英数字など15文字以内で設定できます。',
    profileCodeCard:    'ゲストコード（識別ID）',
    profileCodeNote:    'このコードはブラウザに紐付いた識別子です。同じブラウザで遊ぶ限り同じコードが使われます。異なるブラウザ・デバイスでは別のコードが発行されます。',
    profileCopyBtn:     'コピー',
    profileCopied:      '✓ コピー済み',
    profileBestCard:    'Rollaxy ベストスコア',
    profileBestLink:    '🔗 シェアページを見る',
    profileNoData:      'まだ記録がありません',
    profileRecentCard:  '最近のプレイ記録',
    profileNoRecent:    'まだシェア記録がありません',
    profilePlayBtn:     '▶ Rollaxy をプレイ',
    profileRankBtn:     '🏆 ランキング',
    profileBackBtn:     '▶ ゲームに戻る',
  },
  en: {
    // ── Nav ──
    navGames:    'Games',
    navAbout:    'About',
    navPrivacy:  'Privacy',
    navRanking:  'Ranking',
    navProfile:  '👤 Profile',
    scoreUnit:   'pts',
    navRollaxy:  'Rollaxy',
    // ── Footer ──
    footerHome:    'Home',
    footerGames:   'Games',
    footerPrivacy: 'Privacy Policy',
    // ── Top page ──
    siteDesc:    'Free browser games — no installation required',
    featured:    'Featured Games',
    rollaxyDesc: 'A space-themed falling merge puzzle. Combine celestial bodies and aim for the galaxy cluster.',
    // ── Ranking page ──
    rankingTitle: '🏆 Rollaxy Ranking',
    tabAll:       'All Time',
    tabWeekly:    'This Week',
    tabDaily:     'Today',
    myBestLabel:  '👤 Your Best',
    rankLoading:  'Loading...',
    rankError:    'Failed to load. Please try again later.',
    rankEmpty:    'No entries yet. Play and set a record!',
    backToGame:   '▶ Back to Game',
    // ── Profile page ──
    profileTitle:       '👤 Profile Settings',
    profileNameCard:    'Display Name',
    profileNamePh:      'Up to 15 characters',
    profileNameSave:    'Save',
    profileNameSaved:   '✓ Saved',
    profileNameEmpty:   'Please enter at least 1 character',
    profileNameHint:    'This name appears in the ranking. Up to 15 characters.',
    profileCodeCard:    'Guest Code (ID)',
    profileCodeNote:    'This code is tied to your browser. The same code is used as long as you play on the same browser. A different code is issued on different browsers or devices.',
    profileCopyBtn:     'Copy',
    profileCopied:      '✓ Copied',
    profileBestCard:    'Rollaxy Best Score',
    profileBestLink:    '🔗 View Share Page',
    profileNoData:      'No record yet',
    profileRecentCard:  'Recent Play History',
    profileNoRecent:    'No share history yet',
    profilePlayBtn:     '▶ Play Rollaxy',
    profileRankBtn:     '🏆 Ranking',
    profileBackBtn:     '▶ Back to Game',
  },
};

const _LANG_ORDER = ['ja', 'en'];
const _LANG_KEY   = 'novora_lang';

// rollaxy_lang（旧キー）から移行
let _curLang = localStorage.getItem(_LANG_KEY)
            || localStorage.getItem('rollaxy_lang')
            || 'ja';
if (!_I18N[_curLang]) _curLang = 'ja';

// キーから現在言語の文字列を取得
function TG(key) {
  return (_I18N[_curLang] || _I18N.ja)[key] ?? key;
}

// 言語を切り替えて保存・反映
function setGlobalLang(code) {
  if (!_I18N[code]) return;
  _curLang = code;
  localStorage.setItem(_LANG_KEY, code);
  localStorage.removeItem('rollaxy_lang'); // 旧キー削除
  applyGlobalLang();
}

// data-i18n 属性を持つ全要素を現在言語で更新
function applyGlobalLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = TG(el.dataset.i18n);
    if (typeof val === 'string') el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const val = TG(el.dataset.i18nPh);
    if (typeof val === 'string') el.placeholder = val;
  });
  document.querySelectorAll('.site-lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === _curLang);
  });
  document.dispatchEvent(new CustomEvent('globalLangChange', { detail: { lang: _curLang } }));
}

// ナビの #site-lang-selector に JP/EN ボタンを生成
function buildSiteLangSelector() {
  const el = document.getElementById('site-lang-selector');
  if (!el) return;
  el.innerHTML = '';
  for (const code of _LANG_ORDER) {
    const btn = document.createElement('button');
    btn.className    = 'site-lang-btn';
    btn.dataset.lang = code;
    btn.textContent  = code === 'ja' ? 'JP' : 'EN';
    btn.classList.toggle('active', code === _curLang);
    btn.addEventListener('click', () => setGlobalLang(code));
    el.appendChild(btn);
  }
}

// DOMContentLoaded 後に自動適用
document.addEventListener('DOMContentLoaded', () => {
  buildSiteLangSelector();
  applyGlobalLang();
});
