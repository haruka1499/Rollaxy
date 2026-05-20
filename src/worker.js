// ============================================================
// NOVORA GAME — Cloudflare Worker
// 静的アセット配信 (env.ASSETS) + 動的 API ルートをここで処理する
// ============================================================

import { Resvg } from '@cf-wasm/resvg/workerd';

// ============================================================
// CORS ヘルパー
// ============================================================
const ALLOWED_ORIGIN = 'https://novoragame.com';

function corsHeaders(origin) {
  const allowed = (origin === ALLOWED_ORIGIN || origin === 'https://staging.novoragame.com')
    ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// ============================================================
// nanoid (10文字)
// ============================================================
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function nanoid() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => ID_CHARS[b % ID_CHARS.length]).join('');
}

// ============================================================
// 共通定数（フロントエンド config.js と同期すること）
// ============================================================
const GAME_ID      = 'rollaxy';
const SITE_URL     = 'https://novoragame.com';

// tier n を達成するには最低限これだけのスコアが必要（粗い整合性チェック用）
// 計算根拠: tier n を作るには tier 0 が 2^n 個必要 → スコアの合計下限
const MIN_SCORE_FOR_TIER = [0, 1, 3, 6, 11, 20, 35, 60, 100, 160, 250, 380];

const BODY_EMOJIS = ['💫','🪨','🌙','🌍','🪐','☀️','🔴','⭐','💠','🌑','🌌','🌐'];
const BODY_COLORS = ['#b0a090','#807060','#d0c8b0','#3388cc','#d4a870','#ffcc00',
                     '#cc2200','#c8d8ff','#2244cc','#110022','#7744cc','#aa44ff'];
const BODY_RADII  = [12,18,25,33,42,51,61,70,79,88,97,106];

// score + highestTier → 称号文字列
function getTitle(score, highestTier) {
  if (highestTier >= 11) return '銀河団創造者';
  if (score >= 2000)     return '宇宙の覇者';
  if (score >= 1000)     return '銀河の探検家';
  if (score >=  600)     return '太陽の支配者';
  if (score >=  300)     return '惑星の開拓者';
  if (score >=  100)     return '星の冒険者';
  return '宇宙の旅人';
}

// 称号レベル (0〜6)
function getTitleLevel(score, highestTier) {
  if (highestTier >= 11) return 6;
  if (score >= 2000)     return 5;
  if (score >= 1000)     return 4;
  if (score >=  600)     return 3;
  if (score >=  300)     return 2;
  if (score >=  100)     return 1;
  return 0;
}

// 英語フォールバック称号
const TITLE_EN = [
  'Space Wanderer','Star Explorer','Planet Pioneer',
  'Solar Sovereign','Galaxy Explorer','Cosmic Ruler','Cluster Creator',
];

function scoreWithComma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================
// POST /api/rollaxy/share — 盤面保存
// ============================================================
async function handleSharePost(request, env) {
  const origin = request.headers.get('Origin') ?? '';

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders(origin)); }

  const { score, highest_body_tier, snapshot_payload, ui_lang = 'ja', version = 1, player_id = null } = body;

  // ── 基本バリデーション ──
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 999999) {
    return json({ error: 'invalid score' }, 400, corsHeaders(origin));
  }
  if (typeof highest_body_tier !== 'number' || !Number.isInteger(highest_body_tier)
      || highest_body_tier < 0 || highest_body_tier > 11) {
    return json({ error: 'invalid tier' }, 400, corsHeaders(origin));
  }
  if (!snapshot_payload) {
    return json({ error: 'Missing required fields' }, 400, corsHeaders(origin));
  }
  // スコアと最大天体の粗い整合性チェック（明らかに不可能な値を排除）
  if (score < MIN_SCORE_FOR_TIER[highest_body_tier]) {
    return json({ error: 'score/tier mismatch' }, 400, corsHeaders(origin));
  }

  // ── player_id バリデーション ──
  // フォーマット: {provider}_{8〜28文字英数字} 例: guest_a3f8kz9mxqbt
  // 将来プロバイダー (google_, discord_, novora_) が増えても同形式で通る
  const pid = (typeof player_id === 'string' && /^[a-z]+_[a-z0-9]{8,28}$/.test(player_id))
    ? player_id : null;

  const id         = nanoid();
  const created_at = Math.floor(Date.now() / 1000);
  const payload    = JSON.stringify(snapshot_payload);

  // NOTE: D1 に player_id 列が必要。デプロイ前に以下を実行してください:
  //   ALTER TABLE shares ADD COLUMN player_id TEXT;
  //   CREATE INDEX idx_shares_player ON shares (player_id);
  await env.DB.prepare(
    `INSERT INTO shares (id, game_id, version, score, highest_body_tier, snapshot_payload, ui_lang, created_at, retention_type, player_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'normal', ?)`
  ).bind(id, GAME_ID, version, score, highest_body_tier, payload, ui_lang, created_at, pid).run();

  // ランキング retention 再計算
  const keepRow = await env.DB.prepare(`SELECT value FROM config WHERE key='keep_top_n'`).first();
  const keepN   = keepRow ? parseInt(keepRow.value, 10) : 1000;
  await env.DB.prepare(
    `UPDATE shares SET retention_type='normal' WHERE game_id=? AND retention_type='ranked'`
  ).bind(GAME_ID).run();
  await env.DB.prepare(
    `UPDATE shares SET retention_type='ranked'
     WHERE game_id=? AND id IN (SELECT id FROM shares WHERE game_id=? ORDER BY score DESC LIMIT ?)`
  ).bind(GAME_ID, GAME_ID, keepN).run();

  try { await env.RANKING_CACHE.delete('all'); } catch (_) {}

  return json(
    { id, url: `${SITE_URL}/games/rollaxy/share/${id}` },
    201,
    corsHeaders(origin)
  );
}

// ============================================================
// GET /api/rollaxy/ranking — ランキング取得
// ============================================================
const CACHE_TTL = 60;
const MAX_LIMIT = 100;
const DEF_LIMIT = 20;

async function handleRanking(request, env) {
  const url    = new URL(request.url);
  const period = url.searchParams.get('period') ?? 'all';
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? DEF_LIMIT, 10), MAX_LIMIT);

  if (!['all', 'daily', 'weekly'].includes(period)) {
    return json({ error: 'period must be all | daily | weekly' }, 400);
  }

  const cacheKey = `${GAME_ID}:ranking:${period}:${limit}`;
  try {
    const cached = await env.RANKING_CACHE.get(cacheKey, 'json');
    if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
  } catch (_) {}

  const now   = Math.floor(Date.now() / 1000);
  const since = period === 'daily'  ? now - 86400
              : period === 'weekly' ? now - 604800
              : 0;

  const { results } = await env.DB.prepare(
    `SELECT id, score, highest_body_tier, created_at
     FROM shares WHERE game_id=? AND created_at>=? ORDER BY score DESC LIMIT ?`
  ).bind(GAME_ID, since, limit).all();

  const entries = results.map((row, i) => ({
    rank: i + 1, score: row.score,
    highest_body_tier: row.highest_body_tier,
    id: row.id, created_at: row.created_at,
  }));

  const payload = { period, updated_at: now, entries };
  try {
    await env.RANKING_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL });
  } catch (_) {}

  return json(payload, 200, { 'Cache-Control': `public, max-age=${CACHE_TTL}` });
}

// ============================================================
// POST /api/admin/cleanup — 手動クリーンアップ（要認証）
// ============================================================
async function handleCleanup(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const cfgRows = await env.DB.prepare(`SELECT key, value FROM config`).all();
  const cfg     = Object.fromEntries(cfgRows.results.map(r => [r.key, parseInt(r.value, 10)]));
  const maxShares = cfg.max_shares         ?? 20000;
  const keepTopN  = cfg.keep_top_n         ?? 1000;
  const batchSize = cfg.cleanup_batch_size ?? 500;

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id=?`
  ).bind(GAME_ID).first();
  const total = countRow?.cnt ?? 0;

  let deleted = 0;
  if (total > maxShares) {
    const del = await env.DB.prepare(
      `DELETE FROM shares WHERE game_id=? AND retention_type='normal'
       AND id IN (SELECT id FROM shares WHERE game_id=? AND retention_type='normal'
                  ORDER BY created_at ASC LIMIT ?)`
    ).bind(GAME_ID, GAME_ID, batchSize).run();
    deleted = del.meta?.changes ?? 0;
  }

  await env.DB.prepare(
    `UPDATE shares SET retention_type='normal' WHERE game_id=? AND retention_type='ranked'`
  ).bind(GAME_ID).run();
  await env.DB.prepare(
    `UPDATE shares SET retention_type='ranked'
     WHERE game_id=? AND id IN (SELECT id FROM shares WHERE game_id=? ORDER BY score DESC LIMIT ?)`
  ).bind(GAME_ID, GAME_ID, keepTopN).run();

  let kvCleared = 0;
  for (const period of ['all', 'daily', 'weekly']) {
    for (const lim of [20, 50, 100]) {
      try { await env.RANKING_CACHE.delete(`${GAME_ID}:ranking:${period}:${lim}`); kvCleared++; }
      catch (_) {}
    }
  }

  return json({ ok: true, total_before: total, deleted, kv_cleared: kvCleared });
}

// ============================================================
// GET /games/rollaxy/share/:id — シェアページ HTML
// ============================================================
function buildBoardSVG(bodies) {
  const LW = 200, LH = 350, SCALE = 0.5;
  const BOX_L = 18, BOX_T = 168, BOX_R = 382, BOX_B = 688;
  let circles = '', texts = '';
  for (const b of bodies) {
    const tier = Math.max(0, Math.min(11, b.tier));
    const x  = (b.x * SCALE).toFixed(1);
    const y  = (b.y * SCALE).toFixed(1);
    const r  = (BODY_RADII[tier] * SCALE).toFixed(1);
    const fs = Math.max(8, BODY_RADII[tier] * SCALE * 0.9).toFixed(1);
    circles += `<circle cx="${x}" cy="${y}" r="${r}" fill="${BODY_COLORS[tier]}" opacity="0.85"/>`;
    texts   += `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${BODY_EMOJIS[tier]}</text>`;
  }
  const bx = (BOX_L * SCALE).toFixed(1), by = (BOX_T * SCALE).toFixed(1);
  const bw = ((BOX_R - BOX_L) * SCALE).toFixed(1), bh = ((BOX_B - BOX_T) * SCALE).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${LH}" viewBox="0 0 ${LW} ${LH}">
  <rect width="${LW}" height="${LH}" fill="#060412"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#0c0720"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#7744bb" stroke-width="1.5"/>
  ${circles}${texts}</svg>`;
}

async function handleSharePage(id, env) {
  const row = await env.DB.prepare(
    `SELECT id, score, highest_body_tier, snapshot_payload, ui_lang FROM shares WHERE id=?`
  ).bind(id).first();
  if (!row) return sharePage404();

  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score>?`
  ).bind(row.score).first();
  const rank     = (rankRow?.cnt ?? 0) + 1;
  const rankText = `全体 ${rank.toLocaleString('en-US')} 位`;

  let bodies = [];
  try { bodies = JSON.parse(row.snapshot_payload).bodies ?? []; } catch (_) {}

  const titleStr  = getTitle(row.score, row.highest_body_tier);
  const maxEmoji  = BODY_EMOJIS[Math.min(11, row.highest_body_tier)];
  const svg       = buildBoardSVG(bodies);
  const scoreStr  = scoreWithComma(row.score);
  const shareUrl  = `${SITE_URL}/games/rollaxy/share/${id}`;
  const ogImage   = `${SITE_URL}/games/rollaxy/ogp/${id}`;
  const pageTitle = `Score ${scoreStr} | Rollaxy | NOVORA GAME`;
  const desc      = `${titleStr} — スコア ${scoreStr}、最大天体 ${maxEmoji}。あなたも挑戦！`;

  const html = `<!DOCTYPE html>
<html lang="${row.ui_lang === 'en' ? 'en' : 'ja'}">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-FFF4H3EVV8"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FFF4H3EVV8');</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${shareUrl}">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="${shareUrl}">
  <meta property="og:title"       content="${pageTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image"       content="${ogImage}">
  <meta name="twitter:card"       content="summary_large_image">
  <link rel="stylesheet" href="/style.css">
  <style>
    .share-page{max-width:480px;margin:0 auto;padding:24px 16px 48px;text-align:center}
    .share-board{display:inline-block;margin:24px auto;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(119,68,204,.4)}
    .share-board svg{display:block}
    .share-score{font-size:2.4rem;font-weight:700;color:#fff;margin:8px 0 4px}
    .share-title{font-size:1rem;color:#aa88ff;margin-bottom:4px}
    .share-rank{font-size:.85rem;color:#776699;margin-bottom:24px}
    .share-play{display:inline-block;padding:14px 40px;background:#7744cc;color:#fff;border-radius:8px;font-size:1.1rem;font-weight:700;text-decoration:none;margin-bottom:12px}
    .share-play:hover{background:#9966ee}
    .share-tweet{display:inline-block;padding:10px 28px;background:#000;color:#fff;border-radius:8px;font-size:.95rem;text-decoration:none;margin-left:8px}
    .share-tweet:hover{background:#222}
    .share-links{margin-top:16px;font-size:.85rem}
    .share-links a{color:#776699;margin:0 8px}
  </style>
</head>
<body>
<nav class="site-nav"><div class="nav-inner">
  <a href="/" class="nav-logo">NOVORA GAME</a>
  <ul class="nav-links">
    <li><a href="/games/">Games</a></li>
    <li><a href="/about/">About</a></li>
    <li><a href="/privacy/">Privacy</a></li>
  </ul>
</div></nav>
<main><div class="share-page">
  <div class="share-board">${svg}</div>
  <div class="share-score">${scoreStr}</div>
  <div class="share-title">${titleStr} ${maxEmoji}</div>
  <div class="share-rank">${rankText}</div>
  <div>
    <a class="share-play" href="/games/rollaxy/">▶ Rollaxy をプレイ</a>
    <a class="share-tweet" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`スコア ${scoreStr} — ${titleStr}！`)}&url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener">X でシェア</a>
  </div>
  <div class="share-links"><a href="/games/">ゲーム一覧</a></div>
</div></main>
<footer class="site-footer">
  <div class="footer-links">
    <a href="/">Home</a><a href="/games/">Games</a><a href="/privacy/">Privacy Policy</a>
  </div>
  &copy; 2025 NOVORA GAME
</footer>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

function sharePage404() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found</title></head>
<body style="font-family:sans-serif;text-align:center;padding:48px">
<h1>404</h1><p>このシェアページは存在しないか、削除されました。</p>
<a href="/games/rollaxy/">Rollaxy をプレイ</a></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// ============================================================
// GET /games/rollaxy/ogp/:id — OGP PNG 画像生成
// ============================================================
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function loadFont(env) {
  try {
    const res = await env.ASSETS.fetch(
      new Request(`${SITE_URL}/games/rollaxy/fonts/SpaceMono-Regular.ttf`)
    );
    if (res.ok) return await res.arrayBuffer();
  } catch (_) {}
  return null;
}

async function loadBadge(env, level) {
  try {
    const res = await env.ASSETS.fetch(
      new Request(`${SITE_URL}/games/rollaxy/images/badges/title_${level}.png`)
    );
    if (!res.ok) return null;
    return `data:image/png;base64,${toBase64(await res.arrayBuffer())}`;
  } catch (_) { return null; }
}

function buildOgpBoardCircles(bodies) {
  const scale = Math.min(460 / 400, 590 / 700);
  const offX  = (460 - 400 * scale) / 2 + 10;
  const offY  = (630 - 700 * scale) / 2;
  const bx = (offX + 18 * scale).toFixed(1);
  const by = (offY + 168 * scale).toFixed(1);
  const bw = ((382 - 18) * scale).toFixed(1);
  const bh = ((688 - 168) * scale).toFixed(1);
  let out = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#0c0720" stroke="#7744bb" stroke-width="1.5"/>`;
  for (const b of bodies) {
    const tier = Math.max(0, Math.min(11, b.tier));
    out += `<circle cx="${(offX + b.x * scale).toFixed(1)}" cy="${(offY + b.y * scale).toFixed(1)}" r="${(BODY_RADII[tier] * scale).toFixed(1)}" fill="${BODY_COLORS[tier]}" opacity="0.9"/>`;
  }
  return out;
}

function buildOgpSVG(share, rank, fontBuffer, badgeDataUrl) {
  const { score, highest_body_tier, snapshot_payload } = share;
  const titleLevel = getTitleLevel(score, highest_body_tier);
  let bodies = [];
  try { bodies = JSON.parse(snapshot_payload).bodies ?? []; } catch (_) {}
  const board      = buildOgpBoardCircles(bodies);
  const scoreStr   = scoreWithComma(score);
  const fontFamily = fontBuffer ? 'SpaceMono' : 'monospace';
  const badgeEl    = badgeDataUrl
    ? `<image x="580" y="385" width="360" height="75" href="${badgeDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="760" y="450" font-family="${fontFamily}" font-size="28" fill="#cc99ff" text-anchor="middle">${TITLE_EN[titleLevel]}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#060412"/>
  <circle cx="55"  cy="45"  r="1.5" fill="#fff" opacity="0.6"/>
  <circle cx="330" cy="28"  r="2"   fill="#fff" opacity="0.5"/>
  <circle cx="820" cy="75"  r="1.5" fill="#fff" opacity="0.5"/>
  <circle cx="1100" cy="38" r="1"   fill="#fff" opacity="0.4"/>
  <circle cx="930" cy="555" r="1.5" fill="#fff" opacity="0.6"/>
  <rect x="0" y="0" width="480" height="630" fill="#0a0818"/>
  ${board}
  <line x1="480" y1="40" x2="480" y2="590" stroke="#7744bb" stroke-width="1" opacity="0.4"/>
  <text x="760" y="105" font-family="${fontFamily}" font-size="58" font-weight="bold" fill="#7744cc" text-anchor="middle" letter-spacing="10">ROLLAXY</text>
  <text x="760" y="220" font-family="${fontFamily}" font-size="26" fill="#554477" text-anchor="middle" letter-spacing="3">SCORE</text>
  <text x="760" y="340" font-family="${fontFamily}" font-size="100" font-weight="bold" fill="#ffffff" text-anchor="middle">${scoreStr}</text>
  ${badgeEl}
  <text x="760" y="515" font-family="${fontFamily}" font-size="26" fill="#665588" text-anchor="middle">#${rank} All Time</text>
  <line x1="560" y1="548" x2="960" y2="548" stroke="#2a1a44" stroke-width="1"/>
  <text x="760" y="600" font-family="${fontFamily}" font-size="20" fill="#3a2455" text-anchor="middle" letter-spacing="5">NOVORA GAME</text>
</svg>`;
}

async function handleOgp(id, env) {
  const cacheKey = `ogp:${id}`;
  try {
    const cached = await env.RANKING_CACHE.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
      });
    }
  } catch (_) {}

  const row = await env.DB.prepare(
    `SELECT score, highest_body_tier, snapshot_payload FROM shares WHERE id=?`
  ).bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });

  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score>?`
  ).bind(row.score).first();
  const rank = (rankRow?.cnt ?? 0) + 1;

  const titleLevel = getTitleLevel(row.score, row.highest_body_tier);
  const [fontBuffer, badgeDataUrl] = await Promise.all([
    loadFont(env),
    loadBadge(env, titleLevel),
  ]);

  const svg = buildOgpSVG(row, rank, fontBuffer, badgeDataUrl);
  const resvgOpts = {
    fitTo: { mode: 'width', value: 1200 },
    ...(fontBuffer ? { font: { fontBuffers: [fontBuffer], loadSystemFonts: false } } : {}),
  };

  let png;
  try {
    const resvg = await Resvg.async(svg, resvgOpts);
    png = resvg.render().asPng();
  } catch (err) {
    console.error('resvg render failed:', err);
    return new Response('Image generation failed', { status: 500 });
  }

  try {
    await env.RANKING_CACHE.put(cacheKey, png, { expirationTtl: 86400 });
  } catch (_) {}

  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}

// ============================================================
// メインルーター
// ============================================================
const ID_RE = /^[a-zA-Z0-9]{8,12}$/;

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') ?? '') });
    }

    // POST /api/rollaxy/share
    if (method === 'POST' && path === '/api/rollaxy/share') {
      return handleSharePost(request, env);
    }

    // GET /api/rollaxy/ranking
    if (method === 'GET' && path === '/api/rollaxy/ranking') {
      return handleRanking(request, env);
    }

    // POST /api/admin/cleanup
    if (method === 'POST' && path === '/api/admin/cleanup') {
      return handleCleanup(request, env);
    }

    // GET /games/rollaxy/share/:id
    const shareMatch = path.match(/^\/games\/rollaxy\/share\/([^/]+)$/);
    if (shareMatch && method === 'GET') {
      const id = shareMatch[1];
      return ID_RE.test(id) ? handleSharePage(id, env) : sharePage404();
    }

    // GET /games/rollaxy/ogp/:id
    const ogpMatch = path.match(/^\/games\/rollaxy\/ogp\/([^/]+)$/);
    if (ogpMatch && method === 'GET') {
      const id = ogpMatch[1];
      if (!ID_RE.test(id)) return new Response('Not found', { status: 404 });
      return handleOgp(id, env);
    }

    // 静的ファイルを ASSETS から配信
    return env.ASSETS.fetch(request);
  },
};
