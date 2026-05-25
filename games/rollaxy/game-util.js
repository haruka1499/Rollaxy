'use strict';

// ============================================================
// SHARED UTILITIES — 全スクリプトより先にロードする（index.html 参照）
// ============================================================

// click + touchend を同一ハンドラで登録する。
// touchend で e.preventDefault() を呼ぶことで、モバイルでの
// 300ms click 遅延と二重発火を防ぐ。
// 注意: canvas や passive:false が必要な要素には直接登録すること。
// 将来 PointerEvent に移行する場合はこの関数だけ変更すれば済む。
function on(el, fn) {
  el.addEventListener('click', () => fn());
  el.addEventListener('touchend', e => { e.preventDefault(); fn(); });
}

// CSS .show クラスによる表示切替ヘルパー。
// アニメーション付きオーバーレイ（#overlay, #settings-overlay 等）に使う。
// style.display を直接操作している要素（設定サブパネル等）には使わないこと。
const show = el => el.classList.add('show');
const hide = el => el.classList.remove('show');
