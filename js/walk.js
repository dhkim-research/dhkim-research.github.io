// walk.js — the first-person walk: renderer, light, family shadows, measured|felt seam
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { toon, gradientMap } from './kit.js?v=d1954a06';
import { CITIES, buildCity, vermeerTexture, alpineTexture } from './cities.js?v=19e93967';
import { createRoom, ROOM_STATES } from './room.js?v=ffbe156d';

export { CITIES, ROOM_STATES };

const Z0 = 6, Z1 = -96;              // the walk: from z0 to z1 along -z
const EYE = 1.62;
const K_LUM = 2600;                  // scene-linear 1.0  →  cd/m²
const GLARE = 4000;                  // cd/m² above which the measured view hatches amber

/* ---------------------------------------------------------------- final pass */
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 9000 }, uInkFelt: { value: 0.6 }, uSplit: { value: 0.5 }, uExpo: { value: 1 }, uK: { value: K_LUM }, uGlare: { value: GLARE },
    uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGrade: { value: new THREE.Vector3(1, 1, 1) },
    uFade: { value: 0 }, uFadeCol: { value: new THREE.Color(0xf4efe6) }, uPaper: { value: new THREE.Color(0xf1ede4) }, uInk: { value: new THREE.Color(0x1d2733) },
    uMeasured: { value: 1 }, uFeltEV: { value: 1 },
    uSat: { value: 1.1 }, uCon: { value: 1.0 }, uLift: { value: new THREE.Vector3(0, 0, 0) },
    uSkyTop: { value: new THREE.Color(0x3a74c8) }, uSkyBot: { value: new THREE.Color(0xcfe2f0) }, uSkyMix: { value: 0 }, uOvercast: { value: 0 },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uCloudCov: { value: 0.4 }, uCloudScale: { value: 1.2 }, uCloudLit: { value: new THREE.Color(1, 1, 1) }, uCloudShade: { value: new THREE.Color(0.7, 0.72, 0.8) }, uWind: { value: new THREE.Vector2(0.01, 0.004) }
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uInkFelt; uniform float uSplit, uExpo, uK, uGlare, uTime, uFade, uMeasured; uniform vec2 uRes;
    float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
    uniform vec3 uGrade, uFadeCol, uPaper, uInk, uLift, uSkyTop, uSkyBot; uniform float uFeltEV; uniform float uSat, uCon, uSkyMix, uOvercast, uCloudCov, uCloudScale; uniform mat4 uInvProj, uCamWorld; uniform vec3 uSunDir, uCloudLit, uCloudShade; uniform vec2 uWind; varying vec2 vUv;
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.03; a*=.5; } return v; }
    vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
    vec3 srgb(vec3 c){ c = clamp(c,0.,1.); return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x; return uNear*uFar / (uFar - z*(uFar-uNear)); }
    float edgeAt(vec2 uv, vec2 px){
      float c = lin(uv); vec2 e = 1.0/uRes;
      float l = lin(uv-vec2(e.x,0.)), r = lin(uv+vec2(e.x,0.)), d = lin(uv-vec2(0.,e.y)), u = lin(uv+vec2(0.,e.y));
      float lap = abs(l + r + d + u - 4.0*c) / c;
      return smoothstep(0.02, 0.08, lap) * smoothstep(900.0, 120.0, c);
    }
    void main(){
      vec3 hdr = texture2D(tDiffuse, vUv).rgb * uExpo;
      vec2 px = vUv*uRes;
      float vig = smoothstep(1.25, 0.35, length((vUv-0.5)*vec2(uRes.x/uRes.y,1.0)*1.05));
      float g = hash(px + fract(uTime*7.13)*91.7) - 0.5;
      // ---- felt: tone-mapped, graded, a little warm in the highlights
      float dz = texture2D(tDepth, vUv).x;
      float isSky = step(0.99999, dz);
      vec3 felt = aces(hdr * uGrade * 1.05 * uFeltEV);
      // sky: a painted gradient (keeping the sun's glow) and a perspective cloud deck drawn in two tones
      if (isSky > 0.5) {
        vec4 vv = uInvProj * vec4(vUv*2.0-1.0, 1.0, 1.0); vv /= vv.w;
        vec3 dir = normalize((uCamWorld * vec4(vv.xyz, 0.0)).xyz);
        float sy = smoothstep(0.0, 0.75, dir.y);
        vec3 skyPaint = mix(uSkyBot, uSkyTop, sy);
        vec3 glow = max(felt - vec3(0.8), 0.0);
        vec3 skyCol = mix(felt, skyPaint + glow*0.8, uSkyMix);
        skyCol = mix(skyCol, skyPaint, uOvercast);
        if (dir.y > 0.005) {
          vec2 p = dir.xz / (dir.y + 0.06) * uCloudScale + uWind * uTime;
          float d = fbm(p) + 0.35*fbm(p*2.7 + 3.1) - 0.17;
          float d2 = fbm(p + uSunDir.xz*0.18) + 0.35*fbm((p + uSunDir.xz*0.18)*2.7 + 3.1) - 0.17;
          float lo = 1.0 - uCloudCov;
          float c = smoothstep(lo, lo + 0.06 + 0.25*uOvercast, d) * smoothstep(0.0, 0.12, dir.y);
          float shade = step(0.035, d2 - d + 0.03*sin(p.x*3.0));
          vec3 cc = mix(uCloudLit, uCloudShade, shade*0.85);
          float rim = smoothstep(lo, lo + 0.03, d) - smoothstep(lo + 0.03, lo + 0.09, d);
          cc += rim * uCloudLit * 0.25 * (1.0 - uOvercast);
          skyCol = mix(skyCol, cc, c);
        }
        felt = skyCol;
      }
      float fl = dot(felt, vec3(0.2126,0.7152,0.0722));
      felt = max(mix(vec3(fl), felt, uSat), 0.0);
      felt = clamp((felt - 0.5) * uCon + 0.5, 0.0, 1.0);
      felt = felt + uLift * (1.0 - felt);
      felt = mix(felt, felt*vec3(1.03,1.0,0.95), smoothstep(0.55,1.0,dot(felt,vec3(0.33))));
      float ink = edgeAt(vUv, px);
      felt = srgb(felt);
      felt = mix(felt, felt*vec3(0.32,0.30,0.34), ink*uInkFelt);
      felt = felt * mix(0.8, 1.0, vig) + g*0.022;
      // ---- measured: luminance as ink isolines on paper (quarter-decade steps)
      float L = max(dot(hdr, vec3(0.2126,0.7152,0.0722)) * uK, 1e-3);
      float v = log2(L) / log2(10.0) * 4.0;
      float w = fwidth(v);
      float f = fract(v), d = min(f, 1.0-f) / max(w, 1e-4);
      float line = (1.0 - smoothstep(0.6, 1.6, d)) * (1.0 - smoothstep(0.35, 0.9, w));
      float edge = max(smoothstep(0.6, 1.4, w), ink);
      float band = floor(v) / 22.0;
      vec3 paper = uPaper * mix(0.70, 1.02, clamp(band, 0.0, 1.0));
      vec2 gp = mod(px, 14.0); float grid = (1.0 - step(1.0, gp.x)) * (1.0 - step(1.0, gp.y));
      paper = mix(paper, uInk, grid*0.10);
      float glare = smoothstep(uGlare*0.85, uGlare*1.15, L);
      float hatch = step(0.5, fract((px.x - px.y) / 6.0));
      paper = mix(paper, mix(paper, vec3(0.93,0.62,0.22), 0.55 + 0.25*hatch), glare);
      vec3 meas = mix(paper, uInk, clamp(line*0.85 + edge*0.9, 0.0, 1.0));
      meas += g*0.03;
      // ---- seam
      float sx = uSplit*uRes.x;
      float side = step(px.x, sx) * uMeasured;
      vec3 col = mix(felt, meas, side);
      float seam = 1.0 - smoothstep(0.0, 1.4, abs(px.x - sx));
      float halo = exp(-abs(px.x - sx)/18.0) * (1.0 - side);
      col = mix(col, vec3(1.0,0.97,0.9), seam*0.95*uMeasured) + halo*0.06*uMeasured;
      col = mix(col, uFadeCol, uFade);
      gl_FragColor = vec4(col, 1.0);
    }`
};

/* 1×1 probe: encodes measured luminance at a UV into RG bytes */
const ProbeShader = {
  uniforms: { tDiffuse: { value: null }, uAt: { value: new THREE.Vector2(0.5, 0.5) }, uExpo: { value: 1 }, uK: { value: K_LUM } },
  vertexShader: `void main(){ gl_Position = vec4(position.xy*2.0, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uAt; uniform float uExpo, uK;
    void main(){ vec3 c = vec3(0.); for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) c += texture2D(tDiffuse, uAt + vec2(float(i),float(j))*0.002).rgb;
      float L = max(dot(c/9.0*uExpo, vec3(0.2126,0.7152,0.0722))*uK, 1e-3);
      float lv = clamp((log2(L)/log2(10.0) + 2.0)/8.0, 0.0, 0.99999);
      float hi = floor(lv*255.0)/255.0; float lo = fract(lv*255.0);
      gl_FragColor = vec4(hi, lo, 0.0, 1.0); }`
};

/* ---------------------------------------------------------------- the engine */
export async function createWalk({ canvas, assets = './assets/', onProgress = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.25, 7000);
  camera.rotation.order = 'YXZ';

  /* light */
  const sun = new THREE.DirectionalLight(0xfff1dc, 4.2);
  sun.castShadow = true; sun.shadow.mapSize.set(3072, 3072);
  const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 1.4;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xa9c6ff, 0x7d6a58, 1.0); scene.add(hemi);

  /* sky + environment */
  const sky = new Sky(); sky.scale.setScalar(8000); scene.add(sky);
  const skyEnvScene = new THREE.Scene(); const skyEnv = new Sky(); skyEnvScene.add(skyEnv);
  const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null;

  /* painted clouds — a few big soft cumulus cards far ahead */
  const clouds = makeClouds(); scene.add(clouds.group); clouds.group.visible = false;

  /* materials */
  const mats = {
    wall: toon(), trim: toon(), roof: toon(), dark: toon(), leaf: toon(), ground: toon(), face: toon(),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.12, envMapIntensity: 1.1 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3.2, 3.2, 3.2) })
  };
  const ctx = { vermeer: vermeerTexture(), alpine: alpineTexture(), blank: new THREE.MeshToonMaterial({ color: 0x3a3a3a, gradientMap: gradientMap() }) };

  /* post */
  const size = new THREE.Vector2();
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  rt.depthTexture = new THREE.DepthTexture(4, 4); rt.depthTexture.type = THREE.FloatType;
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
  const fin = new ShaderPass(FinalShader); fin.renderToScreen = true;
  fin.uniforms.tDiffuse.value = rt.texture; fin.uniforms.tDepth.value = rt.depthTexture;
  // probe
  const probeRT = new THREE.WebGLRenderTarget(1, 1);
  const probeMat = new THREE.ShaderMaterial(ProbeShader);
  const probeScene = new THREE.Scene(); const probeQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), probeMat); probeQuad.frustumCulled = false; probeScene.add(probeQuad);
  const probeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const probeBuf = new Uint8Array(4);

  /* models */
  const loader = new GLTFLoader();
  // models ship as base64 text (the host serves .txt, not .glb); decode and parse in memory
  const load = (f) => fetch(assets + f + '.txt').then((r) => { if (!r.ok) throw new Error('missing ' + f); return r.text(); }).then((b64) => {
    const bin = atob(b64.trim()), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Promise((res, rej) => loader.parse(buf.buffer, assets, res, rej));
  });
  let got = 0; const tick = (x) => { got++; onProgress(got / 4); return x; };
  const [soldier, xbot, stork, waterNormals] = await Promise.all([
    load('Soldier.glb').then(tick), load('Xbot.glb').then(tick), load('Stork.glb').then(tick),
    new THREE.TextureLoader().loadAsync(assets + 'waternormals.jpg').then(tick)
  ]);
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

  const shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  function ghost(src, scale, clipName, timeScale = 1, rotY = 0) {
    const root = SkeletonUtils.clone(src.scene);
    root.traverse((o) => { if (o.isMesh) { o.material = shadowMat; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
    const holder = new THREE.Group(); root.rotation.y = rotY; root.scale.setScalar(scale); holder.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const clip = src.animations.find((a) => a.name === clipName) || src.animations[0];
    const act = mixer.clipAction(clip); act.timeScale = timeScale; act.play();
    return { holder, mixer, act };
  }
  // Soldier faces +z in its file; Xbot faces +z — we walk toward −z
  const man = ghost(soldier, 1.0, 'Walk', 1.0, Math.PI);
  const woman = ghost(xbot, 0.93, 'walk', 1.04, Math.PI);
  const child = ghost(xbot, 0.6, 'walk', 1.45, Math.PI);
  const pram = makePram(shadowMat);
  const family = new THREE.Group(); family.add(man.holder, woman.holder, child.holder, pram); scene.add(family);
  const mixers = [man.mixer, woman.mixer, child.mixer];
  // London: an umbrella over the walker's shadow, and drizzle
  const umbrella = new THREE.Group();
  { const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.32, 10, 1, true), shadowMat); c.position.y = 2.05; c.castShadow = true; umbrella.add(c);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), shadowMat); st.position.y = 1.6; st.castShadow = true; umbrella.add(st); }
  umbrella.position.set(0.12, 0, 0.05); man.holder.add(umbrella);
  const RN = 2600, rainPos = new Float32Array(RN * 6), rainSeed = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) { rainSeed[i * 3] = Math.random() * 36 - 18; rainSeed[i * 3 + 1] = Math.random() * 18; rainSeed[i * 3 + 2] = -Math.random() * 40 + 4; }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xe6ebee, transparent: true, opacity: 0.35, depthWrite: false }));
  rain.frustumCulled = false; const fxScene = new THREE.Scene(); fxScene.add(rain);
  function updateRain(t) {
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < RN; i++) {
      const y = ((rainSeed[i * 3 + 1] - t * 7.5) % 18 + 18) % 18, x = cx + rainSeed[i * 3] + y * 0.06, z = cz + rainSeed[i * 3 + 2];
      rainPos.set([x, y, z, x + 0.035, y + 0.55, z], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  // stork, flying ahead
  const storkObj = stork.scene; storkObj.scale.setScalar(0.035);
  storkObj.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  const storkMixer = new THREE.AnimationMixer(storkObj); storkMixer.clipAction(stork.animations[0]).setDuration(1.1).play();
  scene.add(storkObj);

  /* cities */
  const cache = new Map();
  let cur = -1, city = null, water = null;
  function getCity(i) {
    if (!cache.has(i)) cache.set(i, buildCity(i, mats, ctx));
    return cache.get(i);
  }
  function setCity(i) {
    if (i === cur) return;
    if (city) scene.remove(city.root);
    if (water) { scene.remove(water); water.geometry.dispose(); water.material.dispose(); water = null; }
    cur = i; city = getCity(i); scene.add(city.root);
    const C = CITIES[i];
    // sun from behind the walker
    const alt = THREE.MathUtils.degToRad(C.sun.alt), az = THREE.MathUtils.degToRad(C.sun.az);
    const L = new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt));
    state.L.copy(L);
    const u = sky.material.uniforms; for (const s of [sky, skyEnv]) { const uu = s.material.uniforms;
      uu.turbidity.value = C.sky.turbidity; uu.rayleigh.value = C.sky.rayleigh; uu.mieCoefficient.value = C.sky.mie; uu.mieDirectionalG.value = C.sky.g; uu.sunPosition.value.copy(L); }
    if (envRT) envRT.dispose(); envRT = pmrem.fromScene(skyEnvScene); scene.environment = envRT.texture;
    const warm = THREE.MathUtils.clamp((C.sun.alt - 6) / 40, 0, 1);
    sun.color.setRGB(1.0, 0.78 + 0.14 * warm, 0.56 + 0.26 * warm);
    sun.intensity = 4.4 + 1.4 * warm;
    hemi.intensity = 1.15 + 0.25 * warm; hemi.groundColor.set(0x9a8268);
    scene.fog = new THREE.Fog(C.fog[0], C.fog[1], C.fog[2]);
    applyLook(C.look || {}, C.cloudDeck || {}, L, C.grade, C.expo);
    const lk = C.look || {};
    sun.shadow.radius = lk.shadowSoft ?? 1.4;
    if (lk.sunI !== undefined) { sun.intensity = lk.sunI; hemi.intensity = lk.hemiI; }
    if (lk.sunCol) sun.color.set(lk.sunCol); if (lk.hemiSky) hemi.color.set(lk.hemiSky);
    else hemi.color.set(0xa9c6ff);
    rain.visible = C.weather === 'rain'; umbrella.visible = C.weather === 'rain';
    // water
    for (const wd of city.waters) {
      const g = new THREE.PlaneGeometry(wd.w, wd.l);
      water = new Water(g, { textureWidth: 512, textureHeight: 512, waterNormals, sunDirection: L.clone(), sunColor: wd.wet ? 0x404448 : 0xfff0d8,
        waterColor: wd.wet ? 0x2c3034 : wd.big ? 0x1d4a5e : 0x1c2a26, distortionScale: wd.wet ? 0.05 : wd.big ? 1.6 : 0.35, fog: true, alpha: 1 });
      water.rotation.x = -Math.PI / 2; water.position.set(wd.x, wd.y, wd.z);
      water.material.uniforms.size.value = wd.wet ? 30 : wd.big ? 4 : 6;
      if (wd.wet) { water.material.transparent = true; water.material.uniforms.alpha.value = 0.42; water.renderOrder = 1; }
      scene.add(water);
    }
    // the family for this chapter
    const fam = C.family;
    woman.holder.visible = fam !== 'one';
    child.holder.visible = fam === 'three' || fam === 'tokyo';
    pram.visible = fam === 'pram';
    child.holder.children[0].scale.setScalar(fam === 'tokyo' ? 0.66 : 0.58);
    storkObj.visible = C.key === 'delft' || C.key === 'lausanne';
    state.camX = C.camX; state.yaw = C.yaw || 0;
    clouds.tint(C);
  }

  function applyLook(lk, cl, L, grade = [1, 1, 1], expo = 1) {
    const F = fin.uniforms;
    F.uGrade.value.set(...grade); F.uExpo.value = expo;
    F.uSat.value = lk.sat ?? 1.1; F.uCon.value = lk.con ?? 1.0; F.uLift.value.set(...(lk.lift || [0, 0, 0]));
    F.uSkyTop.value.set(lk.skyTop ?? 0x3a74c8); F.uSkyBot.value.set(lk.skyBot ?? 0xcfe2f0);
    F.uSkyMix.value = lk.skyMix ?? 0; F.uOvercast.value = lk.overcast ?? 0;
    F.uCloudCov.value = cl.cov ?? 0.35; F.uCloudScale.value = cl.scale ?? 1.4;
    F.uCloudLit.value.set(cl.lit ?? 0xffffff).multiplyScalar(cl.litI ?? 1.0); F.uCloudShade.value.set(cl.shade ?? 0xb9bdd2);
    F.uWind.value.set(...(cl.wind || [0.012, 0.004])); F.uSunDir.value.copy(L);
    bloom.strength = lk.bloom ?? 0.32;
  }

  /* the room (About · Projects) */
  const room = createRoom(mats);
  let mode = 'walk';
  const look2 = { x: 0, y: 0 };

  const state = { progress: 0, split: 0.5, lookX: 0, lookY: 0, camX: 0, L: new THREE.Vector3(), t: 0, probeAt: new THREE.Vector2(0.5, 0.5), probeL: 0, measured: true };

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); renderer.getDrawingBufferSize(size); rt.setSize(size.x, size.y); bloom.setSize(size.x, size.y); fin.setSize(size.x, size.y);
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 66 : 52; camera.updateProjectionMatrix(); room.resize(w / h);
    renderer.getDrawingBufferSize(size); fin.uniforms.uRes.value.copy(size);
    bloom.resolution.set(size.x / 2, size.y / 2);
  }

  function place(dt) {
    const z = Z0 + (Z1 - Z0) * state.progress;
    const phase = (Z0 - z) / 0.78 * Math.PI;           // a step every 0.78 m
    const x = state.camX;
    camera.position.set(x + Math.sin(phase) * 0.018, EYE + Math.abs(Math.cos(phase)) * 0.028 - 0.014, z);
    const gaze = THREE.MathUtils.smoothstep(state.progress, 0.55, 1.0) * (CITIES[cur].gazeUp ?? 0.12);
    camera.rotation.set(-0.11 + gaze + state.lookY * 0.24, state.yaw - state.lookX * 0.44 + Math.sin(phase * 0.5) * 0.004, 0);
    // family beside and ahead of the walker
    const fz = z - 1.3;   // the family walks just ahead; we see their shadows
    man.holder.position.set(x + 0.3, 0, fz);
    woman.holder.position.set(x + 1.05, 0, fz - 0.1);
    child.holder.position.set(x + 0.68, 0, fz - 0.4);
    pram.position.set(x + 1.15, 0, fz - 1.2);
    // sun & shadow frustum follow the walker
    const tgt = new THREE.Vector3(x, 0, z - 17);
    sun.target.position.copy(tgt); sun.position.copy(tgt).addScaledVector(state.L, 160);
    sky.position.copy(camera.position); clouds.group.position.set(camera.position.x, 0, camera.position.z);
    // stork
    const st = state.t;
    storkObj.position.set(x + 6 + Math.sin(st * 0.21) * 9, 21 + Math.sin(st * 0.5) * 1.5, z - 34 + Math.cos(st * 0.17) * 8);
    storkObj.rotation.y = Math.PI + Math.sin(st * 0.21) * 0.5;
    if (city) for (const m of city.movers) m(st, z);
    if (rain.visible) updateRain(st);
    clouds.drift(st);
    if (water) water.material.uniforms.time.value += dt * 0.6;
  }

  let probeCount = 0;
  function render(dt = 1 / 60) {
    state.t += dt;
    let S = scene, cam = camera;
    if (mode === 'room') {
      room.update(dt, state.t, { x: state.lookX, y: state.lookY });
      const lk = room.look(); applyLook(lk.look, lk.deck, room.L, [1, 1, 1], lk.expo);
      fin.uniforms.uFeltEV.value += (Math.pow(2, room.state.ev) - fin.uniforms.uFeltEV.value) * Math.min(1, dt * 8);
      S = room.scene; cam = room.camera;
    } else {
      fin.uniforms.uFeltEV.value = 1;
      for (const m of mixers) m.update(dt * state.walkRate);
      storkMixer.update(dt);
      place(dt);
    }
    fin.uniforms.uSplit.value = state.split; fin.uniforms.uTime.value = state.t; fin.uniforms.uMeasured.value = state.measured ? 1 : 0;
    renderer.setRenderTarget(rt); renderer.render(S, cam);
    bloom.render(renderer, null, rt, dt, false);
    fin.uniforms.tDiffuse.value = rt.texture;
    fin.uniforms.uNear.value = cam.near; fin.uniforms.uFar.value = cam.far;
    fin.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse); fin.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    renderer.setRenderTarget(null); fin.render(renderer, null, rt, dt, false);
    if (rain.visible && mode === 'walk') { // weather belongs to the felt side only — the meter does not see it
      const sx = Math.round(size.x * (state.measured ? state.split : 0));
      renderer.autoClear = false; renderer.clearDepth(); renderer.setScissorTest(true); renderer.setScissor(sx / renderer.getPixelRatio(), 0, (size.x - sx) / renderer.getPixelRatio(), size.y / renderer.getPixelRatio());
      renderer.render(fxScene, camera);
      renderer.setScissorTest(false); renderer.autoClear = true;
    }
    // probe the HDR buffer under the pointer (cheap: 1 px)
    if ((probeCount++ % 4) === 0) {
      probeMat.uniforms.tDiffuse.value = rt.texture;
      probeMat.uniforms.uAt.value.copy(state.probeAt); probeMat.uniforms.uExpo.value = fin.uniforms.uExpo.value;
      renderer.setRenderTarget(probeRT); renderer.render(probeScene, probeCam); renderer.readRenderTargetPixels(probeRT, 0, 0, 1, 1, probeBuf); renderer.setRenderTarget(null);
      const lv = (probeBuf[0] + probeBuf[1] / 255) / 255; state.probeL = Math.pow(10, lv * 8 - 2);
    }
  }
  state.walkRate = 1;

  window.addEventListener('resize', resize); resize();
  setCity(0);
  return {
    renderer, scene, camera, state, CITIES, resize, render,
    setCity, setProgress(f) { state.progress = THREE.MathUtils.clamp(f, 0, 1); },
    setSplit(v) { state.split = v; }, setLook(x, y) { state.lookX = x; state.lookY = y; },
    setProbe(u, v) { state.probeAt.set(u, v); },
    setMeasured(on) { state.measured = on; },
    fade(v) { fin.uniforms.uFade.value = v; }, setFadeColor(c) { fin.uniforms.uFadeCol.value.set(c); },
    prebuild(i) { getCity(i); },
    setMode(m) { if (m === mode) return; mode = m; if (m === 'walk') { const c = cur; cur = -1; setCity(c); } },
    setRoom(n) { room.setState(n); }, setAI(v) { room.setAI(v); }, room,
    get mode() { return mode; },
    get city() { return cur; }, get sunAlt() { return CITIES[cur].sun.alt; }
  };
}

function makePram(m) {
  const g = new THREE.Group(), add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.rotation.set(rx, ry, rz); k.castShadow = true; g.add(k); };
  add(new THREE.BoxGeometry(0.5, 0.32, 0.82), 0, 0.62, 0);
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 14, 1, false, 0, Math.PI), 0, 0.78, -0.22, 0, 0, Math.PI / 2);
  for (const [x, z] of [[-0.24, -0.3], [0.24, -0.3], [-0.24, 0.3], [0.24, 0.3]]) add(new THREE.TorusGeometry(0.15, 0.025, 6, 16), x, 0.16, z, 0, Math.PI / 2, 0);
  add(new THREE.BoxGeometry(0.04, 0.5, 0.04), -0.2, 0.48, 0.05, 0.3); add(new THREE.BoxGeometry(0.04, 0.5, 0.04), 0.2, 0.48, 0.05, 0.3);
  add(new THREE.BoxGeometry(0.04, 0.04, 0.6), -0.22, 0.95, 0.62, -0.9); add(new THREE.BoxGeometry(0.04, 0.04, 0.6), 0.22, 0.95, 0.62, -0.9);
  add(new THREE.BoxGeometry(0.5, 0.04, 0.04), 0, 1.13, 0.83);
  return g;
}

function cloudTexture(seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const puffs = [];
  for (let i = 0; i < 26; i++) { const x = 70 + r() * 372, w = 1 - Math.abs(x - 256) / 230; puffs.push([x, 170 - r() * 90 * w - 10, 26 + r() * 46 * (0.4 + w)]); }
  // shadowed underside first, lit tops after
  for (const [x, y, rr] of puffs) { const gr = g.createRadialGradient(x, y + rr * 0.25, rr * 0.2, x, y + rr * 0.25, rr); gr.addColorStop(0, 'rgba(196,186,196,0.95)'); gr.addColorStop(1, 'rgba(196,186,196,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y + rr * 0.25, rr, 0, 7); g.fill(); }
  for (const [x, y, rr] of puffs) { const gr = g.createRadialGradient(x - rr * 0.2, y - rr * 0.3, rr * 0.1, x, y, rr * 0.9); gr.addColorStop(0, 'rgba(255,252,244,1)'); gr.addColorStop(0.7, 'rgba(255,246,232,0.85)'); gr.addColorStop(1, 'rgba(255,246,232,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y - rr * 0.12, rr * 0.86, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'destination-in'; const fade = g.createLinearGradient(0, 0, 0, 256); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.78, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fade; g.fillRect(0, 0, 512, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeClouds() {
  const group = new THREE.Group(), cards = [];
  const texs = [cloudTexture(11), cloudTexture(29), cloudTexture(47), cloudTexture(83)];
  const spots = [[-700, 260, -1700, 900], [500, 330, -2100, 1100], [-160, 420, -2600, 1300], [1300, 300, -1600, 800], [-1500, 380, -2200, 1000], [200, 210, -1300, 600], [900, 520, -2900, 1500], [-1100, 560, -3100, 1600], [-400, 180, -1100, 520], [700, 160, -1000, 480]];
  spots.forEach(([x, y, z, w], i) => {
    const m = new THREE.MeshBasicMaterial({ map: texs[i % 4], transparent: true, depthWrite: false, fog: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), m); p.position.set(x, y, z); p.userData.y = y; p.renderOrder = -1; group.add(p); cards.push(p);
  });
  let wind = 0;
  return { group, tint(C) {
    const warm = THREE.MathUtils.clamp(1 - (C.sun.alt - 6) / 30, 0, 1), n = C.clouds === undefined ? 4 : C.clouds, k = C.cloudScale || 1, br = C.cloudBright || 1.5;
    wind = C.wind || 0;
    cards.forEach((p, i) => { p.visible = i < n; p.userData.x = p.userData.x ?? p.position.x; p.position.y = p.userData.y * (C.cloudScale ? 0.85 : 1) + (C.cloudY || 0); p.scale.setScalar(k);
      p.material.color.setRGB(br + 0.2 * warm, br * 0.97, br * 0.94 - 0.2 * warm); });
  }, drift(t) { cards.forEach((p, i) => { p.position.x = p.userData.x + ((t * wind * (0.7 + 0.1 * i)) % 3000); }); } };
}
