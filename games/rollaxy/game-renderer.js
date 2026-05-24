'use strict';

// ============================================================
// RENDERER — キャンバス描画（爆弾・天体・背景・ボディバー）
// ============================================================

// 爆弾を描画（落下待機中 or 物理ボディとして空中にある時）
function paintBomb(x, y, angle, lit) {
  const r = CFG.BOMB.R;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = lit ? '#661100' : '#220a00'; ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (lit) { // 点火中: オレンジの光輪
    const pulse = (Math.sin(Date.now() / 80) + 1) / 2;
    ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,120,0,${0.5 + pulse * 0.5})`; ctx.lineWidth = 3; ctx.stroke();
  }
  ctx.font = `${Math.max(10, r * 1.1)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2;
  ctx.fillStyle = '#fff'; ctx.fillText('💣', 0, 0);
  ctx.restore();
}

function draw() {
  const { W, H, DANGER_Y: DY, DROP_Y: DPY, BAR_H } = CFG;
  const { L, R, T, B, W: wt, GL, GR } = CFG.BOX;

  // 背景（宇宙空間）
  ctx.fillStyle = '#060412';
  ctx.fillRect(0, 0, W, H);

  // ボックス内側（深宇宙）
  ctx.fillStyle = '#0c0720';
  ctx.fillRect(L, T, R - L, B - T);

  // ボックス上端ライン
  ctx.strokeStyle = '#7744bb';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(L - wt, T); ctx.lineTo(R + wt, T); ctx.stroke();

  // 危険ライン（赤破線）
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = 'rgba(220,60,60,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(L, DY); ctx.lineTo(R, DY); ctx.stroke();
  ctx.restore();

  // 落下ガイド＋操作中天体（または爆弾）
  if (canDrop && !dead && !skillSelectMode) {
    if (bombMode) {
      const br = CFG.BOMB.R;
      const gx = clamp(dropX, L + br + 1, R - br - 1);
      // 落下ガイド線（オレンジ）
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,120,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, DPY + br); ctx.lineTo(gx, B); ctx.stroke();
      // 爆発範囲プレビュー（破線円）
      ctx.beginPath();
      ctx.arc(gx, DPY, CFG.BOMB.RANGE, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,80,0,0.4)';
      ctx.stroke();
      ctx.restore();
      paintBomb(gx, DPY, 0, false);
    } else {
      const def = CFG.BODIES[curBi];
      const gx = clamp(dropX, L + def.r + 1, R - def.r - 1);
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(180,160,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(gx, DPY + def.r); ctx.lineTo(gx, B); ctx.stroke();
      ctx.restore();
      paintBody(gx, DPY, 0, curBi);
    }
  }

  // 物理天体を描画（「合成時に少し光る仕様」のエフェクトつき）
  const now = Date.now();
  for (const [id, d] of bmap.entries()) {
    let glowT = 0;
    const glow = glowMap.get(id);
    if (glow) {
      const rem = glow.endTime - now;
      if (rem > 0) { glowT = rem / glow.duration; } // 0→1 の残存率
      else          { glowMap.delete(id); }
    }
    paintBody(d.body.position.x, d.body.position.y, d.body.angle, d.bi, glowT);
    // ゲームオーバー: アウト天体を赤く点滅
    if (_goFlashIds && _goFlashIds.size > 0 && _goFlashIds.has(id)) {
      const elapsed = now - _goFlashStart;
      const blink = 0.5 + 0.5 * Math.sin(elapsed * 0.0314); // ~5Hz サイン波
      const r = CFG.BODIES[d.bi].r;
      ctx.save();
      ctx.translate(d.body.position.x, d.body.position.y);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,40,40,${(blink * 0.45).toFixed(3)})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,80,60,${(blink * 0.9).toFixed(3)})`;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = `rgba(255,0,0,${(blink * 0.7).toFixed(3)})`;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 壁（天体の上に重ねて縁をきれいに）
  ctx.fillStyle = '#1a0e38';
  ctx.fillRect(L - wt, T, wt, B - T + wt);      // 左壁
  ctx.fillRect(R,      T, wt, B - T + wt);      // 右壁
  ctx.fillRect(L - wt, B, R - L + wt*2, wt);    // 底面

  // 壁のハイライト
  ctx.fillStyle = 'rgba(140,100,255,0.18)';
  ctx.fillRect(L - wt, T, 3, B - T + wt);
  ctx.fillRect(R,      T, 3, B - T + wt);

  // ガイド壁（ドロップゾーン・BOX より広め・半透明）
  ctx.fillStyle = 'rgba(80,50,150,0.55)';
  ctx.fillRect(GL - wt, BAR_H, wt, T - BAR_H);   // 左ガイド
  ctx.fillRect(GR,      BAR_H, wt, T - BAR_H);   // 右ガイド
  ctx.fillStyle = 'rgba(160,120,255,0.12)';
  ctx.fillRect(GL - wt, BAR_H, 3,  T - BAR_H);   // 左ハイライト
  ctx.fillRect(GR,      BAR_H, 3,  T - BAR_H);   // 右ハイライト

  // 爆弾ボディ（物理空間を飛行中）
  if (bombBody) {
    // ゲームボックス外に落ちたら撤去（爆発なし）
    if (bombBody.position.y > CFG.BOX.B + 60) {
      Matter.Composite.remove(world, bombBody, true);
      bombBody = null; bombHit = false;
      clearTimeout(bombFuseTimer); bombFuseTimer = null;
    } else {
      paintBomb(bombBody.position.x, bombBody.position.y, bombBody.angle, bombHit);
    }
  }

  // 爆発エフェクト（拡大する光輪）
  if (bombExplosion) {
    const t = (Date.now() - bombExplosion.startTime) / bombExplosion.duration;
    if (t >= 1) {
      bombExplosion = null;
    } else {
      const r = CFG.BOMB.RANGE * (0.4 + t * 1.2);
      const a = 1 - t;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bombExplosion.x, bombExplosion.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,100,0,${(a * 0.25).toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,220,60,${a.toFixed(3)})`;
      ctx.lineWidth = 3 * a;
      ctx.shadowColor = `rgba(255,150,0,${a.toFixed(3)})`;
      ctx.shadowBlur = 20 * a;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ゲームオーバー時の天体ポップエフェクト（スケールアップ＋フェードアウト）
  if (_goPopEffects.length > 0) {
    const nowPop = performance.now();
    for (let i = _goPopEffects.length - 1; i >= 0; i--) {
      const p = _goPopEffects[i];
      const raw = (nowPop - p.startTime) / POP_DUR_MS;
      if (raw >= 1) { _goPopEffects.splice(i, 1); continue; }
      // ease-out: 最初に素早く大きくなり、最後はゆっくりフェード
      const t    = 1 - Math.pow(1 - raw, 2); // ease-out quadratic
      const sc   = 1 + t * 1.6;              // 1x → 2.6x に拡大
      const al   = 1 - raw;                  // リニアにフェードアウト
      const def  = CFG.BODIES[p.bi];
      ctx.save();
      ctx.globalAlpha = al;
      ctx.translate(p.x, p.y);
      ctx.scale(sc, sc);
      // 本体円
      ctx.beginPath();
      ctx.arc(0, 0, def.r, 0, Math.PI * 2);
      ctx.fillStyle = def.c;
      ctx.fill();
      // カスタム画像（あれば）
      const _bimg = bodyImages[p.bi];
      if (_bimg && _bimg.complete && _bimg.naturalWidth > 0) {
        const _adj = IMG_ADJUST[p.bi] || { scale: 1, ox: 0, oy: 0 };
        const _s   = Math.max(
          (def.r * 2) / _bimg.naturalWidth,
          (def.r * 2) / _bimg.naturalHeight
        ) * _adj.scale;
        const _dw = _bimg.naturalWidth  * _s;
        const _dh = _bimg.naturalHeight * _s;
        ctx.drawImage(_bimg, _adj.ox - _dw / 2, _adj.oy - _dh / 2, _dw, _dh);
      }
      ctx.restore();
    }
  }

  // 天体選択モードのハイライト（upgrade/delete）
  if (skillSelectMode) {
    const pulse = (Math.sin(Date.now() / 180) + 1) / 2;
    for (const [id, d] of bmap.entries()) {
      const isSelectable = !(activeSkill === 'upgrade' && d.bi >= CFG.BODIES.length - 1);
      const isSelected   = id === skillSelectedId;
      const r = CFG.BODIES[d.bi].r;
      ctx.save();
      ctx.beginPath();
      ctx.arc(d.body.position.x, d.body.position.y, r + 4, 0, Math.PI * 2);
      if (isSelected) {
        ctx.strokeStyle = 'rgba(255,220,0,0.95)';
        ctx.lineWidth = 3;
      } else if (isSelectable) {
        ctx.strokeStyle = `rgba(200,180,255,${0.3 + pulse * 0.55})`;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = 'rgba(120,100,120,0.25)'; // 選択不可は暗く
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // 天体進行バー（最前面）
  drawBodyBar();
}

// 「天体」を1個描く（「合成時に少し光る仕様」の glowT を受け取る）
function paintBody(x, y, angle, bi, glowT = 0) {
  const def = CFG.BODIES[bi];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // 影
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;

  // 本体
  ctx.beginPath();
  ctx.arc(0, 0, def.r, 0, Math.PI * 2);
  ctx.fillStyle = def.c;
  ctx.fill();

  // ハイライト
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.beginPath();
  ctx.arc(-def.r * 0.27, -def.r * 0.3, def.r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.fill();

  // 輪郭
  ctx.beginPath();
  ctx.arc(0, 0, def.r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 絵文字 / テキスト or カスタム画像
  const _bimg = bodyImages[bi];
  if (_bimg && _bimg.complete && _bimg.naturalWidth > 0) {
    const _adj = IMG_ADJUST[bi] || { scale: 1, ox: 0, oy: 0 };
    const _scale = Math.max((def.r * 2) / _bimg.naturalWidth, (def.r * 2) / _bimg.naturalHeight) * _adj.scale;
    const _dw = _bimg.naturalWidth  * _scale;
    const _dh = _bimg.naturalHeight * _scale;
    const _dx = _adj.ox - _dw / 2;
    const _dy = _adj.oy - _dh / 2;
    // ① 円からはみ出す部分を半透明で先に描く
    ctx.globalAlpha = 0.3;
    ctx.drawImage(_bimg, _dx, _dy, _dw, _dh);
    // ② 円の内側だけクリップして全不透明で上書き
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, def.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 1.0;
    ctx.drawImage(_bimg, _dx, _dy, _dw, _dh);
    ctx.restore();
    ctx.globalAlpha = 1.0; // 以降の描画（グロウ等）のためリセット
  } else {
    const fs = Math.max(10, def.r * 1.1);
    ctx.font = `${fs}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 2;
    ctx.fillStyle = '#fff';
    ctx.fillText(def.e, 0, 0);
  }

  // 「合成時に少し光る仕様」: 縁の光（段階が上がるほど強く・長く）
  // 各視覚パラメータは元の値 ×1.7 済み（不透明度は ×1.35、min(1) でキャップ）
  if (glowT > 0) {
    // 低インデックスは軽め(0.35)、高インデックスは強め(1.0)
    const intensity = 0.35 + (bi / (CFG.BODIES.length - 1)) * 0.65;
    const a = Math.min(1, glowT * intensity * 1.35); // 不透明度
    ctx.beginPath();
    ctx.arc(0, 0, def.r + 2.55, 0, Math.PI * 2); // 光輪の半径オフセット（元: 1.5 → ×1.7: 2.55）
    ctx.strokeStyle = `rgba(255,240,160,${a.toFixed(3)})`;
    ctx.lineWidth   = (1 + 4 * glowT) * intensity * 1.7; // 光輪の太さ（×1.7）
    ctx.shadowColor = `rgba(255,200,80,${a.toFixed(3)})`;
    ctx.shadowBlur  = def.r * 1.02 * glowT * intensity; // 光の広がり（元: 0.6 → ×1.7: 1.02）
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  ctx.restore();
}

// ============================================================
// BODY BAR — canvas 上端に「天体」の進行バーを描画（2段×6個）
// ユーザーが「天体が表示されているところ（バー）」と言う場合はここを指す可能性がある
// ============================================================
function drawBodyBar() {
  const bodies = CFG.BODIES;
  const minR = bodies[0].r, maxR = bodies[bodies.length - 1].r;

  const BAR_H = CFG.BAR_H;
  const PAD_L = 20, PAD_R = 20;
  const SPAN  = CFG.W - PAD_L - PAD_R;  // 360px
  const SLOT  = SPAN / 5;               // 各段6天体・5間隔 = 72px
  const TOP_Y = 20;  // 上段（銀河団〜赤色巨星）の円中心 Y
  const BOT_Y = 52;  // 下段（宇宙塵〜太陽）の円中心 Y

  // 表示半径 8〜18px（実際の r より小さく縮小して表示）
  function dr(b) { return 8 + (b.r - minR) / (maxR - minR) * 10; }
  function xBot(i) { return PAD_L + SLOT * i; }
  function xTop(j) { return PAD_L + SLOT * j; }

  // 上段: bodies[6..11] 逆順 → [銀河団, 銀河, ブラックホール, 中性子星, 白色矮星, 赤色巨星]
  const topRow = [...bodies.slice(6)].reverse();

  // バー背景（ヘッダーと同色 #1a0e30）
  ctx.fillStyle = '#1a0e30';
  ctx.fillRect(0, 0, CFG.W, BAR_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, BAR_H); ctx.lineTo(CFG.W, BAR_H); ctx.stroke();

  function drawB(b, x, y, bi) {
    const r = dr(b);
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = b.c; ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(x - r*.25, y - r*.3, r*.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.8; ctx.stroke();
    const _bimg = bi !== undefined ? bodyImages[bi] : null;
    if (_bimg && _bimg.complete && _bimg.naturalWidth > 0) {
      const _adj = (bi !== undefined && IMG_ADJUST[bi]) ? IMG_ADJUST[bi] : { scale: 1, ox: 0, oy: 0 };
      const _ds  = r / CFG.BODIES[bi].r; // ゲームpx → 表示px 変換率
      const _scale = Math.max((r * 2) / _bimg.naturalWidth, (r * 2) / _bimg.naturalHeight) * _adj.scale;
      const _dw = _bimg.naturalWidth  * _scale;
      const _dh = _bimg.naturalHeight * _scale;
      ctx.drawImage(_bimg, x + _adj.ox * _ds - _dw / 2, y + _adj.oy * _ds - _dh / 2, _dw, _dh);
    } else {
      ctx.font = `${Math.max(7, r * 1.1)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 1;
      ctx.fillStyle = '#fff'; ctx.fillText(b.e, x, y);
      ctx.shadowBlur = 0;
    }
  }

  function drawArr(x1, y, x2, sym) {
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(sym, (x1 + x2) / 2, y);
  }

  // 下段: 宇宙塵(0) → … → 太陽(5)
  for (let i = 0; i < 6; i++) {
    drawB(bodies[i], xBot(i), BOT_Y, i);
    if (i < 5) drawArr(xBot(i), BOT_Y, xBot(i + 1), '→');
  }

  // 上段: 銀河団(j=0) ← … ← 赤色巨星(j=5)  topRow[j] = bodies[11-j]
  for (let j = 0; j < 6; j++) {
    drawB(topRow[j], xTop(j), TOP_Y, 11 - j);
    if (j < 5) drawArr(xTop(j), TOP_Y, xTop(j + 1), '←');
  }

  // 折り返し ↑ 矢印（右端・上下段の中間）
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('↑', xBot(5), (TOP_Y + BOT_Y) / 2);
}
