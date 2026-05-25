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

function _showMenuPanel() {
  menuPanel.style.display    = 'flex';
  settingsPanel.style.display = 'none';
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

on(settingsBtn,     () => paused ? closeSettings() : openSettings());
on(resumeBtn,       () => closeSettings());
on(menuSettingsBtn, () => _showSettingsPanel());
on(settingsBackBtn, () => _showMenuPanel());
on(resetBtn,        () => { closeSettings(); init(); });

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
  openSettings();
});

// パネル外タップで閉じる（touchend と click の両方に対応）
document.addEventListener('click', e => {
  if (!homeMenuBtn.contains(e.target) && !homeMenuPanel.contains(e.target)) {
    _closeHomeMenu();
  }
}, { capture: false });

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
