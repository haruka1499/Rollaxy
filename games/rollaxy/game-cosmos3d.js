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

  // ── GLSL: 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) + fbm ──
  // 恒星表面の沸騰プラズマとコロナの揺らぎに使う手続き型ノイズ。
  const NOISE_GLSL = `
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+1.0*C.xxx; vec3 x2=x0-i2+2.0*C.xxx; vec3 x3=x0-1.0+3.0*C.xxx;
      i=mod(i,289.0);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }
    float fbm(vec3 p){
      float a=0.5,f=0.0; for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.0; a*=0.5; } return f;
    }
  `;

  const SUN_VERT = `
    varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDirW;
    void main(){
      vUv=uv; vPos=position;
      vec4 wp=modelMatrix*vec4(position,1.0);
      vNormalW=normalize(mat3(modelMatrix)*normal);
      vViewDirW=normalize(cameraPosition-wp.xyz);
      gl_Position=projectionMatrix*viewMatrix*wp;
    }
  `;
  // 表面: テクスチャをノイズでドメインワープ（流れる）+ 沸騰する明滅 + 周縁の増光
  const SUN_FRAG = NOISE_GLSL + `
    uniform float uTime; uniform sampler2D uTex; uniform vec3 uColor;
    varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDirW;
    void main(){
      float t=uTime*0.18;
      vec3 q=vPos*2.4;
      float w=fbm(q+vec3(0.0,0.0,t));
      vec2 uv2=vUv+vec2(w)*0.025;
      vec3 base=texture2D(uTex,uv2).rgb;
      float boil=0.8+0.55*fbm(q*1.7+vec3(t*1.9));
      vec3 col=base*boil;
      col=mix(col,col*uColor*1.5,0.3);
      float fres=pow(1.0-max(dot(vNormalW,vViewDirW),0.0),2.0);
      col+=uColor*fres*0.7;
      gl_FragColor=vec4(col,1.0);
    }
  `;
  // ── コロナ用バーテックスシェーダ ──
  // 「ほとんどの頂点は球のまま」「ピーク値の頂点だけ細く外へ突き出る」を実現する。
  // smoothstep でしきい値以下は完全に切り落とし → 突き出る本数を絞る（細い炎の舌）。
  // 続けて pow(d, 3.5) で先端を更に鋭利化。最後に uDisplace で R に対する割合に縮小。
  // uTime でノイズパターンを外向きに流し「燃え上がる」アニメ。
  const CORONA_VERT = NOISE_GLSL + `
    uniform float uTime; uniform float uDisplace;
    varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDirW;
    varying float vDisplace; // 押し出し量比 (frag で先端を強く光らせる)
    void main(){
      vUv = uv;
      vec3 nrm = normalize(position);
      float t = uTime * 0.6;
      // 高周波 + 低周波の混合。+vec3(t) でノイズパターンが外向きに流れる
      float n1 = fbm(nrm * 3.0 + vec3(t));
      float n2 = fbm(nrm * 7.0 + vec3(t * 1.8));
      float n  = n1 * 0.6 + n2 * 0.4 + 0.5; // 0..1 程度
      // しきい値以下を切り捨て（ピーク値のみ残す）→ 突き出る頂点数を絞る = 細い炎の舌
      float peak = smoothstep(0.55, 1.0, n);
      // 更に鋭利化
      peak = pow(peak, 2.0);
      float d = peak * uDisplace; // R に対する割合
      vDisplace = peak; // frag では正規化された 0..1 値を使う（色合い計算用）
      vec3 displaced = position + nrm * d;
      vPos = displaced;
      vec4 wp = modelMatrix * vec4(displaced, 1.0);
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vViewDirW = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  // 炎の舌層フラグメント: 押し出し量(vDisplace)が大きい先端ほど明るく白寄り、
  // 根元はベース色。フレネルも併用して縁側の透過感を出す。
  const CORONA_TONGUE_FRAG = NOISE_GLSL + `
    uniform float uTime; uniform vec3 uColor;
    varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDirW;
    varying float vDisplace;
    void main(){
      float fres = pow(1.0 - max(dot(vNormalW, vViewDirW), 0.0), 1.6);
      float t = uTime * 0.7;
      float n = fbm(vPos * 4.0 + vec3(t * 1.4));
      // 押し出し先端ほど明るい。根元(displace≈0)は暗くて消える → 「炎の舌」効果
      float intensity = vDisplace * 2.0 + fres * 0.5;
      intensity *= (0.7 + 0.5 * n);
      float a = clamp(intensity, 0.0, 1.0);
      // 先端を白寄りに混色（高温部）
      vec3 hot = mix(uColor, vec3(1.0, 0.92, 0.7), clamp(vDisplace * 1.8, 0.0, 0.7));
      gl_FragColor = vec4(hot * a * 1.7, a);
    }
  `;
  // 遠方ヘイズ: 押し出しなし(uDisplace=0)、滑らかな残光。uOpacity で品質低下時に弱める
  const CORONA_HAZE_FRAG = NOISE_GLSL + `
    uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
    varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalW; varying vec3 vViewDirW;
    varying float vDisplace;
    void main(){
      float fres = pow(1.0 - max(dot(vNormalW, vViewDirW), 0.0), 2.8);
      float t = uTime * 0.3;
      float n = fbm(vPos * 1.4 + vec3(t));
      float a = fres * (0.45 + 0.55 * n) * 0.5 * uOpacity;
      a = clamp(a, 0.0, 1.0);
      gl_FragColor = vec4(uColor * a * 1.1, a);
    }
  `;

  // ── パーティクル（外周のプラズマ粒）──
  // 球面上にばらまいた小さな点が明滅する。BufferGeometry + Points で軽量。
  const PARTICLE_VERT = `
    attribute float phase;
    uniform float uTime; uniform float uPointScale;
    varying float vAlpha;
    void main(){
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vec4 mv = viewMatrix * wp;
      // 距離に応じてサイズ調整（遠いと小さく）
      gl_PointSize = uPointScale * (1.0 / -mv.z);
      // 各粒子の独立位相で明滅
      float pulse = sin(uTime * 2.5 + phase) * 0.5 + 0.5;
      vAlpha = pulse * pulse; // 鋭めの明滅
      gl_Position = projectionMatrix * mv;
    }
  `;
  const PARTICLE_FRAG = `
    uniform vec3 uColor;
    varying float vAlpha;
    void main(){
      // 円形マスク（gl_PointCoord は 0..1 の正方形）
      vec2 d = gl_PointCoord - vec2(0.5);
      float dist = length(d);
      if (dist > 0.5) discard;
      float a = smoothstep(0.5, 0.0, dist) * vAlpha;
      gl_FragColor = vec4(uColor * a * 2.2, a);
    }
  `;

  let scene, camera, renderer, starMesh, glowSprite, loader, planetGroup;
  let sunMat;                          // 恒星サーフェスのシェーダ
  let coronaLayers = [];               // コロナ層 [{mesh, mat, baseScale, speed, displace}]
  let particleSystem = null;           // 外周プラズマ粒子
  let particleMat = null;
  let supernovaT = 0;                  // 超新星演出の進行時間（0=非演出, >0=演出中）

  // ── 動的品質（Phase 7）──
  // HIGH: 全機能 / MID: 中間 / LOW: 軽量。起動時HIGH、fps が画面更新の90%を下回ったら段階的に下げる
  // 押し出し量は球半径(=1.0)に対する割合。0.03〜0.08 程度に抑えて「ほぼ球+細い炎の舌」を実現。
  // geomDetail は SphereGeometry の widthSegments。高分割で押し出しエッジを滑らかに見せる。
  const QUALITY = {
    HIGH: { tongueDisplace: 0.08, hazeOpacity: 1.0,  particleCount: 100, geomDetail: 160 },
    MID:  { tongueDisplace: 0.05, hazeOpacity: 0.85, particleCount: 50,  geomDetail: 112 },
    LOW:  { tongueDisplace: 0.03, hazeOpacity: 0.7,  particleCount: 20,  geomDetail: 80 },
  };
  let qualityLevel = 'HIGH';

  // fps 計測
  let _fpsFrames = [];
  let _fpsStartT = 0;
  let _fpsTarget = null;               // 画面リフレッシュレート（起動後2秒で確定）
  let _lastQualityChange = 0;

  // ── カメラ操作（Phase 7）──
  let camTheta = 0;                    // 方位角（rad）
  let camPhi   = Math.PI / 2;          // 仰角（rad、π/2=赤道）
  let camRadius = 3.4;                 // 距離
  const CAM_MIN_R = 1.8, CAM_MAX_R = 7.0;
  const CAM_PHI_PAD = 0.15;            // 極での詰まりを防ぐマージン
  let _userInteractUntil = 0;          // この時刻まで自動回転停止
  let _pointers = new Map();           // pointerId → {x,y}
  let _pinchPrevDist = 0;
  let animId = null;
  let initialized = false;
  let pulseT = 0;

  // 惑星（Phase 3）
  let planetObjs   = [];   // [{ mesh, orbitRadius, angle, speed }]
  let planetsSig   = '';   // 現在の惑星構成シグネチャ（変化時のみ再構築）
  const planetTexCache = {}; // key -> THREE.Texture（再ロード回避）

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

  // テクスチャを NPOT セーフに（WebGL1 黒化回避）
  function _npotSafe(tex) {
    tex.colorSpace      = THREE.SRGBColorSpace;
    tex.minFilter       = THREE.LinearFilter;
    tex.magFilter       = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

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

    loader = new THREE.TextureLoader();
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

    // 恒星サーフェス: sun テクスチャを手続き型ノイズで沸騰・流動させる ShaderMaterial。
    // 単なる貼り付け（プラスチック球）ではなく、生きたプラズマの揺らぎを表現。
    const sunTex = _npotSafe(loader.load('images/cosmos/sun.jpg'));
    sunMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:  { value: 0 },
        uTex:   { value: sunTex },
        uColor: { value: new THREE.Color(target.glowColor) },
      },
      vertexShader:   SUN_VERT,
      fragmentShader: SUN_FRAG,
    });
    starMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), sunMat);
    scene.add(starMesh);

    // コロナ: 頂点押し出しの炎の舌層 + 滑らかな遠方ヘイズの 2 層構成。
    // CORONA_VERT で頂点自体を法線方向にノイズ押し出しするため、輪郭が円ではなくなる。
    const q = QUALITY[qualityLevel];
    // コロナは恒星表面のすぐ外側に寄せる。離れすぎると「球が重なって見える」原因になる
    const layerDefs = [
      // 押し出し付き炎の舌（恒星表面ぎりぎり外側、押し出しで少し外へ伸びる）
      { scale: 1.02, frag: CORONA_TONGUE_FRAG, speed: -0.0014, displace: q.tongueDisplace, opacity: 1.0 },
      // 滑らかな遠方ヘイズ（控えめに表面近く）
      { scale: 1.08, frag: CORONA_HAZE_FRAG,   speed:  0.0008, displace: 0.0,             opacity: q.hazeOpacity },
    ];
    for (const d of layerDefs) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime:     { value: 0 },
          uColor:    { value: new THREE.Color(target.glowColor) },
          uDisplace: { value: d.displace },
          uOpacity:  { value: d.opacity },
        },
        vertexShader:   CORONA_VERT,
        fragmentShader: d.frag,
        transparent:    true,
        blending:       THREE.AdditiveBlending,
        depthWrite:     false,
        side:           THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(d.scale, q.geomDetail, q.geomDetail / 2), mat);
      scene.add(mesh);
      coronaLayers.push({ mesh, mat, baseScale: d.scale, speed: d.speed, displace: d.displace });
    }

    // 外周プラズマ粒子（炎の周りを舞うスパーク）
    _initParticles(q.particleCount);

    // カメラ操作（ドラッグ回転 + ピンチ/ホイールズーム）
    _initCameraControls();
    _fpsStartT = performance.now();

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

    // 惑星用ライト: 恒星（原点）から放射する点光源 + 弱い環境光（暗黒面が真っ黒にならないよう）
    const starLight = new THREE.PointLight(0xfff2dd, 2.4, 0, 0.0);
    starLight.position.set(0, 0, 0);
    scene.add(starLight);
    scene.add(new THREE.AmbientLight(0x404a66, 0.6));

    // 惑星の公転グループ（少し傾けて 3D の奥行きを出す）
    planetGroup = new THREE.Group();
    planetGroup.rotation.x = -0.5; // 約 -28°
    scene.add(planetGroup);

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

  // ── パーティクル（外周プラズマ）──
  function _initParticles(count) {
    if (particleSystem) { scene.remove(particleSystem); particleSystem.geometry.dispose(); particleMat.dispose(); particleSystem = null; }
    if (count <= 0) return;
    const positions = new Float32Array(count * 3);
    const phases    = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // 球面上のランダム点 × 半径バリエーション（1.3〜2.0）
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = 1.3 + Math.random() * 0.7;
      const sx = Math.sqrt(1 - u * u);
      positions[i * 3]     = sx * Math.cos(a) * r;
      positions[i * 3 + 1] = u * r;
      positions[i * 3 + 2] = sx * Math.sin(a) * r;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('phase',    new THREE.BufferAttribute(phases, 1));
    particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uColor:      { value: new THREE.Color(target.glowColor) },
        uPointScale: { value: 12 },
      },
      vertexShader:   PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent:    true,
      blending:       THREE.AdditiveBlending,
      depthWrite:     false,
    });
    particleSystem = new THREE.Points(geo, particleMat);
    scene.add(particleSystem);
  }

  // ── カメラ操作 ──
  function _updateCamera() {
    const x = camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    const y = camRadius * Math.cos(camPhi);
    const z = camRadius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  }
  function _initCameraControls() {
    const canvas = _canvas();
    if (!canvas) return;
    canvas.style.touchAction = 'none'; // ブラウザのジェスチャを抑止し pointer events を取り切る
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      _pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (_pointers.size === 2) {
        const a = [..._pointers.values()];
        _pinchPrevDist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      }
      _userInteractUntil = performance.now() + 100000; // 操作中は自動回転停止
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!_pointers.has(e.pointerId)) return;
      const prev = _pointers.get(e.pointerId);
      const curX = e.clientX, curY = e.clientY;
      if (_pointers.size === 1) {
        // ドラッグ回転
        const dx = curX - prev.x, dy = curY - prev.y;
        camTheta -= dx * 0.008;
        camPhi   = Math.max(CAM_PHI_PAD, Math.min(Math.PI - CAM_PHI_PAD, camPhi - dy * 0.008));
        _updateCamera();
      } else if (_pointers.size >= 2) {
        // ピンチ
        _pointers.set(e.pointerId, { x: curX, y: curY });
        const a = [..._pointers.values()];
        const dist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (_pinchPrevDist > 0) {
          const factor = _pinchPrevDist / dist;
          camRadius = Math.max(CAM_MIN_R, Math.min(CAM_MAX_R, camRadius * factor));
          _updateCamera();
        }
        _pinchPrevDist = dist;
        return;
      }
      _pointers.set(e.pointerId, { x: curX, y: curY });
    });
    function _release(e) {
      _pointers.delete(e.pointerId);
      if (_pointers.size < 2) _pinchPrevDist = 0;
      if (_pointers.size === 0) {
        // 操作終了の 2 秒後に自動回転を再開
        _userInteractUntil = performance.now() + 2000;
      }
    }
    canvas.addEventListener('pointerup',     _release);
    canvas.addEventListener('pointercancel', _release);
    canvas.addEventListener('pointerleave',  _release);
    // マウスホイールでズーム（passive:false で preventDefault 可能に）
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : (1 / 1.1);
      camRadius = Math.max(CAM_MIN_R, Math.min(CAM_MAX_R, camRadius * factor));
      _userInteractUntil = performance.now() + 2000;
      _updateCamera();
    }, { passive: false });
    _updateCamera();
  }

  // ── 動的品質（fps を測定し、画面リフレッシュレートの 90% を下回ったら品質を下げる）──
  function _trackFps(now) {
    _fpsFrames.push(now);
    while (_fpsFrames.length > 0 && _fpsFrames[0] < now - 1000) _fpsFrames.shift();
    const fps = _fpsFrames.length;
    // 起動後 2 秒の最大 fps を画面リフレッシュレートと見なす
    if (_fpsTarget === null && now - _fpsStartT > 2000) {
      _fpsTarget = Math.max(60, fps); // 最低 60 を保証
    }
    if (_fpsTarget == null) return;
    // 一度下げたら最低 10 秒は再評価しない
    if (now - _lastQualityChange < 10000) return;
    if (fps < _fpsTarget * 0.9 && qualityLevel !== 'LOW') {
      _lastQualityChange = now;
      _downgradeQuality();
    }
  }
  function _downgradeQuality() {
    const next = qualityLevel === 'HIGH' ? 'MID' : 'LOW';
    qualityLevel = next;
    const q = QUALITY[next];
    // コロナの押し出し量とヘイズ不透明度を更新（メッシュ作り直さず uniform のみ）
    if (coronaLayers[0]) coronaLayers[0].mat.uniforms.uDisplace.value = q.tongueDisplace;
    if (coronaLayers[1] && coronaLayers[1].mat.uniforms.uOpacity) coronaLayers[1].mat.uniforms.uOpacity.value = q.hazeOpacity;
    // パーティクル数を変更（再構築）
    _initParticles(q.particleCount);
    console.info('[cosmos3d] quality →', next, 'fps target=' + _fpsTarget);
  }

  function _animate() {
    animId = requestAnimationFrame(_animate);
    const now = performance.now();
    pulseT += 0.02;
    _trackFps(now);

    // target へなめらかに補間（生成器強化時のサイズ変化を滑らかに見せる）
    cur.radius      += (target.radius      - cur.radius)      * 0.08;
    cur.glowScale   += (target.glowScale   - cur.glowScale)   * 0.08;
    cur.glowOpacity += (target.glowOpacity - cur.glowOpacity) * 0.08;

    if (starMesh) {
      starMesh.rotation.y += 0.0025;
      starMesh.scale.setScalar(cur.radius);
    }
    if (sunMat) sunMat.uniforms.uTime.value = pulseT;
    // コロナ層を更新（半径追従、別速度回転で躍動感）
    for (const L of coronaLayers) {
      L.mat.uniforms.uTime.value = pulseT;
      L.mesh.scale.setScalar(cur.radius);
      L.mesh.rotation.y += L.speed;
    }
    // パーティクル更新（恒星半径に追従して外周を広げる）
    if (particleSystem) {
      particleMat.uniforms.uTime.value = pulseT;
      particleSystem.scale.setScalar(cur.radius);
    }
    // 自動回転（ユーザー操作直後の冷却期間中は停止）
    if (now > _userInteractUntil) {
      camTheta += 0.0015;
      _updateCamera();
    }
    if (glowSprite) {
      // ゆるやかな脈動（±4%）
      const pulse = 1 + Math.sin(pulseT) * 0.04;
      const s = cur.glowScale * pulse;
      glowSprite.scale.set(s, s, 1);
      glowSprite.material.opacity = cur.glowOpacity * (0.94 + Math.sin(pulseT) * 0.06);
    }
    // 惑星の公転 + 自転
    for (const p of planetObjs) {
      p.angle += p.speed;
      p.mesh.position.set(Math.cos(p.angle) * p.orbitRadius, 0, Math.sin(p.angle) * p.orbitRadius);
      p.mesh.rotation.y += 0.01;
    }
    // 超新星演出: 0→1 にかけて急膨張+白くフラッシュ → 1.0以降で星屑に縮小
    if (supernovaT > 0) {
      supernovaT += 1 / 60; // 約60fps想定
      const t = Math.min(supernovaT, 2.5);
      if (t < 1.0) {
        // 膨張+発光
        const expand = 1 + t * 6;
        if (starMesh) starMesh.scale.setScalar(cur.radius * expand);
        for (const L of coronaLayers) {
          L.mesh.scale.setScalar(cur.radius * (expand + 0.3));
          L.mat.uniforms.uColor.value.setRGB(1, 1, 1); // 白くフラッシュ
        }
      } else if (t < 2.0) {
        // 急縮小+暗転
        const k = 1 - (t - 1.0);
        if (starMesh) starMesh.scale.setScalar(cur.radius * k * 0.5);
        for (const L of coronaLayers) {
          L.mesh.scale.setScalar(cur.radius * k);
          L.mat.uniforms.uColor.value.setHex(target.glowColor); // 色を元に戻す
        }
      } else {
        // 終了: 通常スケールへ戻す
        supernovaT = 0;
        if (starMesh) starMesh.scale.setScalar(cur.radius);
        for (const L of coronaLayers) L.mesh.scale.setScalar(cur.radius);
        if (particleSystem) particleSystem.scale.setScalar(cur.radius);
      }
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
    if (sunMat) sunMat.uniforms.uColor.value.setHex(target.glowColor);
    for (const L of coronaLayers) L.mat.uniforms.uColor.value.setHex(target.glowColor);
    if (particleMat) particleMat.uniforms.uColor.value.setHex(target.glowColor);
  }

  // ── 外部 API: 惑星リストを 3D に反映 ──
  // planets = [{ key, name }]。構成（key の並び）が変わったときだけメッシュを再構築する。
  function setPlanets(planets) {
    if (!initialized || !planetGroup) return;
    planets = Array.isArray(planets) ? planets : [];
    const sig = planets.map(p => p.key).join(',');
    if (sig === planetsSig) return; // 変化なし
    planetsSig = sig;

    // 既存メッシュ破棄
    for (const p of planetObjs) {
      planetGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      _removeOrbitLine(p);
    }
    planetObjs = [];

    // 再構築
    planets.forEach((pl, i) => {
      let tex = planetTexCache[pl.key];
      if (!tex) {
        tex = _npotSafe(loader.load('images/cosmos/' + pl.key + '.jpg'));
        planetTexCache[pl.key] = tex;
      }
      const orbitRadius = 1.7 + i * 0.55;
      const size = 0.13 + (pl.key === 'earth' ? 0.02 : 0);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 32, 16),
        new THREE.MeshLambertMaterial({ map: tex })
      );
      // 惑星ごとに開始角を散らし、外側ほどゆっくり公転（見た目のケプラー風）
      const angle = (i / Math.max(1, planets.length)) * Math.PI * 2;
      const speed = 0.012 / (1 + i * 0.35);
      const obj = { mesh, orbitRadius, angle, speed, orbitLine: null };
      planetGroup.add(mesh);
      _addOrbitLine(obj);
      planetObjs.push(obj);
    });
  }

  // 公転軌道を表す薄い円リング（LineLoop）
  function _addOrbitLine(obj) {
    const seg = 96, pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pts.push(Math.cos(a) * obj.orbitRadius, 0, Math.sin(a) * obj.orbitRadius);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineBasicMaterial({ color: 0x7c5cfc, transparent: true, opacity: 0.22 });
    const line = new THREE.LineLoop(g, m);
    obj.orbitLine = line;
    planetGroup.add(line);
  }
  function _removeOrbitLine(obj) {
    if (!obj.orbitLine) return;
    planetGroup.remove(obj.orbitLine);
    obj.orbitLine.geometry.dispose();
    obj.orbitLine.material.dispose();
    obj.orbitLine = null;
  }

  // DOM 準備が整い次第 init（カルーセル外で width=0 のうちは setTimeout 再試行）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── 外部 API: 超新星演出を発火（約2秒）──
  function triggerSupernova() {
    if (!initialized) return;
    supernovaT = 0.01; // > 0 で演出開始（_animate 内で進行）
  }

  return { init, update, setPlanets, triggerSupernova };
})();
