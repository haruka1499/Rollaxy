// GET /games/rollaxy/share/:id — シェアページ HTML

const SITE_URL = 'https://novoragame.com';
const ID_RE    = /^[a-zA-Z0-9]{8,12}$/;

const BODY_EMOJIS = ['💫','🪨','🌙','🌍','🪐','☀️','🔴','⭐','💠','🌑','🌌','🌐'];
const BODY_COLORS = ['#b0a090','#807060','#d0c8b0','#3388cc','#d4a870','#ffcc00',
                     '#cc2200','#c8d8ff','#2244cc','#110022','#7744cc','#aa44ff'];
const BODY_RADII  = [12,18,25,33,42,51,61,70,79,88,97,106];

function getTitle(score, highestTier) {
  if (highestTier >= 11) return '銀河団創造者';
  if (score >= 2000)     return '宇宙の覇者';
  if (score >= 1000)     return '銀河の探検家';
  if (score >=  600)     return '太陽の支配者';
  if (score >=  300)     return '惑星の開拓者';
  if (score >=  100)     return '星の冒険者';
  return '宇宙の旅人';
}

function scoreWithComma(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function buildBoardSVG(bodies) {
  const LW = 200, LH = 350, SCALE = 0.5;
  const BOX_L = 18, BOX_T = 168, BOX_R = 382, BOX_B = 688;
  let circles = '', texts = '';
  for (const b of bodies) {
    const tier = Math.max(0, Math.min(11, b.tier));
    const x  = (b.x  * SCALE).toFixed(1);
    const y  = (b.y  * SCALE).toFixed(1);
    const r  = (BODY_RADII[tier] * SCALE).toFixed(1);
    const fs = Math.max(8, BODY_RADII[tier] * SCALE * 0.9).toFixed(1);
    circles += `<circle cx="${x}" cy="${y}" r="${r}" fill="${BODY_COLORS[tier]}" opacity="0.85"/>`;
    texts   += `<text x="${x}" y="${y}" font-size="${fs}" text-anchor="middle" dominant-baseline="central">${BODY_EMOJIS[tier]}</text>`;
  }
  const bx = (BOX_L * SCALE).toFixed(1), by = (BOX_T * SCALE).toFixed(1);
  const bw = ((BOX_R - BOX_L) * SCALE).toFixed(1), bh = ((BOX_B - BOX_T) * SCALE).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LW}" height="${LH}" viewBox="0 0 ${LW} ${LH}">
  <rect width="${LW}" height="${LH}" fill="#060412"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#0c0720"/>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#7744bb" stroke-width="1.5"/>
  ${circles}${texts}</svg>`;
}

export async function onRequestGet({ params, env }) {
  const { id } = params;
  if (!ID_RE.test(id)) return page404();

  const row = await env.DB.prepare(
    `SELECT id, score, highest_body_tier, snapshot_payload, ui_lang FROM shares WHERE id=?`
  ).bind(id).first();
  if (!row) return page404();

  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM shares WHERE game_id='rollaxy' AND score>?`
  ).bind(row.score).first();
  const rank     = (rankRow?.cnt ?? 0) + 1;
  const rankText = `全体 ${rank.toLocaleString('en-US')} 位`;

  let bodies = [];
  try { bodies = JSON.parse(row.snapshot_payload).bodies ?? []; } catch (_) {}

  const titleStr  = getTitle(row.score, row.highest_body_tier);
  const maxEmoji  = BODY_EMOJIS[Math.min(11, row.highest_body_tier)];
  const svg       = buildBoardSVG(bodies);
  const scoreStr  = scoreWithComma(row.score);
  const shareUrl  = `${SITE_URL}/games/rollaxy/share/${id}`;
  const ogImage   = `${SITE_URL}/games/rollaxy/ogp/${id}`;
  const pageTitle = `Score ${scoreStr} | Rollaxy | NOVORA GAME`;
  const desc      = `${titleStr} — スコア ${scoreStr}、最大天体 ${maxEmoji}。あなたも挑戦！`;

  const html = `<!DOCTYPE html>
<html lang="${row.ui_lang === 'en' ? 'en' : 'ja'}">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-FFF4H3EVV8"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FFF4H3EVV8');</script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${desc}">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="${shareUrl}">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="${shareUrl}">
  <meta property="og:title"       content="${pageTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image"       content="${ogImage}">
  <meta name="twitter:card"       content="summary_large_image">
  <link rel="stylesheet" href="/style.css">
  <style>
    .share-page{max-width:480px;margin:0 auto;padding:24px 16px 48px;text-align:center}
    .share-board{display:inline-block;margin:24px auto;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(119,68,204,.4)}
    .share-board svg{display:block}
    .share-score{font-size:2.4rem;font-weight:700;color:#fff;margin:8px 0 4px}
    .share-title{font-size:1rem;color:#aa88ff;margin-bottom:4px}
    .share-rank{font-size:.85rem;color:#776699;margin-bottom:24px}
    .share-play{display:inline-block;padding:14px 40px;background:#7744cc;color:#fff;border-radius:8px;font-size:1.1rem;font-weight:700;text-decoration:none;margin-bottom:12px}
    .share-play:hover{background:#9966ee}
    .share-tweet{display:inline-block;padding:10px 28px;background:#000;color:#fff;border-radius:8px;font-size:.95rem;text-decoration:none;margin-left:8px}
    .share-tweet:hover{background:#222}
    .share-links{margin-top:16px;font-size:.85rem}
    .share-links a{color:#776699;margin:0 8px}
  </style>
</head>
<body>
<nav class="site-nav"><div class="nav-inner">
  <a href="/" class="nav-logo">NOVORA GAME</a>
  <ul class="nav-links">
    <li><a href="/games/">Games</a></li>
    <li><a href="/about/">About</a></li>
    <li><a href="/privacy/">Privacy</a></li>
  </ul>
</div></nav>
<main><div class="share-page">
  <div class="share-board">${svg}</div>
  <div class="share-score">${scoreStr}</div>
  <div class="share-title">${titleStr} ${maxEmoji}</div>
  <div class="share-rank">${rankText}</div>
  <div>
    <a class="share-play" href="/games/rollaxy/">▶ Rollaxy をプレイ</a>
    <a class="share-tweet" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`スコア ${scoreStr} — ${titleStr}！`)}&url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener">X でシェア</a>
  </div>
  <div class="share-links"><a href="/games/">ゲーム一覧</a></div>
</div></main>
<footer class="site-footer">
  <div class="footer-links">
    <a href="/">Home</a><a href="/games/">Games</a><a href="/privacy/">Privacy Policy</a>
  </div>
  &copy; 2025 NOVORA GAME
</footer>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

function page404() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found</title></head>
<body style="font-family:sans-serif;text-align:center;padding:48px">
<h1>404</h1><p>このシェアページは存在しないか、削除されました。</p>
<a href="/games/rollaxy/">Rollaxy をプレイ</a></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
