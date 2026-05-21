# NOVORA GAME — アーキテクチャ概要（ChatGPT 共有用）

## プロジェクト概要

- ブラウザゲーム「Rollaxy」（落下合成パズル）を含むゲームポータルサイト
- URL: https://novoragame.com
- ホスティング: Cloudflare Pages + Workers
- フロントエンド: Vanilla JS（ビルドツールなし・ES モジュールなし）
- 物理エンジン: Matter.js（CDN 経由）
- バックエンド: Cloudflare Workers（ES モジュール, wrangler でビルド）
- DB: Cloudflare D1（SQLite）
- キャッシュ: Cloudflare KV
- OGP 画像生成: @cf-wasm/resvg（WASM）

---

## ファイル構成

```
/
├── src/
│   ├── worker.js       # メインルーター + API ハンドラ (~310行)
│   ├── constants.js    # 共有定数（天体定義・称号など）
│   └── ogp.js          # OGP PNG 生成（SVG → resvg → PNG）
├── games/rollaxy/
│   ├── index.html      # ゲーム本体
│   ├── config.js       # ゲームバランス設定
│   ├── lang.js         # 多言語（ja / en / zh）
│   ├── game-player.js  # プレイヤーID・表示名管理
│   ├── game-sfx.js     # 効果音（HTMLAudioElement プール）
│   ├── game-skills.js  # スキル（爆弾・強化・削除）
│   ├── game-renderer.js# Canvas 描画
│   ├── game-share.js   # シェア API 呼び出し・X シェア
│   ├── game.js         # 物理エンジン・ゲームループ（~1000行）
│   └── ranking/index.html # ランキングページ
├── db/schema.sql       # D1 スキーマ
└── wrangler.toml       # Cloudflare 設定
```

---

## API エンドポイント（Worker）

| Method | Path | 説明 |
|--------|------|------|
| POST | /api/rollaxy/share | ゲーム結果保存・シェアURL発行 |
| GET  | /api/rollaxy/ranking | ランキング取得（KVキャッシュ60秒） |
| POST | /api/rollaxy/player | 表示名更新 |
| POST | /api/admin/cleanup | 古レコード削除（ADMIN_SECRET認証） |
| GET  | /games/rollaxy/share/:id | シェアページHTML生成 |
| GET  | /games/rollaxy/ogp/:id | OGP PNG生成（KVキャッシュ24時間） |
| *    | その他 | 静的ファイル配信（env.ASSETS） |

---

## DB スキーマ

```sql
-- ゲーム結果
CREATE TABLE shares (
  id                TEXT PRIMARY KEY,  -- nanoid 10文字
  game_id           TEXT,              -- 'rollaxy'
  version           INTEGER,
  score             INTEGER,
  highest_body_tier INTEGER,           -- 0〜11
  snapshot_payload  TEXT,              -- JSON: { bodies, elapsed_ms, drop_count }
  ui_lang           TEXT,              -- 'ja' / 'en' / 'zh'
  created_at        INTEGER,           -- UNIX秒
  retention_type    TEXT,              -- 'normal' / 'ranked'
  player_id         TEXT,              -- guest_xxx 形式
  display_name      TEXT
);

-- プレイヤー（schema.sql 未定義、ALTER で追加済み）
CREATE TABLE players (
  player_id    TEXT PRIMARY KEY,
  display_name TEXT,
  updated_at   INTEGER
);

-- システム設定
CREATE TABLE config (
  key TEXT PRIMARY KEY, value TEXT
  -- max_shares=20000, keep_top_n=1000, cleanup_batch_size=500
);
```

---

## localStorage（クライアント）

| キー | 内容 |
|------|------|
| novora_player_id | guest_{12文字} — 永続ゲストID |
| novora_display_name | 表示名（最大15文字） |
| novora_lang | 選択言語（明示保存のみ） |
| novora_share_ids | 自分の share ID 最大50件 |
| novora_best_score | ローカルベストスコア |
| novora_best_share_id | ベストスコアの share ID |
| korokoro_hi | ゲーム内ハイスコア（旧キー名のまま残存） |
| rollaxy_sfx_vol | 効果音音量 |
| novora_hint_shown | 初回ヒント表示済みフラグ |
| novora_name_set | 表示名を明示保存済みフラグ |

---

## 通信フロー

```
[ゲームプレイ中]
Client ←→ localStorage          # スコア・設定の読み書き
Client → gtag.js → GA4          # game_start / game_over / share_click

[ゲームオーバー時]
Client → POST /api/rollaxy/share → D1（shares + players upsert）
Client ← { id, url }
Client → GET /games/rollaxy/ogp/:id  # OGP をウォームアップ（await 8秒）
Worker → ASSETS（フォント + 天体PNG取得）→ resvg → KV キャッシュ

[ランキングページ]
Client → GET /api/rollaxy/ranking?period=all&limit=100
Worker → KV（HIT: 即返却 / MISS: D1クエリ → KV保存）

[表示名変更時]
Client → POST /api/rollaxy/player → D1 players + KV ランキングキャッシュ削除
```

---

## セキュリティ上の問題点

### 現在改ざん可能な箇所

1. **スコア**: JS グローバル変数。DevTools から任意の値を POST 可能
   - サーバー側チェック: `0〜999999` の範囲 + `MIN_SCORE_FOR_TIER[tier]` との整合のみ
2. **highest_body_tier**: 同様にクライアント生成値
3. **snapshot_payload (bodies配列)**: 座標・tier の検証なし
4. **player_id**: localStorage を書き換えて他人になりすまし可能
5. **novora_best_score**: localStorage を書き換えるとランキングページの「あなたのベスト」が偽表示される

### 将来リスク
- 広告報酬システム追加時に bot による大量投稿が容易
- 上位%表示が汚染されるとゲームの信頼性が損なわれる

---

## 現在の技術的負債

| 項目 | 詳細 |
|------|------|
| localStorage キー名 | `korokoro_hi`（旧ゲームタイトル）のまま |
| schema.sql 不完全 | players テーブルが未定義（ALTER で手動追加済み） |
| Matter.js が外部 CDN | CDN 障害でゲームが完全停止するリスク |
| 定数の二重定義 | ranking/index.html に constants.js と同じ関数がコピーされている |
| ADMIN_SECRET | wrangler.toml にプレースホルダーのまま残っている |
| wrangler.toml の database_name | `novora_game_staging`（staging DB を参照したまま） |

---

## 今後の拡張に向けた構成提案

### Phase 1（今すぐ・コスト0）
- Matter.js を自己ホスト（/vendor/matter.min.js）
- Cloudflare WAF でレート制限（/api/rollaxy/share を 10回/分/IP）
- ADMIN_SECRET を本物の値に変更
- database_name を production に切り替え
- schema.sql に players テーブルを追記

### Phase 2（3〜6ヶ月後）
- Workers にセッショントークン発行（GET /api/rollaxy/session）
- シェア POST 時のトークン必須化
- スコア × drop_count × elapsed_ms の整合チェック追加
- novora_best_score をサーバー側で管理

### Phase 3（大規模拡張時）
- Supabase（PostgreSQL + Auth）に移行
- OGP 生成を R2 + Node.js（sharp）サービスに分離
- 広告報酬システム用の rewards テーブル追加
- Redis（Upstash）でレートリミット・セッション管理

---

## Cloudflare 固有実装（移植時の注意点）

| 依存 | 代替（Node.js） |
|------|----------------|
| env.DB (D1) | PostgreSQL / better-sqlite3 |
| env.RANKING_CACHE (KV) | Redis / Upstash |
| env.ASSETS.fetch() | fs.readFile() |
| @cf-wasm/resvg/workerd | @resvg/resvg-js または sharp |
| export default { fetch } | Express / Hono |

移植難易度: 低〜中（ロジックは標準 JS、環境依存は薄い）
