# NOVORA GAME — Claude Code Handoff

> この文書は次の Claude Code セッションが即座に作業を開始できるよう作成された。
> 推測は含まない。不明な項目は "Unknown" と記載。

---

## Project Overview

### プロジェクト概要
- ブラウザで動くゲームプラットフォーム「NOVORA GAME」
- 第1作として落ちもの合体パズル「Rollaxy」を提供中
- 独立開発者 (haruka1499) による個人プロジェクト
- URL: `https://novoragame.com/`

### 使用技術
| レイヤー | 技術 |
|---|---|
| フロントエンド | バニラ HTML + バニラ JS（フレームワーク・ビルドツール一切なし） |
| 物理エンジン | Matter.js（game.js に直接ロード） |
| バックエンド | Cloudflare Pages（静的配信） + Pages Functions（`src/` 以下の ES モジュール群） |
| DB | Cloudflare D1（SQLite）— バインド名 `DB` |
| KV | Cloudflare KV — バインド名 `RANKING_CACHE` |
| OGP画像生成 | `@cf-wasm/resvg` (SVG→PNG、`src/ogp.js` 内で実行) |
| 言語管理 | `i18n.js`（サイト共通）/ `lang.js`（ゲーム内）|
| アナリティクス | Google Analytics 4（gtag.js 直埋め込み、GTM不使用） |

### アーキテクチャ概要
```
静的ファイル（Pages 配信）
  ├─ index.html, style.css, i18n.js          ← サイト共通
  ├─ games/rollaxy/                           ← ゲーム本体
  │    ├─ index.html / config.js / lang.js
  │    ├─ game-player.js   ← GA4・player_id・display_name
  │    ├─ game-sfx.js      ← 効果音プール
  │    ├─ game-skills.js   ← スキル・ルーレット・連鎖報酬
  │    ├─ game-renderer.js ← canvas 描画
  │    ├─ game-share.js    ← シェア投稿・X シェア
  │    ├─ game.js          ← ゲームコア（物理・合体・ゲームオーバー）
  │    ├─ ranking/index.html                  ← ランキングページ
  │    └─ images/*.png                        ← 天体画像（12種）
  └─ profile/index.html                       ← プロフィール設定

src/（Cloudflare Worker — ES モジュール方式）
  ├─ constants.js  ← 共通定数（BODY_EMOJIS / 称号 / scoreWithComma など）
  ├─ ogp.js        ← OGP PNG 生成（handleOgp をエクスポート）
  └─ worker.js     ← API ハンドラー + ルーター（constants.js / ogp.js をインポート）
       ├─ POST /api/rollaxy/share
       ├─ GET  /api/rollaxy/ranking
       ├─ POST /api/rollaxy/player
       ├─ POST /api/admin/cleanup
       ├─ GET  /games/rollaxy/share/:id
       └─ GET  /games/rollaxy/ogp/:id
```

### フロントエンド script ロード順
```html
config.js → lang.js → game-player.js → game-sfx.js
  → game-skills.js → game-renderer.js → game-share.js → game.js
```
すべてグローバルスコープ共有（ES モジュールなし）。`game.js` の STATE 変数（`bmap`, `world`, `score` 等）は
ロード後に初めて参照されるため、先行してロードされるモジュールから関数定義だけ置いても問題ない。

---

## Current Task

### 完了済み（このセッションで実装・コミット済み）
- [x] サイト共通 i18n（`i18n.js`）— ja/en 切り替えが全ページに適用
- [x] 設定ボタン（⚙）の再押しで設定を閉じるトグル動作
- [x] 物理スリープ閾値調整（ゆっくり押しのけ動作を可能に）
- [x] 指定削除スキル後の天体浮き問題を修正（`wakeAllBodies()` 改修）
- [x] ランキングページ先頭に「自分のベスト」ヒーローカードを追加
- [x] OGP生成完了を `await` してからシェアボタン有効化（最大8秒タイムアウト）
- [x] OGP盤面描画を塗り色円から実際のPNG（円形クリップ）に変更
- [x] OGP右パネルを「スコア + 全期間TOP X% + 本日TOP Y%」にリデザイン
- [x] GA4カスタムイベント5種を追加（`game_start` / `game_over` / `retry_click` / `share_click` / `ranking_open`）
- [x] ファイル構成リファクタリング: game.js（2000行超）を 6 ファイルに分割
- [x] worker.js を constants.js / ogp.js / worker.js の 3 ファイルに分割

### 未完了・既知の残課題
- [ ] `wrangler.toml` の `database_name` が **staging** のまま（本番切り替え未実施）
- [ ] `ADMIN_SECRET` が `REPLACE_WITH_RANDOM_SECRET` のままでデプロイされている
- [ ] GA4 コンソールでカスタムディメンション未登録（`score`, `highest_tier`, `elapsed_sec`）
- [ ] GA4 で `share_click` / `ranking_open` をキーイベント設定する作業（コンソール側の手作業）
- [ ] OGP の KV キャッシュ（TTL 24h）に古い塗り色バージョンが残存している可能性

### 次にやるべきこと（優先度順）
1. `wrangler.toml` の本番 D1 バインディングに切り替え（`novora_game_staging` → `novora_game`）
2. `ADMIN_SECRET` を安全な値に変更して再デプロイ
3. GA4 コンソールでカスタムディメンション・キーイベントを設定

---

## Important Constraints

### 絶対に守るルール（変更すると確実にバグが再発する）
1. **`wakeAllBodies()` から `d.at = now` と速度ナッジを削除しない**  
   削除するとスキル使用後に天体が浮く（実証済みバグ）
2. **`_createShare()` の bmap 収集ループを `await` より後に移動しない**  
   `_startGameOverAnim()` が非同期で bmap を消すため、移動すると bmap が空になる
3. **`retryBtn` のイベントハンドラー内 `logEvent` を `init()` 内に移動しない**  
   初回ロード時も `init()` が呼ばれるため `retry_click` が誤送信される
4. **OGP の `<defs>` を shapes より後に出力しない**  
   SVG 仕様上、`clipPath` は参照より前に定義が必要（`src/ogp.js` の `buildOgpBoardCircles` 参照）

### 変更は判断次第（経緯を理解した上で）
- **`SLEEP_INTERVAL` / `SLEEP_NET_DISP2` / `SLEEP_GRACE_MS` の数値変更**: チューニング済み。変更は再チューニングを意味する
- **`novora_lang` キー名**: 別のキーへの移行は設計次第でありうる。`rollaxy_lang`（旧）に戻すのは論外

### ビルドルール
- **フロントエンド**: ビルドツール・フレームワーク導入禁止。バニラHTMLのまま
- **Worker**: ES モジュール（`import`/`export`）を使用。wrangler がバンドルするので複数ファイル分割可能
- `logEvent()` を通じてのみ GA4 イベントを送信（直接 `gtag()` 呼び出しを増やさない）

### 技術的制約
- Cloudflare Pages Functions は **Cron Trigger 非対応**。クリーンアップは手動HTTP呼び出し
- `@cf-wasm/resvg` は Latin フォントのみ内蔵。日本語テキストは SVG 内に直接書けないため PNG バッジ画像で対応（現在バッジ画像は未作成 → 英語フォールバック中）
- D1 は Cloudflare Workers Runtime で動く。通常の SQLite ドライバは使用不可

### パフォーマンス・セキュリティ方針
- OGP PNG は KV に 86400秒（24h）キャッシュ
- ランキング API は KV に 60秒キャッシュ
- `player_id` は `guest_{12文字英数字}` 形式。サーバー側で `/^[a-z]+_[a-z0-9]{8,28}$/` バリデーション
- スコアの粗い整合性チェック（`MIN_SCORE_FOR_TIER` 配列）はサーバー側で実施済み

---

## Naming Conventions

### localStorage キー（統一済み）
| キー | 内容 |
|---|---|
| `novora_lang` | 言語設定 (`ja`/`en`) |
| `novora_player_id` | ゲストID (`guest_xxxxxxxxxxxx`) |
| `novora_display_name` | 表示名（ランキング表示用） |
| `novora_share_ids` | 自分のシェアID一覧（JSON配列、最大50件） |
| `novora_best_share_id` | ベストスコア時のシェアID |
| `novora_best_score` | ベストスコア（数値の文字列） |
| `korokoro_hi` | ゲーム内ハイスコア（**旧キー、変更未実施**） |

### GA4 イベント命名規則
- スネークケース: `game_start`, `game_over`, `retry_click`, `share_click`, `ranking_open`
- パラメータは必ず `game_id: 'rollaxy'` を含める
- bool 値は `1`/`0` で送る（GA4 の型変換問題を避けるため）

### JS 関数・変数
- プライベートヘルパーはアンダースコアプレフィックス: `_createShare()`, `_pendingShareId`, `_highestTier`
- GA4 送信は必ず `logEvent(name, params)` 経由（`game-player.js` で定義）

### API 命名
- ゲーム固有: `/api/rollaxy/*`
- 管理系: `/api/admin/*`
- ページ系: `/games/rollaxy/share/:id`, `/games/rollaxy/ogp/:id`

---

## Important Design Decisions

### カスタムスリープシステム（Matter.js の組み込みスリープと共存）
- Matter.js の組み込みスリープ（`enableSleeping: true`）は振動は止めるが「ゆっくり押しのけ」も止めてしまう
- カスタムシステム: 250ms ウィンドウで net 変位 < 0.5px の場合のみ強制スリープ → 高周波振動と低速移動を区別
- `wakeAllBodies()` でスキル使用後に全天体を起こす際、Matter.js 組み込みが即再スリープするのを `d.at = now`（猶予リセット）と速度ナッジ（`+0.15px/frame`）で防ぐ

### OGP 生成フロー
- シェアボタン有効化の条件: POST 成功 → OGP fetch 完了（最大8秒）→ `_restoreShareButton()`
- 8秒タイムアウトで OGP が間に合わなくてもシェア自体は可能（URL は有効）
- KV キャッシュ miss → D1 → resvg → KV put → レスポンス の順で毎回フレッシュ生成

### player_id のプロバイダープレフィックス方式
- 現在: `guest_xxxxxxxxxxxx`
- 将来のログイン統合時は `google_<uid>` / `discord_<uid>` に上書きするだけで DB の既存レコードはそのまま使える

### 採用しなかった案
- Google Tag Manager: シンプルな構成には過剰。直 gtag.js で十分
- Cloudflare Workers（単独）: Pages Functions に統合した方が D1/KV バインディングが簡単
- サブフォルダステージング（`/test/novora/`）: 全パスが絶対パスのため不可。`develop` ブランチ → `staging.novoragame.com` を推奨

---

## Relevant Files

| ファイル | 役割 |
|---|---|
| `src/constants.js` | 共通定数（`BODY_EMOJIS`, `BODY_RADII`, 称号関数, `scoreWithComma` など）。`ogp.js` / `worker.js` 双方からインポート |
| `src/ogp.js` | OGP PNG 生成。`handleOgp` をエクスポート。`@cf-wasm/resvg` と `constants.js` に依存 |
| `src/worker.js` | API ハンドラー + ルーター。`constants.js` / `ogp.js` をインポート |
| `games/rollaxy/game.js` | ゲームコア（物理・合体・ゲームオーバー・ループ・設定UI） |
| `games/rollaxy/game-player.js` | `logEvent` / `getPlayerId` / `getDisplayName` / `addMyShareId` |
| `games/rollaxy/game-sfx.js` | 効果音プール・`playMergeSound` |
| `games/rollaxy/game-skills.js` | スキル（爆弾・強化・削除）・ルーレット・連鎖報酬 |
| `games/rollaxy/game-renderer.js` | `draw` / `paintBody` / `paintBomb` / `drawBodyBar` |
| `games/rollaxy/game-share.js` | `_createShare` / `shareToX`（シェア投稿 + X シェア） |
| `games/rollaxy/config.js` | BODIES定義・物理パラメータ・`GAME_VERSION`（現在 `1`） |
| `games/rollaxy/lang.js` | ゲーム内テキストの ja/en 管理（`novora_lang` キーを使用） |
| `i18n.js` | サイト共通 i18n。`TG(key)` / `setGlobalLang()` / `applyGlobalLang()` |
| `style.css` | サイト共通 CSS変数（`--accent: #7c5cfc`, `--accent2: #3ecfff`, `--bg: #080c14` 等） |
| `wrangler.toml` | Cloudflare バインディング設定（**現在 staging DB を向いている**） |
| `games/rollaxy/ranking/index.html` | ランキングページ。自分のベストカード + タブ切り替え + GA4 `ranking_open` |
| `profile/index.html` | 表示名設定・ベストスコア・シェア履歴表示 |
| `games/rollaxy/images/*.png` | 天体画像 12種（dust / asteroid / moon / earth / jupiter / sun / red_giant / white_dwarf / neutron_star / black_hole / galaxy / galaxy_cluster） |
| `db/schema.sql` | D1 スキーマ定義 |

---

## Current Problems

### 未解決
- **wrangler.toml が staging DB を向いている**: 本番デプロイ時に `novora_game_staging` → `novora_game` への切り替えが必要。Production 環境と Preview 環境でバインディングを分ける設定が wrangler.toml に未記述
- **`ADMIN_SECRET` がプレースホルダー**: `POST /api/admin/cleanup` の認証が事実上無効。Cloudflare Dashboard の環境変数で上書き必要

### 技術的負債
- Measurement ID `G-FFF4H3EVV8` が 8 ファイルにハードコード（`index.html` / 各ページ / `src/worker.js`）
- ハイスコアの localStorage キーが `korokoro_hi`（旧称）のまま。`novora_hi` への移行未実施
- 称号バッジ画像（`games/rollaxy/images/badges/title_0.png` 〜 `title_6.png`）が未作成。OGP では英語フォールバック（`TITLE_EN` 配列）で表示中
- `debug.html` / `image-adjuster.html` に GA4 コードなし（意図的か要確認）

### 不安定箇所
- OGP の KV キャッシュは 24h。本日のランク統計は生成時点の値で固定（リアルタイム更新なし）
- `TODAY TOP` の計算は「過去24時間」ベース（UTC基準、JST日付とは一致しない）

---

## Notes For Next Session

### 最初に確認すべきこと
1. `wrangler.toml` が staging を向いていることを把握してから作業開始する
2. `git log --oneline -5` でコミット状態を確認する
3. 本番反映作業は必ず Cloudflare Dashboard で Production バインディングが正しいか確認してから

### 禁止アクション（AIが誤りやすいポイント）
- **`wakeAllBodies()` から `d.at = now` を削除しない**（スキル後に天体が浮く）
- **`_createShare()` の bmap 収集を `await` の後に移動しない**（bmap が空になる）
- **`retryBtn` ハンドラー内の `logEvent` を `init()` 内に移動しない**（初回誤送信）
- **OGP の `<defs>` を shapes より後に出力しない**（SVG clipPath の参照順序制約）
- **`novora_lang` を `rollaxy_lang` に戻さない**（旧キーは削除済み）

### 開発フロー
```
① develop ブランチで作業（未設定の場合は main でも可）
② git add + commit + push
③ Cloudflare Pages が自動デプロイ
④ staging.novoragame.com で確認（staging DB 使用）
⑤ 問題なければ main にマージ → novoragame.com に反映
```

---

## Suggested First Prompt

次のセッションの最初のプロンプトとして、以下をそのまま貼り付ける:

```
このリポジトリは NOVORA GAME（novoragame.com）です。
handoff.md を読んで現在の状態を把握してください。

現在の作業ブランチ: main
wrangler.toml は staging DB（novora_game_staging）を向いています。

【今回やりたいこと】
（← ここに具体的なタスクを記入）

作業前に以下を確認してください:
- SLEEP_INTERVAL / SLEEP_NET_DISP2 を変更しない
- novora_lang キーを変更しない
- retryBtn の logEvent は init() 内に移動しない
```
