'use strict';

// ============================================================
// SETTINGS UI — 設定オーバーレイ（メニュー / 設定サブパネル）の制御
// ============================================================
// 必ず game.js の後にロードすること（index.html）。
// 理由: 以下のグローバルを共有スコープ経由で参照・変更するため、
// game.js / game-sfx.js が先に評価されている必要がある。
//   - 要素参照 (const): settingsBtn, settingsOverlay, menuPanel,
//                        settingsPanel, resumeBtn, menuSettingsBtn,
//                        settingsBackBtn, resetBtn  … game.js:50-57
//   - 状態 (let): paused, dead  … game.js / sfxVolume … game-sfx.js
//   - 関数: init(), T(), getDisplayName(), saveDisplayName(),
//           updateStartPlayername(), syncDisplayNameToServer()
// buildLangSelector() はブート時（game.js 末尾）に呼ばれるため game.js に残してある。

const creditsPanel      = document.getElementById('credits-panel');
const settingsCreditsBtn = document.getElementById('settings-credits-btn');
const creditsBackBtn    = document.getElementById('credits-back-btn');

function _showMenuPanel() {
  menuPanel.style.display    = 'flex';
  settingsPanel.style.display = 'none';
  creditsPanel.style.display  = 'none';
}
function _showSettingsPanel() {
  // 設定サブパネルを開くタイミングで表示名フィールドを初期化
  const dnInput  = document.getElementById('displayname-input');
  const dnStatus = document.getElementById('displayname-status');
  if (dnInput) {
    dnInput.value       = getDisplayName();
    dnInput.placeholder = T('displayNamePlaceholder');
  }
  if (dnStatus) dnStatus.textContent = '';
  menuPanel.style.display    = 'none';
  settingsPanel.style.display = 'flex';
  creditsPanel.style.display  = 'none';
}
function _showCreditsPanel() {
  menuPanel.style.display    = 'none';
  settingsPanel.style.display = 'none';
  creditsPanel.style.display  = 'flex';
}

function openSettings() {
  if (dead) return; // ゲームオーバー中は設定を開かない（スタート待ち中は開いてよい）
  paused = true;    // 物理を停止（待機中はすでに止まっているが、フラグとして立てる）
  _showMenuPanel();
  show(settingsOverlay);
}
function closeSettings() {
  paused = false;
  hide(settingsOverlay);
  _showMenuPanel(); // 次回オープン時のためにメニューへリセット
}

on(settingsBtn,       () => paused ? closeSettings() : openSettings());
on(resumeBtn,         () => { playBackSound(); closeSettings(); });
on(menuSettingsBtn,   () => _showSettingsPanel());
on(settingsBackBtn,   () => { playBackSound(); _showMenuPanel(); });
on(settingsCreditsBtn,() => _showCreditsPanel());
on(creditsBackBtn,    () => { playBackSound(); _showSettingsPanel(); });
on(resetBtn,          () => { closeSettings(); init(); });

// 表示名保存ボタン
const displayNameSaveBtn = document.getElementById('displayname-save');
if (displayNameSaveBtn) {
  const doSaveName = () => {
    const input  = document.getElementById('displayname-input');
    const status = document.getElementById('displayname-status');
    if (saveDisplayName(input.value)) {
      input.value          = getDisplayName(); // trim 後の値を反映
      updateStartPlayername();                 // スタート画面の名前表示も更新
      syncDisplayNameToServer();               // players テーブルへ即時同期
      status.textContent   = T('displayNameSaved');
      status.dataset.ok    = '1';
      setTimeout(() => { if (status) status.textContent = ''; }, 2000);
    } else {
      status.textContent   = T('displayNameEmpty');
      status.dataset.ok    = '';
    }
  };
  on(displayNameSaveBtn, doSaveName);
  document.getElementById('displayname-input')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSaveName(); } });
}

// ============================================================
// ホーム画面 右上メニュー（設定 / プロフィール / ゲーム一覧）
// ============================================================
const homeMenuBtn      = document.getElementById('home-menu-btn');
const homeMenuPanel    = document.getElementById('home-menu-panel');
const homeMenuSettings = document.getElementById('home-menu-settings');

function _closeHomeMenu() { hide(homeMenuPanel); }

on(homeMenuBtn, () => {
  homeMenuPanel.classList.contains('show') ? _closeHomeMenu() : show(homeMenuPanel);
});

on(homeMenuSettings, () => {
  _closeHomeMenu();
  openHomeSettings();
});

// パネル外タップで閉じる（touchend と click の両方に対応）
document.addEventListener('click', e => {
  if (!homeMenuBtn.contains(e.target) && !homeMenuPanel.contains(e.target)) {
    _closeHomeMenu();
  }
}, { capture: false });

// ============================================================
// ホーム画面専用設定オーバーレイ
// ゲーム中の #settings-overlay とは独立した別オーバーレイ。
// z-index: 1001 で #start-screen (1000) の上に表示される。
// ============================================================
const homeSettingsOverlay = document.getElementById('home-settings-overlay');
const homeSettingsPanelEl = document.getElementById('home-settings-panel');
const homeCreditsPanelEl  = document.getElementById('home-credits-panel');
const homeSettingsClose   = document.getElementById('home-settings-close');
const homeCreditsBtn2     = document.getElementById('home-credits-btn');
const homeCreditsBack     = document.getElementById('home-credits-back');

function _showHomeSettingsPanel() {
  homeSettingsPanelEl.style.display = 'flex';
  homeCreditsPanelEl.style.display  = 'none';
}
function _showHomeCreditsPanel() {
  homeSettingsPanelEl.style.display = 'none';
  homeCreditsPanelEl.style.display  = 'flex';
}

function openHomeSettings() {
  _tryUnlockAudio();
  // スライダーを現在値で初期化
  const hSlider = document.getElementById('home-sfx-vol');
  const hVal    = document.getElementById('home-sfx-val');
  if (hSlider) { hSlider.value = sfxVolume; }
  if (hVal)    { hVal.textContent = Math.round(sfxVolume * 100) + '%'; }
  // 表示名フィールドを初期化
  const dnInput  = document.getElementById('home-displayname-input');
  const dnStatus = document.getElementById('home-displayname-status');
  if (dnInput)  { dnInput.value = getDisplayName(); dnInput.placeholder = T('displayNamePlaceholder'); }
  if (dnStatus) { dnStatus.textContent = ''; }
  _showHomeSettingsPanel();
  homeSettingsOverlay.classList.add('show');
}
function closeHomeSettings() {
  homeSettingsOverlay.classList.remove('show');
  _showHomeSettingsPanel(); // 次回のためにリセット
}

on(homeSettingsClose, () => { playBackSound(); closeHomeSettings(); });
on(homeCreditsBtn2,   () => _showHomeCreditsPanel());
on(homeCreditsBack,   () => { playBackSound(); _showHomeSettingsPanel(); });

// ── 効果音スライダー（ゲーム内スライダーと sfxVolume を共有）
const homeSfxSlider = document.getElementById('home-sfx-vol');
const homeSfxValEl  = document.getElementById('home-sfx-val');
homeSfxSlider.addEventListener('input', () => {
  sfxVolume = parseFloat(homeSfxSlider.value);
  homeSfxValEl.textContent = Math.round(sfxVolume * 100) + '%';
  localStorage.setItem(STORAGE_KEYS.SFX_VOL, sfxVolume);
  // ゲーム内スライダーにも反映
  if (sfxVolSlider) { sfxVolSlider.value = sfxVolume; sfxValEl.textContent = homeSfxValEl.textContent; }
});

// ── 言語ボタン（ゲーム内セレクターと同じ LANGS/setLang を使用）
function _buildHomeLangSelector() {
  const row = document.getElementById('home-lang-row');
  if (!row) return;
  row.innerHTML = '';
  for (const code of LANG_ORDER) {
    const btn = document.createElement('button');
    btn.className    = 'lang-btn';
    btn.dataset.lang = code;
    btn.textContent  = LANGS[code].name;
    if (code === currentLang) btn.classList.add('active');
    btn.addEventListener('click',    () => setLang(code));
    btn.addEventListener('touchend', e => { e.preventDefault(); setLang(code); }, { passive: false });
    row.appendChild(btn);
  }
}
_buildHomeLangSelector();

// 言語変更時にホーム設定の言語ボタンとplaceholderも更新
document.addEventListener('langchange', () => {
  document.querySelectorAll('#home-lang-row .lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  const dnInput = document.getElementById('home-displayname-input');
  if (dnInput) dnInput.placeholder = T('displayNamePlaceholder');
});

// ── 表示名保存
const homeDisplayNameSaveBtn = document.getElementById('home-displayname-save');
if (homeDisplayNameSaveBtn) {
  const doSaveHomeName = () => {
    const input  = document.getElementById('home-displayname-input');
    const status = document.getElementById('home-displayname-status');
    if (saveDisplayName(input.value)) {
      input.value = getDisplayName();
      updateStartPlayername();
      syncDisplayNameToServer();
      status.textContent = T('displayNameSaved');
      status.dataset.ok  = '1';
      setTimeout(() => { if (status) status.textContent = ''; }, 2000);
    } else {
      status.textContent = T('displayNameEmpty');
      status.dataset.ok  = '';
    }
  };
  on(homeDisplayNameSaveBtn, doSaveHomeName);
  document.getElementById('home-displayname-input')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSaveHomeName(); } });
}

// 効果音スライダー
const sfxVolSlider = document.getElementById('sfx-vol');
const sfxValEl     = document.getElementById('sfx-val');
sfxVolSlider.value = sfxVolume;
sfxValEl.textContent = Math.round(sfxVolume * 100) + '%';
sfxVolSlider.addEventListener('input', () => {
  sfxVolume = parseFloat(sfxVolSlider.value);
  sfxValEl.textContent = Math.round(sfxVolume * 100) + '%';
  localStorage.setItem(STORAGE_KEYS.SFX_VOL, sfxVolume);
});
