// GET /games/rollaxy/ogp/:id — OGP PNG 画像生成 (@cf-wasm/resvg)

import { Resvg } from '@cf-wasm/resvg/workerd';

const SITE_URL = 'https://novoragame.com';
const ID_RE    = /^[a-zA-Z0-9]{8,12}$/;

const BODY_COLORS = ['#b0a090','#807060','#d0c8b0','#3388cc','#d4a870','#ffcc00',
                     '#cc2200','#c8d8ff','#2244cc','#110022','#7744cc','#aa44ff'];
const BODY_RADII  = [12,18,25,33,42,51,61,70,79,88,97,106];

const TITLE_EN = [
  'Space Wanderer','Star Explorer','Planet Pioneer',
  'Solar Sovereign','Galaxy Explorer','Cosmic Ruler','Cluster Creator',
];

function getTitleLevel(score, highestTier) {
  if (highestTier >= 11) return 6;
  if (score >= 2000)     return 5;
  if (score >= 1000)     return 4;
  if (score >=  600)     return 3;
  if (score >=  300)     return 2;
  if (score >=  100)     return 1;
  return 0;
}

function scoreWithComma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function loadFont(env) {
  try {
    const res = await env.ASSETS.fetch(
      new Request(`${SITE_URL}/games/rollaxy/fonts/SpaceMono-Regular.ttf`)
    );
    if (res.ok) return await res.arrayBuffer();
  } catch (_) {}
  return null;
}

async function loadBadge(env, level) {
  try {
    const res = await env.ASSETS.fetch(
      new Request(`${SITE_URL}/games/rollaxy/images/badges/title_${level}.png`)
    );
    if (!res.ok) return null;
    return `data:image/png;base64,${toBase64(await res.arrayBuffer())}`;
  } catch (_) { return null; }
}

function buildOgpBoardCircles(bodies) {
  const scale = Math.min(460 / 400, 590 / 700);
  const offX  = (460 - 400 * scale) / 2 + 10;
  const offY  = (630 - 700 * scale) / 2;
  const bx = (offX + 18 * scale).toFixed(1);
  const by = (offY + 168 * scale).toFixed(1);
  const bw = ((382 - 18) * scale).toFixed(1);
  const bh = ((688 - 168) * scale).toFixed(1);
  let out = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#0c0720" stroke="#7744bb" stroke-width="1.5"/>`;
  for (const b of bodies) {
    const tier = Math.max(0, Math.min(11, b.tier));
    out += `<circle cx="${(offX + b.x * scale).toFixed(1)}" cy="${(offY + b.y * scale).toFixed(1)}" r="${(BODY_RADII[tier] * scale).toFixed(1)}" fill="${BODY_COLORS[tier]}" opacity="0.9"/>`;
  }
  return out;
}

function buildOgpSVG(share, rank, fontBuffer, badgeDataUrl) {
  const { score, highest_body_tier, snapshot_payload } = share;
  const titleLevel = getTitleLevel(score, highest_body_tier);
  let bodies = [];
  try { bodies = JSON.parse(snapshot_payload).bodies ?? []; } catch (_) {}
  const board      = buildOgpBoardCircles(bodies);
  const scoreStr   = scoreWithComma(score);
  const fontFamily = fontBuffer ? 'SpaceMono' : 'monospace';
  const badgeEl    = badgeDataUrl
    ? `<image x="580" y="385" width="360" height="75" href="${badgeDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="760" y="450" font-family="${fontFamily}" font-size="28" fill="#cc99ff" text-anchor="middle">${TITLE_EN[titleLevel]}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#060412"/>
  <circle cx="55"  cy="45"  r="1.5" fill="#fff" opacity="0.6"/>
  <circle cx="330" cy="28"  r="2"   fill="#fff" opacity="0.5"/>
  <circle cx="820" cy="75"  r="1.5" fill="#fff" opacity="0.5"/>
  <circle cx="1100" cy="38" r="1"   fill="#fff" opacity="0.4"/>
  <circle cx="930" cy="555" r="1.5" fill="#fff" opacity="0.6"/>
  <rect x="0" y="0" width="480" height="630" fill="#0a0818"/>
  ${board}
  <line x1="480" y1="40" x2="480" y2="590" stroke="#7744bb" stroke-width="1" opacity="0.4"/>
  <text x="760" y="105" font-family="${fontFamily}" font-size="58" font-weight="bold" fill="#7744cc" text-anchor="middle" letter-spacing="10">ROLLAXY</text>
  <text x="760" y="220" font-family="${fontFamily}" font-size="26" fill="#554477" text-anchor="middle" letter-spacing="3">SCORE</text>
  <text x="760" y="340" font-family="${fontFamily}" font-size="100" font-weight="bold" fill="#ffffff" text-anchor="middle">${scoreStr}</text>
  ${badgeEl}
  <text x="760" y="515" font-family="${fontFamily}" font-size="26" fill="#665588" text-anchor="middle">#${rank} All Time</text>
  <line x1="560" y1="548" x2="960" y2="548" stroke="#2a1a44" stroke-width="1"/>
  <text x="760" y="600" font-family="${fontFamily}" font-size="20" fill="#3a2455" text-anchor="middle" letter-spacing="5">NOVORA GAME</text>
</svg>`;
}

export async function onRequestGet({ params, env }) {
  const { id } = params;
  if (!ID_RE.test(id)) return new Response('Not found', { status: 404 });

  // KV キャッシュ確認（TTL 24h）
  const cacheKey = `ogp:${id}`;
  try {
    const cached = await env.RANKING_CACHE.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
      });
    }
  } catch (_) {}

  const row = await env.DB.prepare(
    `SELECT score, highest_body_tier, snapshot_payload FROM shares WHERE id=?`
  ).bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });

  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score>?`
  ).bind(row.score).first();
  const rank = (rankRow?.cnt ?? 0) + 1;

  const [fontBuffer, badgeDataUrl] = await Promise.all([
    loadFont(env),
    loadBadge(env, getTitleLevel(row.score, row.highest_body_tier)),
  ]);

  const svg = buildOgpSVG(row, rank, fontBuffer, badgeDataUrl);
  const resvgOpts = {
    fitTo: { mode: 'width', value: 1200 },
    ...(fontBuffer ? { font: { fontBuffers: [fontBuffer], loadSystemFonts: false } } : {}),
  };

  let png;
  try {
    const resvg = await Resvg.async(svg, resvgOpts);
    png = resvg.render().asPng();
  } catch (err) {
    console.error('resvg render failed:', err);
    return new Response('Image generation failed', { status: 500 });
  }

  try {
    await env.RANKING_CACHE.put(cacheKey, png, { expirationTtl: 86400 });
  } catch (_) {}

  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}
