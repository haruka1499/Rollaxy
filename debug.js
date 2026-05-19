'use strict';

const { Engine, Bodies, Composite, Body } = Matter;

const W = CFG.W, H = CFG.H;
const BOX = CFG.BOX;

const canvas = document.getElementById('dbg-canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = W;
canvas.height = H;

// ============================================================
// 物理エンジン（game.js と同じパラメータ）
// ============================================================
const eng   = Engine.create({
  gravity:     { x: 0, y: CFG.PHYS.GRAVITY },
  enableSleeping: false,
  positionIterations: CFG.PHYS.POS_ITER,
  velocityIterations: CFG.PHYS.VEL_ITER,
});
const world = eng.world;

// 壁・床（game.js の BOX 座標に合わせる）
(function createWalls() {
  const { L, R, T, B, W: wt } = BOX;
  const opts = { isStatic: true, label: 'wall',
    friction: CFG.PHYS.FRIC, restitution: CFG.PHYS.REST };
  Composite.add(world, [
    Bodies.rectangle((L + R) / 2, B + wt / 2,  R - L + wt * 2, wt,     opts), // 床
    Bodies.rectangle(L - wt / 2,  (T + B) / 2, wt, B - T + wt,         opts), // 左壁
    Bodies.rectangle(R + wt / 2,  (T + B) / 2, wt, B - T + wt,         opts), // 右壁
  ]);
})();

// ============================================================
// 状態
// ============================================================
let selectedBi  = 0;
let cursorPos   = null;   // {x, y} | null  キャンバス上の論理座標
let isDragging  = false;
let paused      = false;
let bmap        = new Map(); // bodyId → {bi, body}
let lastPlacePos = null;     // ドラッグ中の直前配置位置（近すぎる連打を防ぐ）

// ============================================================
// 天体の配置 / 削除
// ============================================================
function placeBody(lx, ly) {
  const def = CFG.BODIES[selectedBi];
  // ドラッグ中は前回位置から r 以上離れていないと多重配置しない
  if (lastPlacePos) {
    const dx = lx - lastPlacePos.x, dy = ly - lastPlacePos.y;
    if (dx * dx + dy * dy < def.r * def.r) return;
  }
  // ボックス内にクランプ
  const x = Math.max(BOX.L + def.r + 1, Math.min(BOX.R - def.r - 1, lx));
  const y = Math.max(BOX.T + def.r + 1, Math.min(BOX.B - def.r - 1, ly));
  const b = Bodies.circle(x, y, def.r, {
    label: 'celestial',
    friction:       CFG.PHYS.FRIC,
    frictionAir:    CFG.PHYS.FRIC_AIR,
    frictionStatic: CFG.PHYS.FRIC_S,
    restitution:    CFG.PHYS.REST,
    slop:           CFG.PHYS.SLOP,
  });
  bmap.set(b.id, { bi: selectedBi, body: b });
  Composite.add(world, b);
  lastPlacePos = { x, y };
  updateCount();
}

function removeBodyAt(lx, ly) {
  // クリック位置に重なっている最初の天体を削除
  for (const [id, d] of bmap.entries()) {
    const dx = d.body.position.x - lx;
    const dy = d.body.position.y - ly;
    if (dx * dx + dy * dy <= CFG.BODIES[d.bi].r * CFG.BODIES[d.bi].r) {
      bmap.delete(id);
      Composite.remove(world, d.body, true);
      updateCount();
      return;
    }
  }
}

function resetBodies() {
  for (const d of bmap.values()) Composite.remove(world, d.body, true);
  bmap.clear();
  updateCount();
}

function updateCount() {
  document.getElementById('count-val').textContent = bmap.size;
}

// ============================================================
// 描画
// ============================================================
function render() {
  ctx.clearRect(0, 0, W, H);

  // 背景
  ctx.fillStyle = '#0d0820';
  ctx.fillRect(0, 0, W, H);

  // ゲームフィールド内側
  const { L, R, T, B } = BOX;
  ctx.fillStyle = '#120a2a';
  ctx.fillRect(L, T, R - L, B - T);

  // 壁
  ctx.fillStyle = '#1e1040';
  ctx.fillRect(0,   T, L,     B - T); // 左
  ctx.fillRect(R,   T, W - R, B - T); // 右
  ctx.fillRect(0,   B, W,     H - B); // 底

  // 危険ライン
  ctx.save();
  ctx.strokeStyle = 'rgba(255,60,60,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(L, CFG.DANGER_Y); ctx.lineTo(R, CFG.DANGER_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // DROP_Y ライン（配置の目安）
  ctx.save();
  ctx.strokeStyle = 'rgba(100,180,255,0.20)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(L, CFG.DROP_Y); ctx.lineTo(R, CFG.DROP_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // 配置済み天体
  for (const [, d] of bmap) drawBody(d.body.position, d.body.angle, d.bi, false);

  // カーソル上のホバープレビュー
  if (cursorPos && inBox(cursorPos.x, cursorPos.y)) {
    ctx.globalAlpha = 0.45;
    drawBody(cursorPos, 0, selectedBi, true);
    ctx.globalAlpha = 1.0;
  }

  // 一時停止中の表示
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(L, T, R - L, B - T);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSED', W / 2, (T + B) / 2);
  }
}

function drawBody(pos, angle, bi, preview) {
  const def = CFG.BODIES[bi];
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);

  // 円
  ctx.beginPath();
  ctx.arc(0, 0, def.r, 0, Math.PI * 2);
  ctx.fillStyle = def.c;
  ctx.fill();

  if (preview) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 絵文字
  ctx.font = `${Math.max(10, Math.round(def.r * 1.1))}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.e, 0, 0);

  ctx.restore();
}

function inBox(x, y) {
  return x >= BOX.L && x <= BOX.R && y >= BOX.T && y <= BOX.B;
}

// ============================================================
// メインループ（Matter.js を手動更新）
// ============================================================
const SUBSTEPS = CFG.PHYS.SUBSTEPS;
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(now - lastTime, 50);
  lastTime = now;
  if (!paused) {
    const step = dt / SUBSTEPS;
    for (let i = 0; i < SUBSTEPS; i++) Engine.update(eng, step);
  }
  render();
  requestAnimationFrame(loop);
}

// ============================================================
// スケーリング（ウィンドウサイズに合わせてキャンバスを拡縮）
// ============================================================
function resize() {
  const wrap = document.getElementById('canvas-wrap');
  const s = Math.min(wrap.clientWidth / W, wrap.clientHeight / H);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.transform = `scale(${s})`;
  const ox = Math.floor((wrap.clientWidth  - W * s) / 2);
  const oy = Math.floor((wrap.clientHeight - H * s) / 2);
  canvas.style.left = ox + 'px';
  canvas.style.top  = oy + 'px';
}

// キャンバス上のマウス座標 → 論理座標
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (W / r.width),
    y: (e.clientY - r.top)  * (H / r.height),
  };
}

// ============================================================
// パレット構築
// ============================================================
const SHORTCUT_KEYS = '1234567890-=';

function buildPalette() {
  const palette = document.getElementById('palette');
  CFG.BODIES.forEach((def, i) => {
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.dataset.bi = i;
    btn.innerHTML =
      `<span class="pb-key">${SHORTCUT_KEYS[i]}</span>` +
      `<span class="pb-emoji">${def.e}</span>` +
      `<span class="pb-name">${def.n}</span>` +
      `<span class="pb-r">r=${def.r}</span>`;
    btn.addEventListener('click', () => selectBi(i));
    palette.appendChild(btn);
  });
}

function selectBi(i) {
  selectedBi = i;
  const def = CFG.BODIES[i];
  document.querySelectorAll('.palette-btn').forEach((btn, j) => {
    btn.classList.toggle('active', j === i);
  });
  document.getElementById('selected-info').textContent =
    `${def.e} ${def.n}\nr=${def.r}  score=${def.s}`;
}

// ============================================================
// コントロールボタン更新
// ============================================================
function updatePauseBtn() {
  const btn = document.getElementById('btn-pause');
  btn.textContent = paused ? '再開 [Space]' : '一時停止 [Space]';
  btn.classList.toggle('active', paused);
}

function updateGravityBtn() {
  const on  = eng.gravity.y !== 0;
  const btn = document.getElementById('btn-gravity');
  btn.textContent = on ? '重力: ON [G]' : '重力: OFF [G]';
  btn.classList.toggle('active', !on);
}

// ============================================================
// イベントリスナー
// ============================================================

// マウス
canvas.addEventListener('mousedown', e => {
  e.preventDefault();
  const p = toLogical(e);
  if (e.button === 0 && inBox(p.x, p.y)) { isDragging = true; lastPlacePos = null; placeBody(p.x, p.y); }
  if (e.button === 2) removeBodyAt(p.x, p.y);
});
canvas.addEventListener('mousemove', e => {
  const p = toLogical(e);
  cursorPos = p;
  if (isDragging && inBox(p.x, p.y)) placeBody(p.x, p.y);
});
canvas.addEventListener('mouseup',    () => { isDragging = false; lastPlacePos = null; });
canvas.addEventListener('mouseleave', () => { cursorPos = null; isDragging = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// キーボード
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const ki = SHORTCUT_KEYS.indexOf(e.key);
  if (ki !== -1 && ki < CFG.BODIES.length) { selectBi(ki); return; }
  switch (e.key) {
    case ' ':       e.preventDefault(); paused = !paused;                           updatePauseBtn();   break;
    case 'g': case 'G': eng.gravity.y = eng.gravity.y === 0 ? CFG.PHYS.GRAVITY : 0; updateGravityBtn(); break;
    case 'r': case 'R': resetBodies(); break;
  }
});

// ボタン
document.getElementById('btn-pause').addEventListener('click',   () => { paused = !paused;                           updatePauseBtn();   });
document.getElementById('btn-gravity').addEventListener('click', () => { eng.gravity.y = eng.gravity.y === 0 ? CFG.PHYS.GRAVITY : 0; updateGravityBtn(); });
document.getElementById('btn-reset').addEventListener('click',   () => resetBodies());

window.addEventListener('resize', resize);

// ============================================================
// 起動
// ============================================================
buildPalette();
selectBi(0);
resize();
requestAnimationFrame(loop);
