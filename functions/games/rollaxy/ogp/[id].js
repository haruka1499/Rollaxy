'use strict';

// GET /games/rollaxy/ogp/:id — OGP PNG 画像を動的生成
//
// 処理フロー:
//   1. KV キャッシュをチェック（TTL 24h）
//   2. D1 からシェアデータを取得
//   3. フォント・称号バッジを静的アセットから読み込み
//   4. SVG を組み立て → @cf-wasm/resvg で PNG に変換
//   5. KV にキャッシュして返却
//
// フォント: games/rollaxy/fonts/SpaceMono-Regular.ttf を配置すると使用される。
//   なければテキスト要素は非表示になるが、円とバッジ画像は正常に描画される。
//
// 称号バッジ: games/rollaxy/images/badges/title_0.png 〜 title_6.png を配置すると
//   OGP 画像内に合成される。なければ英語 ASCII フォールバックテキストを使用。

import { Resvg } from '@cf-wasm/resvg/workerd';

const SITE_URL = 'https://novoragame.com';
const OGP_W   = 1200;
const OGP_H   = 630;

// 称号レベル → 英語テキスト（フォント/バッジがない場合のフォールバック）
const TITLE_EN = [
  'Space Wanderer',
  'Star Explorer',
  'Planet Pioneer',
  'Solar Sovereign',
  'Galaxy Explorer',
  'Cosmic Ruler',
  'Cluster Creator',
];

// 称号レベルを計算（share/[id].js の getTitle と対称）
function getTitleLevel(score, highestTier) {
  if (highestTier >= 11) return 6;
  if (score >= 2000)     return 5;
  if (score >= 1000)     return 4;
  if (score >=  600)     return 3;
  if (score >=  300)     return 2;
  if (score >=  100)     return 1;
  return 0;
}

// ArrayBuffer → base64 (大きなバッファでもスタックオーバーフローしないよう分割処理)
function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// フォントを静的アセットから読み込む
// games/rollaxy/fonts/SpaceMono-Regular.ttf を配置してください（Google Fonts から DL可）
async function loadFont(env) {
  try {
    const res = await env.ASSETS.fetch(
      new Request(`${SITE_URL}/games/rollaxy/fonts/SpaceMono-Regular.ttf`)
    );
    if (res.ok) return await res.arrayBuffer();
  } catch (_) {}
  return null;
}

// 称号バッジ PNG を base64 data URL として返す
// games/rollaxy/images/badges/title_N.png を配置してください
async function loadBadge(env, level) {
  try {
    const res = await env.ASSETS.fetch(
      new Request(`${SITE_URL}/games/rollaxy/images/badges/title_${level}.png`)
    );
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${toBase64(buf)}`;
  } catch (_) {
    return null;
  }
}

const BODY_COLORS = [
  '#b0a090','#807060','#d0c8b0','#3388cc','#d4a870','#ffcc00',
  '#cc2200','#c8d8ff','#2244cc','#110022','#7744cc','#aa44ff',
];
const BODY_RADII = [12,18,25,33,42,51,61,70,79,88,97,106];

// 盤面の円要素 (左パネル用)
function buildBoardCircles(bodies) {
  // ボード全体 (400×700) を左パネル (480×630) に収まるようスケール
  const scaleX = 460 / 400;
  const scaleY = 590 / 700;
  const scale  = Math.min(scaleX, scaleY);
  const offX   = (460 - 400 * scale) / 2 + 10;
  const offY   = (OGP_H - 700 * scale) / 2;

  // ボックス背景
  const bx = (offX + 18 * scale).toFixed(1);
  const by = (offY + 168 * scale).toFixed(1);
  const bw = ((382 - 18) * scale).toFixed(1);
  const bh = ((688 - 168) * scale).toFixed(1);
  let out = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#0c0720" stroke="#7744bb" stroke-width="1.5"/>`;

  for (const b of bodies) {
    const tier = Math.max(0, Math.min(11, b.tier));
    const cx   = (offX + b.x * scale).toFixed(1);
    const cy   = (offY + b.y * scale).toFixed(1);
    const r    = (BODY_RADII[tier] * scale).toFixed(1);
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BODY_COLORS[tier]}" opacity="0.9"/>`;
  }
  return out;
}

// 数字をカンマ区切りにする（Intl 非依存）
function fmtScore(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function buildOgpSVG(share, rank, fontBuffer, badgeDataUrl) {
  const { score, highest_body_tier, snapshot_payload } = share;
  const titleLevel = getTitleLevel(score, highest_body_tier);

  let bodies = [];
  try { bodies = JSON.parse(snapshot_payload).bodies ?? []; } catch (_) {}

  const boardSVG   = buildBoardCircles(bodies);
  const scoreStr   = fmtScore(score);
  const rankStr    = `#${rank} All Time`;
  const hasFont    = !!fontBuffer;
  const fontFamily = hasFont ? 'SpaceMono' : 'monospace';

  // フォントを resvg options で渡すため SVG 内には @font-face を書かない
  // SVG の font-family 属性だけ指定し、resvg オプションにバッファを渡す

  // バッジ or ASCII フォールバック
  const badgeEl = badgeDataUrl
    ? `<image x="580" y="385" width="360" height="75" href="${badgeDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="760" y="450" font-family="${fontFamily}" font-size="28" fill="#cc99ff" text-anchor="middle">${TITLE_EN[titleLevel]}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OGP_W}" height="${OGP_H}">
  <!-- 背景 -->
  <rect width="${OGP_W}" height="${OGP_H}" fill="#060412"/>

  <!-- 星 (装飾) -->
  <circle cx="55"  cy="45"  r="1.5" fill="#fff" opacity="0.6"/>
  <circle cx="180" cy="110" r="1"   fill="#fff" opacity="0.4"/>
  <circle cx="330" cy="28"  r="2"   fill="#fff" opacity="0.5"/>
  <circle cx="820" cy="75"  r="1.5" fill="#fff" opacity="0.5"/>
  <circle cx="1100" cy="38" r="1"   fill="#fff" opacity="0.4"/>
  <circle cx="930" cy="555" r="1.5" fill="#fff" opacity="0.6"/>
  <circle cx="1060" cy="605" r="1"  fill="#fff" opacity="0.3"/>
  <circle cx="700" cy="20"  r="1"   fill="#fff" opacity="0.5"/>

  <!-- 左パネル背景 -->
  <rect x="0" y="0" width="480" height="${OGP_H}" fill="#0a0818"/>

  <!-- 盤面プレビュー -->
  ${boardSVG}

  <!-- 仕切り線 -->
  <line x1="480" y1="40" x2="480" y2="${OGP_H - 40}" stroke="#7744bb" stroke-width="1" opacity="0.4"/>

  <!-- ゲームタイトル -->
  <text x="760" y="105" font-family="${fontFamily}" font-size="58" font-weight="bold"
        fill="#7744cc" text-anchor="middle" letter-spacing="10">ROLLAXY</text>

  <!-- Score ラベル -->
  <text x="760" y="220" font-family="${fontFamily}" font-size="26"
        fill="#554477" text-anchor="middle" letter-spacing="3">SCORE</text>

  <!-- スコア値 -->
  <text x="760" y="340" font-family="${fontFamily}" font-size="100" font-weight="bold"
        fill="#ffffff" text-anchor="middle">${scoreStr}</text>

  <!-- 称号バッジ or ASCII フォールバック -->
  ${badgeEl}

  <!-- ランク -->
  <text x="760" y="515" font-family="${fontFamily}" font-size="26"
        fill="#665588" text-anchor="middle">${rankStr}</text>

  <!-- 区切り線 -->
  <line x1="560" y1="548" x2="960" y2="548" stroke="#2a1a44" stroke-width="1"/>

  <!-- ブランディング -->
  <text x="760" y="600" font-family="${fontFamily}" font-size="20"
        fill="#3a2455" text-anchor="middle" letter-spacing="5">NOVORA GAME</text>
</svg>`;
}

export async function onRequestGet({ params, env }) {
  const id = params.id;
  if (!id || !/^[a-zA-Z0-9]{8,12}$/.test(id)) {
    return new Response('Not found', { status: 404 });
  }

  // KV キャッシュ確認
  const cacheKey = `ogp:${id}`;
  try {
    const cached = await env.RANKING_CACHE.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
      });
    }
  } catch (_) {}

  // D1 からシェアデータ取得
  const row = await env.DB.prepare(
    `SELECT score, highest_body_tier, snapshot_payload FROM shares WHERE id = ?`
  ).bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });

  // ランク取得
  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score > ?`
  ).bind(row.score).first();
  const rank = (rankRow?.cnt ?? 0) + 1;

  // フォントとバッジを並列取得
  const titleLevel = getTitleLevel(row.score, row.highest_body_tier);
  const [fontBuffer, badgeDataUrl] = await Promise.all([
    loadFont(env),
    loadBadge(env, titleLevel),
  ]);

  // SVG 生成
  const svg = buildOgpSVG(row, rank, fontBuffer, badgeDataUrl);

  // @cf-wasm/resvg で PNG レンダリング
  // fontBuffer がある場合はオプションで渡す（SVG 内の @font-face は使わない）
  const resvgOpts = {
    fitTo:  { mode: 'width', value: OGP_W },
    ...(fontBuffer ? { font: { fontBuffers: [fontBuffer], loadSystemFonts: false } } : {}),
  };

  let png;
  try {
    const resvg  = await Resvg.async(svg, resvgOpts);
    const result = resvg.render();
    png = result.asPng();
  } catch (err) {
    console.error('resvg render failed:', err);
    return new Response('Image generation failed', { status: 500 });
  }

  // KV にキャッシュ（24h）
  try {
    await env.RANKING_CACHE.put(cacheKey, png, { expirationTtl: 86400 });
  } catch (_) {}

  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}
