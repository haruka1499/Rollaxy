'use strict';

// GET /api/rollaxy/ranking?period=all&limit=20
// KV キャッシュ（TTL 60秒）→ D1 フォールバック

const GAME_ID    = 'rollaxy';
const CACHE_TTL  = 60;   // seconds
const MAX_LIMIT  = 100;
const DEF_LIMIT  = 20;

export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const period = url.searchParams.get('period') ?? 'all';
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? DEF_LIMIT, 10), MAX_LIMIT);

  if (!['all', 'daily', 'weekly'].includes(period)) {
    return json({ error: 'period must be all | daily | weekly' }, 400);
  }

  const cacheKey = `${GAME_ID}:ranking:${period}:${limit}`;

  // KV キャッシュを試みる
  try {
    const cached = await env.RANKING_CACHE.get(cacheKey, 'json');
    if (cached) {
      return json(cached, 200, { 'X-Cache': 'HIT' });
    }
  } catch (_) {}

  // D1 から取得
  const now   = Math.floor(Date.now() / 1000);
  const since = period === 'daily'  ? now - 86400
              : period === 'weekly' ? now - 604800
              : 0;

  const { results } = await env.DB.prepare(
    `SELECT id, score, highest_body_tier, created_at
     FROM shares
     WHERE game_id = ? AND created_at >= ?
     ORDER BY score DESC
     LIMIT ?`
  ).bind(GAME_ID, since, limit).all();

  const entries = results.map((row, i) => ({
    rank:             i + 1,
    score:            row.score,
    highest_body_tier: row.highest_body_tier,
    id:               row.id,
    created_at:       row.created_at,
  }));

  const payload = { period, updated_at: now, entries };

  // KV に書き込み（失敗しても返却は続行）
  try {
    await env.RANKING_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: CACHE_TTL });
  } catch (_) {}

  return json(payload, 200);
}

function json(data, status, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Cache-Control':               `public, max-age=${CACHE_TTL}`,
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}
