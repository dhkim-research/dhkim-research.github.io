// walk.js — the first-person walk: renderer, light, family shadows, measured|felt seam
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { toon, gradientMap } from './kit.js?v=d1954a06';
import { CITIES, buildCity, vermeerTexture, alpineTexture } from './cities.js?v=3e9c0b28';
import { createRoom, ROOM_STATES } from './room.js?v=f2867de1';

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
    uMeasured: { value: 1 }, uFeltEV: { value: 1 }, uFalse: { value: 0 }, uArt: { value: 0 },
    uSat: { value: 1.1 }, uCon: { value: 1.0 }, uLift: { value: new THREE.Vector3(0, 0, 0) },
    uSkyTop: { value: new THREE.Color(0x3a74c8) }, uSkyBot: { value: new THREE.Color(0xcfe2f0) }, uSkyMix: { value: 0 }, uOvercast: { value: 0 },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uCloudCov: { value: 0.4 }, uCloudScale: { value: 1.2 }, uCloudLit: { value: new THREE.Color(1, 1, 1) }, uCloudShade: { value: new THREE.Color(0.7, 0.72, 0.8) }, uWind: { value: new THREE.Vector2(0.01, 0.004) }
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uInkFelt; uniform float uSplit, uExpo, uK, uGlare, uTime, uFade, uMeasured, uFalse, uArt; uniform vec2 uRes;
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
    // felt side through a painter's hand (uArt 1 = Van Gogh, 2 = Monet): the image is smeared along a flow of
    // brush strokes and the strokes leave bristle marks (a line integral of noise along the same flow)
    void main(){
      vec3 hdrM = texture2D(tDiffuse, vUv).rgb * uExpo;                   // the meter reads the scene as it is
      vec3 hdr = hdrM; float stroke = 0.5; vec2 uvF = vUv;
      // painters: 1 Van Gogh · 2 Monet · 3 Hodler · 4 Jansson · 5 Klee · 6 Hiroshige
      float kk = 900.0 / uRes.y; vec2 sp = vUv * uRes * kk;
      vec2 kcell = vec2(0.), kf = vec2(0.);
      if (uArt > 4.5 && uArt < 5.5) {                                    // Klee: the scene seen through a grid of coloured squares
        float cs = 34.0; vec2 g = sp / cs + 0.06 * vec2(vnoise(sp * 0.03), vnoise(sp * 0.03 + 7.1));   // hand-ruled, never quite straight
        kcell = floor(g); kf = fract(g) - 0.5;
        vec2 cuv = vUv + (-kf * cs) / (uRes * kk);
        hdr = mix(texture2D(tDiffuse, cuv).rgb * uExpo, hdrM, 0.7); stroke = hash(kcell);
      } else if (uArt > 0.5 && uArt < 4.5) {
        vec2 d; float stepPx, cell;
        if (uArt < 1.5) {        // Van Gogh: long swirls
          vec2 q = sp / 230.0 + uTime * 0.003; float e = 0.04, n0 = fbm(q), nx = fbm(q + vec2(e, 0.)), ny = fbm(q + vec2(0., e));
          d = normalize(vec2(ny - n0, -(nx - n0)) + vec2(1e-5, 0.)); stepPx = 2.6; cell = 2.2;
        } else if (uArt < 2.5) { // Monet: short, restless dabs
          vec2 q = sp / 95.0; float e = 0.04, n0 = fbm(q), nx = fbm(q + vec2(e, 0.)), ny = fbm(q + vec2(0., e));
          d = normalize(vec2(ny - n0, -(nx - n0)) + vec2(1e-5, 0.)); stepPx = 1.25; cell = 1.6;
        } else if (uArt < 3.5) { // Hodler: everything laid in parallel, horizontal bands
          d = normalize(vec2(1.0, 0.06 * sin(sp.y * 0.02))); stepPx = 2.4; cell = 3.4;
        } else {                 // Jansson: long, slow curves, like water at dusk
          vec2 q = sp / 420.0 + uTime * 0.002; float e = 0.04, n0 = fbm(q), nx = fbm(q + vec2(e, 0.)), ny = fbm(q + vec2(0., e));
          d = normalize(vec2(ny - n0, -(nx - n0)) + vec2(1e-5, 0.)); stepPx = 2.1; cell = 2.6;
        }
        vec3 acc = vec3(0.); float tex = 0.;
        for (int k = -4; k <= 4; k++) {
          vec2 o = d * float(k) * stepPx;
          acc += texture2D(tDiffuse, vUv + o / (uRes * kk)).rgb;
          tex += hash(floor((sp + o) / cell));
        }
        hdr = acc / 9.0 * uExpo; stroke = tex / 9.0;
      } else if (uArt > 5.5) {   // Hiroshige: no strokes — a woodblock: the grain of the block and the fibres of the paper
        stroke = 0.5 + 0.5 * (vnoise(vec2(sp.x * 0.9, sp.y * 0.05)) - 0.5) + 0.25 * (hash(floor(sp * 0.5)) - 0.5);
      }
      vec2 px = vUv*uRes;
      float vig = smoothstep(1.25, 0.35, length((vUv-0.5)*vec2(uRes.x/uRes.y,1.0)*1.05));
      float g = hash(px + fract(uTime*7.13)*91.7) - 0.5;
      // ---- felt: tone-mapped, graded, a little warm in the highlights
      float dz = texture2D(tDepth, uvF).x;
      float isSky = step(0.99999, dz);
      vec3 felt = aces(hdr * uGrade * 1.05 * uFeltEV);
      // sky: a painted gradient (keeping the sun's glow) and a perspective cloud deck drawn in two tones
      if (isSky > 0.5) {
        vec4 vv = uInvProj * vec4(uvF*2.0-1.0, 1.0, 1.0); vv /= vv.w;
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
        if (uArt > 2.5 && uArt < 3.5 && dir.y > 0.0) {                    // Hodler: clouds in rows parallel to the lake
          float rib = sin(dir.y * 70.0 + fbm(dir.xz / (dir.y + 0.1) * 0.4) * 5.0);
          float cr = smoothstep(0.55, 0.8, rib) * smoothstep(0.02, 0.1, dir.y) * (1.0 - smoothstep(0.35, 0.6, dir.y));
          skyCol = mix(skyCol, mix(vec3(.98,.95,.86), vec3(.78,.80,.88), smoothstep(0.65, 0.8, rib)), cr);
        }
        if (uArt > 5.5) {                                                  // Hiroshige: the bokashi — Prussian blue printed down from the top
          skyCol = mix(skyCol, vec3(.02,.07,.26), smoothstep(0.55, 0.95, vUv.y) * 0.9);
          skyCol = mix(skyCol, vec3(.96,.86,.70), smoothstep(0.35, 0.0, dir.y) * 0.35);   // a warm wash at the horizon
        }
        felt = skyCol;
      }
      float fl = dot(felt, vec3(0.2126,0.7152,0.0722));
      felt = max(mix(vec3(fl), felt, uSat), 0.0);
      felt = clamp((felt - 0.5) * uCon + 0.5, 0.0, 1.0);
      felt = felt + uLift * (1.0 - felt);
      felt = mix(felt, felt*vec3(1.03,1.0,0.95), smoothstep(0.55,1.0,dot(felt,vec3(0.33))));
      float ink = edgeAt(vUv, px);
      if (uArt > 0.5) {
        float l = dot(felt, vec3(0.2126, 0.7152, 0.0722));
        float st = clamp((stroke - 0.5) * 3.2 + 0.5, 0.0, 1.0);
        vec3 tint;
        if (uArt < 1.5) {   // Van Gogh: ultramarine shadows, chrome-yellow lights, everything a little more
          tint = l < 0.45 ? mix(vec3(.02,.05,.28), vec3(.10,.30,.30), l / 0.45) : mix(vec3(.10,.30,.30), vec3(1.0,.80,.22), (l - 0.45) / 0.55);
          felt = mix(felt * 1.08, tint, 0.38);
        } else if (uArt < 2.5) { // Monet's London: violet and blue close by, the fog glowing rose and orange as it recedes
          float glowR = 1.0 - smoothstep(0.0, 0.75, length((vUv - vec2(0.6, 0.6)) * vec2(uRes.x / uRes.y, 1.0)));
          float far = clamp(max(max(isSky, smoothstep(15.0, 120.0, lin(vUv))) * 0.85, glowR * 0.7), 0.0, 1.0);
          vec3 a0 = mix(vec3(.05,.05,.24), vec3(.30,.17,.32), far), a1 = mix(vec3(.34,.32,.66), vec3(.86,.50,.46), far), a2 = mix(vec3(.88,.62,.74), vec3(1.0,.74,.36), far);
          tint = l < 0.5 ? mix(a0, a1, l / 0.5) : mix(a1, a2, (l - 0.5) / 0.5);
          felt = mix(felt, tint, 0.7);
          felt = clamp((felt - 0.42) * 1.22 + 0.42, 0.0, 1.0);       // deeper blue-violet silhouettes against the glow
          felt = mix(felt, vec3(1.0,.55,.25), step(0.965, stroke + hash(floor(px / 3.0)) * 0.04) * far * 0.6);   // flecks of orange in the fog
          ink *= 0.3;       // Monet drew no outlines
        }
        if (uArt > 2.5 && uArt < 3.5) {        // Hodler: flat, clear, a few colours — lake turquoise, violet shade, pale gold light
          tint = l < 0.5 ? mix(vec3(.10,.12,.36), vec3(.16,.48,.56), l / 0.5) : mix(vec3(.16,.48,.56), vec3(.98,.92,.62), (l - 0.5) / 0.5);
          felt = mix(floor(felt * 6.0 + 0.5) / 6.0, tint, 0.38);
        } else if (uArt > 3.5 && uArt < 4.5) { // Jansson: Stockholm in deep Prussian blue, every light turned to gold
          tint = l < 0.5 ? mix(vec3(.01,.03,.16), vec3(.06,.20,.52), l / 0.5) : mix(vec3(.06,.20,.52), vec3(1.0,.74,.30), (l - 0.5) / 0.5);
          felt = mix(felt, tint, 0.62);
        } else if (uArt > 4.5 && uArt < 5.5) { // Klee: each square its own warm or cool, borders left as bare ground
          vec3 kp = stroke < 0.17 ? vec3(.90,.55,.25) : stroke < 0.34 ? vec3(.80,.36,.38) : stroke < 0.5 ? vec3(.25,.55,.55) : stroke < 0.67 ? vec3(.52,.40,.62) : stroke < 0.84 ? vec3(.88,.78,.45) : vec3(.55,.62,.42);
          felt = mix(felt, felt * kp * 1.9, 0.34);
          float bd = smoothstep(0.44, 0.5, max(abs(kf.x), abs(kf.y)));
          felt = mix(felt, vec3(.86,.80,.68), bd * 0.3);
        } else if (uArt > 5.5) {               // Hiroshige: flat colour in four values, and the ink line does the drawing
          tint = l < 0.45 ? mix(vec3(.06,.09,.24), vec3(.42,.52,.50), l / 0.45) : mix(vec3(.42,.52,.50), vec3(.97,.92,.80), (l - 0.45) / 0.55);
          felt = mix(felt, tint, 0.3);                                     // indigo, a grey-green, and the paper itself
          felt = floor(felt * 4.0 + 0.5) / 4.0 * 0.6 + felt * 0.4;
          ink = min(1.0, ink * 1.4);
        }
        float bristle = uArt < 1.5 ? 0.40 : uArt < 2.5 ? 0.36 : uArt < 3.5 ? 0.16 : uArt < 4.5 ? 0.26 : uArt < 5.5 ? 0.12 : 0.22;
        felt *= (1.0 - bristle * 0.5) + bristle * st;                       // bristle marks, paper grain or woodblock fibre
      }
      felt = srgb(felt);
      felt = mix(felt, felt*vec3(0.32,0.30,0.34), ink*uInkFelt);
      felt = felt * mix(0.8, 1.0, vig) + g*0.022;
      // ---- measured: luminance as ink isolines on paper (quarter-decade steps)
      float L = max(dot(hdrM, vec3(0.2126,0.7152,0.0722)) * uK, 1e-3);
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
      // ---- or as an HDR tool shows it: false colour on log10 cd/m², 1 → 100 000, decade lines, the sun white
      if (uFalse > 0.001) {
        float lg = log2(L) / log2(10.0), t = clamp(lg, 0.0, 5.0);
        vec3 c0 = vec3(.071,.063,.157), c1 = vec3(.204,.141,.471), c2 = vec3(.086,.502,.627), c3 = vec3(.376,.769,.471), c4 = vec3(.965,.831,.282), c5 = vec3(.980,.376,.157);
        vec3 fc = t < 1.0 ? mix(c0, c1, t) : t < 2.0 ? mix(c1, c2, t - 1.0) : t < 3.0 ? mix(c2, c3, t - 2.0) : t < 4.0 ? mix(c3, c4, t - 3.0) : mix(c4, c5, t - 4.0);
        fc = mix(fc, vec3(1.0), smoothstep(5.0, 5.3, lg));
        float vd = lg * 2.0, wd = fwidth(vd), fd = fract(vd), dd = min(fd, 1.0 - fd) / max(wd, 1e-4);
        float dline = (1.0 - smoothstep(0.5, 1.4, dd)) * (1.0 - smoothstep(0.35, 0.9, wd)) * (mod(floor(vd + 0.5), 2.0) < 0.5 ? 0.55 : 0.25);
        fc = mix(fc, vec3(0.02, 0.02, 0.05), max(dline, edge * 0.45));
        meas = mix(meas, fc, uFalse);
      }
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
  uniforms: { tDiffuse: { value: null }, uAt: { value: new THREE.Vector2(0.5, 0.5) }, uExpo: { value: 1 }, uK: { value: K_LUM }, uRad: { value: new THREE.Vector2(0.002, 0.002) } },
  vertexShader: `void main(){ gl_Position = vec4(position.xy*2.0, 0.0, 1.0); }`,
  // the mean over the meter's 1° acceptance spot (uRad = its radius in UV), as a spot luminance meter reads
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uAt, uRad; uniform float uExpo, uK;
    void main(){ vec3 c = vec3(0.); for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) c += texture2D(tDiffuse, uAt + vec2(float(i),float(j))*uRad*0.7).rgb;
      float L = max(dot(c/9.0*uExpo, vec3(0.2126,0.7152,0.0722))*uK, 1e-3);
      float lv = clamp((log2(L)/log2(10.0) + 2.0)/8.0, 0.0, 0.99999);
      float hi = floor(lv*255.0)/255.0; float lo = fract(lv*255.0);
      gl_FragColor = vec4(hi, lo, 0.0, 1.0); }`
};

/* a coarse luminance map of the frame (log10 cd/m² in two bytes), read back a few times a second for contour labels */
const GridShader = {
  uniforms: { tDiffuse: { value: null }, uExpo: { value: 1 }, uK: { value: K_LUM }, uSize: { value: new THREE.Vector2(128, 72) } },
  vertexShader: `void main(){ gl_Position = vec4(position.xy*2.0, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uSize; uniform float uExpo, uK;
    void main(){ vec2 uv = gl_FragCoord.xy / uSize, h = 0.25 / uSize; vec3 c = vec3(0.);
      c += texture2D(tDiffuse, uv + vec2(-h.x,-h.y)).rgb; c += texture2D(tDiffuse, uv + vec2(h.x,-h.y)).rgb; c += texture2D(tDiffuse, uv + vec2(-h.x,h.y)).rgb; c += texture2D(tDiffuse, uv + h).rgb;
      float L = max(dot(c*0.25*uExpo, vec3(0.2126,0.7152,0.0722))*uK, 1e-3);
      float lv = clamp((log2(L)/log2(10.0) + 2.0)/8.0, 0.0, 0.99999);
      gl_FragColor = vec4(floor(lv*255.0)/255.0, fract(lv*255.0), 0.0, 1.0); }`
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
  const GW = 128; let GH = 72, gridRT = new THREE.WebGLRenderTarget(GW, GH), gridBuf = new Uint8Array(GW * GH * 4);
  const gridMat = new THREE.ShaderMaterial(GridShader), gridScene = new THREE.Scene(); { const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gridMat); q.frustumCulled = false; gridScene.add(q); }

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
    if (!cache.has(i)) { const c = buildCity(i, mats, ctx); c.static = c.root.children[c.root.children.length - 1]; cache.set(i, c); c.bakedP = bakeLight(i, c); roadPaint(i, c); streetArt(i, c); pixelPal(i, c); }
    return cache.get(i);
  }
  /* ray-traced sky light and bounce light, baked once in Blender (bake/bake_city.py) into lm/<city>.webp.
     Direct sun and its shadows stay live; the lightmap replaces most of the hemisphere fill. */
  const bakedRamp = new THREE.DataTexture(new Uint8Array([40, 64, 190, 255]), 4, 1, THREE.RedFormat);   // a little painted lift stays in the shade
  bakedRamp.minFilter = bakedRamp.magFilter = THREE.NearestFilter; bakedRamp.needsUpdate = true;
  const BAKED_HEMI = 0.35;           // a little hemisphere light stays for the walkers, buses and trams
  let hemiBase = 1, useBaked = true;
  const lmIndex = fetch(new URL('../lm/index.json', import.meta.url).href, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((j) => { lmVer = j.v || ''; return j.cities || []; }).catch(() => []);
  let lmVer = '';
  async function bakeLight(i, c) {
    const url = (f) => new URL(`../lm/${CITIES[i].key}${f}?v=${lmVer}`, import.meta.url).href;
    try {
      if (!(await lmIndex).includes(CITIES[i].key)) return;
      const r = await fetch(url('.json')); if (!r.ok) return;
      const meta = await r.json();
      const [buf, tex] = await Promise.all([fetch(url('.uv1.bin')).then((q) => q.arrayBuffer()), new THREE.TextureLoader().loadAsync(new URL(`../lm/${meta.map}?v=${lmVer}`, import.meta.url).href)]);
      tex.channel = 1; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;   // islands sit 1–2 px apart: no mips, no bleeding
      const grp = c.static;
      for (const part of meta.meshes) {
        const mesh = grp.children.find((m) => m.name === part.name);
        if (!mesh || mesh.geometry.attributes.position.count !== part.count) { console.warn('lightmap: geometry changed since the bake —', CITIES[i].key, part.name); continue; }
        mesh.geometry.setAttribute('uv1', new THREE.BufferAttribute(new Uint16Array(buf, part.offset, part.count * 2), 2, true));
        const m = mesh.material.clone(); m.lightMap = tex; m.lightMapIntensity = meta.lmMax; m.gradientMap = bakedRamp;
        mesh.userData.live = mesh.material; mesh.userData.baked = m; if (useBaked) mesh.material = m;
      }
      c.baked = true; if (cur === i) lightFill();
    } catch (e) { /* no lightmap for this city: the live look stays */ }
  }
  /* the city's name painted on the street ahead, the way that city paints its roads: stretched along the
     walk so it reads in perspective, a little worn. Typography in the world instead of on a panel. */
  const PAINT = {
    // [word, years, paint, metres right of the walker's line]
    london: ['LONDON', '2007–2018', '#f2efe6', -1.9], delft: ['DELFT', '2018–2020', '#f2efe6', 0.4], lausanne: ['LAUSANNE', '2021–2024', '#f2efe6', 0.9],
    stockholm: ['STOCKHOLM', '2024', '#f2efe6', 1.2], zurich: ['ZÜRICH', '2025–2026', '#f2c230', -1.6], tokyo: ['東京', '2026–', '#f2efe6', 0.1]
  };
  async function roadPaint(i, c) {
    const C = CITIES[i], P = PAINT[C.key]; if (!P) return;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 2048;
    const g = cv.getContext('2d'), ja = C.key === 'tokyo';
    try { await document.fonts.load(ja ? '500 200px "IBM Plex Sans JP"' : '600 200px Archivo'); } catch (e) { /* system font then */ }
    g.clearRect(0, 0, 512, 2048); g.fillStyle = P[2]; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // letters 4.5× taller than wide, as road markings are, so they look right from eye height
    const word = P[0], fam = ja ? '"IBM Plex Sans JP", "Hiragino Sans", sans-serif' : 'Archivo, "Arial Narrow", sans-serif';
    g.font = `${ja ? 500 : 600} 120px ${fam}`;
    const tw = g.measureText(word).width, sx = Math.min(1, 470 / tw);
    g.save(); g.translate(256, 1250); g.scale(sx, 4.6); g.fillText(word, 0, 0); g.restore();
    g.font = `500 64px "IBM Plex Mono", ui-monospace, monospace`;
    g.save(); g.translate(256, 1840); g.scale(1, 3.2); g.fillText(P[1], 0, 0); g.restore();
    // wear: the paint has been walked on
    g.globalCompositeOperation = 'destination-out';
    let r = 7 + i; const rnd = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646;
    for (let k = 0; k < 2600; k++) { g.globalAlpha = 0.25 + rnd() * 0.6; g.beginPath(); g.ellipse(rnd() * 512, rnd() * 2048, 0.6 + rnd() * 2.2, 1.5 + rnd() * 6, 0, 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: bakedRamp, transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const W_ = 2.3, L_ = 9.2, mesh = new THREE.Mesh(new THREE.PlaneGeometry(W_, L_), m);
    mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true; mesh.name = 'paint';
    // on the ground just left of the walker's line, 8–17 m ahead of where the walk begins
    const x = C.camX + P[3], z = Z0 - 14;
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0), 0, 12);
    c.static.updateMatrixWorld(true);
    const hit = ray.intersectObject(c.static, true)[0];
    mesh.position.set(x, (hit ? hit.point.y : 0) + (C.weather === 'rain' ? 0.02 : 0.004), z);   // above the wet sheen in London
    mesh.renderOrder = 2;
    c.root.add(mesh);
  }
  /* London: one stencil piece sprayed on the pavement along the walk — street-art manner, an original image:
     a figure under an umbrella holds a light meter up to a grey sky; a small sun is stuck behind the cloud. */
  function streetArt(i, c) {
    if (CITIES[i].key !== 'london') return;
    const N = 1024, cv = document.createElement('canvas'); cv.width = N; cv.height = N; const g = cv.getContext('2d');
    const ink = '#141414', sun = '#f2c230';
    const shapes = (ctx, col) => {
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // the cloud
      for (const [x, y, r] of [[600, 190, 66], [680, 160, 88], [775, 185, 70], [720, 225, 66], [640, 235, 52]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      // a city gent in a long coat and a bowler hat
      ctx.beginPath(); ctx.moveTo(388, 560); ctx.lineTo(462, 560); ctx.lineTo(500, 845); ctx.lineTo(350, 845); ctx.closePath(); ctx.fill();
      ctx.fillRect(388, 840, 28, 70); ctx.fillRect(436, 840, 28, 70);
      ctx.beginPath(); ctx.ellipse(392, 912, 32, 11, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(460, 912, 32, 11, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(425, 515, 36, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(425, 486, 46, 10, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(425, 482, 30, Math.PI, 0); ctx.fill();
      // an open umbrella held low over the shoulder: flat canopy, scalloped rim, ribs showing, hooked handle
      ctx.save(); ctx.translate(300, 470); ctx.rotate(-0.18);
      ctx.beginPath(); ctx.moveTo(-175, 40);
      ctx.bezierCurveTo(-150, -40, 150, -40, 175, 40);
      for (let k = 0; k < 6; k++) { const x0 = 175 - k * 58.3; ctx.quadraticCurveTo(x0 - 29, 16, x0 - 58.3, 40); }
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 6;
      for (const xr of [-116, -58, 0, 58, 116]) { ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(xr, 34); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 175); ctx.stroke();
      ctx.beginPath(); ctx.arc(-18, 175, 18, 0, Math.PI); ctx.stroke(); ctx.restore();
      ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(398, 600); ctx.lineTo(345, 650); ctx.lineTo(312, 640); ctx.stroke();
      // the other arm up, a spot meter aimed at the cloud
      ctx.beginPath(); ctx.moveTo(455, 590); ctx.lineTo(522, 505); ctx.lineTo(548, 425); ctx.stroke();
      ctx.save(); ctx.translate(560, 392); ctx.rotate(0.6); ctx.fillRect(-20, -46, 40, 66); ctx.beginPath(); ctx.arc(0, -52, 16, 0, 7); ctx.fill(); ctx.restore();
      ctx.lineWidth = 7; ctx.setLineDash([2, 22]); ctx.beginPath(); ctx.moveTo(590, 335); ctx.lineTo(655, 240); ctx.stroke(); ctx.setLineDash([]);
      // the words, in stencil letters
      ctx.font = '900 64px Impact, "Arial Narrow", Archivo, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('STILL LOOKING', 520, 1000);
    };
    // the sun first, half hidden behind the cloud, in the one colour
    g.fillStyle = sun; g.beginPath(); g.arc(800, 120, 46, 0, 7); g.fill();
    g.strokeStyle = sun; g.lineWidth = 10; g.lineCap = 'round';
    for (let k = 0; k < 8; k++) { const a = -Math.PI * 0.9 + k * 0.27; g.beginPath(); g.moveTo(800 + Math.cos(a) * 66, 120 + Math.sin(a) * 66); g.lineTo(800 + Math.cos(a) * 92, 120 + Math.sin(a) * 92); g.stroke(); }
    // overspray: the same shapes, blurred and faint, then the crisp stencil on top
    g.save(); g.filter = 'blur(6px)'; g.globalAlpha = 0.35; shapes(g, ink); g.restore();
    shapes(g, ink);
    // stencil bridges in the letters, and a few drips
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (let x = 300; x < 760; x += 37) g.fillRect(x, 952, 5, 60);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = ink;
    let r = 11; const rnd = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646;
    for (const [x, y] of [[372, 845], [480, 845], [700, 268], [610, 280], [540, 1005], [430, 1008], [300, 515]]) { const L = 30 + rnd() * 110; g.fillRect(x - 2.5, y, 5, L); g.beginPath(); g.arc(x, y + L, 5, 0, 7); g.fill(); }
    // speckle: spray paint never covers evenly
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 3500; k++) { g.globalAlpha = 0.2 + rnd() * 0.5; g.beginPath(); g.arc(rnd() * N, rnd() * N, 0.6 + rnd() * 1.6, 0, 7); g.fill(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: bakedRamp, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    // sprayed on the pavement ahead, stretched along the walk like the road paint so it reads from eye height
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 7.6), m); mesh.receiveShadow = true; mesh.renderOrder = 2; mesh.rotation.x = -Math.PI / 2;
    const x = CITIES[i].camX + 1.25, z = Z0 - 10.5;
    c.static.updateMatrixWorld(true);
    const hit = new THREE.Raycaster(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0), 0, 12).intersectObject(c.static, true)[0];
    mesh.position.set(x, (hit ? hit.point.y : 0.14) + 0.02, z);
    c.root.add(mesh);
  }

  /* Tokyo: a small 8-bit colleague who runs on ahead, light meter in hand, and climbs every vending machine on the way.
     Its readout is a rough horizontal illuminance: direct sun when the sky is clear to the sun, sky alone in shade. */
  function pixelPal(i, c) {
    const C = CITIES[i]; if (C.key !== 'tokyo') return;
    // the right-hand pavement, and the vending machines along it to climb on (sampled once, by casting down)
    c.static.updateMatrixWorld(true);
    const down = new THREE.Raycaster(); down.far = 12; const DN = new THREE.Vector3(0, -1, 0), XW = 3.15, XM = 3.0;
    const prof = [];
    for (let z = 40; z >= -150; z -= 0.25) {
      down.set(new THREE.Vector3(XW, 6, z), DN); const g = down.intersectObject(c.static, true)[0];
      down.set(new THREE.Vector3(XM, 6, z), DN); const m = down.intersectObject(c.static, true)[0];
      const top = m && m.point.y > 1.7 && m.point.y < 2.1 ? m.point.y : null;
      prof.push({ z, g: g ? g.point.y : 0.15, m: top });
    }
    const spot = (z) => prof[THREE.MathUtils.clamp(Math.round((40 - z) / 0.25), 0, prof.length - 1)];
    const PAL = { K: '#16161f', H: '#2a2230', S: '#f0c49c', G: '#e8f6ff', C: '#f4f1ea', c: '#c4c8cc', T: '#1f9e8f', P: '#2c3c70', B: '#121216', M: '#5c6370', D: '#ffffff', Y: '#ffd23f' };
    const F = {
      measure: ['...........DDD..', '..........KMMMK.', '....KKKK...MMM..', '...KHHHHK...S...', '..KHHHHHHK..S...', '..KHSSSSHK..C...', '..KHGKGSSK..C...', '..KSSSSSSK.CC...', '...KSSSSK.CC....', '..TTTTTTTTC.....', '.CCCCTCCCC......', '.CCCCTCCCc......', '.CCcCCCCcC......', '.SCcCCCCcC......', '..CcCCCCcC......', '..CCCCCCCC......', '...PPP.PPP......', '...PPP.PPP......', '...PP...PP......', '..BBB..BBB......'],
      run1:    ['................', '................', '....KKKK....DDD.', '...KHHHHK..KMMMK', '..KHHHHHHK..MMM.', '..KHSSSSHK...S..', '..KHGKGSSK..CC..', '..KSSSSSSK.CC...', '...KSSSSK.CC....', '..TTTTTTTTC.....', '.CCCCTCCCC......', 'SCCCCTCCCc......', '.CCcCCCCcC......', '..CcCCCCcC......', '..CCCCCCCC......', '..PPP..PPP......', '.PPP....PPP.....', 'PPP......PP.....', 'BB.......BBB....', '................'],
      run2:    ['................', '................', '....KKKK....DDD.', '...KHHHHK..KMMMK', '..KHHHHHHK..MMM.', '..KHSSSSHK...S..', '..KHGKGSSK..CC..', '..KSSSSSSK.CC...', '...KSSSSK.CC....', '..TTTTTTTTC.....', '.CCCCTCCCC......', '.CCCCTCCCc......', '.SCcCCCCcC......', '..CcCCCCcC......', '..CCCCCCCC......', '...PPPPPP.......', '....PPPP........', '....PP.PP.......', '...BBB.BBB......', '................'],
      jump:    ['............DDD.', '...........KMMMK', '....KKKK....MMM.', '...KHHHHK...S...', '..KHHHHHHK..S...', '..KHSSSSHK..C...', 'S.KHGKGSSK.CC...', 'C.KSSSSSSKCC....', 'CC.KSSSSKCC.....', '.CTTTTTTTTC.....', '..CCCTCCCC......', '..CCCTCCCc......', '..CcCCCCcC......', '..CcCCCCcC......', '..CCCCCCCC......', '..PPPPPPPP......', '..PP....PP......', '.BBB....BBB.....', '................', '................']
    };
    const tex = {};
    for (const [k, rows] of Object.entries(F)) for (const flip of [0, 1]) {
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 20; const g = cv.getContext('2d');
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = PAL[ch]; g.fillRect(flip ? 15 - x : x, y, 1, 1); } }));
      const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
      tex[k + flip] = t;
    }
    const pal = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.measure0, color: new THREE.Color(1.1, 1.1, 1.1), alphaTest: 0.5, fog: false }));
    pal.center.set(0.5, 0); pal.scale.set(1.04, 1.3, 1); c.root.add(pal);
    // the readout: a 3×5 pixel font in a small dark window
    const GL = { 0: '7,5,5,5,7', 1: '2,6,2,2,7', 2: '7,1,7,4,7', 3: '7,1,3,1,7', 4: '5,5,7,1,1', 5: '7,4,7,1,7', 6: '7,4,7,5,7', 7: '7,1,1,2,2', 8: '7,5,7,5,7', 9: '7,5,7,1,7', L: '4,4,4,4,7', U: '5,5,5,5,7', X: '5,5,2,5,5', ' ': '0,0,0,0,0' };
    const rc = document.createElement('canvas'); rc.width = 41; rc.height = 9; const rg = rc.getContext('2d');
    const rtex = new THREE.CanvasTexture(rc); rtex.magFilter = rtex.minFilter = THREE.NearestFilter; rtex.generateMipmaps = false; rtex.colorSpace = THREE.SRGBColorSpace;
    const drawRead = (str) => {
      rg.fillStyle = '#16161f'; rg.fillRect(0, 0, 41, 9); rg.fillStyle = '#ffd23f';
      [...str].forEach((ch, k) => (GL[ch] || GL[' ']).split(',').forEach((row, y) => { for (let x = 0; x < 3; x++) if (+row & (4 >> x)) rg.fillRect(2 + k * 4 + x, 2 + y, 1, 1); }));
      rtex.needsUpdate = true;
    };
    drawRead('LUX 00000');
    const read = new THREE.Sprite(new THREE.SpriteMaterial({ map: rtex, color: new THREE.Color(1.2, 1.2, 1.2), fog: false }));
    read.center.set(0.5, 0); read.scale.set(1.85, 0.4, 1); c.root.add(read);
    // it runs a dozen metres ahead, hops up onto each vending machine it passes, and stops to measure when you stop
    const ray = new THREE.Raycaster(); ray.far = 200;
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), from = new THREE.Vector3();
    let lastT = 0, lastZ = null, onTop = null, hop = 1, dist = 0, still = 0, E = 0, Eshow = 0, nextRead = 0, lastStr = '';
    c.movers.push((t, cz) => {
      const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      const z = cz - 12.5, sp = spot(z), up = sp.m != null;
      tgt.set(up ? XM : XW, up ? sp.m : sp.g, z);
      const moved = lastZ == null ? 0 : Math.abs(z - lastZ); lastZ = z; dist += moved;
      still = moved > 1e-4 ? 0 : still + dt;
      if (onTop === null) { onTop = up; pos.copy(tgt); }
      if (up !== onTop) { onTop = up; from.copy(pos); hop = 0; }
      if (hop < 1) {
        hop = Math.min(1, hop + Math.max(dt, moved * 0.4) / 0.45);
        pos.lerpVectors(from, tgt, hop); pos.y += Math.sin(hop * Math.PI) * 0.9;
        pal.material.map = tex.jump0;
      } else {
        pos.copy(tgt);
        if (still > 0.25) { pal.material.map = tex.measure0; pos.y += Math.abs(Math.sin(t * 4.0)) * 0.03; }
        else { const ph = Math.floor(dist / 0.55) % 2; pal.material.map = tex['run' + (1 + ph) + '0']; pos.y += ph * 0.05; }
      }
      pal.position.copy(pos); read.position.set(pos.x, pos.y + 1.42, pos.z);
      if (t > nextRead) {                                    // take a reading: can the meter's dome see the sun?
        nextRead = t + 0.3;
        const o = pos.clone(); o.y += 1.25; ray.set(o, state.L);
        const shade = ray.intersectObject(c.static, true).length > 0;
        E = (shade ? 0 : 92000 * Math.max(0, state.L.y)) + 16000 * (shade ? 0.55 : 1);
        E *= 1 + Math.sin(t * 13.1) * 0.004;
      }
      Eshow += (E - Eshow) * Math.min(1, dt * 6);
      const str = 'LUX ' + String(Math.round(Math.min(99999, Eshow) / 10) * 10).padStart(5, '0');
      if (str !== lastStr) { drawRead(str); lastStr = str; }
    });
  }

  function lightFill() { hemi.intensity = hemiBase * (city && city.baked && useBaked ? BAKED_HEMI : 1); }
  function setBaked(v) {
    useBaked = !!v;
    for (const c of cache.values()) if (c.baked) c.static.children.forEach((m) => { if (m.userData.baked) m.material = useBaked ? m.userData.baked : m.userData.live; });
    lightFill();
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
    hemiBase = hemi.intensity; lightFill();
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
    F.uArt.value = lk.art ?? 0;
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
    fin.uniforms.uFalse.value += ((state.falseColour ? 1 : 0) - fin.uniforms.uFalse.value) * Math.min(1, dt * 6);
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
    // the meter's spot: 1° across, whatever the camera's field of view
    const fovV = cam.fov, aspect = size.x / size.y;
    state.spotPx = (canvas.clientHeight || innerHeight) / fovV;
    probeMat.uniforms.uRad.value.set(0.5 / fovV / aspect, 0.5 / fovV);
    // the luminance map for contour labels: ~6 times a second, only while someone looks at the measured side
    if (state.wantGrid && state.measured && (probeCount % 10) === 5) {
      const gh = Math.max(24, Math.round(GW / aspect));
      if (gh !== GH) { GH = gh; gridRT.setSize(GW, GH); gridBuf = new Uint8Array(GW * GH * 4); }
      gridMat.uniforms.tDiffuse.value = rt.texture; gridMat.uniforms.uExpo.value = fin.uniforms.uExpo.value; gridMat.uniforms.uSize.value.set(GW, GH);
      renderer.setRenderTarget(gridRT); renderer.render(gridScene, probeCam); renderer.readRenderTargetPixels(gridRT, 0, 0, GW, GH, gridBuf); renderer.setRenderTarget(null);
      const lg = state.grid && state.grid.lg.length === GW * GH ? state.grid.lg : new Float32Array(GW * GH);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const k = ((GH - 1 - y) * GW + x) * 4; lg[y * GW + x] = (gridBuf[k] + gridBuf[k + 1] / 255) / 255 * 8 - 2; }   // rows top → bottom
      state.grid = { w: GW, h: GH, lg, t: state.t };
    }
    // probe the HDR buffer under the pointer
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
    setFalseColour(on) { state.falseColour = !!on; }, wantGrid(on) { state.wantGrid = !!on; },
    fade(v) { fin.uniforms.uFade.value = v; }, setFadeColor(c) { fin.uniforms.uFadeCol.value.set(c); },
    prebuild(i) { getCity(i); },
    setMode(m) { if (m === mode) return; mode = m; if (m === 'walk') { const c = cur; cur = -1; setCity(c); } },
    setRoom(n) { room.setState(n); }, setAI(v) { room.setAI(v); }, setWeights(w) { room.setWeights(w); }, setPattern(k) { room.setPattern(k); }, setBench(i) { room.setBench(i); }, setBaked, whenBaked(i) { return getCity(i).bakedP; }, room,
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
