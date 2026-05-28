'use strict';

// ============================================================
// game-meta.js — メタ進行（インクリメンタル）
//
// ループ:
//   プレイ → スコア/連鎖に応じて 星屑(stardust)・恒星エネルギー(energy) 獲得
//        → 星屑で「物質生成器」を強化（Lvアップ）
//        → 恒星サイズ↑ → 自動で得られる恒星エネルギー/秒↑（放置でも蓄積・上限あり）
//
// 文明レベル: 恒星エネルギーを消費してレベルアップ → 研究の解禁ゲート。
// 研究: 星屑で購入し、effect を getModifier() で中央集計して各所に適用。
//
// 数値は config.js の CFG.META に集約。UI はホーム下部バーから開く
// #cosmos-overlay（恒星/生成器）と #research-overlay（文明/研究）。
// ============================================================

// ---- 永続状態 ----
const metaState = {
  stardust: 0,
  energy:   0,
  mass:     0, // 物質生成器が蓄積した質量
  genLevel: CFG.META.GENERATOR.START_LEVEL,
  civLevel: CFG.META.CIV.START_LEVEL,
  research: new Set(), // 所持研究ID
  lastSaved: Date.now(),
  _suspect: false,     // 簡易チート対策: セーブ署名不一致フラグ（将来サーバー検証へ送出）
};

function _metaNum(key, def) {
  const v = parseFloat(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}

// 簡易チート対策: セーブ全体の整合性チェックサム（FNV-1a, 暗号強度なし＝改ざん抑止用）。
// localStorage を手で書き換えると署名が一致しなくなり _suspect フラグが立つ。
function _metaSig() {
  const s = [
    CFG.META.ANTICHEAT.SIG_SALT,
    metaState.stardust, metaState.energy, metaState.mass,
    metaState.genLevel, metaState.civLevel,
    [...metaState.research].sort().join(','),
    metaState.lastSaved,
  ].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function loadMeta() {
  const g = CFG.META.GENERATOR, c = CFG.META.CIV;
  metaState.stardust  = Math.max(0, _metaNum(STORAGE_KEYS.META_STARDUST, 0));
  metaState.energy    = Math.max(0, _metaNum(STORAGE_KEYS.META_ENERGY, 0));
  metaState.mass      = Math.max(0, _metaNum(STORAGE_KEYS.META_MASS, 0));
  metaState.genLevel  = Math.min(g.MAX_LEVEL,
                          Math.max(g.START_LEVEL, Math.floor(_metaNum(STORAGE_KEYS.META_GEN_LEVEL, g.START_LEVEL))));
  metaState.civLevel  = Math.min(c.MAX_LEVEL,
                          Math.max(c.START_LEVEL, Math.floor(_metaNum(STORAGE_KEYS.META_CIV_LEVEL, c.START_LEVEL))));
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEYS.META_RESEARCH) || '[]');
    metaState.research = new Set(Array.isArray(ids) ? ids : []);
  } catch (_) { metaState.research = new Set(); }
  metaState.lastSaved = _metaNum(STORAGE_KEYS.META_LAST_SAVED, Date.now());

  // 簡易チート対策: 署名検証。不一致＝外部編集の疑い。破壊的措置は取らず
  // フラグを立てつつ Cloudflare ログへビーコン送出（将来のサーバー検証・課金保護のフック）。
  const storedSig = localStorage.getItem(STORAGE_KEYS.META_SIG);
  metaState._suspect = (storedSig !== null && storedSig !== _metaSig());
  if (metaState._suspect) {
    console.warn('[anticheat] meta integrity check failed');
    _reportSuspect('meta_sig_mismatch');
  }

  updateResourceBar();
}

// 簡易チート検知のサーバー通知（fire-and-forget）。Cloudflare ログに出すだけ。
// 同一セッションでの多重送信は防ぐ。
let _reportSent = false;
function _reportSuspect(kind) {
  if (_reportSent) return;
  _reportSent = true;
  try {
    const pid = (typeof getPlayerId === 'function') ? getPlayerId() : null;
    fetch('/api/rollaxy/report', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ player_id: pid, kind }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
}

function saveMeta() {
  localStorage.setItem(STORAGE_KEYS.META_STARDUST,   String(metaState.stardust));
  localStorage.setItem(STORAGE_KEYS.META_ENERGY,     String(metaState.energy));
  localStorage.setItem(STORAGE_KEYS.META_MASS,       String(metaState.mass));
  localStorage.setItem(STORAGE_KEYS.META_GEN_LEVEL,  String(metaState.genLevel));
  localStorage.setItem(STORAGE_KEYS.META_CIV_LEVEL,  String(metaState.civLevel));
  localStorage.setItem(STORAGE_KEYS.META_RESEARCH,   JSON.stringify([...metaState.research]));
  localStorage.setItem(STORAGE_KEYS.META_LAST_SAVED, String(metaState.lastSaved));
  localStorage.setItem(STORAGE_KEYS.META_SIG,        _metaSig()); // 整合性署名（簡易チート対策）
}

// ============================================================
// 研究効果の中央集計（拡張ポイント）
// ownedResearch の effect を type ごとに合算。
//   倍率系(rewardMult/scoreMult/starRateMult/genCostMult): 1 + Σvalue を返す
//   加算系(skillCharge/timeBonus): Σvalue を返す
// ============================================================
const _MULT_KEYS = new Set(['rewardMult', 'scoreMult', 'starRateMult', 'genCostMult']);
function getModifier(key) {
  let sum = 0;
  for (const r of CFG.META.RESEARCH) {
    if (!metaState.research.has(r.id)) continue;
    if (r.effect && r.effect.type === key) sum += r.effect.value;
  }
  return _MULT_KEYS.has(key) ? (1 + sum) : sum;
}

// ---- 計算ヘルパー ----
// 質量生成レート (質量/秒) = (MASS_BASE + (level-1)*MASS_PER_LEVEL) × 研究倍率
function massProdRate(level = metaState.genLevel) {
  const s = CFG.META.STAR;
  return (s.MASS_BASE + (level - 1) * s.MASS_PER_LEVEL) * getModifier('starRateMult');
}
// エネルギー生成レート (energy/秒) = K × mass^(2/3)
function energyRateFromMass(mass) {
  if (mass <= 0) return 0;
  return CFG.META.STAR.ENERGY_K * Math.pow(mass, 2 / 3);
}
// 現在の恒星エネルギー/秒（現在の蓄積質量から）
function starEnergyRate() {
  return energyRateFromMass(metaState.mass);
}
// 恒星の見た目 tier（BODIES index）。TIER_LEVELS の到達レベルから決定。
function starTierBi(level = metaState.genLevel) {
  const tl = CFG.META.STAR.TIER_LEVELS;
  let bi = 0;
  for (let i = 0; i < tl.length; i++) if (level >= tl[i]) bi = i;
  return Math.min(bi, CFG.BODIES.length - 1);
}
// Lv L→L+1 の強化コスト（星屑）。MAX_LEVEL 到達で Infinity。研究で倍率補正。
function generatorCost(level = metaState.genLevel) {
  const g = CFG.META.GENERATOR;
  if (level >= g.MAX_LEVEL) return Infinity;
  const raw = g.BASE_COST * Math.pow(g.GROWTH, level - 1) * getModifier('genCostMult');
  return Math.max(1, Math.floor(raw));
}

// ---- 文明レベル（消費型）----
// Lv L→L+1 のコスト（恒星エネルギー）。MAX_LEVEL 到達で Infinity。
function civLevelCost(level = metaState.civLevel) {
  const c = CFG.META.CIV;
  if (level >= c.MAX_LEVEL) return Infinity;
  return Math.floor(c.BASE_COST * Math.pow(c.GROWTH, level - 1));
}
// 文明レベルを1上げる（恒星エネルギーが足りれば）。戻り値 = 成功可否。
function levelUpCiv() {
  const cost = civLevelCost();
  if (!Number.isFinite(cost)) return false;
  settleEnergy(); // 支払い前に放置分を精算
  if (metaState.energy < cost) return false;
  metaState.energy  -= cost;
  metaState.civLevel += 1;
  saveMeta();
  updateResourceBar();
  return true;
}

// ---- 研究 ----
function researchDef(id)   { return CFG.META.RESEARCH.find(r => r.id === id) || null; }
function isResearched(id)  { return metaState.research.has(id); }
function isResearchUnlocked(def) { return def && metaState.civLevel >= def.reqCiv; }
function canBuyResearch(def) {
  return def && !isResearched(def.id) && isResearchUnlocked(def) && metaState.stardust >= def.cost;
}
// 研究を購入（星屑消費）。戻り値 = 成功可否。
function buyResearch(id) {
  const def = researchDef(id);
  if (!canBuyResearch(def)) return false;
  metaState.stardust -= def.cost;
  metaState.research.add(id);
  saveMeta();
  updateResourceBar();
  return true;
}

// 放置（経過時間）分の質量・エネルギーを精算。時間上限あり（CAP_SEC = 12h）。
// 戻り値 = 今回加算したエネルギー量。
// シンプル計算: エネルギーレートは「精算直前の質量」で固定し、経過秒数を単純に掛ける。
//   energyGain = energyRateFromMass(mass_before) * T
//   massGain   = massProdRate() * T
// ※ 簡易チート対策: 時計巻き戻り(elapsed<0)は 0 に、進め過ぎは CAP_SEC で頭打ち。
function settleEnergy() {
  const now = Date.now();
  let elapsedSec = (now - metaState.lastSaved) / 1000;
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0) elapsedSec = 0; // 時計巻き戻り対策
  const T = Math.min(elapsedSec, CFG.META.IDLE.CAP_SEC);

  // エネルギーレートは精算前の質量で固定（オフライン直前のレート × 時間）
  let energyGain = energyRateFromMass(metaState.mass) * T;
  if (!Number.isFinite(energyGain) || energyGain < 0) energyGain = 0;

  metaState.mass    += massProdRate() * T; // 質量はレート × 時間で線形増加
  metaState.energy  += energyGain;
  metaState.lastSaved = now;
  saveMeta();
  updateResourceBar();
  return energyGain;
}

// プレイ報酬を計算（floor）。modeType = 'time' | 'endless' | 'tutorial'
// stardust = score × STARDUST_PER_SCORE × modeMult × 研究倍率
// ※ エネルギーはゲームからは得られず、恒星（物質生成器）が自動生成する
function computeReward(score, modeType) {
  const r = CFG.META.REWARD;
  const modeMult = (r.MODE_MULT && r.MODE_MULT[modeType] != null) ? r.MODE_MULT[modeType] : 1;
  const rMult = getModifier('rewardMult'); // 研究による報酬倍率
  const mult = modeMult * rMult;
  const stardust = Math.floor(score * r.STARDUST_PER_SCORE * mult);
  return { stardust: Math.max(0, stardust) };
}

// プレイ報酬を付与して保存。戻り値 = 付与した報酬 {stardust}。
function grantPlayReward(score, modeType) {
  settleEnergy(); // 付与前に放置分を確定（lastSaved 更新）
  const rw = computeReward(score, modeType);
  metaState.stardust += rw.stardust;
  saveMeta();
  updateResourceBar();
  return rw;
}

// 物質生成器を1段階強化（星屑が足りれば）。戻り値 = 成功可否。
function upgradeGenerator() {
  const cost = generatorCost();
  if (!Number.isFinite(cost) || metaState.stardust < cost) return false;
  settleEnergy(); // レベル変更でレートが変わるため、その前に精算
  metaState.stardust -= cost;
  metaState.genLevel += 1;
  saveMeta();
  updateResourceBar();
  return true;
}

// ============================================================
// UI — リソースバー（ホーム画面上部の星屑・エネルギー表示）
// ============================================================
function updateResourceBar() {
  const sdEl = document.getElementById('res-stardust-val');
  const enEl = document.getElementById('res-energy-val');
  if (sdEl) sdEl.textContent = Math.floor(metaState.stardust).toLocaleString();
  if (enEl) enEl.textContent = Math.floor(metaState.energy).toLocaleString();
}

// ステージクリア時に報酬パーティクルを飛ばす。
// stardust / energy: 今回獲得した量（粒数の計算に使用）。
function flyRewardParticles(stardust) {
  const sdTarget = document.getElementById('res-stardust');
  if (!sdTarget) return;

  // ソース：画面中央やや下
  const sx = window.innerWidth  / 2;
  const sy = window.innerHeight * 0.52;

  const _flyGroup = (emoji, targetEl, count, groupDelay) => {
    if (count <= 0) return;
    let arrived = 0;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'reward-particle';
      p.textContent = emoji;

      // 発生時の散らばり
      const ox = (Math.random() - 0.5) * 110;
      const oy = (Math.random() - 0.5) * 70 - 10;
      p.style.left    = (sx + ox) + 'px';
      p.style.top     = (sy + oy) + 'px';
      p.style.opacity = '1';
      p.style.transform = 'scale(1)';
      document.body.appendChild(p);

      const flyDelay = groupDelay + i * 55;
      setTimeout(() => {
        const rect = targetEl.getBoundingClientRect();
        const tx = rect.left + rect.width  / 2;
        const ty = rect.top  + rect.height / 2;
        const dur = 0.45 + Math.random() * 0.15;
        p.style.transition = [
          `left ${dur}s cubic-bezier(0.5,0,0.7,1)`,
          `top ${dur}s cubic-bezier(0.5,0,0.7,1)`,
          `opacity 0.18s ${(dur - 0.18).toFixed(2)}s`,
          `transform ${dur}s ease-in`,
        ].join(', ');
        p.style.left      = tx + 'px';
        p.style.top       = ty + 'px';
        p.style.opacity   = '0';
        p.style.transform = 'scale(0.2)';

        setTimeout(() => {
          p.remove();
          arrived++;
          // 最後の粒が到着したらバーをバンプ
          if (arrived === count) {
            targetEl.classList.remove('res-bump');
            void targetEl.offsetWidth; // reflow で animation をリセット
            targetEl.classList.add('res-bump');
            setTimeout(() => targetEl.classList.remove('res-bump'), 400);
          }
        }, (dur + 0.1) * 1000);
      }, flyDelay);
    }
  };

  const nStar = stardust > 0 ? 6 : 0;
  _flyGroup('💫', sdTarget, nStar, 0);
}

// ============================================================
// ============================================================
// ホームカルーセル制御 (0=研究, 1=プレイ, 2=恒星)
// ============================================================
let _carouselIdx = 1;

// カルーセルを指定パネルへ移動（mobile のみアニメーション、desktop は静的3列表示）
function carouselGoTo(idx) {
  _carouselIdx = idx;
  const el = document.getElementById('home-carousel');
  if (!el) return;
  // デスクトップ(≥760px)は CSS で常時3列表示のためtransformしない
  if (window.matchMedia('(min-width: 760px)').matches) return;
  el.style.transform = `translateX(${-idx * 33.3333}%)`;
}

// ============================================================
// UI — cosmos-panel / research-panel
// ============================================================
function _setTxt(id, txt) { const e = document.getElementById(id); if (e) e.textContent = txt; }
function _fmt(n) { return Math.floor(n).toLocaleString(); }

function renderCosmos() {
  if (!document.getElementById('cosmos-panel')) return;
  // 恒星の見た目（天体画像 PNG）。tier に応じた key で images/{key}.png を使用
  const bi = starTierBi();
  const starEl = document.getElementById('cosmos-star');
  if (starEl) {
    const key  = CFG.BODIES[bi].key;
    const name = CFG.BODIES[bi].n;
    starEl.innerHTML = `<img src="images/${key}.png" alt="${name}">`;
    starEl.style.fontSize = ''; // 旧emoji用 font-size をクリア
  }
  // 質量・残高
  _setTxt('cosmos-mass',     T('massInfo')(_fmt(metaState.mass), massProdRate().toFixed(1)));
  _setTxt('cosmos-rate',     `⚡ +${starEnergyRate().toFixed(2)} ${T('stellarEnergy')}${T('energyRate')}`);
  // 物質生成器
  _setTxt('cosmos-gen-level', T('generatorLevel')(metaState.genLevel));
  const cost = generatorCost();
  const btn  = document.getElementById('cosmos-upgrade-btn');
  if (btn) {
    if (!Number.isFinite(cost)) {
      btn.textContent = T('generatorMax');
      btn.disabled = true;
    } else {
      btn.textContent = `${T('generatorUpgrade')}  💫 ${_fmt(cost)}`;
      btn.disabled = metaState.stardust < cost;
    }
  }
}

// 毎秒: 恒星を脈動させながら数値を「絞り出す」演出（同期）
function _tickStarEffect() {
  const starEl = document.getElementById('cosmos-star');
  if (!starEl) return;
  const rate = starEnergyRate();
  if (rate <= 0) return;

  // ① 恒星を押し込む（star-pulse クラスで CSS animation をトリガー）
  starEl.classList.remove('star-pulse');
  void starEl.offsetWidth; // reflow で animation をリセット
  starEl.classList.add('star-pulse');
  starEl.addEventListener('animationend', () => starEl.classList.remove('star-pulse'), { once: true });

  // ② 同タイミングで数値を「押し出される」ように浮かせる
  const rect = starEl.getBoundingClientRect();
  const p = document.createElement('span');
  p.className = 'energy-float';
  p.textContent = `+${rate.toFixed(2)} ⚡`;
  // 水平方向に少しランダムにずらし、恒星の中央やや上から出現
  const ox = (Math.random() - 0.5) * 44;
  p.style.left = (rect.left + rect.width / 2 + ox) + 'px';
  p.style.top  = (rect.top + rect.height * 0.42) + 'px';
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1450);
}

let _cosmosTimer = null;
function _startCosmosTick() {
  _stopCosmosTick();
  _cosmosTimer = setInterval(() => {
    settleEnergy();
    renderCosmos();
    _tickStarEffect();
  }, 1000);
}
function _stopCosmosTick() {
  if (_cosmosTimer) { clearInterval(_cosmosTimer); _cosmosTimer = null; }
}

function openCosmos() {
  settleEnergy();
  renderCosmos();
  carouselGoTo(2);
  _startCosmosTick();
}
function closeCosmos() {
  _stopCosmosTick();
  settleEnergy();
  carouselGoTo(1);
}

// ---- 研究オーバーレイ ----
function _locName(o) { const c = (currentLang || 'ja').replace(/^./, x => x.toUpperCase()); return o['name' + c] || o.nameJa; }
function _locDesc(o) { const c = (currentLang || 'ja').replace(/^./, x => x.toUpperCase()); return o['desc' + c] || o.descJa; }

function renderResearch() {
  if (!document.getElementById('research-list')) return;
  // 文明レベル
  _setTxt('research-civ-level', T('civLevelLabel')(metaState.civLevel));
  const cc = civLevelCost();
  const upBtn = document.getElementById('research-civ-up');
  if (!Number.isFinite(cc)) {
    _setTxt('research-civ-cost', T('civMax'));
    if (upBtn) { upBtn.textContent = T('civUpBtn'); upBtn.disabled = true; }
  } else {
    _setTxt('research-civ-cost', T('civNextCost')(_fmt(cc)));
    if (upBtn) { upBtn.textContent = T('civUpBtn'); upBtn.disabled = metaState.energy < cc; }
  }
  // 研究一覧（名前・説明は config 由来の信頼値なので innerHTML 安全）
  const list = document.getElementById('research-list');
  if (!list) return;
  let html = '';
  for (const r of CFG.META.RESEARCH) {
    let status, cls, disabled;
    if (isResearched(r.id)) {
      status = T('researchOwned'); cls = 'owned'; disabled = true;
    } else if (!isResearchUnlocked(r)) {
      status = T('researchReqCiv')(r.reqCiv); cls = 'locked'; disabled = true;
    } else {
      status = `💫 ${_fmt(r.cost)}`;
      disabled = metaState.stardust < r.cost;
      cls = disabled ? 'poor' : 'buy';
    }
    html += `<div class="research-item ${cls}">`
          + `<div class="research-info">`
          + `<div class="research-name">${_locName(r)}</div>`
          + `<div class="research-desc">${_locDesc(r)}</div></div>`
          + `<button class="research-buy-btn" data-id="${r.id}"${disabled ? ' disabled' : ''}>${status}</button>`
          + `</div>`;
  }
  list.innerHTML = html;
}

let _researchTimer = null;
function _startResearchTick() {
  _stopResearchTick();
  _researchTimer = setInterval(() => { settleEnergy(); renderResearch(); }, 1000);
}
function _stopResearchTick() {
  if (_researchTimer) { clearInterval(_researchTimer); _researchTimer = null; }
}

// デスクトップ(≥760px)では両パネルが常時表示されるため両方のティックを起動する。
// 重複呼び出しは内部で _stop してから再起動するので安全。
function ensureDesktopTicks() {
  if (!window.matchMedia('(min-width: 760px)').matches) return;
  settleEnergy();
  renderCosmos();
  renderResearch();
  _startCosmosTick();
  _startResearchTick();
}

function openResearch() {
  settleEnergy();
  renderResearch();
  carouselGoTo(0);
  _startResearchTick();
}
function closeResearch() {
  _stopResearchTick();
  settleEnergy();
  carouselGoTo(1);
}

// ---- ランキングオーバーレイ（/api/rollaxy/ranking をネイティブ表示）----
let _rankPeriod = 'daily';
function _esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _rankMyIds() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.SHARE_IDS) || '[]'); } catch (_) { return []; }
}
async function renderRankingHome() {
  const list = document.getElementById('rank-list-home');
  if (!list) return;
  document.querySelectorAll('#rank-period-tabs .rank-period')
    .forEach(b => b.classList.toggle('active', b.dataset.period === _rankPeriod));
  list.innerHTML = `<div class="rank-status">${T('rankLoading')}</div>`;
  const tz = -(new Date().getTimezoneOffset());
  let entries;
  try {
    const res = await fetch(`/api/rollaxy/ranking?period=${_rankPeriod}&limit=50&tz=${tz}`);
    if (!res.ok) throw new Error('http');
    entries = (await res.json()).entries || [];
  } catch (_) {
    list.innerHTML = `<div class="rank-status error">${T('rankError')}</div>`;
    return;
  }
  if (!entries.length) { list.innerHTML = `<div class="rank-status">${T('rankEmpty')}</div>`; return; }
  const mine = _rankMyIds();
  let html = '';
  for (const e of entries) {
    const isMine = mine.includes(e.id);
    const rc = e.rank === 1 ? 'top1' : e.rank === 2 ? 'top2' : e.rank === 3 ? 'top3' : '';
    const tier = Math.min(CFG.BODIES.length - 1, Math.max(0, e.highest_body_tier | 0));
    const emoji = (CFG.BODIES[tier] || {}).e || '✨';
    const name = e.display_name ? _esc(e.display_name) : '—';
    const date = new Date(e.created_at * 1000).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    html += `<div class="rank-card${isMine ? ' is-mine' : ''}">`
          + `<div class="rc-rank ${rc}">#${e.rank}</div>`
          + `<div class="rc-body">${emoji}</div>`
          + `<div class="rc-main"><div class="rc-player">${name}${isMine ? ' 👤' : ''}</div>`
          + `<div class="rc-score">${Number(e.score).toLocaleString()}</div></div>`
          + `<div class="rc-date">${date}</div></div>`;
  }
  list.innerHTML = html;
}
function openRankingHome() {
  renderRankingHome();
  document.getElementById('ranking-overlay')?.classList.add('show');
}
function closeRankingHome() {
  document.getElementById('ranking-overlay')?.classList.remove('show');
}

// ============================================================
// 初期化・イベント配線（スクリプトは body 末尾のため DOM 構築済み）
// ============================================================
loadMeta();
// オフライン報酬: settleEnergy 前に経過時間を測り、戻り値（獲得エネルギー）を通知。
(function _grantOfflineReward() {
  const elapsedSec = (Date.now() - metaState.lastSaved) / 1000;
  const gain = settleEnergy(); // lastSaved を更新（12h 上限・シンプル計算）
  // 1分以上放置かつ 1以上の獲得があったときだけ控えめに通知
  if (elapsedSec >= 60 && gain >= 1) _showOfflineReward(gain);
})();

// オフライン報酬トースト（ホーム上部に数秒表示）
function _showOfflineReward(gain) {
  const el = document.createElement('div');
  el.className = 'offline-reward-toast';
  el.textContent = T('offlineGain')(_fmt(gain));
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 450);
  }, 4000);
}

// ※ 下部バーのタブ切替（恒星/研究/実績/ランキング/プレイ）は game.js の showHomeTab() が統括。
//    ここでは各パネル内の操作だけ配線する。
on(document.getElementById('cosmos-upgrade-btn'), () => {
  if (upgradeGenerator()) { playUpgradeSound(); renderCosmos(); }
});
on(document.getElementById('research-civ-up'), () => {
  if (levelUpCiv()) { playUpgradeSound(); renderResearch(); }
});
// ランキング期間タブ
document.querySelectorAll('#rank-period-tabs .rank-period').forEach((btn) => {
  on(btn, () => { _rankPeriod = btn.dataset.period; renderRankingHome(); });
});
const _researchListEl = document.getElementById('research-list');
if (_researchListEl) {
  _researchListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.research-buy-btn');
    if (!btn || btn.disabled) return;
    if (buyResearch(btn.dataset.id)) { playUpgradeSound(); renderResearch(); }
  });
}

// 言語切替時、ホーム画面が表示中なら動的コンテンツを再描画
document.addEventListener('langchange', () => {
  if (!document.getElementById('start-screen')?.classList.contains('hidden')) {
    renderCosmos();
    renderResearch();
  }
  const rkv = document.getElementById('ranking-overlay');
  if (rkv && rkv.classList.contains('show')) renderRankingHome();
});
