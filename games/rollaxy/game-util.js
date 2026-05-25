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
// 【表示制御の規約】可視性の真実は .show クラスが持ち、display の値は CSS の
// `要素 { display: none }` / `要素.show { display: ... }` ルールが持つ。
// JS は class の付け外しのみ行い、style.display は直接操作しない。
// 新規 UI の表示/非表示は必ずこのヘルパー経由で実装すること。
// 注意: HTML の inline style="display:..." は .show より優先されるため、
// このヘルパーで制御する要素には inline display を付けないこと。
const show = el => el.classList.add('show');
const hide = el => el.classList.remove('show');
// 条件付き表示切替。on が真なら show、偽なら hide。
// 例: toggleShow(newHiEl, score > hiScore)
const toggleShow = (el, on) => el.classList.toggle('show', !!on);
