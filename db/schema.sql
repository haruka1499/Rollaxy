-- Rollaxy Share & Ranking — D1 スキーマ
-- 適用: wrangler d1 execute novora_game --file=db/schema.sql

CREATE TABLE IF NOT EXISTS shares (
  id                TEXT    PRIMARY KEY,
  game_id           TEXT    NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  score             INTEGER NOT NULL,
  highest_body_tier INTEGER NOT NULL,
  snapshot_payload  TEXT    NOT NULL,
  ui_lang           TEXT    NOT NULL DEFAULT 'ja',
  created_at        INTEGER NOT NULL,
  retention_type    TEXT    NOT NULL DEFAULT 'normal'
);

CREATE INDEX IF NOT EXISTS idx_shares_game_score  ON shares (game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_shares_created     ON shares (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_retention   ON shares (retention_type, created_at DESC);

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO config VALUES ('max_shares',         '20000');
INSERT OR IGNORE INTO config VALUES ('keep_top_n',         '1000');
INSERT OR IGNORE INTO config VALUES ('cleanup_batch_size', '500');
