// ============================================================
// OGP PNG 画像生成
// GET /games/rollaxy/ogp/:id
// ============================================================
import { Resvg } from '@cf-wasm/resvg/workerd';
import { SITE_URL, BODY_RADII, BODY_COLORS, BODY_KEYS, BODY_IMAGE_ADJUST, scoreWithComma } from './constants.js';

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function loadFont(env) {
  const url = `${SITE_URL}/games/rollaxy/fonts/SpaceMono-Regular.ttf`;
  try {
    const res = await env.ASSETS.fetch(new Request(url));
    if (res.ok) {
      const buf = await res.arrayBuffer();
      console.log(`[ogp] font loaded: ${buf.byteLength} bytes`);
      return buf;
    }
    console.warn(`[ogp] font load failed: ${url} → HTTP ${res.status}`);
  } catch (err) {
    console.warn(`[ogp] font load error: ${url} → ${err}`);
  }
  return null;
}

async function loadBodyImages(env, bodies) {
  const usedTiers = [...new Set(bodies.map(b => Math.max(0, Math.min(11, b.tier))))];
  const pairs = await Promise.all(
    usedTiers.map(async tier => {
      // OGP 用サムネイル（256×256px）を使用。
      // 画像は <defs> に tier ごと 1 回だけ定義し <use> で参照するため
      // 天体数が多くても SVG サイズは tier 数分しか増えない。
      const url = `${SITE_URL}/games/rollaxy/images/ogp/${BODY_KEYS[tier]}.png`;
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
  // ゲームボード領域（新レイアウト座標。config.js の BOX と一致させること）
  const BOX_L = 18, BOX_T = 240, BOX_R = 382, BOX_B = 760;
  const M = 20; // 盤面外周の余白（ゲーム座標）
  const regX = BOX_L - M, regY = BOX_T - M;
  const regW = (BOX_R - BOX_L) + 2 * M;
  const regH = (BOX_B - BOX_T) + 2 * M;
  // 左パネル 480×630 に盤面領域を収めて中央寄せ（上の空白バー領域は切り捨てる）
  const scale = Math.min(460 / regW, 600 / regH);
  const offX  = (480 - regW * scale) / 2 - regX * scale;
  const offY  = (630 - regH * scale) / 2 - regY * scale;
  const gx = v => offX + v * scale; // ゲーム X → OGP X
  const gy = v => offY + v * scale; // ゲーム Y → OGP Y

  let defs   = '<defs>';

  // ── 画像は tier ごとに 1 回だけ <defs> に定義し <use> で参照する ──
  // 天体数分だけ base64 を重複埋め込みすると SVG が数MB になり
  // resvg(WASM) のメモリ限界を超えるため、この構造が必須。
  for (const [tier, dataUrl] of Object.entries(bodyImages || {})) {
    defs += `<image id="bimg-${tier}" href="${dataUrl}" preserveAspectRatio="xMidYMid slice"/>`;
  }

  const bx = gx(BOX_L).toFixed(1);
  const by = gy(BOX_T).toFixed(1);
  const bw = ((BOX_R - BOX_L) * scale).toFixed(1);
  const bh = ((BOX_B - BOX_T) * scale).toFixed(1);
  let shapes = `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#0c0720" stroke="#7744bb" stroke-width="1.5"/>`;

  for (let i = 0; i < bodies.length; i++) {
    const b    = bodies[i];
    const tier = Math.max(0, Math.min(11, b.tier));
    const cx   = gx(b.x).toFixed(1);
    const cy   = gy(b.y).toFixed(1);
    const rNum = BODY_RADII[tier] * scale;
    const r    = rNum.toFixed(1);
    const iadj = BODY_IMAGE_ADJUST[tier];
    const imgRad = rNum * iadj.scale;
    const lx = (gx(b.x) - imgRad + rNum * iadj.dx).toFixed(1);
    const ly = (gy(b.y) - imgRad + rNum * iadj.dy).toFixed(1);
    const d  = (imgRad * 2).toFixed(1);

    // ── ① ベース円（常に描く） ──
    shapes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BODY_COLORS[tier]}" opacity="0.9"/>`;

    // ── ② ハイライト（立体感） ──
    const hr = (rNum * 0.32).toFixed(1);
    const hx = (gx(b.x) - rNum * 0.27).toFixed(1);
    const hy = (gy(b.y) - rNum * 0.3).toFixed(1);
    shapes += `<circle cx="${hx}" cy="${hy}" r="${hr}" fill="white" fill-opacity="0.22"/>`;

    // ── ③ 画像オーバーレイ（defs の <image> を <use> で参照） ──
    if (bodyImages?.[tier]) {
      defs   += `<clipPath id="bc${i}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
      shapes += `<g clip-path="url(#bc${i})"><use href="#bimg-${tier}" x="${lx}" y="${ly}" width="${d}" height="${d}"/></g>`;
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

  // Adjust main % size and position depending on whether today section is shown
  const allPctY  = todayPct != null ? 388 : 430;
  const allPctSz = todayPct != null ? 98  : 122;

  const todayEl = todayPct != null ? `
  <line x1="600" y1="432" x2="1080" y2="432" stroke="#150c28" stroke-width="1"/>
  <rect x="575" y="444" width="530" height="118" rx="12" ry="12" fill="#1e0e3a" fill-opacity="0.65" stroke="#643cb4" stroke-opacity="0.32" stroke-width="1.5"/>
  <text x="840" y="479" font-family="${fontFamily}" font-size="11" fill="#5544aa" text-anchor="middle" letter-spacing="5">T O D A Y   T O P</text>
  <text x="840" y="554" font-family="${fontFamily}" font-size="62" font-weight="bold" fill="#9966cc" text-anchor="middle">${todayPct}%</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#060412"/>
  <rect x="0" y="0" width="480" height="630" fill="#0a0818"/>
  <circle cx="55"  cy="45"  r="1.5" fill="#fff" opacity="0.6"/>
  <circle cx="330" cy="28"  r="2"   fill="#fff" opacity="0.5"/>
  <circle cx="820" cy="75"  r="1.5" fill="#fff" opacity="0.5"/>
  <circle cx="1100" cy="38" r="1"   fill="#fff" opacity="0.4"/>
  <circle cx="930" cy="555" r="1.5" fill="#fff" opacity="0.6"/>
  <circle cx="1155" cy="480" r="1.2" fill="#fff" opacity="0.4"/>
  <circle cx="700" cy="578" r="1"   fill="#fff" opacity="0.3"/>
  <circle cx="512" cy="310" r="1"   fill="#fff" opacity="0.25"/>
  ${board}
  <line x1="480" y1="40" x2="480" y2="590" stroke="#7744bb" stroke-width="1" opacity="0.4"/>
  <text x="840" y="56" font-family="${fontFamily}" font-size="34" font-weight="bold" fill="#6633bb" text-anchor="middle" letter-spacing="10">ROLLAXY</text>
  <line x1="555" y1="68" x2="1125" y2="68" stroke="#170e2a" stroke-width="1"/>
  <rect x="555" y="80" width="570" height="148" rx="14" ry="14" fill="#28124b" fill-opacity="0.55" stroke="#7844c8" stroke-opacity="0.38" stroke-width="1.5"/>
  <text x="840" y="118" font-family="${fontFamily}" font-size="11" fill="#5544aa" text-anchor="middle" letter-spacing="5">S C O R E</text>
  <text x="840" y="196" font-family="${fontFamily}" font-size="76" font-weight="bold" fill="#ffffff" text-anchor="middle">${scoreStr}</text>
  <text x="840" y="218" font-family="${fontFamily}" font-size="11" fill="#443368" text-anchor="middle" letter-spacing="3">p t s</text>
  <line x1="600" y1="248" x2="1080" y2="248" stroke="#150c28" stroke-width="1"/>
  <text x="840" y="280" font-family="${fontFamily}" font-size="12" fill="#443368" text-anchor="middle" letter-spacing="5">ALL  TIME  TOP</text>
  <text x="840" y="${allPctY}" font-family="${fontFamily}" font-size="${allPctSz}" font-weight="bold" fill="#cc88ff" text-anchor="middle">${allPct}%</text>
${todayEl}
  <text x="840" y="610" font-family="${fontFamily}" font-size="14" fill="#2e1a44" text-anchor="middle" letter-spacing="5">NOVORA GAME</text>
</svg>`;
}

export async function handleOgp(id, env, url) {
  // ── 診断モード ──
  //   ?debug=1     → フォント/画像/レンダリングの状態を JSON で返す（キャッシュ無視）
  //   ?format=svg  → 生 SVG を返す（ブラウザはシステムフォントで描画するため
  //                  「SVG構造は正しいがフォント未ロード」かを切り分けられる）
  //   ?nocache=1   → KV キャッシュをスキップして必ず再生成
  const debug   = url?.searchParams.get('debug')  === '1';
  const fmtSvg  = url?.searchParams.get('format') === 'svg';
  const noCache = debug || fmtSvg || url?.searchParams.get('nocache') === '1';

  const cacheKey = `ogp:${id}`;
  if (!noCache) {
    try {
      const cached = await env.RANKING_CACHE.get(cacheKey, 'arrayBuffer');
      if (cached) {
        return new Response(cached, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
        });
      }
    } catch (_) {}
  }

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

  // ── ?format=svg: 生 SVG を返す ──
  if (fmtSvg) {
    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const resvgOpts = {
    fitTo: { mode: 'width', value: 1200 },
    ...(fontBuffer ? { font: { fontBuffers: [fontBuffer], loadSystemFonts: false } } : {}),
  };

  let png, renderError = null;
  try {
    const resvg = await Resvg.async(svg, resvgOpts);
    png = resvg.render().asPng();
  } catch (err) {
    renderError = String(err);
    console.error('resvg render failed:', err);
    if (!debug) return new Response('Image generation failed', { status: 500 });
  }

  // ── ?debug=1: 診断 JSON を返す ──
  if (debug) {
    return new Response(JSON.stringify({
      id,
      score: row.score,
      rank, total, todayRank, todayTotal,
      font: {
        loaded:    !!fontBuffer,
        bytes:     fontBuffer ? fontBuffer.byteLength : 0,
        fontFamily: fontBuffer ? 'SpaceMono' : 'monospace',
        hint:      fontBuffer ? null
          : 'フォント未ロード → Cloudflare Workers にシステムフォントが無いため全テキストが不可視になります。games/rollaxy/fonts/SpaceMono-Regular.ttf を配置してください。',
      },
      bodies: {
        count:       bodies.length,
        usedTiers:   [...new Set(bodies.map(b => Math.max(0, Math.min(11, b.tier))))],
        imagesLoaded: Object.keys(bodyImages).length,
      },
      render: {
        ok:        !renderError,
        error:     renderError,
        pngBytes:  png ? png.byteLength : 0,
      },
      svgLength: svg.length,
    }, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (!noCache) {
    try {
      await env.RANKING_CACHE.put(cacheKey, png, { expirationTtl: 86400 });
    } catch (_) {}
  }

  return new Response(png, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  });
}
