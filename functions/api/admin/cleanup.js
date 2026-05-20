// POST /api/admin/cleanup — 手動クリーンアップ（ADMIN_SECRET 認証）

const GAME_ID = 'rollaxy';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
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
