'use strict';

// POST /api/rollaxy/share  — 盤面データ保存 → { id, url } 返却
// GET  /api/rollaxy/share/:id は /functions/games/rollaxy/share/[id].js が担う

const ALLOWED_ORIGIN = 'https://novoragame.com';
const BASE_URL       = 'https://novoragame.com';
const GAME_ID        = 'rollaxy';
const ID_CHARS       = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ID_LENGTH      = 10;

function nanoid() {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(bytes, b => ID_CHARS[b % ID_CHARS.length]).join('');
}

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') ?? '';

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, origin);
  }

  const { score, highest_body_tier, snapshot_payload, ui_lang = 'ja', version = 1 } = body;

  if (typeof score !== 'number' || typeof highest_body_tier !== 'number' || !snapshot_payload) {
    return json({ error: 'Missing required fields' }, 400, origin);
  }
  if (score < 0 || score > 1_000_000 || highest_body_tier < 0 || highest_body_tier > 11) {
    return json({ error: 'Invalid values' }, 400, origin);
  }

  const id         = nanoid();
  const created_at = Math.floor(Date.now() / 1000);
  const payload    = JSON.stringify(snapshot_payload);

  await env.DB.prepare(
    `INSERT INTO shares (id, game_id, version, score, highest_body_tier, snapshot_payload, ui_lang, created_at, retention_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'normal')`
  ).bind(id, GAME_ID, version, score, highest_body_tier, payload, ui_lang, created_at).run();

  // ランキング上位 keep_top_n 件の retention_type を ranked に更新（簡易同期版）
  // 重い場合は Cron に移す
  const keepRow = await env.DB.prepare(`SELECT value FROM config WHERE key='keep_top_n'`).first();
  const keepN   = keepRow ? parseInt(keepRow.value, 10) : 1000;
  await env.DB.prepare(
    `UPDATE shares SET retention_type='normal'  WHERE game_id=? AND retention_type='ranked'`
  ).bind(GAME_ID).run();
  await env.DB.prepare(
    `UPDATE shares SET retention_type='ranked'
     WHERE game_id=? AND id IN (
       SELECT id FROM shares WHERE game_id=? ORDER BY score DESC LIMIT ?
     )`
  ).bind(GAME_ID, GAME_ID, keepN).run();

  // KV ランキングキャッシュを無効化（次回 GET 時に再生成）
  try { await env.RANKING_CACHE.delete('all'); } catch (_) {}

  return json({ id, url: `${BASE_URL}/games/rollaxy/share/${id}` }, 201, origin);
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
