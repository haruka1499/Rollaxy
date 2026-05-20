// POST /api/rollaxy/share  — 盤面保存
// GET  /api/rollaxy/share  （未使用、将来拡張用）

const GAME_ID  = 'rollaxy';
const SITE_URL = 'https://novoragame.com';

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function nanoid() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => ID_CHARS[b % ID_CHARS.length]).join('');
}

const ALLOWED_ORIGINS = ['https://novoragame.com', 'https://staging.novoragame.com'];
function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

// CORS preflight
export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin') ?? '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

// POST — 盤面データを保存して share ID を返す
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') ?? '';

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, corsHeaders(origin)); }

  const { score, highest_body_tier, snapshot_payload, ui_lang = 'ja', version = 1 } = body;
  if (typeof score !== 'number' || typeof highest_body_tier !== 'number' || !snapshot_payload) {
    return json({ error: 'Missing required fields' }, 400, corsHeaders(origin));
  }
  if (score < 0 || score > 1_000_000 || highest_body_tier < 0 || highest_body_tier > 11) {
    return json({ error: 'Invalid values' }, 400, corsHeaders(origin));
  }

  const id         = nanoid();
  const created_at = Math.floor(Date.now() / 1000);
  const payload    = JSON.stringify(snapshot_payload);

  await env.DB.prepare(
    `INSERT INTO shares (id, game_id, version, score, highest_body_tier, snapshot_payload, ui_lang, created_at, retention_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'normal')`
  ).bind(id, GAME_ID, version, score, highest_body_tier, payload, ui_lang, created_at).run();

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

  try { await env.RANKING_CACHE.delete(`${GAME_ID}:ranking:all:20`); } catch (_) {}

  return json(
    { id, url: `${SITE_URL}/games/rollaxy/share/${id}` },
    201,
    corsHeaders(origin)
  );
}
