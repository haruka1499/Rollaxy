// ============================================================
// NOVORA GAME — Cloudflare Worker
// 静的アセット配信 (env.ASSETS) + 動的 API ルートをここで処理する
// ============================================================
import {
  GAME_ID, SITE_URL, MIN_SCORE_FOR_TIER,
  BODY_EMOJIS, BODY_COLORS, BODY_RADII,
  getTitle, getTitleI18n, scoreWithComma,
} from './constants.js';
import { handleOgp } from './ogp.js';
import { signJwt, verifyJwt } from './auth.js';

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
// レートリミット（KV を使った IP ベース制限）
// share API に対して 10 回/分/IP を超えたらブロック。
// KV エラー時は通す（可用性優先）。
// ============================================================
async function _rateLimit(env, ip) {
  const key = `rl:share:${ip}`;
  try {
    const cur = parseInt(await env.RANKING_CACHE.get(key) || '0', 10);
    if (cur >= 10) return false;
    await env.RANKING_CACHE.put(key, String(cur + 1), { expirationTtl: 60 });
    return true;
  } catch { return true; }
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
// POST /api/rollaxy/share — 盤面保存
// ============================================================
async function handleSharePost(request, env) {
  const origin = request.headers.get('Origin') ?? '';

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders(origin)); }

  const { score, highest_body_tier, snapshot_payload, ui_lang = 'ja', version = 1, player_id = null, display_name = null } = body;

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
  if (score < MIN_SCORE_FOR_TIER[highest_body_tier]) {
    return json({ error: 'score/tier mismatch' }, 400, corsHeaders(origin));
  }

  // ── レートリミット（IP 単位 10回/分）──
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await _rateLimit(env, ip))) {
    return json({ error: 'rate limit exceeded' }, 429, corsHeaders(origin));
  }

  // ── セッショントークン検証 ──
  // 現在は未強制。アカウントシステム追加時に有効化する。
  // インフラ（auth.js・/api/session・クライアント側送信）は維持済み。
  // if (env.JWT_SECRET) {
  //   const tok     = typeof body.session_token === 'string' ? body.session_token : null;
  //   const payload = tok ? await verifyJwt(tok, env.JWT_SECRET) : null;
  //   if (!payload || payload.gid !== GAME_ID) {
  //     return json({ error: 'invalid session' }, 401, corsHeaders(origin));
  //   }
  // }

  // ── スコア整合チェック ──
  // elapsed_ms / drop_count で明らかに異常なスコアを弾く。
  // 正常プレイなら 1 ドロップあたり最低 200ms・最大 1000 点程度が上限。
  const { drop_count, elapsed_ms } = snapshot_payload;
  if (typeof drop_count === 'number' && typeof elapsed_ms === 'number' && drop_count > 0) {
    if (elapsed_ms < drop_count * 200) {
      return json({ error: 'invalid play data' }, 400, corsHeaders(origin));
    }
    if (score / drop_count > 1000) {
      return json({ error: 'invalid play data' }, 400, corsHeaders(origin));
    }
  }

  // ── player_id バリデーション ──
  // フォーマット: {provider}_{8〜28文字英数字} 例: guest_a3f8kz9mxqbt
  const pid = (typeof player_id === 'string' && /^[a-z]+_[a-z0-9]{8,28}$/.test(player_id))
    ? player_id : null;

  // ── display_name バリデーション ──
  const dname = (typeof display_name === 'string' && display_name.trim().length >= 1)
    ? display_name.trim().replace(/[<>"&]/g, '').slice(0, 15) || null
    : null;

  const id         = nanoid();
  const created_at = Math.floor(Date.now() / 1000);
  const payload    = JSON.stringify(snapshot_payload);

  // shares への INSERT（player_id / display_name 列が未追加の場合はフォールバック）
  try {
    await env.DB.prepare(
      `INSERT INTO shares (id, game_id, version, score, highest_body_tier, snapshot_payload, ui_lang, created_at, retention_type, player_id, display_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'normal', ?, ?)`
    ).bind(id, GAME_ID, version, score, highest_body_tier, payload, ui_lang, created_at, pid, dname).run();
  } catch (_) {
    await env.DB.prepare(
      `INSERT INTO shares (id, game_id, version, score, highest_body_tier, snapshot_payload, ui_lang, created_at, retention_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'normal')`
    ).bind(id, GAME_ID, version, score, highest_body_tier, payload, ui_lang, created_at).run();
  }

  // players テーブルへ upsert（最新の表示名を常に最新に保つ）
  if (pid) {
    const pname = dname ?? ('ゲスト_' + pid.split('_').slice(1).join('').slice(0, 6));
    try {
      await env.DB.prepare(
        `INSERT INTO players (player_id, display_name, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(player_id) DO UPDATE SET
           display_name = excluded.display_name,
           updated_at   = excluded.updated_at`
      ).bind(pid, pname, created_at).run();
    } catch (_) {} // players テーブル未作成の場合は無視
  }

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

  // tz: クライアントのUTCオフセット（分）。例: JST=+540、EST=-300
  // -(new Date().getTimezoneOffset()) で取得した値をそのまま渡す。
  // 未指定・不正値はUTC(0)にフォールバック。有効範囲: -720〜840
  const tzRaw = parseInt(url.searchParams.get('tz') ?? '0', 10);
  const tz    = (Number.isFinite(tzRaw) && tzRaw >= -720 && tzRaw <= 840) ? tzRaw : 0;

  if (!['all', 'daily', 'weekly'].includes(period)) {
    return json({ error: 'period must be all | daily | weekly' }, 400);
  }

  // all はタイムゾーン無関係。daily/weekly はtz別にキャッシュを分ける
  const cacheKey = period === 'all'
    ? `${GAME_ID}:ranking:${period}:${limit}`
    : `${GAME_ID}:ranking:${period}:${limit}:tz${tz}`;
  try {
    const cached = await env.RANKING_CACHE.get(cacheKey, 'json');
    if (cached) return json(cached, 200, { 'X-Cache': 'HIT' });
  } catch (_) {}

  const now   = Math.floor(Date.now() / 1000);
  // ── カレンダー境界計算 ──
  // ローリングウィンドウ（now-86400s）ではなく、ローカル時刻の「今日00:00」「今週月曜00:00」を使う。
  // tzSec: UTCオフセットを秒換算。localNow: ローカル時刻での Unix 秒（擬似値）。
  let since;
  if (period === 'all') {
    since = 0;
  } else {
    const tzSec   = tz * 60;
    const localNow = now + tzSec; // ローカル時刻でのUnix秒（エポックからの秒数をローカル基準にずらす）
    if (period === 'daily') {
      // ローカルの今日 00:00:00 をUTCのUnix秒に変換
      since = Math.floor(localNow / 86400) * 86400 - tzSec;
    } else {
      // ローカルの今週月曜 00:00:00 をUTCのUnix秒に変換
      // エポック(1970-01-01)は木曜 → 月曜起算(0=Mon)で index 3
      const localDays       = Math.floor(localNow / 86400);
      const daysSinceMonday = (localDays + 3) % 7; // 0=月,1=火,...,6=日
      since = (localDays - daysSinceMonday) * 86400 - tzSec;
    }
  }

  // players テーブルを LEFT JOIN して最新の表示名を取得
  // フォールバック: players テーブルなし → shares.display_name → 列なし の順で試みる
  let results;
  try {
    ({ results } = await env.DB.prepare(
      `SELECT s.id, s.score, s.highest_body_tier, s.created_at,
              COALESCE(p.display_name, s.display_name) AS display_name
       FROM shares s
       LEFT JOIN players p ON s.player_id = p.player_id
       WHERE s.game_id=? AND s.created_at>=?
       ORDER BY s.score DESC LIMIT ?`
    ).bind(GAME_ID, since, limit).all());
  } catch (_) {
    try {
      ({ results } = await env.DB.prepare(
        `SELECT id, score, highest_body_tier, created_at, display_name
         FROM shares WHERE game_id=? AND created_at>=? ORDER BY score DESC LIMIT ?`
      ).bind(GAME_ID, since, limit).all());
    } catch (_) {
      ({ results } = await env.DB.prepare(
        `SELECT id, score, highest_body_tier, created_at
         FROM shares WHERE game_id=? AND created_at>=? ORDER BY score DESC LIMIT ?`
      ).bind(GAME_ID, since, limit).all());
    }
  }

  const entries = results.map((row, i) => ({
    rank:              i + 1,
    score:             row.score,
    highest_body_tier: row.highest_body_tier,
    id:                row.id,
    created_at:        row.created_at,
    display_name:      row.display_name || null,
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
// シェアページ多言語テキスト
// ============================================================
const _SL = {
  ja: {
    rankText:  rank => `全体 ${rank.toLocaleString('en-US')} 位`,
    playBtn:   'Rollaxy をプレイ',
    tweetBtn:  'X でシェア',
    gamesLink: 'ゲーム一覧',
    tweetText: (score, title) => `スコア ${score} — ${title}！`,
    desc:      (score, title, emoji) => `${title} — スコア ${score}、最大天体 ${emoji}。あなたも挑戦！`,
    navGames: 'ゲーム', navAbout: 'About', navPrivacy: 'Privacy',
    footerHome: 'Home', footerGames: 'ゲーム', footerPrivacy: 'プライバシーポリシー',
  },
  en: {
    rankText:  rank => `Overall Rank #${rank.toLocaleString('en-US')}`,
    playBtn:   'Play Rollaxy',
    tweetBtn:  'Share on X',
    gamesLink: 'Game List',
    tweetText: (score, title) => `Score ${score} — ${title}!`,
    desc:      (score, title, emoji) => `${title} — Score ${score}, top body ${emoji}. Try it!`,
    navGames: 'Games', navAbout: 'About', navPrivacy: 'Privacy',
    footerHome: 'Home', footerGames: 'Games', footerPrivacy: 'Privacy Policy',
  },
  zh: {
    rankText:  rank => `全球排名第 ${rank.toLocaleString('en-US')} 名`,
    playBtn:   '开始游戏',
    tweetBtn:  '分享到 X',
    gamesLink: '游戏列表',
    tweetText: (score, title) => `得分 ${score} — ${title}！`,
    desc:      (score, title, emoji) => `${title} — 得分 ${score}，最大天体 ${emoji}。快来挑战！`,
    navGames: '游戏', navAbout: 'About', navPrivacy: 'Privacy',
    footerHome: 'Home', footerGames: '游戏', footerPrivacy: '隐私政策',
  },
};

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

  const lang = (_SL[row.ui_lang] ? row.ui_lang : 'ja');
  const L    = _SL[lang];

  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score>?`
  ).bind(row.score).first();
  const rank     = (rankRow?.cnt ?? 0) + 1;
  const rankText = L.rankText(rank);

  let bodies = [];
  try { bodies = JSON.parse(row.snapshot_payload).bodies ?? []; } catch (_) {}

  const titleStr  = getTitleI18n(row.score, row.highest_body_tier, lang);
  const maxEmoji  = BODY_EMOJIS[Math.min(11, row.highest_body_tier)];
  const svg       = buildBoardSVG(bodies);
  const scoreStr  = scoreWithComma(row.score);
  const shareUrl  = `${SITE_URL}/games/rollaxy/share/${id}`;
  const ogImage   = `${SITE_URL}/games/rollaxy/ogp/${id}`;
  const pageTitle = `Score ${scoreStr} | Rollaxy | NOVORA GAME`;
  const desc      = L.desc(scoreStr, titleStr, maxEmoji);
  const htmlLang  = lang === 'zh' ? 'zh' : lang === 'en' ? 'en' : 'ja';

  const html = `<!DOCTYPE html>
<html lang="${htmlLang}">
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
    <li><a href="/games/">${L.navGames}</a></li>
    <li><a href="/about/">${L.navAbout}</a></li>
    <li><a href="/privacy/">${L.navPrivacy}</a></li>
  </ul>
</div></nav>
<main><div class="share-page">
  <div class="share-board">${svg}</div>
  <div class="share-score">${scoreStr}</div>
  <div class="share-title">${titleStr} ${maxEmoji}</div>
  <div class="share-rank">${rankText}</div>
  <div>
    <a class="share-play" href="/games/rollaxy/">▶ ${L.playBtn}</a>
    <a class="share-tweet" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(L.tweetText(scoreStr, titleStr))}&url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener">${L.tweetBtn}</a>
  </div>
  <div class="share-links"><a href="/games/">${L.gamesLink}</a></div>
</div></main>
<footer class="site-footer">
  <div class="footer-links">
    <a href="/">${L.footerHome}</a><a href="/games/">${L.footerGames}</a><a href="/privacy/">${L.footerPrivacy}</a>
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
// GET /api/session — セッショントークン発行
// ゲーム開始時に呼ばれ、スコア投稿時の検証に使う JWT を返す。
// JWT_SECRET 未設定時は { token: null } を返し、後方互換を保つ。
// ============================================================
async function handleSession(request, env) {
  const origin = request.headers.get('Origin') ?? '';
  if (!env.JWT_SECRET) {
    return json({ token: null }, 200, corsHeaders(origin));
  }
  const now   = Math.floor(Date.now() / 1000);
  const token = await signJwt({ iat: now, exp: now + 14400, gid: GAME_ID }, env.JWT_SECRET);
  return json({ token }, 200, corsHeaders(origin));
}

// ============================================================
// POST /api/rollaxy/player — プレイヤー表示名の即時更新
// ============================================================
async function handlePlayerUpdate(request, env) {
  const origin = request.headers.get('Origin') ?? '';

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders(origin)); }

  const { player_id, display_name } = body;

  const pid = (typeof player_id === 'string' && /^[a-z]+_[a-z0-9]{8,28}$/.test(player_id))
    ? player_id : null;
  if (!pid) return json({ error: 'invalid player_id' }, 400, corsHeaders(origin));

  const dname = (typeof display_name === 'string' && display_name.trim().length >= 1)
    ? display_name.trim().replace(/[<>"&]/g, '').slice(0, 15) || null : null;
  if (!dname) return json({ error: 'invalid display_name' }, 400, corsHeaders(origin));

  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare(
      `INSERT INTO players (player_id, display_name, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(player_id) DO UPDATE SET
         display_name = excluded.display_name,
         updated_at   = excluded.updated_at`
    ).bind(pid, dname, now).run();
  } catch (_) {
    return json({ error: 'players table not ready' }, 503, corsHeaders(origin));
  }

  try {
    for (const p of ['all', 'daily', 'weekly']) {
      for (const l of [20, 50, 100]) {
        await env.RANKING_CACHE.delete(`${GAME_ID}:ranking:${p}:${l}`);
      }
    }
  } catch (_) {}

  return json({ ok: true }, 200, corsHeaders(origin));
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

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') ?? '') });
    }

    if (method === 'GET' && path === '/api/session') {
      return handleSession(request, env);
    }

    if (method === 'POST' && path === '/api/rollaxy/share') {
      return handleSharePost(request, env);
    }

    if (method === 'GET' && path === '/api/rollaxy/ranking') {
      return handleRanking(request, env);
    }

    if (method === 'POST' && path === '/api/rollaxy/player') {
      return handlePlayerUpdate(request, env);
    }

    if (method === 'POST' && path === '/api/admin/cleanup') {
      return handleCleanup(request, env);
    }

    const shareMatch = path.match(/^\/games\/rollaxy\/share\/([^/]+)$/);
    if (shareMatch && method === 'GET') {
      const id = shareMatch[1];
      return ID_RE.test(id) ? handleSharePage(id, env) : sharePage404();
    }

    const ogpMatch = path.match(/^\/games\/rollaxy\/ogp\/([^/]+)$/);
    if (ogpMatch && method === 'GET') {
      const id = ogpMatch[1];
      if (!ID_RE.test(id)) return new Response('Not found', { status: 404 });
      return handleOgp(id, env);
    }

    return env.ASSETS.fetch(request);
  },
};
