'use strict';

// ============================================================
// COSMOS 3D — Phase 2: 恒星成長を 3D に反映
// ============================================================
// Three.js を使った宇宙パネル用 3D ビューア。パネル全面を占める。
//   - 背景: space-bg.png (360° 環境マップ)
//   - 中央: 恒星（sun.png）。サイズ＝物質生成器レベル、
//           グロー光輪の色＝tier、強度＝エネルギーレートに連動
//
// 連動は game-meta.js の renderCosmos() から Cosmos3D.update() を呼ぶ。
//
// 後続フェーズ:
//   Phase 3: 公転する惑星を配置（earth/mercury/venus テクスチャ）
//   Phase 4: 超新星演出
//   Phase 7: カメラのドラッグ/ピンチ操作
// ============================================================

window.Cosmos3D = (function () {
  // tier ごとの恒星グロー色（恒星進化のイメージ: 赤色矮星 → 黄 → 白 → 青色巨星）。
  // CFG.META.STAR.TIER_LEVELS は 12 段階なので 12 色用意。
  const TIER_COLORS = [
    0x6a5a7a, // 0 原始星（くすんだ紫灰）
    0x8a5a6a, // 1
    0xff6a4d, // 2 赤
    0xff7a3d, // 3 赤橙
    0xffa840, // 4 橙
    0xffc24d, // 5 黄
    0xffe27a, // 6 黄白
    0xfff0c0, // 7 白黄
    0xffffff, // 8 白
    0xdce8ff, // 9 青白
    0xbcd4ff, // 10 青
    0x9cc0ff, // 11 濃青
  ];

  let scene, camera, renderer, starMesh, glowSprite;
  let animId = null;
  let initialized = false;
  let pulseT = 0;

  // 最新の連動パラメータ（update で更新、アニメループで反映）
  const target = {
    radius:    0.5,
    glowColor: TIER_COLORS[0],
    glowScale: 1.6,
    glowOpacity: 0.4,
  };
  // 現在値（target へなめらかに補間）
  const cur = { radius: 0.5, glowScale: 1.6, glowOpacity: 0.4 };

  function _wrap()   { return document.getElementById('cosmos-3d-wrap'); }
  function _canvas() { return document.getElementById('cosmos-3d'); }

  // 放射状グラデーション（中心白→外周透明）の Sprite テクスチャを動的生成
  function _makeGlowTexture() {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function init() {
    if (initialized) return;
    if (typeof THREE === 'undefined') {
      console.warn('[cosmos3d] THREE.js が読み込めませんでした。3D 表示はスキップします。');
      return;
    }
    const canvas = _canvas();
    const wrap   = _wrap();
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w < 10 || h < 10) { setTimeout(init, 200); return; } // サイズ未確定なら再試行
    initialized = true;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, 0, 3.4);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);

    const loader = new THREE.TextureLoader();
    // テクスチャは 1024×512 (2の冪乗) だが、WebGL1 環境での黒化を確実に防ぐため
    // NPOT セーフなパラメータ（mipmap無効・Linear・ClampToEdge）を明示設定する
    function _npotSafe(tex) {
      tex.colorSpace    = THREE.SRGBColorSpace;
      tex.minFilter     = THREE.LinearFilter;
      tex.magFilter     = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    }
    // 背景（360° 環境マップ）
    loader.load('images/cosmos/space-bg.jpg',
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        _npotSafe(tex);
        scene.background = tex;
      },
      undefined,
      (err) => console.warn('[cosmos3d] 背景テクスチャ読込失敗', err)
    );

    // 恒星（sun テクスチャ）。MeshBasicMaterial = 自己発光的に見える（恒星は光源なので影不要）
    const sunTex = _npotSafe(loader.load('images/cosmos/sun.jpg'));
    const geo = new THREE.SphereGeometry(1, 64, 32);
    const mat = new THREE.MeshBasicMaterial({ map: sunTex });
    starMesh = new THREE.Mesh(geo, mat);
    scene.add(starMesh);

    // グロー光輪（Sprite + 加算合成）
    const glowMat = new THREE.SpriteMaterial({
      map: _makeGlowTexture(),
      color: target.glowColor,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    glowSprite = new THREE.Sprite(glowMat);
    scene.add(glowSprite);

    window.addEventListener('resize', _onResize);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(_onResize).observe(wrap);

    _start();
  }

  function _onResize() {
    if (!initialized) return;
    const wrap = _wrap();
    if (!wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w < 10 || h < 10) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function _animate() {
    animId = requestAnimationFrame(_animate);
    pulseT += 0.02;

    // target へなめらかに補間（生成器強化時のサイズ変化を滑らかに見せる）
    cur.radius      += (target.radius      - cur.radius)      * 0.08;
    cur.glowScale   += (target.glowScale   - cur.glowScale)   * 0.08;
    cur.glowOpacity += (target.glowOpacity - cur.glowOpacity) * 0.08;

    if (starMesh) {
      starMesh.rotation.y += 0.0025;
      starMesh.scale.setScalar(cur.radius);
    }
    if (glowSprite) {
      // ゆるやかな脈動（±4%）
      const pulse = 1 + Math.sin(pulseT) * 0.04;
      const s = cur.glowScale * pulse;
      glowSprite.scale.set(s, s, 1);
      glowSprite.material.opacity = cur.glowOpacity * (0.94 + Math.sin(pulseT) * 0.06);
    }
    renderer.render(scene, camera);
  }

  function _start() { if (animId === null) _animate(); }
  function _stop()  { if (animId !== null) { cancelAnimationFrame(animId); animId = null; } }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) _stop();
    else if (initialized) _start();
  });

  // ── 外部 API: メタ進行を 3D に反映 ──
  // state = { level, tier, energyRate }
  function update(state) {
    if (!state) return;
    const level = Math.max(1, state.level || 1);
    const tier  = Math.max(0, Math.min(TIER_COLORS.length - 1, state.tier || 0));
    const er    = Math.max(0, state.energyRate || 0);

    // サイズ: レベルを対数カーブで 0..1 に正規化 → 半径 0.45〜1.25
    const t = Math.min(1, Math.log(level + 1) / Math.log(101));
    target.radius    = 0.45 + 0.8 * t;
    target.glowColor = TIER_COLORS[tier];
    // 光輪サイズは恒星半径に追従、強度はエネルギーレートで上乗せ
    const erNorm = Math.min(1, er / 2);
    target.glowScale   = target.radius * (2.4 + 1.2 * erNorm);
    target.glowOpacity = 0.32 + 0.4 * erNorm;

    if (glowSprite) glowSprite.material.color.setHex(target.glowColor);
  }

  // DOM 準備が整い次第 init（カルーセル外で width=0 のうちは setTimeout 再試行）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { init, update };
})();
