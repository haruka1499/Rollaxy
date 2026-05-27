# CLAUDE.md — NOVORA GAME 開発コンテキスト

Claude Code が自動で読み込む開発コンテキスト。行動規範とプロジェクト固有ルールを統合。

---

## 行動規範

### 実装前に考える
- 仮定は明示する。複数の解釈があれば選択肢を提示する（黙って選ばない）
- 不明点があれば止まって質問する。実装後の修正より事前確認の方が安い

### シンプルさ優先
- 求められた機能だけ作る。予防的な抽象化・設定化・柔軟性は不要
- 200行で書いたコードが50行で書けるなら書き直す

### 最小変更の原則
- 触るのは依頼箇所だけ。関係ない整形・コメント修正・リファクタはしない
- 既存コードのスタイルに合わせる（自分なら別の書き方をするとしても）
- 自分の変更で生じた不要コードは削除する。既存の不要コードは報告だけする

### ゴール駆動
- 複数ステップのタスクは先に手順を箇条書きで示す
- 「どうすれば正しいとわかるか」を自分で定義してから実装・検証する

---

## 事業概要

ブラウザゲームを継続リリースし広告収入で収益化する一人運営事業。
コーディング・翻訳・SNS運用はすべてAIで自動化する。
インフラ: Cloudflare Workers + D1 (DB) + KV (キャッシュ) + Nginx (静的配信 + HTTPS)

---

## Rollaxy — 落下合成ゲーム（公開済み）

URL: `https://novoragame.com/games/rollaxy/`

### ファイル構成
```
games/rollaxy/
  index.html           ← UI・オーバーレイ構造（スタート/ゲームオーバー/設定/実績）
  game.js              ← メインループ・物理演算 (Matter.js)
  game-renderer.js     ← Canvas描画（論理 400×700px、CSS transform でスケール）
  game-skills.js       ← スキルロジック（爆弾・強化・削除）
  game-achievements.js ← 実績UI・トースト・サーバー同期
  achievement-data.js  ← 実績定義 (ACH_CATS / ACH_GROUPS)
  game-sfx.js          ← 効果音
  game-share.js        ← X シェア・盤面キャプチャ
  game-player.js       ← プレイヤー名・表示名管理
  config.js            ← 天体データ・物理パラメータ
  lang.js              ← 多言語対応 (ja/en/zh)
  style.css
  ranking/             ← ランキングページ（Cloudflare Workers API）
```

### 主要システム
- **物理**: Matter.js。論理サイズ 400×700px を CSS transform でスケール
- **ランキング**: Cloudflare Workers (`/api/ranking`) + D1 + KV キャッシュ。デフォルト表示は daily
- **GA4**: `gtag('event', ...)` で game_start / game_over / merge / chain イベントを計測
- **実績**: `ACH_GROUPS`（表示グループ5種）と `ACH_CATS`（論理カテゴリ）を分離。
  localStorage 永続化 + サーバー同期
- **多言語**: `lang.js` の `LANGS` オブジェクト。`T(key)` で取得。`data-i18n` 属性で自動更新
- **OGP**: `index.html` に og:title / og:image / twitter:card を配置

### 実績データの慣習
- フィールド命名: `nameJa/nameEn/nameZh`, `condJa/condEn/condZh`, `subJa/subEn/subZh`
- `ACH_GROUPS` でUI表示グループを定義 → `ACH_CATS` の各エントリに `group` プロパティで紐づける
  - スコア系 → `group: 'score'` / 合成系 → `group: 'merge'` / 連鎖系 → `group: 'chain'`
  - スキル連鎖系 → `group: 'skill_chain'` / 同時存在系 → `group: 'sim'`
- トーストには `condJa/condEn/condZh`（達成条件）を表示（sub フレーバーテキストではない）

### 簡易チート対策方針（将来の課金・ランキング保護の前提）
クライアント側（localStorage / JS）は原理的に改ざん可能なため、**完全防御は目指さない**。
目的は「カジュアルな改ざんの抑止」と「将来サーバー検証へ繋ぐフック」の確保。本丸の enforcement は
将来サーバー側（スコア妥当性・課金レシート検証）で行う。現状の最低限の仕組み:

- **セーブ整合性署名**: メタ進行(`metaState`)を保存するたびに FNV-1a チェックサム（`_metaSig()`,
  `CFG.META.ANTICHEAT.SIG_SALT` でソルト）を `META_SIG` に書き込む。読込時に再計算して照合し、
  不一致なら `metaState._suspect = true` を立てて `console.warn`。**破壊的リセットはしない**
  （正規ユーザーのセーブ破損を誤って消さないため）。
- **検知ログ送出**: 不一致を検知したら `POST /api/rollaxy/report`（worker.js `handleReport`）へ
  fire-and-forget でビーコン送信。サーバーは `console.warn('[anticheat] …')` で **Cloudflare ログ**
  （`wrangler tail` / ダッシュボード）へ出力するのみ（永続化は必要時に Logpush）。多重送信は
  クライアント側 `_reportSent` で抑止。現状はログ観測が目的で、能動的ペナルティ（獲得停止等）は未実装。
- **時計操作対策**（オフライン報酬）: `settleEnergy()` で経過時間 `elapsed` が負（巻き戻し）なら 0、
  進め過ぎは `CFG.META.IDLE.CAP_SEC`（12h）で頭打ち。報酬は「精算直前レート × 時間」のシンプル計算。
- **値のサニタイズ**: 読込時に数値は `_metaNum()` で有限値チェック（`Infinity`/`NaN`/文字列注入は既定値へ）、
  リソースは `Math.max(0, …)`、レベルは `Math.min/max/floor` でクランプ。
- 新しい永続値を追加する際は **必ず `_metaSig()` の対象に含める**（署名の意味が薄れるのを防ぐ）。

---

## 農場×文明発展ゲーム — 開発中

### コンセプト
作物タイマー収穫 + テックツリー研究 + 時代進行（原始 → 農業革命 → 産業革命 → 現代 → 未来）。
放置中も進行。広告は任意視聴のみ（強制なし）。

### ファイル構成
```
farm-civ-game/
  index.html  config.js  game.js  ui.js  style.css
```

### ゲームループ
- 長期（数時間〜日単位）: 作物育成・文明発展 → 毎日ログイン動機
- 中期（数分〜数時間）: テックツリー研究・農場スロット拡張
- 短期（1〜5分）: 収穫・種まき・広告ボーナス

### MVP スコープ
- ✅ v1: 農場スロット・タイマー収穫・テックツリー（5〜6段階）・3時代・広告ボーナス
- ❌ v2以降: タワーディフェンス・採掘・リアルタイムランキング

### 技術方針
- 数値は `config.js` に集約。`game.js` はconfig参照のみ
- リソースは `{ coins, wood, stone, ... }` 構造（採掘追加に備える）
- タイマーは `setInterval` でなく `Date.now()` 差分で管理（ズレ対策）
- 広告: 開発中は `simulateAd()` でモック。本番は AdSense / AdMob SDK

### 保存データ骨格 (localStorage)
```js
{ version, coins, resources: { coins }, currentEra, unlockedTechs[],
  slots[{ id, cropId, plantedAt, harvested }], lastSaved, dailyBonus, stats }
```

---

## 共通技術方針

- **言語**: Vanilla JS / HTML / CSS（フレームワーク・ライブラリ不使用）
- **SEO**: 各ゲームの `index.html` に title / meta description / OGP / JSON-LD (VideoGameスキーマ) を配置
- **テキスト**: i18n オブジェクトまたは config.js に集約（後でAIで翻訳生成）
- **デプロイ**: Nginx 静的配信 + Cloudflare (HTTPS・キャッシュ)
