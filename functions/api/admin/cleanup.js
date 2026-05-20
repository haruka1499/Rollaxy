'use strict';

// POST /api/admin/cleanup — 手動クリーンアップ
// Cloudflare Pages Functions は Cron Trigger 非対応のため、
// 外部 Cron サービス (GitHub Actions, cron-job.org 等) から定期呼び出しする。
//
// 認証: リクエストボディの secret が ADMIN_SECRET 環境変数と一致する場合のみ実行。

const GAME_ID = 'rollaxy';

export async function onRequestPost({ request, env }) {
  // 簡易認証
  let body;
  try { body = await request.json(); } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // config テーブルから設定値を取得
  const cfgRows = await env.DB.prepare(`SELECT key, value FROM config`).all();
  const cfg = Object.fromEntries(cfgRows.results.map(r => [r.key, parseInt(r.value, 10)]));
  const maxShares   = cfg.max_shares         ?? 20000;
  const keepTopN    = cfg.keep_top_n         ?? 1000;
  const batchSize   = cfg.cleanup_batch_size ?? 500;

  // 現在の件数を確認
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id = ?`
  ).bind(GAME_ID).first();
  const total = countRow?.cnt ?? 0;

  let deleted = 0;

  // 件数が上限を超えていたら retention_type='normal' の古い順から削除
  if (total > maxShares) {
    const del = await env.DB.prepare(
      `DELETE FROM shares WHERE game_id = ? AND retention_type = 'normal'
       AND id IN (
         SELECT id FROM shares WHERE game_id = ? AND retention_type = 'normal'
         ORDER BY created_at ASC LIMIT ?
       )`
    ).bind(GAME_ID, GAME_ID, batchSize).run();
    deleted = del.meta?.changes ?? 0;
  }

  // retention_type の再計算: 上位 keep_top_n 件を 'ranked' に設定
  await env.DB.prepare(
    `UPDATE shares SET retention_type = 'normal'
     WHERE game_id = ? AND retention_type = 'ranked'`
  ).bind(GAME_ID).run();

  await env.DB.prepare(
    `UPDATE shares SET retention_type = 'ranked'
     WHERE game_id = ? AND id IN (
       SELECT id FROM shares WHERE game_id = ? ORDER BY score DESC LIMIT ?
     )`
  ).bind(GAME_ID, GAME_ID, keepTopN).run();

  // KV ランキングキャッシュを全クリア
  let kvCleared = 0;
  for (const period of ['all', 'daily', 'weekly']) {
    for (const limit of [20, 50, 100]) {
      try {
        await env.RANKING_CACHE.delete(`${GAME_ID}:ranking:${period}:${limit}`);
        kvCleared++;
      } catch (_) {}
    }
  }

  return json({ ok: true, total_before: total, deleted, kv_cleared: kvCleared });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
