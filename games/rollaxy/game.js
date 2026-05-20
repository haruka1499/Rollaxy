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
const shareBtn    = document.getElementById('share-btn');

// 「設定ボタン」= #settings-btn / 「設定を開いたとき」= #settings-overlay
const settingsBtn     = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const resumeBtn       = document.getElementById('resume-btn'); // 「ゲームに戻る」
const resetBtn        = document.getElementById('reset-btn');  // 「リセット」

// 「スタート画面」= #start-overlay
const startOverlay      = document.getElementById('start-overlay');
const startBtn          = document.getElementById('start-btn');
const startPlayernameEl = document.getElementById('start-playername-val');

// スタート画面のプレイヤー名を更新
function updateStartPlayername() {
  if (startPlayernameEl) startPlayernameEl.textContent = getDisplayName();
}

// 「連鎖表示」= #chain-display（2連鎖以上でポップアップ）
const chainEl = document.getElementById('chain-display');

// スキルボタン群
const skillBombBtn    = document.getElementById('skill-bomb');
const skillUpgradeBtn = document.getElementById('skill-upgrade');
const skillDeleteBtn  = document.getElementById('skill-delete');
// 所持数バッジ
const skillBombCount    = document.getElementById('skill-bomb-count');
const skillUpgradeCount = document.getElementById('skill-upgrade-count');
const skillDeleteCount  = document.getElementById('skill-delete-count');
// スキル確認パネル（upgrade/delete 選択後に表示）
const skillConfirmEl  = document.getElementById('skill-confirm');
const confirmPreviewEl = document.getElementById('confirm-preview');
const confirmOkBtn    = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

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

let chainRewardPending; // true = 5連鎖報酬パネル表示中（ドロップをブロック）
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

let hiScore = +(localStorage.getItem('korokoro_hi') || 0);
hiEl.textContent = `${T('best')}: ${hiScore}`;

// 共有 URL（doGameOver で非同期生成し shareToX で使う）
let _pendingShareId = null;

// replay / anti-cheat 用メタデータ
let _gameStartTime = 0; // beginGame() でセット
let _dropCount     = 0; // 天体を落とすたびにカウント

// ============================================================
// プレイヤー識別（ゲストID）
// フォーマット: guest_{12文字英数字}
// 将来の Google/Discord/NOVORA ログイン統合時は novora_player_id を上書きするだけ
// ============================================================
const _ID_CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789';

function getPlayerId() {
  let id = localStorage.getItem('novora_player_id');
  if (!id) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)),
      b => _ID_CHARS_LOWER[b % _ID_CHARS_LOWER.length]).join('');
    id = `guest_${rand}`;
    localStorage.setItem('novora_player_id', id);
  }
  return id;
}

// ── 表示名（ランキングに載る名前・日本語可・最大15文字） ──
const DISPLAY_NAME_MAX = 15;

function getDisplayName() {
  let name = localStorage.getItem('novora_display_name');
  if (!name) {
    // 初回: player_id のサフィックス先頭6文字でデフォルト名を生成
    const pid    = getPlayerId();
    const suffix = pid.includes('_') ? pid.split('_').slice(1).join('').slice(0, 6) : pid.slice(0, 6);
    name = 'ゲスト_' + suffix;
    localStorage.setItem('novora_display_name', name);
  }
  return name;
}

function saveDisplayName(rawName) {
  const name = rawName.replace(/[<>"&]/g, '').trim().slice(0, DISPLAY_NAME_MAX);
  if (name.length === 0) return false;
  localStorage.setItem('novora_display_name', name);
  return true;
}

// 表示名をサーバーの players テーブルに即時同期
// ゲームプレイ時は share POST で自動 upsert されるが、
// 設定・プロフィールページでの変更はこちらで明示的に送信する
async function syncDisplayNameToServer() {
  try {
    await fetch('/api/rollaxy/player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: getPlayerId(), display_name: getDisplayName() }),
    });
  } catch (_) {}
}

// ゲストコード（player_id のサフィックス部分を表示用に取り出す）
function getGuestCode() {
  const pid = getPlayerId();
  return pid.includes('_') ? pid.split('_').slice(1).join('') : pid;
}

// 自分のシェアID一覧を localStorage に追記（最大50件）
// ベストスコア更新時は best_share_id / best_score も更新
function addMyShareId(shareId, currentScore) {
  const ids = JSON.parse(localStorage.getItem('novora_share_ids') || '[]');
  if (!ids.includes(shareId)) ids.push(shareId);
  localStorage.setItem('novora_share_ids', JSON.stringify(ids.slice(-50)));
  const best = Number(localStorage.getItem('novora_best_score') || 0);
  if (currentScore >= best) {
    localStorage.setItem('novora_best_score', String(currentScore));
    localStorage.setItem('novora_best_share_id', shareId);
  }
}

// ゲームオーバーアニメーション
// ・天体をランダム順に消去し、最後の天体が消えた後にオーバーレイを表示する
// ・消去間隔 = GO_ANIM_MS ÷ 天体数 → 天体数に関わらず合計所要時間がほぼ一定
const GO_ANIM_MS = 2500; // 全天体消去にかける合計時間 (ms)
const POP_DUR_MS = 320;  // 1個あたりのポップアニメーション時間 (ms)
let _goPopEffects = [];   // { x, y, bi, startTime }

// ============================================================
// SOUND — 合成効果音（HTMLAudioElement プール + busy フラグ方式）
// paused は play() 直後でも true になる瞬間があるため信頼できない。
// 代わりに _busy フラグで使用中を管理し、ended / play失敗で解放する。
// WAV ファイルは冒頭無音を削除済みのため currentTime seek は不要。
// ============================================================
let sfxVolume = parseFloat(localStorage.getItem('rollaxy_sfx_vol') ?? String(CFG.SOUND.DEFAULT_VOL));
if (!isFinite(sfxVolume) || sfxVolume < 0 || sfxVolume > 1) sfxVolume = CFG.SOUND.DEFAULT_VOL;

const _sfxPool = Array.from({ length: 16 }, () => {
  const a = new Audio('sounds/merge_sound.wav');
  a.preload = 'auto';
  a._busy = false;
  a.addEventListener('ended', () => { a._busy = false; });
  return a;
});
let _sfxPoolIdx = 0;

function playMergeSound(chain) {
  const semitones = Math.min(chain - 1, 6) * 2; // 1〜7連鎖: 0,2,4,6,8,10,12半音
  const rate = Math.pow(2, semitones / 12);
  const vol  = Math.max(0, Math.min(1, sfxVolume));

  // busy でない要素を優先して選ぶ。全て busy なら最も古い要素を上書き
  let chosen = _sfxPoolIdx;
  for (let i = 0; i < _sfxPool.length; i++) {
    const idx = (_sfxPoolIdx + i) % _sfxPool.length;
    if (!_sfxPool[idx]._busy) { chosen = idx; break; }
  }
  _sfxPoolIdx = (chosen + 1) % _sfxPool.length;

  const snd = _sfxPool[chosen];
  snd._busy = true;
  snd.playbackRate = rate;
  snd.volume = vol;
  snd.play().catch(() => { snd._busy = false; });
}

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
  if (chainRewardPending) return; // 5連鎖選択パネル表示中は投下不可
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
// 爆弾スキル
// ============================================================

// 爆弾を物理ワールドに生成（bmap には登録しない → 合成対象外）
function spawnBomb(x, y) {
  const b = Matter.Bodies.circle(x, y, CFG.BOMB.R, {
    label: 'bomb',
    friction: CFG.PHYS.FRIC, frictionAir: CFG.PHYS.FRIC_AIR,
    frictionStatic: CFG.PHYS.FRIC_S, restitution: CFG.PHYS.REST, slop: CFG.PHYS.SLOP,
  });
  Matter.Composite.add(world, b);
  return b;
}

// 爆弾が何かに衝突したら導火線を開始
function startBombFuse() {
  if (bombFuseTimer) return; // すでに点火済み
  bombHit = true;
  bombFuseTimer = setTimeout(() => {
    if (bombBody) explodeBomb({ x: bombBody.position.x, y: bombBody.position.y });
  }, CFG.BOMB.FUSE_MS);
}

// 爆発処理: SAFE_BI 未満の天体を効果範囲内で消去
function explodeBomb(pos) {
  bombExplosion = { x: pos.x, y: pos.y, startTime: Date.now(), duration: 500 };

  const toRemove = [];    // bi < SAFE_BI  → 即消滅
  const toDowngrade = []; // SAFE_BI <= bi <= DOWNGRADE_BI → 1段階ダウン
  for (const [id, d] of bmap.entries()) {
    const dx = d.body.position.x - pos.x;
    const dy = d.body.position.y - pos.y;
    // 爆発円(RANGE)と天体円(body.r)の重なり判定: center距離 <= RANGE + body.r
    const eff = CFG.BOMB.RANGE + d.body.circleRadius;
    if (dx * dx + dy * dy > eff * eff) continue;
    if (d.bi < CFG.BOMB.SAFE_BI) {
      toRemove.push({ id, body: d.body });
    } else if (d.bi <= CFG.BOMB.DOWNGRADE_BI) {
      toDowngrade.push({ id, body: d.body, bi: d.bi });
    }
    // bi > DOWNGRADE_BI (ブラックホール以上) は影響なし
  }
  for (const { id, body } of toRemove) {
    bmap.delete(id); glowMap.delete(id);
    Matter.Composite.remove(world, body, true);
  }
  for (const { id, body, bi } of toDowngrade) {
    const px = body.position.x, py = body.position.y;
    bmap.delete(id); glowMap.delete(id);
    Matter.Composite.remove(world, body, true);
    spawn(px, py, bi - 1);
  }

  if (bombBody) { Matter.Composite.remove(world, bombBody, true); bombBody = null; }
  bombFuseTimer = null; bombHit = false;
  wakeAllBodies();
}

// 爆弾を描画（落下待機中 or 物理ボディとして空中にある時）
function paintBomb(x, y, angle, lit) {
  const r = CFG.BOMB.R;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = lit ? '#661100' : '#220a00'; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (lit) { // 点火中: オレンジの光輪
    const pulse = (Math.sin(Date.now() / 80) + 1) / 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,120,0,${0.5 + pulse * 0.5})`; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.font = `${Math.max(10, r * 1.1)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2;
  ctx.fillStyle = '#fff'; ctx.fillText('💣', 0, 0);
  ctx.restore();
}

// ============================================================
// スキル共通管理
// ============================================================

function updateSkillButtons() {
  skillBombBtn.classList.toggle('active',      activeSkill === 'bomb');
  skillUpgradeBtn.classList.toggle('active',   activeSkill === 'upgrade');
  skillDeleteBtn.classList.toggle('active',    activeSkill === 'delete');
  skillUpgradeBtn.classList.toggle('select-mode', activeSkill === 'upgrade' && skillSelectMode);
  skillDeleteBtn.classList.toggle('select-mode',  activeSkill === 'delete'  && skillSelectMode);

  // 所持数バッジを更新（Infinity は ∞ 表示）
  const fmt = n => n === Infinity ? '∞' : String(n);
  skillBombCount.textContent    = fmt(skillCharges.bomb);
  skillUpgradeCount.textContent = fmt(skillCharges.upgrade);
  skillDeleteCount.textContent  = fmt(skillCharges.delete);

  // 所持数 0 またはゲーム非アクティブ時は無効化
  const inactive = dead || waiting;
  skillBombBtn.disabled    = inactive || skillCharges.bomb    === 0;
  skillUpgradeBtn.disabled = inactive || skillCharges.upgrade === 0;
  skillDeleteBtn.disabled  = inactive || skillCharges.delete  === 0;
}

function resetSkillState() {
  activeSkill = null; bombMode = false;
  skillSelectMode = false; skillSelectedId = null;
  skillConfirmEl.classList.remove('show');
  updateSkillButtons();
}

// スキルボタンを押したときの処理（同じスキルならトグルオフ）
function setActiveSkill(skill) {
  if (dead || waiting) return;
  if (activeSkill === skill) { resetSkillState(); return; } // トグルオフ

  // 既存スキルをキャンセルしてから新スキルを有効化
  skillConfirmEl.classList.remove('show');
  activeSkill = skill;
  bombMode = (skill === 'bomb');
  skillSelectMode = (skill === 'upgrade' || skill === 'delete');
  skillSelectedId = null;
  updateSkillButtons();
}

// ============================================================
// 天体選択モード（upgrade / delete）
// ============================================================

function toLogicalY(clientY) {
  const r = canvas.getBoundingClientRect();
  return (clientY - r.top) * (CFG.H / r.height);
}

// canvas タップ時に天体を選択する
function handleSelectTap(lx, ly) {
  if (skillSelectedId !== null) return; // 既に選択済み（確認パネル表示中）
  for (const [id, d] of bmap.entries()) {
    const r = CFG.BODIES[d.bi].r;
    const dx = lx - d.body.position.x;
    const dy = ly - d.body.position.y;
    if (dx * dx + dy * dy > r * r) continue;
    // upgrade の場合、最上位（銀河団 bi=11）は選択不可
    if (activeSkill === 'upgrade' && d.bi >= CFG.BODIES.length - 1) continue;
    skillSelectedId = id;
    showConfirmPanel(id);
    return;
  }
}

function bodyImgTag(bi) {
  const img = bodyImages[bi];
  if (img && img.complete && img.naturalWidth > 0) {
    return `<img src="images/${CFG.BODIES[bi].key}.png" style="height:44px;vertical-align:middle">`;
  }
  return CFG.BODIES[bi].e;
}

function showConfirmPanel(bodyId) {
  const d = bmap.get(bodyId);
  if (!d) return;
  if (activeSkill === 'upgrade') {
    confirmPreviewEl.innerHTML = `${bodyImgTag(d.bi)}&nbsp;→&nbsp;${bodyImgTag(d.bi + 1)}`;
  } else {
    confirmPreviewEl.innerHTML = `${bodyImgTag(d.bi)}&nbsp;${T('confirmDelete')}`;
  }
  skillConfirmEl.classList.add('show');
}

function confirmSkillAction() {
  const d = bmap.get(skillSelectedId);
  if (!d) { resetSkillState(); return; }

  if (activeSkill === 'upgrade') {
    const ni = d.bi + 1;
    bmap.delete(skillSelectedId); glowMap.delete(skillSelectedId);
    Matter.Composite.remove(world, d.body, true);
    const nb = spawn(d.body.position.x, d.body.position.y, ni);
    const dur = 300 + ni * 100;
    glowMap.set(nb.id, { endTime: Date.now() + dur, duration: dur });
    if (skillCharges.upgrade !== Infinity) skillCharges.upgrade--;
  } else if (activeSkill === 'delete') {
    bmap.delete(skillSelectedId); glowMap.delete(skillSelectedId);
    Matter.Composite.remove(world, d.body, true);
    if (skillCharges.delete !== Infinity) skillCharges.delete--;
  }

  // 操作後に全ボディの sleep を解除する。
  // Matter.js は enableSleeping:true のため周囲の天体が休眠しており、
  // 天体の消滅・サイズ変化に反応できない。強制起床で重なり解消・落下を再開させる。
  wakeAllBodies();

  resetSkillState();
}

// bmap 内の全天体を sleep から起こす
function wakeAllBodies() {
  const now = Date.now();
  for (const d of bmap.values()) {
    Matter.Sleeping.set(d.body, false);
    d._sc = null; // 振動検出カウンタをリセット（wake 後は改めて計測する）
    d.at  = now;  // SLEEP_GRACE_MS の猶予をリセット
    // Matter.js 組み込み sleep が即座に再スリープするのを防ぐため
    // 静止天体に微小な下方速度を与える。支持されている天体では
    // 接触拘束が即座に打ち消すため実質的な移動は発生しない。
    if (d.body.speed < 0.1) {
      Matter.Body.setVelocity(d.body, {
        x: d.body.velocity.x,
        y: d.body.velocity.y + 0.15,
      });
    }
  }
}

function cancelSkillAction() {
  // キャンセルは選択モードに戻る（スキル自体は継続）
  skillSelectedId = null;
  skillConfirmEl.classList.remove('show');
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

// 4連鎖報酬: ルーレット演出でスキルをランダムに決定
const RLT_SKILLS  = ['bomb', 'upgrade', 'delete'];
const RLT_SPIN_MS = 90;  // 通常スピード (ms/ステップ)
const RLT_DECEL   = [110, 160, 225, 315, 440]; // 減速ステップの間隔 (ms)
let rltPos = 0, rltTarget = 0, rltTimer = null, rltAutoTimer = null, rltStopping = false;

function showRoulette() {
  rouletteActive = true;
  rltStopping    = false;
  rltPos         = 0;
  rltTarget      = Math.floor(Math.random() * 3); // 当選スキルを事前決定
  document.getElementById('roulette-stop').disabled = false;
  document.getElementById('roulette-overlay').classList.add('show');
  rltSetHighlight(RLT_SPIN_MS);
  rltScheduleSpin(RLT_SPIN_MS);
  rltAutoTimer = setTimeout(rltStop, 1800); // 1.8秒で自動停止
}

function rltScheduleSpin(delay) {
  rltTimer = setTimeout(() => {
    rltPos = (rltPos + 1) % 3;
    rltSetHighlight(RLT_SPIN_MS);
    rltScheduleSpin(RLT_SPIN_MS);
  }, delay);
}

function rltStop() {
  if (rltStopping || !rouletteActive) return;
  rltStopping = true;
  clearTimeout(rltTimer);
  clearTimeout(rltAutoTimer);
  document.getElementById('roulette-stop').disabled = true;
  // 現在位置からtargetに向かって4〜6ステップ減速して止まるシーケンスを生成
  const rem   = ((rltTarget - rltPos) % 3 + 3) % 3;
  const total = rem === 0 ? 3 : rem + 3; // 3〜5ステップ (最低でも一巡)
  rltRunDecel(total, 0);
}

function rltRunDecel(total, step) {
  if (step >= total) { rltFinish(); return; }
  const delay = RLT_DECEL[Math.min(step, RLT_DECEL.length - 1)];
  rltPos = (rltPos + 1) % 3;
  rltSetHighlight(delay);
  rltTimer = setTimeout(() => rltRunDecel(total, step + 1), delay);
}

function rltSetHighlight(transMs) {
  const t = Math.min(transMs * 0.75, 200); // transition duration
  document.querySelectorAll('.rlt-card').forEach((card, i) => {
    card.style.transition = `background ${t}ms ease, border-color ${t}ms ease, box-shadow ${t}ms ease`;
    card.classList.toggle('active', i === rltPos);
  });
}

function rltFinish() {
  // 結果を500ms見せてから閉じて次のルーレットがあれば再生
  setTimeout(() => {
    const skill = RLT_SKILLS[rltTarget];
    if (skillCharges[skill] !== Infinity) skillCharges[skill]++;
    updateSkillButtons();
    document.getElementById('roulette-overlay').classList.remove('show');
    rouletteActive = false;
    if (rouletteQueue.length > 0) setTimeout(processNextRoulette, 350);
  }, 500);
}

function rltReset() {
  clearTimeout(rltTimer); clearTimeout(rltAutoTimer);
  rouletteActive = false; rltStopping = false;
  document.getElementById('roulette-overlay').classList.remove('show');
}

// 5連鎖報酬: スキル選択パネルを表示（ドロップをブロック）
function showChainRewardPanel() {
  // ピーク演出中なら中断してフルパネルに切り替え
  clearTimeout(choicePeekTimer); choicePeekTimer = null;
  const panel = document.getElementById('chain-reward');
  panel.classList.remove('panel-peek', 'panel-peek-out');
  updateRewardQueueInfo();
  chainRewardPending = true;
  panel.classList.add('show');
  clearTimeout(choiceAutoTimer);
  choiceAutoTimer = setTimeout(closeChoicePanel, 5000); // 5秒で自動閉じ
}

function closeChoicePanel() {
  clearTimeout(choiceAutoTimer); choiceAutoTimer = null;
  clearTimeout(choicePeekTimer); choicePeekTimer = null;
  chainRewardPending = false;
  const panel = document.getElementById('chain-reward');
  panel.classList.remove('show', 'panel-peek', 'panel-peek-out');
  updateSkillBarRewardState();
}

// ============================================================
// 連鎖報酬管理（ルーレットと選択は独立）
// ============================================================

// ルーレットをキューに積む。表示中でなければ即開始
function enqueueRoulette() {
  if (dead) return; // ゲームオーバー後は報酬を与えない
  rouletteQueue.push(true);
  if (!rouletteActive) processNextRoulette();
}

function processNextRoulette() {
  if (rouletteQueue.length === 0) return;
  rouletteQueue.shift();
  showRoulette();
}

// 5連鎖報酬をカウントアップして、状況に応じてパネルを表示
function enqueueChoice() {
  if (dead) return; // ゲームオーバー後は報酬を与えない
  pendingChoiceRewards++;
  updateRewardQueueInfo();
  updateSkillBarRewardState();
  if (chainRewardPending) return; // すでにパネル開放中 → カウント更新だけ
  if (pendingChoiceRewards === 1 && choiceAutoShow) {
    showChainRewardPanel(); // 初回かつ自動表示ON → フルパネル
  } else {
    peekChoicePanel(); // 追加報酬 or 自動表示OFF → 引き込みピーク演出
  }
}

// 報酬ボタンに引き込まれる短時間ピーク演出（ドロップをブロックしない）
function peekChoicePanel() {
  const panel = document.getElementById('chain-reward');
  clearTimeout(choicePeekTimer);
  // リセットして再アニメーション
  panel.classList.remove('show', 'panel-peek', 'panel-peek-out');
  void panel.offsetWidth;
  panel.classList.add('show', 'panel-peek');
  choicePeekTimer = setTimeout(() => {
    panel.classList.add('panel-peek-out');
    choicePeekTimer = setTimeout(() => {
      panel.classList.remove('show', 'panel-peek', 'panel-peek-out');
      choicePeekTimer = null;
    }, 380);
  }, 1400);
}

// スキル選択完了時の処理
function onChoicePicked(skill) {
  if (pendingChoiceRewards <= 0) return;
  if (skillCharges[skill] !== Infinity) skillCharges[skill]++;
  updateSkillButtons();
  pendingChoiceRewards--;
  updateRewardQueueInfo();
  if (pendingChoiceRewards > 0) {
    // まだ残りあり: パネルを開いたまま自動タイマーをリセット
    clearTimeout(choiceAutoTimer);
    choiceAutoTimer = setTimeout(closeChoicePanel, 5000);
  } else {
    closeChoicePanel();
  }
  updateSkillBarRewardState();
}

// 各オーバーレイの待機件数表示を更新
function updateRewardQueueInfo() {
  const rltRem = rouletteQueue.length;
  document.getElementById('roulette-queue-info').textContent =
    rltRem > 0 ? T('queueWaiting')(rltRem) : '';
  const choiceRem = chainRewardPending ? pendingChoiceRewards - 1 : pendingChoiceRewards;
  document.getElementById('choice-queue-info').textContent =
    choiceRem > 0 ? T('queueMore')(choiceRem) : '';
}

// スキルバーの報酬待機状態（縮小 + クレームボタン）を更新
function updateSkillBarRewardState() {
  const skillBar  = document.getElementById('skill-bar');
  const claimBtn  = document.getElementById('skill-claim');
  const claimCount = document.getElementById('skill-claim-count');
  if (pendingChoiceRewards > 0) {
    skillBar.classList.add('reward-pending');
    claimCount.textContent = pendingChoiceRewards;
    claimBtn.style.display = '';
  } else {
    skillBar.classList.remove('reward-pending');
    claimBtn.style.display = 'none';
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
    localStorage.setItem('korokoro_hi', score);
    hiEl.textContent = `${T('best')}: ${hiScore}`;
  }
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

function _restoreShareButton() {
  shareBtn.disabled = false;
  shareBtn.textContent = T('shareBtn');
  shareBtn.classList.remove('loading');
}

// 盤面スナップショットを Worker に POST して共有 URL を取得する（失敗しても UI に影響しない）
// 成功・失敗どちらでも finally でシェアボタンを復元する。
async function _createShare() {
  const controller  = new AbortController();
  const timeoutId   = setTimeout(() => controller.abort(), 10000);
  // await 前に同期収集（_startGameOverAnim() が非同期で bmap を消していく前に取得）
  const elapsed_ms  = Date.now() - _gameStartTime;
  const drop_count  = _dropCount;
  let highestTier = 0;
  const bodies = [];
  for (const d of bmap.values()) {
    if (d.bi > highestTier) highestTier = d.bi;
    bodies.push({
      tier:  d.bi,
      x:     Math.round(d.body.position.x * 10) / 10,
      y:     Math.round(d.body.position.y * 10) / 10,
      angle: Math.round(d.body.angle * 100) / 100,
    });
  }
  const shareScore = score; // クロージャ保持（addMyShareId 用）
  try {
    const res = await fetch('/api/rollaxy/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score,
        highest_body_tier: highestTier,
        snapshot_payload:  {
          bodies,
          // replay / anti-cheat metadata（将来の server-side validation 用）
          elapsed_ms,
          drop_count,
          body_count: bodies.length,
        },
        ui_lang:      typeof currentLang !== 'undefined' ? currentLang : 'ja',
        version:      CFG.GAME_VERSION,
        player_id:    getPlayerId(),    // guest_xxx 形式（将来ログイン統合時は差し替え）
        display_name: getDisplayName(), // ランキングに表示する表示名
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      const { id } = await res.json();
      _pendingShareId = id;
      addMyShareId(id, shareScore); // share_ids / best_share_id を localStorage に記録
      // OGP 画像生成を完了まで待つ（最大 8 秒）
      // fire-and-forget ではなく await することで、_restoreShareButton() が呼ばれる時点で
      // 必ず KV キャッシュに乗っている状態を保証する。
      // → Twitter クローラーがシェア URL にアクセスした時に画像が確実に存在する。
      // タイムアウトしても finally でボタンは有効化されるので UI はブロックしない。
      try {
        const ogpCtrl    = new AbortController();
        const ogpTimeout = setTimeout(() => ogpCtrl.abort(), 8000);
        await fetch(`/games/rollaxy/ogp/${id}`, { signal: ogpCtrl.signal });
        clearTimeout(ogpTimeout);
      } catch (_) {
        // タイムアウト or ネットワークエラー → OGP なしでシェア可能（URL は有効）
      }
    }
  } catch (_) {
    // タイムアウト・ネットワークエラー等 → フォールバックURLでシェア可能
  } finally {
    clearTimeout(timeoutId);
    _restoreShareButton();
  }
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  const { W, H, DANGER_Y: DY, DROP_Y: DPY, BAR_H } = CFG;
  const { L, R, T, B, W: wt, GL, GR } = CFG.BOX;

  // 背景（宇宙空間）
  ctx.fillStyle = '#060412';
  ctx.fillRect(0, 0, W, H);

  // ボックス内側（深宇宙）
  ctx.fillStyle = '#0c0720';
  ctx.fillRect(L, T, R - L, B - T);

  // ボックス上端ライン
  ctx.strokeStyle = '#7744bb';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(L - wt, T); ctx.lineTo(R + wt, T); ctx.stroke();

  // 危険ライン（赤破線）
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = 'rgba(220,60,60,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(L, DY); ctx.lineTo(R, DY); ctx.stroke();
  ctx.restore();

  // 落下ガイド＋操作中天体（または爆弾）
  if (canDrop && !dead && !skillSelectMode) {
    if (bombMode) {
      const br = CFG.BOMB.R;
      const gx = clamp(dropX, L + br + 1, R - br - 1);
      // 落下ガイド線（オレンジ）
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,120,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, DPY + br); ctx.lineTo(gx, B); ctx.stroke();
      // 爆発範囲プレビュー（破線円）
      ctx.beginPath();
      ctx.arc(gx, DPY, CFG.BOMB.RANGE, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,80,0,0.4)';
      ctx.stroke();
      ctx.restore();
      paintBomb(gx, DPY, 0, false);
    } else {
      const def = CFG.BODIES[curBi];
      const gx = clamp(dropX, L + def.r + 1, R - def.r - 1);
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(180,160,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, DPY + def.r); ctx.lineTo(gx, B); ctx.stroke();
      ctx.restore();
      paintBody(gx, DPY, 0, curBi);
    }
  }

  // 物理天体を描画（「合成時に少し光る仕様」のエフェクトつき）
  const now = Date.now();
  for (const [id, d] of bmap.entries()) {
    let glowT = 0;
    const glow = glowMap.get(id);
    if (glow) {
      const rem = glow.endTime - now;
      if (rem > 0) { glowT = rem / glow.duration; } // 0→1 の残存率
      else          { glowMap.delete(id); }
    }
    paintBody(d.body.position.x, d.body.position.y, d.body.angle, d.bi, glowT);
  }

  // 壁（天体の上に重ねて縁をきれいに）
  ctx.fillStyle = '#1a0e38';
  ctx.fillRect(L - wt, T, wt, B - T + wt);      // 左壁
  ctx.fillRect(R,      T, wt, B - T + wt);      // 右壁
  ctx.fillRect(L - wt, B, R - L + wt*2, wt);    // 底面

  // 壁のハイライト
  ctx.fillStyle = 'rgba(140,100,255,0.18)';
  ctx.fillRect(L - wt, T, 3, B - T + wt);
  ctx.fillRect(R,      T, 3, B - T + wt);

  // ガイド壁（ドロップゾーン・BOX より広め・半透明）
  ctx.fillStyle = 'rgba(80,50,150,0.55)';
  ctx.fillRect(GL - wt, BAR_H, wt, T - BAR_H);   // 左ガイド
  ctx.fillRect(GR,      BAR_H, wt, T - BAR_H);   // 右ガイド
  ctx.fillStyle = 'rgba(160,120,255,0.12)';
  ctx.fillRect(GL - wt, BAR_H, 3,  T - BAR_H);   // 左ハイライト
  ctx.fillRect(GR,      BAR_H, 3,  T - BAR_H);   // 右ハイライト

  // 爆弾ボディ（物理空間を飛行中）
  if (bombBody) {
    // ゲームボックス外に落ちたら撤去（爆発なし）
    if (bombBody.position.y > CFG.BOX.B + 60) {
      Matter.Composite.remove(world, bombBody, true);
      bombBody = null; bombHit = false;
      clearTimeout(bombFuseTimer); bombFuseTimer = null;
    } else {
      paintBomb(bombBody.position.x, bombBody.position.y, bombBody.angle, bombHit);
    }
  }

  // 爆発エフェクト（拡大する光輪）
  if (bombExplosion) {
    const t = (Date.now() - bombExplosion.startTime) / bombExplosion.duration;
    if (t >= 1) {
      bombExplosion = null;
    } else {
      const r = CFG.BOMB.RANGE * (0.4 + t * 1.2);
      const a = 1 - t;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bombExplosion.x, bombExplosion.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,100,0,${(a * 0.25).toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,220,60,${a.toFixed(3)})`;
      ctx.lineWidth = 3 * a;
      ctx.shadowColor = `rgba(255,150,0,${a.toFixed(3)})`;
      ctx.shadowBlur = 20 * a;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ゲームオーバー時の天体ポップエフェクト（スケールアップ＋フェードアウト）
  if (_goPopEffects.length > 0) {
    const nowPop = performance.now();
    for (let i = _goPopEffects.length - 1; i >= 0; i--) {
      const p = _goPopEffects[i];
      const raw = (nowPop - p.startTime) / POP_DUR_MS;
      if (raw >= 1) { _goPopEffects.splice(i, 1); continue; }
      // ease-out: 最初に素早く大きくなり、最後はゆっくりフェード
      const t    = 1 - Math.pow(1 - raw, 2); // ease-out quadratic
      const sc   = 1 + t * 1.6;              // 1x → 2.6x に拡大
      const al   = 1 - raw;                  // リニアにフェードアウト
      const def  = CFG.BODIES[p.bi];
      ctx.save();
      ctx.globalAlpha = al;
      ctx.translate(p.x, p.y);
      ctx.scale(sc, sc);
      // 本体円
      ctx.beginPath();
      ctx.arc(0, 0, def.r, 0, Math.PI * 2);
      ctx.fillStyle = def.c;
      ctx.fill();
      // カスタム画像（あれば）
      const _bimg = bodyImages[p.bi];
      if (_bimg && _bimg.complete && _bimg.naturalWidth > 0) {
        const _adj = IMG_ADJUST[p.bi] || { scale: 1, ox: 0, oy: 0 };
        const _s   = Math.max(
          (def.r * 2) / _bimg.naturalWidth,
          (def.r * 2) / _bimg.naturalHeight
        ) * _adj.scale;
        const _dw = _bimg.naturalWidth  * _s;
        const _dh = _bimg.naturalHeight * _s;
        ctx.drawImage(_bimg, _adj.ox - _dw / 2, _adj.oy - _dh / 2, _dw, _dh);
      }
      ctx.restore();
    }
  }

  // 天体選択モードのハイライト（upgrade/delete）
  if (skillSelectMode) {
    const pulse = (Math.sin(Date.now() / 180) + 1) / 2;
    for (const [id, d] of bmap.entries()) {
      const isSelectable = !(activeSkill === 'upgrade' && d.bi >= CFG.BODIES.length - 1);
      const isSelected   = id === skillSelectedId;
      const r = CFG.BODIES[d.bi].r;
      ctx.save();
      ctx.beginPath();
      ctx.arc(d.body.position.x, d.body.position.y, r + 4, 0, Math.PI * 2);
      if (isSelected) {
        ctx.strokeStyle = 'rgba(255,220,0,0.95)';
        ctx.lineWidth = 3;
      } else if (isSelectable) {
        ctx.strokeStyle = `rgba(200,180,255,${0.3 + pulse * 0.55})`;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(120,100,120,0.25)'; // 選択不可は暗く
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // 天体進行バー（最前面）
  drawBodyBar();
}

// 「天体」を1個描く（「合成時に少し光る仕様」の glowT を受け取る）
function paintBody(x, y, angle, bi, glowT = 0) {
  const def = CFG.BODIES[bi];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 影
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  // 本体
  ctx.beginPath();
  ctx.arc(0, 0, def.r, 0, Math.PI * 2);
  ctx.fillStyle = def.c;
  ctx.fill();

  // ハイライト
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.arc(-def.r * 0.27, -def.r * 0.3, def.r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.fill();

  // 輪郭
  ctx.beginPath();
  ctx.arc(0, 0, def.r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 絵文字 / テキスト or カスタム画像
  const _bimg = bodyImages[bi];
  if (_bimg && _bimg.complete && _bimg.naturalWidth > 0) {
    const _adj = IMG_ADJUST[bi] || { scale: 1, ox: 0, oy: 0 };
    const _scale = Math.max((def.r * 2) / _bimg.naturalWidth, (def.r * 2) / _bimg.naturalHeight) * _adj.scale;
    const _dw = _bimg.naturalWidth  * _scale;
    const _dh = _bimg.naturalHeight * _scale;
    const _dx = _adj.ox - _dw / 2;
    const _dy = _adj.oy - _dh / 2;
    // ① 円からはみ出す部分を半透明で先に描く
    ctx.globalAlpha = 0.3;
    ctx.drawImage(_bimg, _dx, _dy, _dw, _dh);
    // ② 円の内側だけクリップして全不透明で上書き
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, def.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 1.0;
    ctx.drawImage(_bimg, _dx, _dy, _dw, _dh);
    ctx.restore();
    ctx.globalAlpha = 1.0; // 以降の描画（グロウ等）のためリセット
  } else {
    const fs = Math.max(10, def.r * 1.1);
    ctx.font = `${fs}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = '#fff';
    ctx.fillText(def.e, 0, 0);
  }

  // 「合成時に少し光る仕様」: 縁の光（段階が上がるほど強く・長く）
  // 各視覚パラメータは元の値 ×1.7 済み（不透明度は ×1.35、min(1) でキャップ）
  if (glowT > 0) {
    // 低インデックスは軽め(0.35)、高インデックスは強め(1.0)
    const intensity = 0.35 + (bi / (CFG.BODIES.length - 1)) * 0.65;
    const a = Math.min(1, glowT * intensity * 1.35); // 不透明度
    ctx.beginPath();
    ctx.arc(0, 0, def.r + 2.55, 0, Math.PI * 2); // 光輪の半径オフセット（元: 1.5 → ×1.7: 2.55）
    ctx.strokeStyle = `rgba(255,240,160,${a.toFixed(3)})`;
    ctx.lineWidth   = (1 + 4 * glowT) * intensity * 1.7; // 光輪の太さ（×1.7）
    ctx.shadowColor = `rgba(255,200,80,${a.toFixed(3)})`;
    ctx.shadowBlur  = def.r * 1.02 * glowT * intensity; // 光の広がり（元: 0.6 → ×1.7: 1.02）
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  ctx.restore();
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
retryBtn.addEventListener('click',    () => init());
retryBtn.addEventListener('touchend', e => { e.preventDefault(); init(); });

// ============================================================
// X（Twitter）シェア
// canvas.toDataURL()（同期）でキャプチャし、非同期処理を一切挟まないことで
// ポップアップブロッカーを回避する。
// ① Twitter Intent を先に開く（ユーザー操作直後の最初のアクション）
// ② 盤面画像をダウンロード（ツイートに手動添付できるよう）
// 定型文は lang.js の tweetText、URL は CFG.SHARE.URL で変更可能。
// ============================================================
// data URL → Blob 同期変換（ユーザージェスチャーコンテキストを保つため同期で行う）
function _dataURLtoBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function shareToX() {
  const text    = T('tweetText')(score);
  // 共有 URL: 個別シェアページ（生成済み）> ゲームトップページ > なし
  // サーバー側で OGP 画像を生成するので canvas スクショは不要
  const shareId  = _pendingShareId;
  const shareUrl = shareId
    ? `${CFG.SHARE.URL.replace(/\/$/, '')}/share/${shareId}`
    : (CFG.SHARE.URL || '');

  const tweetUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text)
    + (shareUrl ? '&url=' + encodeURIComponent(shareUrl) : '');
  window.open(tweetUrl, '_blank');
}

shareBtn.addEventListener('click',    () => shareToX());
shareBtn.addEventListener('touchend', e => { e.preventDefault(); shareToX(); });

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
}

// スタートボタン押下（ユーザー操作）のタイミングで pool[0] を無音で一瞬再生する。
// これによりブラウザの autoplay 制限が解除され、以降 rAF ループ内からも play() が通る。
function _unlockAudio() {
  const snd = _sfxPool[0];
  snd._busy = true;
  const prevVol = snd.volume;
  snd.volume = 0;
  snd.play().then(() => {
    snd.pause();
    snd.volume = prevVol;
    snd._busy = false;
  }).catch(() => {
    snd.volume = prevVol;
    snd._busy = false;
  });
}

function openSettings() {
  if (dead) return; // ゲームオーバー中は設定を開かない（スタート待ち中は開いてよい）
  paused = true;    // 物理を停止（待機中はすでに止まっているが、フラグとして立てる）
  // 表示名フィールドを現在値で初期化
  const dnInput  = document.getElementById('displayname-input');
  const dnStatus = document.getElementById('displayname-status');
  if (dnInput) {
    dnInput.value          = getDisplayName();
    dnInput.placeholder    = T('displayNamePlaceholder');
  }
  if (dnStatus) dnStatus.textContent = '';
  // ゲストコード表示
  const gcEl = document.getElementById('guest-code-val');
  if (gcEl) gcEl.textContent = getGuestCode();
  settingsOverlay.classList.add('show');
}
function closeSettings() {
  paused = false;
  settingsOverlay.classList.remove('show');
}

settingsBtn.addEventListener('click',    () => paused ? closeSettings() : openSettings());
settingsBtn.addEventListener('touchend', e => { e.preventDefault(); paused ? closeSettings() : openSettings(); });
resumeBtn.addEventListener('click',    () => closeSettings());
resumeBtn.addEventListener('touchend', e => { e.preventDefault(); closeSettings(); });
resetBtn.addEventListener('click',    () => { settingsOverlay.classList.remove('show'); init(); });
resetBtn.addEventListener('touchend', e => { e.preventDefault(); settingsOverlay.classList.remove('show'); init(); });

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

// スキルボタン（click + touchend 両方登録）
skillBombBtn.addEventListener('click',    () => setActiveSkill('bomb'));
skillBombBtn.addEventListener('touchend', e => { e.preventDefault(); setActiveSkill('bomb'); });
skillUpgradeBtn.addEventListener('click',    () => setActiveSkill('upgrade'));
skillUpgradeBtn.addEventListener('touchend', e => { e.preventDefault(); setActiveSkill('upgrade'); });
skillDeleteBtn.addEventListener('click',    () => setActiveSkill('delete'));
skillDeleteBtn.addEventListener('touchend', e => { e.preventDefault(); setActiveSkill('delete'); });

// 確認パネルボタン
confirmOkBtn.addEventListener('click',       () => confirmSkillAction());
confirmOkBtn.addEventListener('touchend',    e => { e.preventDefault(); confirmSkillAction(); });
confirmCancelBtn.addEventListener('click',    () => cancelSkillAction());
confirmCancelBtn.addEventListener('touchend', e => { e.preventDefault(); cancelSkillAction(); });

// 4連鎖ルーレット停止ボタン
const rouletteStopBtn = document.getElementById('roulette-stop');
rouletteStopBtn.addEventListener('click',    () => rltStop());
rouletteStopBtn.addEventListener('touchend', e  => { e.preventDefault(); rltStop(); });

// Space キーでルーレット停止（PCショートカット）
document.addEventListener('keydown', e => {
  if (e.key === ' ' && rouletteActive) { e.preventDefault(); rltStop(); }
});

// 連鎖報酬スキル選択ボタン
document.querySelectorAll('.chain-reward-btn').forEach(btn => {
  const pick = () => onChoicePicked(btn.dataset.skill);
  btn.addEventListener('click',    pick);
  btn.addEventListener('touchend', e => { e.preventDefault(); pick(); });
});

// スキルバーのクレームボタン（報酬待機中に表示）
const skillClaimBtn = document.getElementById('skill-claim');
const claimOpen = () => {
  if (dead) return;
  if (pendingChoiceRewards > 0 && !chainRewardPending) showChainRewardPanel();
};
skillClaimBtn.addEventListener('click',    claimOpen);
skillClaimBtn.addEventListener('touchend', e => { e.preventDefault(); claimOpen(); });

// 設定画面: 報酬自動表示トグル
const autoshowBtn = document.getElementById('autoshow-btn');
const updateAutoshowBtn = () => {
  autoshowBtn.textContent = T('autoshow')(choiceAutoShow);
};
autoshowBtn.addEventListener('click', () => {
  choiceAutoShow = !choiceAutoShow;
  updateAutoshowBtn();
});
updateAutoshowBtn();

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
// BODY BAR — canvas 上端に「天体」の進行バーを描画（2段×6個）
// ユーザーが「天体が表示されているところ（バー）」と言う場合はここを指す可能性がある
// ============================================================
function drawBodyBar() {
  const bodies = CFG.BODIES;
  const minR = bodies[0].r, maxR = bodies[bodies.length - 1].r;

  const BAR_H = CFG.BAR_H;
  const PAD_L = 20, PAD_R = 20;
  const SPAN  = CFG.W - PAD_L - PAD_R;  // 360px
  const SLOT  = SPAN / 5;               // 各段6天体・5間隔 = 72px
  const TOP_Y = 20;  // 上段（銀河団〜赤色巨星）の円中心 Y
  const BOT_Y = 52;  // 下段（宇宙塵〜太陽）の円中心 Y

  // 表示半径 8〜18px（実際の r より小さく縮小して表示）
  function dr(b) { return 8 + (b.r - minR) / (maxR - minR) * 10; }
  function xBot(i) { return PAD_L + SLOT * i; }
  function xTop(j) { return PAD_L + SLOT * j; }

  // 上段: bodies[6..11] 逆順 → [銀河団, 銀河, ブラックホール, 中性子星, 白色矮星, 赤色巨星]
  const topRow = [...bodies.slice(6)].reverse();

  // バー背景
  ctx.fillStyle = 'rgba(10,5,30,0.80)';
  ctx.fillRect(0, 0, CFG.W, BAR_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, BAR_H); ctx.lineTo(CFG.W, BAR_H); ctx.stroke();

  function drawB(b, x, y, bi) {
    const r = dr(b);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = b.c; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(x - r*.25, y - r*.3, r*.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8; ctx.stroke();
    const _bimg = bi !== undefined ? bodyImages[bi] : null;
    if (_bimg && _bimg.complete && _bimg.naturalWidth > 0) {
      const _adj = (bi !== undefined && IMG_ADJUST[bi]) ? IMG_ADJUST[bi] : { scale: 1, ox: 0, oy: 0 };
      const _ds  = r / CFG.BODIES[bi].r; // ゲームpx → 表示px 変換率
      const _scale = Math.max((r * 2) / _bimg.naturalWidth, (r * 2) / _bimg.naturalHeight) * _adj.scale;
      const _dw = _bimg.naturalWidth  * _scale;
      const _dh = _bimg.naturalHeight * _scale;
      ctx.drawImage(_bimg, x + _adj.ox * _ds - _dw / 2, y + _adj.oy * _ds - _dh / 2, _dw, _dh);
    } else {
      ctx.font = `${Math.max(7, r * 1.1)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 1;
      ctx.fillStyle = '#fff'; ctx.fillText(b.e, x, y);
      ctx.shadowBlur = 0;
    }
  }

  function drawArr(x1, y, x2, sym) {
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(sym, (x1 + x2) / 2, y);
  }

  // 下段: 宇宙塵(0) → … → 太陽(5)
  for (let i = 0; i < 6; i++) {
    drawB(bodies[i], xBot(i), BOT_Y, i);
    if (i < 5) drawArr(xBot(i), BOT_Y, xBot(i + 1), '→');
  }

  // 上段: 銀河団(j=0) ← … ← 赤色巨星(j=5)  topRow[j] = bodies[11-j]
  for (let j = 0; j < 6; j++) {
    drawB(topRow[j], xTop(j), TOP_Y, 11 - j);
    if (j < 5) drawArr(xTop(j), TOP_Y, xTop(j + 1), '←');
  }

  // 折り返し ↑ 矢印（右端・上下段の中間）
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('↑', xBot(5), (TOP_Y + BOT_Y) / 2);
}

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
updateStartPlayername(); // 初回表示
requestAnimationFrame(loop);
