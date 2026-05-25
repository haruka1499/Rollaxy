'use strict';

// ============================================================
// nav.js — サイト共通ナビゲーション
//
// 使い方: 各ページの <body> 冒頭に
//   <script src="/nav.js"></script>
// と書くだけ。同期実行なので document.currentScript でその場に挿入される。
// async / defer は付けないこと（挿入位置がずれる）。
//
// 言語切替は localStorage "novora_lang" で i18n.js と共有。
// i18n.js が同ページで読み込まれている場合は setGlobalLang() に委譲する。
// ============================================================

(function () {
  const LABELS = {
    ja: { games: 'ゲーム', profile: '👤 プロフィール' },
    en: { games: 'Games',  profile: '👤 Profile' },
    zh: { games: '游戏',   profile: '👤 个人资料' },
  };
  const LANG_BTN   = { ja: 'JP', en: 'EN', zh: 'ZH' };
  const LANG_ORDER = ['ja', 'en', 'zh'];
  const LANG_KEY   = 'novora_lang';

  // ── 言語検出（i18n.js と同じロジック）
  function _detectLang() {
    const s = localStorage.getItem(LANG_KEY) || localStorage.getItem('rollaxy_lang');
    if (s && LABELS[s]) return s;
    const nv = (navigator.language || '').toLowerCase();
    for (const c of LANG_ORDER) if (nv === c || nv.startsWith(c + '-')) return c;
    return 'en';
  }

  let _lang = _detectLang();
  document.documentElement.lang = _lang;

  // ── active クラス判定
  function _active(page) {
    const p = location.pathname;
    const map = {
      games:   '/games',
      about:   '/about',
      privacy: '/privacy',
      credits: '/credits',
      profile: '/profile',
    };
    return p.startsWith(map[page] || '\0') ? ' class="active"' : '';
  }

  // ── nav HTML 生成
  function _build() {
    const L = LABELS[_lang] || LABELS.en;
    const langBtns = LANG_ORDER.map(c =>
      `<button class="site-lang-btn${c === _lang ? ' active' : ''}" data-lang="${c}">${LANG_BTN[c]}</button>`
    ).join('');
    return `<nav class="site-nav" id="site-nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">NOVORA GAME</a>
    <ul class="nav-links">
      <li><a href="/games/"${_active('games')}>${L.games}</a></li>
      <li><a href="/about/"${_active('about')}>About</a></li>
      <li><a href="/privacy/"${_active('privacy')}>Privacy</a></li>
      <li><a href="/credits/"${_active('credits')}>Credits</a></li>
      <li><a href="/profile/"${_active('profile')}>${L.profile}</a></li>
    </ul>
    <div id="site-lang-selector">${langBtns}</div>
  </div>
</nav>`;
  }

  // ── 同期挿入（スクリプトタグの直前に nav を展開）
  document.currentScript.insertAdjacentHTML('beforebegin', _build());

  // ── 言語切替（イベント委譲）
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#site-nav .site-lang-btn');
    if (!btn) return;
    const code = btn.dataset.lang;
    if (!LABELS[code] || code === _lang) return;

    _lang = code;
    localStorage.setItem(LANG_KEY, code);
    localStorage.removeItem('rollaxy_lang'); // 旧キー削除
    document.documentElement.lang = code;

    // nav を再描画（outerHTML 置換で active 状態・ラベルを更新）
    const nav = document.getElementById('site-nav');
    if (nav) nav.outerHTML = _build();

    // i18n.js が読み込まれていればページ内容も更新、なければ自前でイベントを発火
    if (typeof setGlobalLang === 'function') {
      setGlobalLang(code);
    } else {
      document.dispatchEvent(new CustomEvent('globalLangChange', { detail: { lang: code } }));
    }
  });
})();
