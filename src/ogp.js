// ============================================================
// OGP PNG 画像生成
// GET /games/rollaxy/ogp/:id
// ============================================================
import { Resvg } from '@cf-wasm/resvg/workerd';
import { SITE_URL, BODY_RADII, BODY_COLORS, BODY_KEYS, scoreWithComma } from './constants.js';

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

// CPU 使用時間制限対策: 画像を貼るのは高 tier 上位 MAX_IMAGE_TIERS 種類まで。
// それ以外の tier は色付き円（フォールバック）で描画する。
// resvg は base64 PNG の枚数に比例して CPU を消費するため、
// 枚数を絞ることで Worker の CPU 制限（50ms）超過を防ぐ。
const MAX_IMAGE_TIERS = 5;

async function loadBodyImages(env, bodies) {
  const usedTiers = [...new Set(bodies.map(b => Math.max(0, Math.min(11, b.tier))))]
    .sort((a, b) => b - a)   // 高 tier 優先
    .slice(0, MAX_IMAGE_TIERS);
  const pairs = await Promise.all(
    usedTiers.map(async tier => {
      const url = `${SITE_URL}/games/rollaxy/images/${BODY_KEYS[tier]}.png`;
      try {
        const res = await env.ASSETS.fetch(new Request(url));
        if (!res.ok) {
          console.warn(`[ogp] image load failed: ${url} → HTTP ${res.status}`);
          return null;
        }
        const buf = await res.arrayBuffer();
        return [tier, `data:image/png;base64,${toBase64(buf)}`];
      } catch (err) {
        console.warn(`[ogp] image load error: ${url} → ${err}`);
        return null;
      }
    })
  );
  const result = Object.fromEntries(pairs.filter(Boolean));
  console.log(`[ogp] loadBodyImages: ${Object.keys(result).length}/${usedTiers.length} tiers loaded`);
  return result;
}

// bodies を SVG に描画する。
// 常に着色ベース円 + ハイライトを描き（paintBody スタイルに合わせる）、
// bodyImages が渡されていれば PNG を円形クリップして上に重ねる。
// → 画像ロード失敗 / resvg が <image> を未サポートでも円が消えない防御的設計。
// !! <defs> は shapes より必ず前に出力すること（SVG clipPath の参照前定義が必要）
function buildOgpBoardCircles(bodies, bodyImages) {
  const scale = Math.min(460 / 400, 590 / 700);
  const offX  = (460 - 400 * scale) / 2 + 10;
  const offY  = (630 - 700 * scale) / 2;
  const bx = (offX + 18 * scale).toFixed(1);
  const by = (offY + 168 * scale).toFixed(1);
  const bw = ((382 - 18) * scale).toFixed(1);
  const bh = ((688 - 168) * scale).toFixed(1);

  let defs   = '<defs>';
  let shapes = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#0c0720" stroke="#7744bb" stroke-width="1.5"/>`;

  for (let i = 0; i < bodies.length; i++) {
    const b    = bodies[i];
    const tier = Math.max(0, Math.min(11, b.tier));
    const cx   = (offX + b.x * scale).toFixed(1);
    const cy   = (offY + b.y * scale).toFixed(1);
    const r    = (BODY_RADII[tier] * scale).toFixed(1);
    const rNum = BODY_RADII[tier] * scale;
    const d    = (rNum * 2).toFixed(1);
    const lx   = (offX + b.x * scale - rNum).toFixed(1);
    const ly   = (offY + b.y * scale - rNum).toFixed(1);

    // ── ① ベース円（常に描く） ──
    // 画像が読み込めない・resvg が <image> を描画できない場合でも
    // 天体が完全に消えないようにするフォールバック兼ベースレイヤー。
    shapes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BODY_COLORS[tier]}" opacity="0.9"/>`;

    // ── ② ハイライト（立体感・paintBody に合わせたスタイル） ──
    const hr = (rNum * 0.32).toFixed(1);
    const hx = (offX + b.x * scale - rNum * 0.27).toFixed(1);
    const hy = (offY + b.y * scale - rNum * 0.3).toFixed(1);
    shapes += `<circle cx="${hx}" cy="${hy}" r="${hr}" fill="rgba(255,255,255,0.22)"/>`;

    // ── ③ 画像オーバーレイ（ロードできた tier のみ） ──
    // clip-path を <image> に直接付けず <g> ラッパーで適用することで
    // resvg / Satori などレンダラー間の互換性を高める。
    const dataUrl = bodyImages?.[tier];
    if (dataUrl) {
      defs   += `<clipPath id="bc${i}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
      shapes += `<g clip-path="url(#bc${i})"><image href="${dataUrl}" x="${lx}" y="${ly}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice"/></g>`;
    }
  }

  defs += '</defs>';
  return defs + shapes;
}

function buildOgpSVG(share, rank, total, todayRank, todayTotal, fontBuffer, bodyImages, bodies) {
  const { score } = share;
  const scoreStr   = scoreWithComma(score);
  const fontFamily = fontBuffer ? 'SpaceMono' : 'monospace';
  const board      = buildOgpBoardCircles(bodies, bodyImages);

  const calcPct = (r, t) => r === 1 ? 1 : Math.min(99, Math.ceil(r / Math.max(t, 1) * 100));
  const allPct   = calcPct(rank, total);
  const todayPct = todayTotal > 0 ? calcPct(todayRank, todayTotal) : null;

  const todayEl = todayPct != null
    ? `  <text x="840" y="452" font-family="${fontFamily}" font-size="13" fill="#2b1a40" text-anchor="middle" letter-spacing="2">TODAY  TOP</text>
  <text x="840" y="512" font-family="${fontFamily}" font-size="52" font-weight="bold" fill="#8866cc" text-anchor="middle">${todayPct}%</text>`
    : '';

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
  <!-- ── 右パネル ── -->
  <text x="840" y="65" font-family="${fontFamily}" font-size="40" font-weight="bold" fill="#6633bb" text-anchor="middle" letter-spacing="8">ROLLAXY</text>
  <text x="840" y="155" font-family="${fontFamily}" font-size="78" font-weight="bold" fill="#ffffff" text-anchor="middle">${scoreStr}</text>
  <text x="840" y="180" font-family="${fontFamily}" font-size="15" fill="#44335a" text-anchor="middle" letter-spacing="2">pts</text>
  <line x1="540" y1="202" x2="1140" y2="202" stroke="#170e2a" stroke-width="1"/>
  <text x="840" y="245" font-family="${fontFamily}" font-size="18" fill="#443368" text-anchor="middle" letter-spacing="4">TOP</text>
  <text x="840" y="385" font-family="${fontFamily}" font-size="120" font-weight="bold" fill="#cc88ff" text-anchor="middle">${allPct}%</text>
  <line x1="540" y1="415" x2="1140" y2="415" stroke="#170e2a" stroke-width="1"/>
${todayEl}
  <text x="840" y="598" font-family="${fontFamily}" font-size="18" fill="#2e1a44" text-anchor="middle" letter-spacing="5">NOVORA GAME</text>
</svg>`;
}

export async function handleOgp(id, env) {
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

  const todayStart = Math.floor(Date.now() / 1000) - 86400;
  const [rankRow, totalRow, todayRankRow, todayTotalRow] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score>?`).bind(row.score).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy'`).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score>? AND created_at>=?`).bind(row.score, todayStart).first(),
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND created_at>=?`).bind(todayStart).first(),
  ]);
  const rank       = (rankRow?.cnt    ?? 0) + 1;
  const total      = (totalRow?.cnt   ?? 1);
  const todayRank  = (todayRankRow?.cnt  ?? 0) + 1;
  const todayTotal = (todayTotalRow?.cnt ?? 0);

  let bodies = [];
  try { bodies = JSON.parse(row.snapshot_payload).bodies ?? []; } catch (_) {}

  const [fontBuffer, bodyImages] = await Promise.all([
    loadFont(env),
    loadBodyImages(env, bodies),
  ]);

  const svg = buildOgpSVG(row, rank, total, todayRank, todayTotal, fontBuffer, bodyImages, bodies);
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
