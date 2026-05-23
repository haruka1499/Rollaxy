-- Rollaxy Share & Ranking — D1 スキーマ
--
-- ⚠️  DB名について
--   wrangler.toml の database_name が "novora_game_staging" のままだが、
--   これが実際の本番DBとして機能している（名前と実態が乖離している状態）。
--   D1 は database_name をあとから変更する公式手段がない。
--   binding 名（コード上の "DB"）は変わらないため動作に支障はなく、
--   無理に変える必要もない。見た目だけの問題として放置で OK。
--
-- ✅  このファイルの適用コマンド（achievements テーブル追加時など）:
--   wrangler d1 execute novora_game_staging --file=db/schema.sql
--   （database_name に合わせて "novora_game_staging" を指定すること）

CREATE TABLE IF NOT EXISTS shares (
  id                TEXT    PRIMARY KEY,
  game_id           TEXT    NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  score             INTEGER NOT NULL,
  highest_body_tier INTEGER NOT NULL,
  snapshot_payload  TEXT    NOT NULL,
  ui_lang           TEXT    NOT NULL DEFAULT 'ja',
  created_at        INTEGER NOT NULL,
  retention_type    TEXT    NOT NULL DEFAULT 'normal',
  player_id         TEXT,
  display_name      TEXT
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

-- プレイヤー表示名管理（game_id 横断で共有）
-- player_id: guest_{12文字英数字} または将来の auth プロバイダー形式
CREATE TABLE IF NOT EXISTS players (
  player_id    TEXT    PRIMARY KEY,
  display_name TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- 実績解除記録（ゲームごとではなく player_id 単位で管理）
CREATE TABLE IF NOT EXISTS achievements (
  player_id   TEXT    NOT NULL,
  ach_id      TEXT    NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, ach_id)
);
CREATE INDEX IF NOT EXISTS idx_ach_player ON achievements (player_id);
