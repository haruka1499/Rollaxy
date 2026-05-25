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
//   「スタート画面」      → #start-screen（canvas外の独立レイヤー。ページ読み込み・リトライ・リセット後に表示）
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

// デバイスピクセル比（Retina / 高DPI 対応）。3倍超はパフォーマンス重視で上限を設ける
const _dpr = Math.min(window.devicePixelRatio || 1, 3);

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

// 「スタート画面」= #start-screen（canvas外の独立レイヤー）
const startScreen       = document.getElementById('start-screen');
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
    hide(startNameHint);
    return;
  }
  const msgEl = document.getElementById('start-name-hint-msg');
  if (msgEl) msgEl.textContent = T('startNameHint');
  if (startNameHintOkBtn) startNameHintOkBtn.textContent = T('startNameHintOk');
  show(startNameHint);
}

function _dismissNameHint() {
  localStorage.setItem('novora_hint_shown', '1');
  if (startNameHint) hide(startNameHint);
}

on(startNameHintOkBtn, _dismissNameHint);

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

on(startNameEditBtn,   _openStartNameEditor);
on(startNameSaveBtn,   _saveStartName);
on(startNameCancelBtn, _closeStartNameEditor);
on(startNameHint,      _openStartNameEditor);
startNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter')  _saveStartName();
  if (e.key === 'Escape') _closeStartNameEditor();
});

// 「連鎖表示」= #chain-display（2連鎖以上でポップアップ）
const chainEl = document.getElementById('chain-display');

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
let waiting; // true = スタート待ち（物理停止・描画は継続・#start-screen 表示）
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

// ---- チュートリアル / 強制スキル使用 ----
let tutorialDone = !!localStorage.getItem('rollaxy_tutorial_done');
let tutorialActive = false;     // チュートリアル強制使用モード中
let tutorialTargetId = null;    // ポインターが指す天体ID
let _forcedSkillActive = false; // 4連鎖後の強制即時使用待ち中

// ---- リマインダー追跡（セッション単位） ----
let _session5ChainCount   = 0;     // 今セッションの5連鎖報酬付与回数
let _sessionEverClaimed   = false; // 一度でも報酬を選択したか
let _sessionEverUsedSkill = false; // 一度でも自分でスキルを使ったか

// ---- ポインター座標変換キャッシュ ----
let _canvasScale   = 1;
let _canvasOffsetX = 0;

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
let _gameStartTime     = 0; // beginGame() でセット
let _dropCount         = 0; // 天体を落とすたびにカウント
let _clusterVanishCount = 0; // 銀河団同士の消滅回数（ゲーム内）
let _mergeCount        = 0; // このゲームでの合成回数（doGameOver で累計に加算）
let _bodyMergeCount    = []; // このゲームでの天体種別合成回数（インデックス=bi）
let _savedBodyMerges   = []; // ゲーム開始時に localStorage から読み込んだ累計
let _maxChainThisGame  = 0;  // このゲームの最高連鎖数
let _chainEventCount   = 0;  // このゲームで発生した連鎖回数（finalCount>=2の解決回数）
let _lastDropHadChain  = false; // 前のドロップで連鎖が発生したか
let _consecutiveChainDrops = 0; // 連続連鎖ドロップ数
let _chainCountsByLevel = []; // このゲームでの各連鎖レベル(5〜15)達成回数
let _savedChainCounts   = []; // ゲーム開始時に localStorage から読み込んだ累計
let _skillJustUsed           = false; // スキルが適用されてから次のドロップ/連鎖解決前か
let _skillChainCountsByLevel = []; // このゲームでのスキル経由各連鎖レベル(5〜10)達成回数
let _savedSkillChainCounts   = []; // ゲーム開始時に localStorage から読み込んだ累計

// ゲームオーバーアニメーション
// ・天体をランダム順に消去し、最後の天体が消えた後にオーバーレイを表示する
// ・消去間隔 = GO_ANIM_MS ÷ 天体数 → 天体数に関わらず合計所要時間がほぼ一定
const GO_ANIM_MS   = 2500; // 全天体消去にかける合計時間 (ms)
const POP_DUR_MS   = 320;  // 1個あたりのポップアニメーション時間 (ms)
const GO_FLASH_MS  = 900;  // アウト天体の点滅強調時間 (ms) — この後に消去アニメが始まる
let _goPopEffects  = [];   // { x, y, bi, startTime }
let _goFlashIds    = new Set(); // 点滅強調するアウト天体のID
let _goFlashStart  = 0;         // 点滅開始時刻 (Date.now())

// ============================================================
// UTIL
// ============================================================
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

// ============================================================
// INIT — ゲーム全体の初期化（「リセット」時も呼ばれる）
// ============================================================
function init() {
  // canvas バッファを DPR 倍に設定し、論理座標は CFG.W×CFG.H のままにする。
  // これにより Retina/高DPI ディスプレイで描画がくっきりする。
  // ※ canvas.width を再代入するとコンテキスト状態がリセットされるため、
  //   必ずその直後に ctx.scale(_dpr, _dpr) を呼ぶ。
  canvas.width  = CFG.W * _dpr;
  canvas.height = CFG.H * _dpr;
  ctx.scale(_dpr, _dpr);
  resize();

  score = 0; dangerCnt = 0; dead = false; paused = false; waiting = true;
  _resetStats();
  // ゲームオーバー・設定オーバーレイを閉じる（スタート画面は表示しない）
  hide(overlay);         // ゲームオーバーオーバーレイ
  document.getElementById('share-note')?.classList.remove('show');
  const _rankPctEl = document.getElementById('rank-pct-el');
  if (_rankPctEl) { hide(_rankPctEl); _rankPctEl.textContent = ''; }
  _restoreShareButton();
  hide(settingsOverlay); // 設定オーバーレイ
  startScreen.classList.remove('hidden');    // スタート画面を表示（#start-screen の .hidden を外す）
  dropX = CFG.W / 2; canDrop = true;
  bmap = new Map(); mq = []; glowMap = new Map();
  if (dropTimer) clearTimeout(dropTimer);

  curBi = rnd(); nxtBi = rnd();

  _buildPhysicsWorld();
  updateHUD();
}

// 物理エンジン・壁・衝突イベントを再構築する（init からのみ呼ばれる）。
// bmap などの状態リセット後に呼ぶこと。
function _buildPhysicsWorld() {
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
}

// スコア・各種カウンタ・スキル・連鎖・チュートリアル状態をリセットする
// （init からのみ呼ばれる）。コア状態フラグ（dead/paused/waiting/score）は
// 呼び出し側 init() に残してある。
function _resetStats() {
  _pendingShareId = null;
  _goPopEffects = [];
  _goFlashIds.clear();
  _goFlashStart = 0;
  _dropCount = 0;
  _clusterVanishCount = 0;
  _mergeCount = 0;
  _bodyMergeCount = [];
  _savedBodyMerges = JSON.parse(localStorage.getItem('rollaxy_body_merges') || '[]');
  _maxChainThisGame = 0;
  _chainEventCount = 0;
  _lastDropHadChain = false;
  _consecutiveChainDrops = 0;
  _chainCountsByLevel = [];
  _savedChainCounts = JSON.parse(localStorage.getItem('rollaxy_chain_counts') || '[]');
  _skillJustUsed = false;
  _skillChainCountsByLevel = [];
  _savedSkillChainCounts = JSON.parse(localStorage.getItem('rollaxy_skill_chain_counts') || '[]');
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
  hide(skillConfirmEl);
  chainRewardPending = false;
  document.getElementById('chain-reward').classList.remove('show');
  clearTimeout(choiceAutoTimer); choiceAutoTimer = null;
  clearTimeout(choicePeekTimer); choicePeekTimer = null;
  rltReset();
  rouletteQueue.length = 0;
  pendingChoiceRewards = 0;
  updateRewardQueueInfo();
  updateSkillBarRewardState();
  // チュートリアル・強制使用・リマインダーをリセット
  tutorialActive = false; tutorialTargetId = null; _forcedSkillActive = false;
  hideTutorialPointer();
  _session5ChainCount = 0; _sessionEverClaimed = false; _sessionEverUsedSkill = false;
  updateSkillButtons();
  updateReminderHighlight();
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

  // 前のターンに連鎖があったか確認して連続連鎖を更新（初回ドロップは対象外）
  if (_dropCount > 1) {
    if (_lastDropHadChain) {
      _consecutiveChainDrops++;
      achCheckConsecutiveChain(_consecutiveChainDrops);
    } else {
      _consecutiveChainDrops = 0;
    }
  }
  _lastDropHadChain = false;
  _skillJustUsed = false; // ドロップ境界を超えたらスキル連鎖は無効

  if (bombMode) {
    // 爆弾を投下（curBi は変えない）
    const r = CFG.BOMB.R;
    const x = clamp(dropX, CFG.BOX.L + r + 1, CFG.BOX.R - r - 1);
    bombBody = spawnBomb(x, CFG.DROP_Y);
    bombMode = false;
    activeSkill = null;
    if (skillCharges.bomb !== Infinity) skillCharges.bomb--;
    updateSkillButtons();
    if (_forcedSkillActive) onForcedSkillUsed(); // 強制爆弾は投下で完了
  } else {
    const def = CFG.BODIES[curBi];
    const x = clamp(dropX, CFG.BOX.L + def.r + 1, CFG.BOX.R - def.r - 1);
    spawn(x, CFG.DROP_Y, curBi);
    _checkSimultaneous();
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
  if (chainCount > _maxChainThisGame) {
    _maxChainThisGame = chainCount;
    achCheckMaxChain(_maxChainThisGame);
  }
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

    _chainEventCount++;
    _lastDropHadChain = true;
    achCheckTotalChains(
      parseInt(localStorage.getItem('rollaxy_total_chains') || '0', 10) + _chainEventCount
    );
    // 5連鎖以上なら各レベル(5〜finalCount)の累計カウントをインクリメントしてチェック
    if (finalCount >= 5) {
      for (let _lvl = 5; _lvl <= Math.min(finalCount, 15); _lvl++) {
        _chainCountsByLevel[_lvl] = (_chainCountsByLevel[_lvl] || 0) + 1;
        achCheckChainByLevel(_lvl, (_savedChainCounts[_lvl] || 0) + _chainCountsByLevel[_lvl]);
      }
    }
    // スキル使用後の連鎖チェック（ドロップをまたがない場合のみ有効）
    if (_skillJustUsed) {
      achCheckSkillChain(finalCount);
      // スキル経由の連鎖レベル別累計チェック（5〜10）
      if (finalCount >= 5) {
        for (let _lvl = 5; _lvl <= Math.min(finalCount, 10); _lvl++) {
          _skillChainCountsByLevel[_lvl] = (_skillChainCountsByLevel[_lvl] || 0) + 1;
          achCheckSkillChainByLevel(_lvl, (_savedSkillChainCounts[_lvl] || 0) + _skillChainCountsByLevel[_lvl]);
        }
      }
      _skillJustUsed = false;
    }

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

// フィールド上の天体を種別ごとに数えて同時存在系実績をチェック
function _checkSimultaneous() {
  const counts = new Array(CFG.BODIES.length).fill(0);
  for (const d of bmap.values()) counts[d.bi]++;
  for (let _bi = 0; _bi < counts.length; _bi++) {
    if (counts[_bi] > 0) achCheckSimultaneous(_bi, counts[_bi]);
  }
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
    _mergeCount++;
    achCheckMergeCount(
      parseInt(localStorage.getItem('rollaxy_total_merges') || '0', 10) + _mergeCount
    );
    if (m.bi >= 1 && m.bi <= 8) {
      _bodyMergeCount[m.bi] = (_bodyMergeCount[m.bi] || 0) + 1;
      achCheckBodyMerge(m.bi, (_savedBodyMerges[m.bi] || 0) + _bodyMergeCount[m.bi]);
    }

    bmap.delete(m.bA.id); bmap.delete(m.bB.id);
    Matter.Composite.remove(world, m.bA, true);
    Matter.Composite.remove(world, m.bB, true);

    if (m.vanish) {
      // 銀河団同士は消滅：ボーナススコアのみ加算
      score += CFG.BODIES[m.bi].s * 2;
      _clusterVanishCount++;
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
  if (anyMerged) { wakeAllBodies(); _checkSimultaneous(); }
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
    if (d.body.position.y < CFG.DANGER_Y) { hi = true; break; }
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
  tutorialActive = false; tutorialTargetId = null; _forcedSkillActive = false;
  hideTutorialPointer();
  rltReset(); // ルーレット表示中でもゲームオーバーで強制終了
  closeChoicePanel(); // updateSkillBarRewardState を内部で呼ぶ（pendingChoiceRewards=0 が先に必要）
  resetSkillState(); // スキル状態をクリア
  finalEl.textContent = score;
  const isHi = score > hiScore;
  toggleShow(newHiEl, isHi);
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
  const _elapsedSec = Math.round((Date.now() - _gameStartTime) / 1000);
  // ── プレイ統計を localStorage に蓄積 ──
  try {
    const _gc = parseInt(localStorage.getItem('rollaxy_game_count') || '0', 10);
    localStorage.setItem('rollaxy_total_sec',
      String((parseInt(localStorage.getItem('rollaxy_total_sec')   || '0', 10)) + _elapsedSec));
    localStorage.setItem('rollaxy_total_score',
      String((parseInt(localStorage.getItem('rollaxy_total_score') || '0', 10)) + score));
    localStorage.setItem('rollaxy_total_drops',
      String((parseInt(localStorage.getItem('rollaxy_total_drops') || '0', 10)) + _dropCount));
    localStorage.setItem('rollaxy_total_merges',
      String((parseInt(localStorage.getItem('rollaxy_total_merges') || '0', 10)) + _mergeCount));
    for (let _bi = 1; _bi <= 8; _bi++) {
      if (_bodyMergeCount[_bi]) _savedBodyMerges[_bi] = (_savedBodyMerges[_bi] || 0) + _bodyMergeCount[_bi];
    }
    localStorage.setItem('rollaxy_body_merges', JSON.stringify(_savedBodyMerges));
    localStorage.setItem('rollaxy_total_chains',
      String((parseInt(localStorage.getItem('rollaxy_total_chains') || '0', 10)) + _chainEventCount));
    for (let _lvl = 5; _lvl <= 15; _lvl++) {
      if (_chainCountsByLevel[_lvl]) _savedChainCounts[_lvl] = (_savedChainCounts[_lvl] || 0) + _chainCountsByLevel[_lvl];
    }
    localStorage.setItem('rollaxy_chain_counts', JSON.stringify(_savedChainCounts));
    for (let _lvl = 5; _lvl <= 10; _lvl++) {
      if (_skillChainCountsByLevel[_lvl]) _savedSkillChainCounts[_lvl] = (_savedSkillChainCounts[_lvl] || 0) + _skillChainCountsByLevel[_lvl];
    }
    localStorage.setItem('rollaxy_skill_chain_counts', JSON.stringify(_savedSkillChainCounts));
    const _prevMaxTier = parseInt(localStorage.getItem('rollaxy_max_tier') || '0', 10);
    if (_highestTier > _prevMaxTier) localStorage.setItem('rollaxy_max_tier', String(_highestTier));
    if (_clusterVanishCount > 0) {
      localStorage.setItem('rollaxy_cluster_vanish',
        String((parseInt(localStorage.getItem('rollaxy_cluster_vanish') || '0', 10)) + _clusterVanishCount));
    }
    // 銀河団（tier 11）到達ゲームをカウント
    if (_highestTier >= 11) {
      localStorage.setItem('rollaxy_cluster_count',
        String((parseInt(localStorage.getItem('rollaxy_cluster_count') || '0', 10)) + 1));
    }
  } catch (_) {}
  logEvent('game_over', {
    game_id:      'rollaxy',
    score,
    highest_tier: _highestTier,
    drop_count:   _dropCount,
    elapsed_sec:  _elapsedSec,
    is_new_best:  isHi ? 1 : 0,
    lang:         typeof currentLang !== 'undefined' ? currentLang : 'ja',
  });
  // share API を即座に非同期呼び出し（アニメーション中に裏で通信）
  _pendingShareId = null;
  shareBtn.disabled = true;
  shareBtn.textContent = T('sharePreparing');
  shareBtn.classList.add('loading');
  _createShare();
  // アウトした天体を特定して点滅強調 → GO_FLASH_MS 後に通常の消去アニメを開始
  _goFlashIds.clear();
  for (const [id, d] of bmap.entries()) {
    if (d.body.position.y < CFG.DANGER_Y) _goFlashIds.add(id);
  }
  _goFlashStart = Date.now();
  setTimeout(_startGameOverAnim, _goFlashIds.size > 0 ? GO_FLASH_MS : 0);
}

// 天体をランダム順にポップ消去し、終わったらゲームオーバーオーバーレイを表示する
function _startGameOverAnim() {
  _goFlashIds.clear(); // 点滅終了 → 消去アニメへ移行
  const ids = [...bmap.keys()];
  if (ids.length === 0) {
    show(overlay);
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
        setTimeout(() => show(overlay), POP_DUR_MS + 80);
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
  achCheckScore(score);
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
  if (tutorialActive) updateTutorialPointerEl();
  requestAnimationFrame(loop);
}

// ============================================================
// RESPONSIVE RESIZE（スマホ向け）
// canvas は論理サイズ 400×700px を固定し、CSS transform:scale で画面サイズに合わせる。
// これにより物理演算の座標系を変えずにスマホ・PC どちらでも正しく表示できる。
// ============================================================
const _headerEl = document.getElementById('header');
function resize() {
  const ow = outer.clientWidth  || CFG.W;
  const oh = outer.clientHeight || CFG.H;
  const s  = Math.min(ow / CFG.W, oh / CFG.H);
  const ox = Math.floor((ow - CFG.W * s) / 2);
  _canvasScale = s; _canvasOffsetX = ox; // ポインター座標変換用
  canvas.style.width           = CFG.W + 'px';
  canvas.style.height          = CFG.H + 'px';
  canvas.style.transform       = `scale(${s})`;
  canvas.style.transformOrigin = 'top left';
  canvas.style.left            = ox + 'px';
  outer.style.height           = Math.ceil(CFG.H * s) + 'px';
  // body bar（天体の段階表示）直下にヘッダーを配置
  const _barH = Math.round(CFG.BAR_H * s);
  _headerEl.style.top = _barH + 'px';
  // 実績トーストを天体バーと同じ高さに
  const _toastEl = document.getElementById('ach-toast');
  if (_toastEl) _toastEl.style.height = _barH + 'px';
  // 再フィットした時点のビューポート寸法を記録（_onViewportResize の判定用）
  _lastFitW = window.innerWidth; _lastFitH = window.innerHeight;
}

// アドレスバー開閉は「幅そのまま・高さだけ」変化させて resize を連発する。
// 幅が同一かつ高さ変化が閾値以下なら再フィットせず、最後のスケールを維持して
// canvas のガタつきを防ぐ。回転・PCリサイズ（幅変化）や大きな高さ変化のときだけ
// resize() を呼ぶ。初回フィットは init() が resize() を直接呼ぶ。
let _lastFitW = 0, _lastFitH = 0;
function _onViewportResize() {
  const w = window.innerWidth, h = window.innerHeight;
  if (w === _lastFitW && Math.abs(h - _lastFitH) <= CFG.RESIZE_IGNORE_DH) return;
  resize();
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
  _tryUnlockAudio(); // 最初のクリックで音声を解除
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
  _tryUnlockAudio(); // 最初のタップで音声を解除
  const lx = toLogicalX(e.changedTouches[0].clientX);
  const ly = toLogicalY(e.changedTouches[0].clientY);
  if (skillSelectMode) { handleSelectTap(lx, ly); return; }
  dropX = lx; drop();
}, { passive: false });

// retry_click はここで発火（init() 内部ではなく）
// → ページ初回ロード時の init() と区別するため
on(retryBtn, () => {
  logEvent('retry_click', { game_id: 'rollaxy', previous_score: score });
  init();
});

on(startBtn, () => { _tryUnlockAudio(); beginGame(); });

// ============================================================
// 設定オーバーレイの開閉
// openSettings: dead=true（ゲームオーバー中）は開かない
// ============================================================
// ユーザー操作のタイミングで一度だけ音声を解除（autoplay 制限対策）
let _audioUnlocked = false;
function _tryUnlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  _unlockAudio();
}

function beginGame() {
  waiting = false;
  _gameStartTime = Date.now(); // ゲーム開始時刻（elapsed_ms 計算用）
  startScreen.classList.add('hidden');       // スタート画面をフェードアウト
  updateSkillButtons(); // waiting=false になったのでボタンの disabled を解除
  // _unlockAudio() は最初のユーザー操作時に _tryUnlockAudio() 経由で呼ぶ
  // game_number: このブラウザで何回目のゲームか（初回=1）
  // is_returning は increment 前に確認する（初回は必ず 0 になるように）
  const _prevCount  = parseInt(localStorage.getItem('rollaxy_game_count') || '0', 10);
  const _gameCount  = _prevCount + 1;
  localStorage.setItem('rollaxy_game_count', String(_gameCount));
  logEvent('game_start', {
    game_id:          'rollaxy',
    lang:             typeof currentLang !== 'undefined' ? currentLang : 'ja',
    game_number:      _gameCount,           // 通算プレイ回数（リテンション分析用）
    is_returning:     _prevCount > 0 ? 1 : 0, // 初回=0、2回目以降=1
    has_display_name: localStorage.getItem('novora_name_set') ? 1 : 0,
  });
  _fetchSessionToken(); // セッショントークンをバックグラウンドで取得（ゲーム開始はブロックしない）

  // 初回ゲーム開始時のみスキルバーをパルスアニメで強調（存在に気づかせる）
  if (_gameCount === 1) {
    const skillBar = document.getElementById('skill-bar');
    skillBar.classList.add('skill-bar-highlight');
    skillBar.addEventListener('animationend', () => {
      skillBar.classList.remove('skill-bar-highlight');
    }, { once: true });
  }
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

// 設定オーバーレイ UI（メニュー/設定パネル・表示名保存・音量スライダー）は
// game-ui.js に分離（game.js の後にロード）。openSettings/closeSettings 等を提供。

window.addEventListener('resize', _onViewportResize);

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

// デバッグ: ゲームデータを全リセットしてリロード
document.getElementById('debug-reset-btn').addEventListener('click', () => {
  const keep = new Set(['novora_lang', 'novora_displayname', 'rollaxy_sfx_vol']);
  Object.keys(localStorage)
    .filter(k => !keep.has(k))
    .forEach(k => localStorage.removeItem(k));
  location.reload();
});

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
// [TEMP_AUTOSTART] サイト生涯で1回だけスタート画面をスキップして即ゲーム開始。
// 2回目以降・リトライ・リセット後はスタート画面を表示する。
if (!localStorage.getItem('rollaxy_autostarted')) {
  localStorage.setItem('rollaxy_autostarted', '1');
  beginGame();
}
updateStartPlayername();
updateNameHint();
updateAutoshowBtn(); // game-skills.js のロード時点では choiceAutoShow 未定義のためここで呼ぶ
requestAnimationFrame(loop);
