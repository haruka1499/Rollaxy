'use strict';

// ============================================================
// ころころ宇宙 — game.js
//
// 【ユーザーの表現 → コード対応表】
//   「天体」              → CFG.BODIES[bi] の各要素 / Matter.js の circle body (label:'celestial')
//   「次の天体（が表示されているところ）」→ #next-wrap / #next-emoji / 変数 nxtBi
//   「合成」              → 同種天体が接触 → onColl/scanNearby → flushMerges で1段階上を生成
//   「合成時に少し光る仕様」→ glowMap + paintBody 内の glow ブロック（縁が光るエフェクト）
//   「ゲームオーバー時のオーバーレイ」→ #overlay（dead=true 時に .show で表示）
//   「設定を開いたとき（の画面）」→ #settings-overlay（paused=true 時に .show で表示）
//   「設定ボタン」        → #settings-btn（ヘッダー右端の ⚙ ボタン）
//   「ゲームに戻る」      → closeSettings()（paused を解除して #settings-overlay を閉じる）
//   「リセット」          → init()（物理エンジン・スコア・天体を全初期化→スタート画面へ）
//   「スタート画面」      → #start-overlay（ページ読み込み・リトライ・リセット後に表示）
//   「爆弾スキル」        → activeSkill='bomb' / bombMode=true / bombBody（物理ボディ）
//   「指定アップグレード（強化スキル）」→ activeSkill='upgrade' / skillSelectMode=true
//   「指定削除スキル」    → activeSkill='delete'  / skillSelectMode=true
//   「天体選択モード」    → skillSelectMode=true（upgrade/delete 選択中、canvas tap で天体を選ぶ）
//
// 【スマホ向け設計の要点】
//   - canvas は論理サイズ 400×700px 固定。resize() が CSS transform:scale で画面にフィット。
//   - 入力は mousemove/click と touchmove/touchend の両方を登録（PC・スマホ共用）。
//   - touchmove は preventDefault() で引っ張りスクロールを防ぐため passive:false が必要。
//   - 各ボタンに click と touchend を両方登録（iOS の 300ms click 遅延を回避）。
// ============================================================

// ============================================================
// DOM
// ============================================================
const canvas      = document.getElementById('game');
const ctx         = canvas.getContext('2d');
const outer       = document.getElementById('canvas-outer');

// 「ゲームオーバー時のオーバーレイ」= #overlay
const overlay     = document.getElementById('overlay');
const scoreEl     = document.getElementById('score-el');
const hiEl        = document.getElementById('hi-el');
// 「次の天体が表示されているところ」の絵文字部分 = #next-emoji
const nextEmoEl   = document.getElementById('next-emoji');
const finalEl     = document.getElementById('final-score');
const newHiEl     = document.getElementById('new-hi');
const retryBtn    = document.getElementById('retry-btn');

// 「設定ボタン」= #settings-btn / 「設定を開いたとき」= #settings-overlay
const settingsBtn     = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const menuPanel       = document.getElementById('menu-panel');
const settingsPanel   = document.getElementById('settings-panel');
const resumeBtn       = document.getElementById('resume-btn');       // 「ゲームに戻る」
const menuSettingsBtn = document.getElementById('menu-settings-btn'); // メニュー内「設定」
const settingsBackBtn = document.getElementById('settings-back-btn'); // 設定内「← 戻る」
const resetBtn        = document.getElementById('reset-btn');         // 「リセット」

// 「スタート画面」= #start-overlay
const startOverlay      = document.getElementById('start-overlay');
const startBtn          = document.getElementById('start-btn');
const startPlayernameEl  = document.getElementById('start-playername-val');
const startNameView      = document.getElementById('start-name-view');
const startNameEditor    = document.getElementById('start-name-editor');
const startNameInput     = document.getElementById('start-name-input');
const startNameEditBtn   = document.getElementById('start-name-edit-btn');
const startNameSaveBtn   = document.getElementById('start-name-save-btn');
const startNameCancelBtn = document.getElementById('start-name-cancel-btn');
const startNameHint      = document.getElementById('start-name-hint');
const startNameHintOkBtn = document.getElementById('start-name-hint-ok');

// スタート画面のプレイヤー名を更新
function updateStartPlayername() {
  if (startPlayernameEl) startPlayernameEl.textContent = getDisplayName();
}

// 初回訪問ヒントの表示・テキスト更新（langchange 時にも呼ぶ）
function updateNameHint() {
  if (!startNameHint) return;
  if (localStorage.getItem('novora_hint_shown')) {
    startNameHint.style.display = 'none';
    return;
  }
  const msgEl = document.getElementById('start-name-hint-msg');
  if (msgEl) msgEl.textContent = T('startNameHint');
  if (startNameHintOkBtn) startNameHintOkBtn.textContent = T('startNameHintOk');
  startNameHint.style.display = '';
}

function _dismissNameHint() {
  localStorage.setItem('novora_hint_shown', '1');
  if (startNameHint) startNameHint.style.display = 'none';
}

startNameHintOkBtn.addEventListener('click',    () => _dismissNameHint());
startNameHintOkBtn.addEventListener('touchend', e => { e.preventDefault(); _dismissNameHint(); });

function _openStartNameEditor() {
  if (startNameInput) {
    startNameInput.value       = '';
    startNameInput.placeholder = getDisplayName(); // 現在のデフォルト名をプレースホルダーに
  }
  startNameView.style.display   = 'none';
  startNameEditor.style.display = 'flex';
  if (startNameInput) startNameInput.focus();
}

function _closeStartNameEditor() {
  startNameView.style.display   = 'flex';
  startNameEditor.style.display = 'none';
}

function _saveStartName() {
  // 空のまま確定 → プレースホルダーのデフォルト名を採用
  const raw = (startNameInput && startNameInput.value.trim()) || getDisplayName();
  if (saveDisplayName(raw)) syncDisplayNameToServer();
  updateStartPlayername();
  _closeStartNameEditor();
  _dismissNameHint();
}

startNameEditBtn.addEventListener('click',    () => _openStartNameEditor());
startNameEditBtn.addEventListener('touchend', e => { e.preventDefault(); _openStartNameEditor(); });
startNameSaveBtn.addEventListener('click',    () => _saveStartName());
startNameSaveBtn.addEventListener('touchend', e => { e.preventDefault(); _saveStartName(); });
startNameCancelBtn.addEventListener('click',    () => _closeStartNameEditor());
startNameCancelBtn.addEventListener('touchend', e => { e.preventDefault(); _closeStartNameEditor(); });
startNameHint.addEventListener('click',    () => _openStartNameEditor());
startNameHint.addEventListener('touchend', e => { e.preventDefault(); _openStartNameEditor(); });
startNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  _saveStartName();
  if (e.key === 'Escape') _closeStartNameEditor();
});

// 「連鎖表示」= #chain-display（2連鎖以上でポップアップ）
const chainEl = document.getElementById('chain-display');

// ============================================================
// 天体画像の表示調整値（image-adjuster.html で決定した値）
// scale: カバースケールへの乗数 / ox,oy: 中心からのオフセット（ゲーム px）
// ============================================================
const IMG_ADJUST = [
  /*  0: 宇宙塵      */ { scale: 1.22, ox:   0.2, oy:   0.1 },
  /*  1: 小惑星      */ { scale: 1.39, ox:   0.0, oy:   1.0 },
  /*  2: 月          */ { scale: 1.23, ox:   0.5, oy:   1.0 },
  /*  3: 地球        */ { scale: 1.19, ox:   0.8, oy:   0.6 },
  /*  4: 木星        */ { scale: 1.09, ox:   0.3, oy:   1.0 },
  /*  5: 太陽        */ { scale: 1.20, ox:   0.0, oy:   0.0 },
  /*  6: 赤色巨星    */ { scale: 1.14, ox:   0.0, oy:   0.0 },
  /*  7: 白色矮星    */ { scale: 1.35, ox:   0.0, oy:   0.0 },
  /*  8: 中性子星    */ { scale: 2.39, ox:   0.0, oy:   1.5 },
  /*  9: ブラックホール */ { scale: 1.20, ox:   0.5, oy:   5.0 },
  /* 10: 銀河        */ { scale: 1.01, ox:  -0.1, oy:  10.0 },
  /* 11: 銀河団      */ { scale: 1.05, ox:   0.0, oy:   0.0 },
];

// ============================================================
// 天体カスタム画像（絵文字の代わりに PNG を使う天体）
// bodyImages[bi] に Image オブジェクトをセットすると、その bi の天体に画像が使われる
// ============================================================
const bodyImages = new Array(CFG.BODIES.length).fill(null);
(function () {
  CFG.BODIES.forEach((def, bi) => {
    const img = new Image();
    img.onload = () => { try { updateHUD(); } catch (_) {} };
    img.src = `images/${def.key}.png`;
    bodyImages[bi] = img;
  });
})();

// ============================================================
// STATE
// ============================================================
let eng, world;
let score, dangerCnt;
let dead;    // true = ゲームオーバー（物理停止・描画は継続・#overlay 表示）
let paused;  // true = 設定中（物理停止・描画は継続・#settings-overlay 表示）
let waiting; // true = スタート待ち（物理停止・描画は継続・#start-overlay 表示）
let curBi, nxtBi, dropX, canDrop, dropTimer;
let bmap;    // Map<bodyId, {bi, at, body}>  ※ at = スポーン時刻(ms)
let mq;      // merge queue: 合成待ちペアのリスト
let glowMap; // Map<bodyId, {endTime, duration}> — 「合成時に少し光る仕様」のエフェクト管理

let chainCount;       // 連鎖カウント（1回目の合成で1、以降ウィンドウ内に続けば加算）
let chainTimer;       // 700ms 連鎖ウィンドウタイマー（新しい合成で clearTimeout される）
let chainResolveTimer; // 750ms 演出+報酬タイマー（新しい合成で cancel されてはいけない）

// ---- スキル状態 ----
let activeSkill;    // null | 'bomb' | 'upgrade' | 'delete'
let bombMode;       // true = 爆弾が落下待機中（curBi の代わりに爆弾を落とす）
let bombBody;       // 爆弾の Matter.js ボディ（投下後に存在）
let bombHit;        // true = 爆弾が衝突済み（導火線カウント中）
let bombFuseTimer;  // 爆発タイムアウト ID
let bombExplosion;  // 爆発エフェクト状態 {x, y, startTime, duration} | null

let skillSelectMode; // true = upgrade/delete の天体選択モード中
let skillSelectedId; // 選択済み bodyId（確認パネル表示中）
let skillCharges;    // {bomb, upgrade, delete} — 現在の所持数

let chainRewardPending; // true = 5連鎖報酬パネル表示中
let rouletteActive;    // true = ルーレット表示中
const rouletteQueue = [];   // ルーレット待機キュー（rouletteActive 中でも積める）
let pendingChoiceRewards = 0; // 未受け取り5連鎖報酬数
let choiceAutoShow = true;   // 報酬パネルを自動表示するか（設定でトグル可）
let choiceAutoTimer = null;  // 自動非表示タイマー
let choicePeekTimer = null;  // 短時間ピーク演出タイマー

// ---- デバッグモード状態 ----
let debugMode    = false; // ` キーでトグル
let debugBi      = 0;     // パレットで選択中の天体インデックス
let debugDragging = false; // 左ボタン押しっぱなし中

// korokoro_hi は旧キー名。rollaxy_hi に移行済みなら旧キーは無視される。
let hiScore = +(localStorage.getItem('rollaxy_hi') || localStorage.getItem('korokoro_hi') || 0);
hiEl.textContent = `${T('best')}: ${hiScore}`;

// 共有 URL（doGameOver で非同期生成し shareToX で使う）
let _pendingShareId = null;

// セッショントークン（beginGame() で取得し _createShare() で使う）
let _sessionToken = null;

// replay / anti-cheat 用メタデータ
let _gameStartTime = 0; // beginGame() でセット
let _dropCount     = 0; // 天体を落とすたびにカウント

// ゲームオーバーアニメーション
// ・天体をランダム順に消去し、最後の天体が消えた後にオーバーレイを表示する
// ・消去間隔 = GO_ANIM_MS ÷ 天体数 → 天体数に関わらず合計所要時間がほぼ一定
const GO_ANIM_MS = 2500; // 全天体消去にかける合計時間 (ms)
const POP_DUR_MS = 320;  // 1個あたりのポップアニメーション時間 (ms)
let _goPopEffects = [];   // { x, y, bi, startTime }

// ============================================================
// UTIL
// ============================================================
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

// ============================================================
// INIT — ゲーム全体の初期化（「リセット」時も呼ばれる）
// ============================================================
function init() {
  canvas.width  = CFG.W;
  canvas.height = CFG.H;
  resize();

  score = 0; dangerCnt = 0; dead = false; paused = false; waiting = true;
  _pendingShareId = null;
  _goPopEffects = [];
  _dropCount = 0;
  chainCount = 0;
  clearTimeout(chainTimer);       chainTimer = null;
  clearTimeout(chainResolveTimer); chainResolveTimer = null;
  chainEl.classList.remove('show', 'chain-final');
  // スキル状態リセット（所持数は config の初期値に戻す）
  skillCharges = { ...CFG.SKILL_INIT_CHARGES };
  activeSkill = null; bombMode = false;
  if (bombBody) { Matter.Composite.remove(world, bombBody, true); bombBody = null; }
  bombHit = false; clearTimeout(bombFuseTimer); bombFuseTimer = null; bombExplosion = null;
  skillSelectMode = false; skillSelectedId = null;
  skillConfirmEl.classList.remove('show');
  chainRewardPending = false;
  document.getElementById('chain-reward').classList.remove('show');
  clearTimeout(choiceAutoTimer); choiceAutoTimer = null;
  clearTimeout(choicePeekTimer); choicePeekTimer = null;
  rltReset();
  rouletteQueue.length = 0;
  pendingChoiceRewards = 0;
  updateRewardQueueInfo();
  updateSkillBarRewardState();
  updateSkillButtons();
  // ゲームオーバー・設定オーバーレイを閉じ、スタート画面を表示
  overlay.classList.remove('show');         // 「ゲームオーバー時のオーバーレイ」
  document.getElementById('share-note')?.classList.remove('show');
  _restoreShareButton();
  settingsOverlay.classList.remove('show'); // 「設定を開いたとき」の画面
  startOverlay.classList.add('show');       // 「スタート画面」
  updateStartPlayername();                  // スタート画面のプレイヤー名を最新に
  dropX = CFG.W / 2; canDrop = true;
  bmap = new Map(); mq = []; glowMap = new Map();
  if (dropTimer) clearTimeout(dropTimer);

  curBi = rnd(); nxtBi = rnd();

  if (eng) { Matter.Events.off(eng); Matter.Engine.clear(eng); }
  eng   = Matter.Engine.create({
    enableSleeping: true,
    gravity: { y: CFG.PHYS.GRAVITY },
    positionIterations: CFG.PHYS.POS_ITER,
    velocityIterations: CFG.PHYS.VEL_ITER,
  });
  world = eng.world;

  const { L, R, T, B, W: wt, GL, GR } = CFG.BOX;
  const wo = {
    isStatic: true, label: 'wall',
    friction: CFG.PHYS.FRIC, frictionStatic: CFG.PHYS.FRIC_S,
  };
  Matter.Composite.add(world, [
    // 底面
    Matter.Bodies.rectangle((L+R)/2,  B + wt/2,  R-L+wt*2, wt,     wo),
    // 左壁
    Matter.Bodies.rectangle(L - wt/2, (T+B)/2,   wt,       B-T+wt, wo),
    // 右壁
    Matter.Bodies.rectangle(R + wt/2, (T+B)/2,   wt,       B-T+wt, wo),
    // 左ガイド壁（ドロップゾーン・BOX.L より広め）
    Matter.Bodies.rectangle(GL - wt/2, T/2,       wt,       T,      wo),
    // 右ガイド壁（ドロップゾーン・BOX.R より広め）
    Matter.Bodies.rectangle(GR + wt/2, T/2,       wt,       T,      wo),
  ]);

  Matter.Events.on(eng, 'collisionStart',  onColl);           // 接触開始
  Matter.Events.on(eng, 'collisionActive', onColl);           // 接触継続中（クールダウン解除後の再判定）
  Matter.Events.on(eng, 'afterUpdate',     checkCustomSleep); // 振動検出による強制スリープ
  Matter.Events.on(eng, 'afterUpdate',     scanNearby);       // 近距離ペアを補完スキャン
  Matter.Events.on(eng, 'afterUpdate',     flushMerges);      // スキャン結果を処理（登録順で後に実行）
  updateHUD();
}

// 出現する天体をランダム選択（0 〜 MAX_SPAWN の範囲）
function rnd() { return Math.floor(Math.random() * (CFG.RULES.MAX_SPAWN + 1)); }

// ============================================================
// SPAWN — 「天体」を物理ワールドに生成
// ============================================================
function spawn(x, y, bi) {
  const def = CFG.BODIES[bi];
  const b = Matter.Bodies.circle(x, y, def.r, {
    label: 'celestial',
    friction:       CFG.PHYS.FRIC,
    frictionAir:    CFG.PHYS.FRIC_AIR,
    frictionStatic: CFG.PHYS.FRIC_S,
    restitution:    CFG.PHYS.REST,
    slop:           CFG.PHYS.SLOP,
  });
  bmap.set(b.id, { bi, at: Date.now(), body: b });
  Matter.Composite.add(world, b);
  return b;
}

// ============================================================
// DROP — プレイヤーが「天体」（または爆弾）を落とす
// ============================================================
function drop() {
  if (!canDrop || dead || waiting || chainTimer !== null || chainResolveTimer !== null) return;
  if (skillSelectMode) return;
  // chainRewardPending 中（5連鎖報酬パネル表示中）もドロップ可能にする
  canDrop = false;
  _dropCount++; // 投下カウント（replay / anti-cheat 用）

  if (bombMode) {
    // 爆弾を投下（curBi は変えない）
    const r = CFG.BOMB.R;
    const x = clamp(dropX, CFG.BOX.L + r + 1, CFG.BOX.R - r - 1);
    bombBody = spawnBomb(x, CFG.DROP_Y);
    bombMode = false;
    activeSkill = null;
    if (skillCharges.bomb !== Infinity) skillCharges.bomb--;
    updateSkillButtons();
  } else {
    const def = CFG.BODIES[curBi];
    const x = clamp(dropX, CFG.BOX.L + def.r + 1, CFG.BOX.R - def.r - 1);
    spawn(x, CFG.DROP_Y, curBi);
    curBi = nxtBi; nxtBi = rnd();
    updateHUD();
  }

  dropTimer = setTimeout(() => { canDrop = true; }, CFG.RULES.COOLDOWN);
}

// ============================================================
// 合成生成位置の計算（速度の逆数による重み付き補間）
//
// 「合成」時に新しい天体をどこに生成するかを決める。
// 重み w = 1 / (speed + EPS)^BIAS で連続的に決定するため
// 「静止 vs 高速」「両静止」「両移動」を if 分岐なしで統一処理できる。
//
//   両方静止       → 重みが等しい → 中間点に生成
//   一方静止・一方高速 → 静止側の重みが圧倒的 → 静止側寄りに生成
//   両方移動       → 遅い方に寄る
//
// BIAS・EPS は CFG.RULES で調整可能。
// ============================================================
function mergeSpawnPos(bA, bB) {
  const { MERGE_POS_BIAS: bias, MERGE_POS_EPS: eps } = CFG.RULES;
  const velA = Math.hypot(bA.velocity.x, bA.velocity.y);
  const velB = Math.hypot(bB.velocity.x, bB.velocity.y);
  // 遅いほど重みが大きくなる（eps で完全静止でも安定）
  const wA = 1 / Math.pow(velA + eps, bias);
  const wB = 1 / Math.pow(velB + eps, bias);
  const t  = wA / (wA + wB); // A の寄与率（0=B 側, 1=A 側）
  return {
    x: bA.position.x * t + bB.position.x * (1 - t),
    y: bA.position.y * t + bB.position.y * (1 - t),
  };
}

// ============================================================
// COLLISION → MERGE QUEUE
// 「合成」トリガー: 同種天体が接触したら mq（合成待ちキュー）に追加
// ============================================================
function onColl(evt) {
  const now = Date.now();

  // 爆弾の衝突検知（bombBody が存在し未点火なら導火線を開始）
  if (bombBody && !bombHit) {
    for (const { bodyA, bodyB } of evt.pairs) {
      if (bodyA.id === bombBody.id || bodyB.id === bombBody.id) {
        startBombFuse(); break;
      }
    }
  }

  for (const { bodyA: bA, bodyB: bB } of evt.pairs) {
    const dA = bmap.get(bA.id), dB = bmap.get(bB.id);
    if (!dA || !dB || dA.bi !== dB.bi) continue;

    // 合成直後の天体は猶予時間が切れるまで再合成しない
    if (now - dA.at < CFG.RULES.MERGE_GRACE_MS) continue;
    if (now - dB.at < CFG.RULES.MERGE_GRACE_MS) continue;
    const key = bA.id < bB.id ? `${bA.id}-${bB.id}` : `${bB.id}-${bA.id}`;
    if (mq.some(m => m.key === key)) continue;

    const vanish = dA.bi >= CFG.BODIES.length - 1; // 銀河団同士は消滅

    const { x, y } = mergeSpawnPos(bA, bB);
    mq.push({ key, bA, bB, bi: dA.bi, vanish, x, y });
  }
}

// ============================================================
// 連鎖カウント処理
// 合成が起きるたびに呼ぶ。CHAIN_WINDOW_MS 以内に次の合成が来れば連鎖が続く。
// 2連鎖以上になったら #chain-display に「N連鎖！」を表示する。
// ============================================================
function triggerChain() {
  // chainTimer（700ms窓）だけをキャンセル。
  // chainResolveTimer は触らない → 確定済み連鎖の報酬が上書きされない。
  clearTimeout(chainTimer);
  chainTimer = null;
  chainCount++;
  playMergeSound(chainCount);

  if (chainCount >= 2) {
    chainEl.textContent = T('chain')(chainCount);
    chainEl.classList.remove('show', 'chain-final');
    void chainEl.offsetWidth;
    chainEl.classList.add('show');
  }

  // 700ms 以内に次の合成が来なければ連鎖終了
  chainTimer = setTimeout(() => {
    // ── この時点で finalCount を確定スナップショットとして取得 ──
    // 以降 chainCount がどう変わっても finalCount は変わらない
    const finalCount = chainCount;
    chainCount = 0;
    chainTimer = null; // 700ms窓は終了

    if (finalCount < 2) return;

    // ぽん！演出（chainResolveTimer が非null の間はドロップをブロック）
    chainEl.classList.remove('show', 'chain-final');
    void chainEl.offsetWidth;
    chainEl.textContent = T('chain')(finalCount);
    chainEl.classList.add('chain-final');

    // chainResolveTimer は新しい合成の clearTimeout(chainTimer) に影響されない独立タイマー
    chainResolveTimer = setTimeout(() => {
      chainResolveTimer = null;
      chainEl.classList.remove('chain-final');
      // finalCount はクロージャに閉じた不変値なので競合しない
      if      (finalCount === 4) enqueueRoulette();
      else if (finalCount >= 5) enqueueChoice();
    }, 280);
  }, CFG.RULES.CHAIN_WINDOW_MS);
}

// mq を処理して実際に「合成」を実行する
function flushMerges() {
  if (!mq.length) return;
  const q = mq.splice(0);
  const done = new Set();
  let anyMerged = false;
  for (const m of q) {
    if (done.has(m.bA.id) || done.has(m.bB.id)) continue;
    if (!bmap.has(m.bA.id) || !bmap.has(m.bB.id)) continue;
    done.add(m.bA.id); done.add(m.bB.id);
    anyMerged = true;

    bmap.delete(m.bA.id); bmap.delete(m.bB.id);
    Matter.Composite.remove(world, m.bA, true);
    Matter.Composite.remove(world, m.bB, true);

    if (m.vanish) {
      // 銀河団同士は消滅：ボーナススコアのみ加算
      score += CFG.BODIES[m.bi].s * 2;
      triggerChain();
      updateHUD();
      continue;
    }

    const ni = m.bi + 1;
    score += CFG.BODIES[ni].s;

    // 同座標スポーン防止: 微小オフセットを加える
    const ox = (Math.random() - 0.5) * 0.5;
    const oy = (Math.random() - 0.5) * 0.5;
    const nb = spawn(m.x + ox, m.y + oy, ni);

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * CFG.RULES.MERGE_BURST;
    Matter.Body.setVelocity(nb, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    });

    // 「合成時に少し光る仕様」のエフェクト登録（段階が上がるほど長く光る）
    const duration = 300 + ni * 100; // ni=1→400ms … ni=11→1400ms
    glowMap.set(nb.id, { endTime: Date.now() + duration, duration });

    triggerChain();
    updateHUD();
  }
  // 合成で生じた空間に周囲の天体が落下できるよう sleep を解除する
  if (anyMerged) wakeAllBodies();
}

// ============================================================
// CUSTOM SLEEP — 振動検出による強制スリープ
//
// Matter.js のデフォルト sleep は瞬間速度を基準にするため、
// 微小振動（行ったり来たりで net 変位がほぼゼロ）の天体が sleep しない。
// SLEEP_INTERVAL sub-step ごとに net 変位を計算し、
// 閾値未満なら「振動中」とみなして強制スリープさせる。
// ゆっくり落下・移動している天体は net 変位が大きいため sleep しない。
// ============================================================
const SLEEP_INTERVAL  = 60;   // 判定間隔 (sub-step 数)。4 sub-step/frame × 60fps で約 250ms
const SLEEP_NET_DISP2 = 0.25; // net 変位の二乗閾値 (px²)。0.5px 未満かつ高周波振動ならスリープ
const SLEEP_GRACE_MS  = 800; // スポーン・wake 直後のこの時間は判定しない (ms)

function checkCustomSleep() {
  if (dead) return;
  const now = Date.now();
  for (const d of bmap.values()) {
    if (now - d.at < SLEEP_GRACE_MS) continue; // スポーン直後は除外
    if (d.body.isSleeping) continue;           // すでに sleep 中はスキップ

    if (!d._sc) {
      d._sc = { x: d.body.position.x, y: d.body.position.y, tick: 0 };
      continue;
    }
    if (++d._sc.tick < SLEEP_INTERVAL) continue;

    const dx = d.body.position.x - d._sc.x;
    const dy = d.body.position.y - d._sc.y;
    // 次の判定ウィンドウのために現在位置を記録してカウンタをリセット
    d._sc.x = d.body.position.x;
    d._sc.y = d.body.position.y;
    d._sc.tick = 0;

    if (dx * dx + dy * dy < SLEEP_NET_DISP2) {
      Matter.Sleeping.set(d.body, true);
    }
  }
}

// ============================================================
// PROXIMITY MERGE SCAN
// 物理エンジンの solver 誤差で collisionActive が発火しないケースを補完する。
// 同種ボディを全ペア走査し、中心間距離が (r×2 + margin) 以内なら mq に積む。
// ============================================================
function scanNearby() {
  if (dead) return;
  const entries = [...bmap.values()]; // スナップショット（flushMerges の変更と干渉しない）
  const now = Date.now();
  for (let i = 0; i < entries.length - 1; i++) {
    const dA = entries[i];
    if (now - dA.at < CFG.RULES.MERGE_GRACE_MS) continue;
    const bA = dA.body;
    const r  = CFG.BODIES[dA.bi].r; // 同種なので rA === rB
    const threshold = r * 2 + r * CFG.RULES.MERGE_MARGIN;
    const thresh2   = threshold * threshold; // sqrt 回避

    for (let j = i + 1; j < entries.length; j++) {
      const dB = entries[j];
      if (dA.bi !== dB.bi) continue;
      if (now - dB.at < CFG.RULES.MERGE_GRACE_MS) continue;

      const bB = dB.body;
      const dx = bA.position.x - bB.position.x;
      const dy = bA.position.y - bB.position.y;
      if (dx * dx + dy * dy > thresh2) continue;

      const key = bA.id < bB.id ? `${bA.id}-${bB.id}` : `${bB.id}-${bA.id}`;
      if (mq.some(m => m.key === key)) continue;

      const vanish = dA.bi >= CFG.BODIES.length - 1;
      const { x, y } = mergeSpawnPos(bA, bB);
      mq.push({ key, bA, bB, bi: dA.bi, vanish, x, y });
    }
  }
}

// ============================================================
// GAME OVER CHECK — 危険ラインより上に天体が積み上がった状態を検出
// ============================================================
function checkDanger() {
  if (dead) return;
  const now = Date.now();
  let hi = false;
  for (const d of bmap.values()) {
    if (now - d.at < CFG.RULES.GRACE_MS) continue;
    if (d.body.position.y - CFG.BODIES[d.bi].r < CFG.DANGER_Y) { hi = true; break; }
  }
  dangerCnt = hi ? dangerCnt + 1 : 0;
  if (dangerCnt >= CFG.RULES.DANGER_F) doGameOver();
}

function doGameOver() {
  dead = true;
  if (dropTimer) clearTimeout(dropTimer);
  // 連鎖演出タイマーをすべて止める（ゲームオーバー後に報酬が発生しないよう）
  clearTimeout(chainTimer);       chainTimer = null;
  clearTimeout(chainResolveTimer); chainResolveTimer = null;
  rouletteQueue.length = 0; // キュー済みルーレットも破棄
  pendingChoiceRewards = 0; // 未受け取り報酬を破棄（スキルバーの「受け取る」ボタンを消す）
  rltReset(); // ルーレット表示中でもゲームオーバーで強制終了
  closeChoicePanel(); // updateSkillBarRewardState を内部で呼ぶ（pendingChoiceRewards=0 が先に必要）
  resetSkillState(); // スキル状態をクリア
  finalEl.textContent = score;
  const isHi = score > hiScore;
  newHiEl.style.display = isHi ? 'block' : 'none';
  if (isHi) {
    hiScore = score;
    localStorage.setItem('rollaxy_hi', score);
    localStorage.removeItem('korokoro_hi'); // 旧キーを削除（移行完了）
    hiEl.textContent = `${T('best')}: ${hiScore}`;
  }
  // GA4 game_over イベント
  // _startGameOverAnim() が bmap を順次削除する前にここで計算する
  let _highestTier = 0;
  for (const d of bmap.values()) { if (d.bi > _highestTier) _highestTier = d.bi; }
  logEvent('game_over', {
    game_id:      'rollaxy',
    score,
    highest_tier: _highestTier,
    drop_count:   _dropCount,
    elapsed_sec:  Math.round((Date.now() - _gameStartTime) / 1000),
    is_new_best:  isHi ? 1 : 0,
  });
  // share API を即座に非同期呼び出し（アニメーション中に裏で通信）
  _pendingShareId = null;
  shareBtn.disabled = true;
  shareBtn.textContent = T('sharePreparing');
  shareBtn.classList.add('loading');
  _createShare();
  // 天体を順番にポップ消去 → 全消去後にオーバーレイ表示
  _startGameOverAnim();
}

// 天体をランダム順にポップ消去し、終わったらゲームオーバーオーバーレイを表示する
function _startGameOverAnim() {
  const ids = [...bmap.keys()];
  if (ids.length === 0) {
    overlay.classList.add('show');
    return;
  }
  // Fisher-Yates シャッフル
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const interval = GO_ANIM_MS / ids.length;
  ids.forEach((id, idx) => {
    setTimeout(() => {
      _popBody(id);
      if (idx === ids.length - 1) {
        // 最後の天体のポップアニメが終わる頃にオーバーレイを表示
        setTimeout(() => overlay.classList.add('show'), POP_DUR_MS + 80);
      }
    }, Math.round(idx * interval));
  });
}

// 天体を物理世界から除去してポップエフェクトを登録する
function _popBody(id) {
  const d = bmap.get(id);
  if (!d) return;
  _goPopEffects.push({
    x: d.body.position.x,
    y: d.body.position.y,
    bi: d.bi,
    startTime: performance.now(),
  });
  bmap.delete(id);
  glowMap.delete(id);
  Matter.Composite.remove(world, d.body, true);
}

// ============================================================
// HUD — ヘッダーのスコアと「次の天体が表示されているところ」を更新
// ============================================================
function updateHUD() {
  scoreEl.textContent = `${T('score')}: ${score}`;
  const _ni = bodyImages[nxtBi];
  if (_ni && _ni.complete && _ni.naturalWidth > 0) {
    nextEmoEl.innerHTML = `<img src="${_ni.src}" style="height:1.3em;vertical-align:middle;border-radius:50%">`;
  } else {
    nextEmoEl.textContent = CFG.BODIES[nxtBi].e;
  }
}

// ============================================================
// GAME LOOP
// dead   = true → 物理停止（ゲームオーバー）、描画は継続して #overlay の背後に見える
// paused = true → 物理停止（設定中）、描画は継続して #settings-overlay の背後に見える
// ============================================================
let lastT = 0;
function loop(t) {
  const dt = Math.min(t - lastT, 50); // 最大50msでキャップ（タブ非表示対策）
  lastT = t;
  if (!dead && !paused && !waiting) {
    const subDt = dt / CFG.PHYS.SUBSTEPS;
    for (let i = 0; i < CFG.PHYS.SUBSTEPS; i++) {
      Matter.Engine.update(eng, subDt);
    }
    // flushMerges は afterUpdate イベントで各サブステップ後に処理される
    checkDanger();
  }
  draw();
  requestAnimationFrame(loop);
}

// ============================================================
// RESPONSIVE RESIZE（スマホ向け）
// canvas は論理サイズ 400×700px を固定し、CSS transform:scale で画面サイズに合わせる。
// これにより物理演算の座標系を変えずにスマホ・PC どちらでも正しく表示できる。
// ============================================================
function resize() {
  const ow = outer.clientWidth  || CFG.W;
  const oh = outer.clientHeight || CFG.H;
  const s  = Math.min(ow / CFG.W, oh / CFG.H);
  const ox = Math.floor((ow - CFG.W * s) / 2);
  canvas.style.width           = CFG.W + 'px';
  canvas.style.height          = CFG.H + 'px';
  canvas.style.transform       = `scale(${s})`;
  canvas.style.transformOrigin = 'top left';
  canvas.style.left            = ox + 'px';
  outer.style.height           = Math.ceil(CFG.H * s) + 'px';
}

// ============================================================
// INPUT（マウス＆タッチ）
// スマホ向け:
//   - touchmove に passive:false → preventDefault() でスクロールを封じる
//   - touchend でも drop() を呼ぶ → iOS の 300ms click 遅延を回避
//   - toLogicalX で CSS transform による座標ズレを補正
// ============================================================
function toLogicalX(clientX) {
  const r = canvas.getBoundingClientRect();
  return (clientX - r.left) * (CFG.W / r.width);
}

canvas.addEventListener('mousemove', e => {
  if (debugMode) {
    if (debugDragging) debugPlace(toLogicalX(e.clientX), toLogicalY(e.clientY));
    return;
  }
  if (!skillSelectMode) dropX = toLogicalX(e.clientX);
});
canvas.addEventListener('mousedown', e => {
  if (!debugMode) return;
  e.preventDefault();
  if (e.button === 0) { debugDragging = true; debugPlace(toLogicalX(e.clientX), toLogicalY(e.clientY)); }
  if (e.button === 2) debugRemove(toLogicalX(e.clientX), toLogicalY(e.clientY));
});
canvas.addEventListener('mouseup',    () => { debugDragging = false; });
canvas.addEventListener('mouseleave', () => { debugDragging = false; });
canvas.addEventListener('contextmenu', e => { if (debugMode) e.preventDefault(); });
canvas.addEventListener('click', e => {
  if (debugMode) return; // デバッグモード中は通常のクリック操作をスキップ
  const lx = toLogicalX(e.clientX);
  if (skillSelectMode) { handleSelectTap(lx, toLogicalY(e.clientY)); return; }
  dropX = lx; drop();
});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!skillSelectMode) dropX = toLogicalX(e.touches[0].clientX);
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const lx = toLogicalX(e.changedTouches[0].clientX);
  const ly = toLogicalY(e.changedTouches[0].clientY);
  if (skillSelectMode) { handleSelectTap(lx, ly); return; }
  dropX = lx; drop();
}, { passive: false });

// 各ボタンに click と touchend を両方登録（スマホの 300ms 遅延対策）
// retry_click はここで発火（init() 内部ではなく）
// → ページ初回ロード時の init() と区別するため
retryBtn.addEventListener('click', () => {
  logEvent('retry_click', { game_id: 'rollaxy', previous_score: score });
  init();
});
retryBtn.addEventListener('touchend', e => {
  e.preventDefault(); // touchend の後に click が重複発火しないよう preventDefault
  logEvent('retry_click', { game_id: 'rollaxy', previous_score: score });
  init();
});

startBtn.addEventListener('click',    () => beginGame());
startBtn.addEventListener('touchend', e => { e.preventDefault(); beginGame(); });

// ============================================================
// 設定オーバーレイの開閉
// openSettings: dead=true（ゲームオーバー中）は開かない
// ============================================================
function beginGame() {
  waiting = false;
  _gameStartTime = Date.now(); // ゲーム開始時刻（elapsed_ms 計算用）
  startOverlay.classList.remove('show');
  updateSkillButtons(); // waiting=false になったのでボタンの disabled を解除
  _unlockAudio();       // ユーザー操作のタイミングで音声を起動し autoplay 制限を解除
  logEvent('game_start', { game_id: 'rollaxy' });
  _fetchSessionToken(); // セッショントークンをバックグラウンドで取得（ゲーム開始はブロックしない）
}

// ゲーム開始時にサーバーからセッショントークンを非同期取得。
// 取得できなくてもゲームは続行（JWT_SECRET 未設定時は token: null が返る）。
async function _fetchSessionToken() {
  try {
    const res = await fetch('/api/session');
    if (res.ok) {
      const { token } = await res.json();
      _sessionToken = token ?? null;
    }
  } catch (_) {
    // ネットワークエラー時はトークンなしのまま続行
  }
}

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
  settingsOverlay.classList.add('show');
}
function closeSettings() {
  paused = false;
  settingsOverlay.classList.remove('show');
  _showMenuPanel(); // 次回オープン時のためにメニューへリセット
}

settingsBtn.addEventListener('click',    () => paused ? closeSettings() : openSettings());
settingsBtn.addEventListener('touchend', e => { e.preventDefault(); paused ? closeSettings() : openSettings(); });
resumeBtn.addEventListener('click',    () => closeSettings());
resumeBtn.addEventListener('touchend', e => { e.preventDefault(); closeSettings(); });
menuSettingsBtn.addEventListener('click',    () => _showSettingsPanel());
menuSettingsBtn.addEventListener('touchend', e => { e.preventDefault(); _showSettingsPanel(); });
settingsBackBtn.addEventListener('click',    () => _showMenuPanel());
settingsBackBtn.addEventListener('touchend', e => { e.preventDefault(); _showMenuPanel(); });
resetBtn.addEventListener('click',    () => { closeSettings(); init(); });
resetBtn.addEventListener('touchend', e => { e.preventDefault(); closeSettings(); init(); });

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
  displayNameSaveBtn.addEventListener('click',    doSaveName);
  displayNameSaveBtn.addEventListener('touchend', e => { e.preventDefault(); doSaveName(); });
  document.getElementById('displayname-input')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSaveName(); } });
}

// 効果音スライダー
const sfxVolSlider = document.getElementById('sfx-vol');
const sfxValEl     = document.getElementById('sfx-val');
sfxVolSlider.value = sfxVolume;
sfxValEl.textContent = Math.round(sfxVolume * 100) + '%';
sfxVolSlider.addEventListener('input', () => {
  sfxVolume = parseFloat(sfxVolSlider.value);
  sfxValEl.textContent = Math.round(sfxVolume * 100) + '%';
  localStorage.setItem('rollaxy_sfx_vol', sfxVolume);
});

window.addEventListener('resize', resize);

// ============================================================
// LANG — 言語セレクターの構築と langchange イベントへの対応
// ============================================================

// 設定オーバーレイ内に言語ボタンを生成（LANG_ORDER の順）
function buildLangSelector() {
  const selector = document.getElementById('settings-lang-row');
  if (!selector) return;
  selector.innerHTML = '';
  for (const code of LANG_ORDER) {
    const btn = document.createElement('button');
    btn.className = 'lang-btn';
    btn.dataset.lang = code;
    btn.textContent = LANGS[code].name;
    if (code === currentLang) btn.classList.add('active');
    btn.addEventListener('click',     () => setLang(code));
    btn.addEventListener('touchend',  e  => { e.preventDefault(); setLang(code); }, { passive: false });
    selector.appendChild(btn);
  }
}

// lang.js の applyLang() が発火する langchange を受けてスコア等の動的文字列を再描画
document.addEventListener('langchange', () => {
  scoreEl.textContent = `${T('score')}: ${score ?? 0}`;
  hiEl.textContent    = `${T('best')}: ${hiScore}`;
  updateRewardQueueInfo();
  updateAutoshowBtn();
  updateNameHint();
  // 表示名フィールドの placeholder を言語に合わせて更新
  const dnInput = document.getElementById('displayname-input');
  if (dnInput) dnInput.placeholder = T('displayNamePlaceholder');
});

// ============================================================
// DEBUG MODE — ` キーでトグル
// ゲーム進行はそのまま継続しつつ、任意の天体を直接配置・削除できる。
// ============================================================
const DBG_KEYS   = '1234567890-='; // 12天体のショートカット
const dbgPanel   = document.getElementById('debug-panel');
const dbgCountEl = document.getElementById('debug-count');

function buildDebugPalette() {
  const container = document.getElementById('debug-palette');
  CFG.BODIES.forEach((def, i) => {
    const btn = document.createElement('button');
    btn.className = 'dbg-btn';
    btn.dataset.bi = i;
    btn.innerHTML =
      `<span class="dbg-key">${DBG_KEYS[i]}</span>` +
      `<span class="dbg-emoji">${def.e}</span>`;
    btn.title = `${def.n}  r=${def.r}  score=${def.s}`;
    btn.addEventListener('click', () => debugSelectBi(i));
    container.appendChild(btn);
  });
  debugSelectBi(0);
}

function debugSelectBi(i) {
  debugBi = i;
  document.querySelectorAll('.dbg-btn').forEach((b, j) => b.classList.toggle('active', j === i));
}

function toggleDebugMode() {
  debugMode = !debugMode;
  dbgPanel.classList.toggle('show', debugMode);
  outer.classList.toggle('debug-active', debugMode);
  debugDragging = false;
}

// 天体をゲームフィールド内に直接配置
function debugPlace(lx, ly) {
  if (lx < CFG.BOX.L || lx > CFG.BOX.R || ly < CFG.BOX.T || ly > CFG.BOX.B) return;
  spawn(lx, ly, debugBi);
  dbgCountEl.textContent = bmap.size + ' bodies';
}

// クリック位置に最も近い天体を削除
function debugRemove(lx, ly) {
  for (const [id, d] of bmap.entries()) {
    const dx = d.body.position.x - lx;
    const dy = d.body.position.y - ly;
    if (dx * dx + dy * dy <= CFG.BODIES[d.bi].r * CFG.BODIES[d.bi].r) {
      bmap.delete(id); glowMap.delete(id);
      Matter.Composite.remove(world, d.body, true);
      dbgCountEl.textContent = bmap.size + ' bodies';
      return;
    }
  }
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  // ` でデバッグモードをトグル
  if (e.key === '`') { toggleDebugMode(); return; }
  if (!debugMode) return;
  // 1–= で天体選択
  const ki = DBG_KEYS.indexOf(e.key);
  if (ki !== -1 && ki < CFG.BODIES.length) { debugSelectBi(ki); return; }
  // Shift+R で全天体クリア（誤爆防止のため Shift 必須）
  if (e.key === 'R') {
    for (const [id, d] of bmap.entries()) {
      glowMap.delete(id);
      Matter.Composite.remove(world, d.body, true);
    }
    bmap.clear();
    dbgCountEl.textContent = '0 bodies';
  }
});

// ============================================================
// START
// ============================================================
buildDebugPalette();
buildLangSelector();
applyLang();
init();
updateStartPlayername();
updateNameHint();
updateAutoshowBtn(); // game-skills.js のロード時点では choiceAutoShow 未定義のためここで呼ぶ
requestAnimationFrame(loop);
