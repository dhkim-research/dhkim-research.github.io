// kit.js — low-level building blocks: merged geometry buckets, toon materials, architectural parts
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const rnd = (() => { let s = 7; return { seed(v) { s = v; }, next() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; } }; })();
export const R = (a, b) => a + (b - a) * rnd.next();
export const pick = (arr) => arr[Math.floor(rnd.next() * arr.length) % arr.length];

/* three-step ramp for the cel look */
let _grad;
export function gradientMap() {
  if (_grad) return _grad;
  const d = new Uint8Array([92, 150, 205, 255]);
  _grad = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true;
  return _grad;
}
export function toon(opts = {}) { return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), ...opts }); }

/* A bucket collects many small geometries per material key and merges them into one mesh each. */
export class Bucket {
  constructor() { this.parts = {}; }
  add(key, geom, matrix, color) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    g.clearGroups();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    const c = new THREE.Color(color === undefined ? 0xffffff : color);
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    (this.parts[key] = this.parts[key] || []).push(g);
  }
  build(materials, opts = {}) {
    const group = new THREE.Group();
    for (const key of Object.keys(this.parts)) {
      const geo = mergeGeometries(this.parts[key], false);
      const mesh = new THREE.Mesh(geo, materials[key] || materials.wall);
      mesh.castShadow = opts.cast !== false && key !== 'glass' && key !== 'glow';
      mesh.receiveShadow = key !== 'glow';
      mesh.name = key;
      group.add(mesh);
    }
    this.parts = {};
    return group;
  }
}

const _o = new THREE.Object3D();
export function mat4(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(sx, sy, sz); _o.updateMatrix();
  return _o.matrix.clone();
}
export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
export const CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
export const SPH = new THREE.IcosahedronGeometry(1, 1);
export const LEAF = new THREE.IcosahedronGeometry(1, 3);
export const SPH2 = new THREE.SphereGeometry(1, 16, 10);
export const CONE4 = new THREE.ConeGeometry(0.7071, 1, 4, 1); // square pyramid, base side 1
CONE4.rotateY(Math.PI / 4);
export const CONE8 = new THREE.ConeGeometry(0.5, 1, 8, 1);

/* place a box (centre x,y,z, size w,h,d) in the frame M */
export function box(b, key, M, x, y, z, w, h, d, color, ry = 0) { b.add(key, BOX, M.clone().multiply(mat4(x, y, z, ry, 0, 0, w, h, d)), color); }
export function cyl(b, key, M, x, y, z, r, h, color, geo = CYL) { b.add(key, geo, M.clone().multiply(mat4(x, y, z, 0, 0, 0, r * 2, h, r * 2)), color); }
export function geom(b, key, M, g, x, y, z, color, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { b.add(key, g, M.clone().multiply(mat4(x, y, z, ry, rx, rz, sx, sy, sz)), color); }

/* prism with a profile in local XY extruded along Z */
export function prism(points, depth) {
  const s = new THREE.Shape(); points.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  return g;
}

/* ---------- a facade building ----------
   local frame: facade on z = 0 facing +z, width W along x centred at 0, height up +y, body into -z */
export function building(b, M, o) {
  const W = o.W, H = o.H, D = o.D || 10, wall = o.color, trim = o.trim || 0xf2efe8, fh = o.fh || 3.2, g0 = o.g0 || 3.6;
  // body
  box(b, 'wall', M, 0, H / 2, -D / 2, W, H, D, wall);
  // plinth and string courses
  box(b, 'trim', M, 0, 0.35, 0.04, W + 0.06, 0.7, 0.1, o.plinth || 0x6f6a64);
  if (o.courses !== false) for (let y = g0; y < H - 1; y += fh) box(b, 'trim', M, 0, y - 0.05, 0.05, W + 0.04, 0.14, 0.12, trim);
  // cornice
  box(b, 'trim', M, 0, H - 0.18, 0.12, W + 0.3, 0.36, 0.34, trim);
  // windows
  const cols = Math.max(1, Math.floor((W - 0.8) / (o.bay || 2.2)));
  const ww = o.ww || 1.05, wh = o.wh || 1.7;
  for (let y = g0 + 0.55; y + wh < H - 0.6; y += fh) {
    for (let c = 0; c < cols; c++) {
      const x = -W / 2 + W * (c + 0.5) / cols;
      win(b, M, x, y, ww, wh, trim, o.shutters ? o.shutters : null);
    }
  }
  // ground floor: door and shopfront
  if (o.shop) {
    box(b, 'glass', M, -W * 0.12, 1.5, 0.02, W * 0.55, 1.9, 0.04, 0x223040);
    box(b, 'trim', M, -W * 0.12, 2.62, 0.08, W * 0.6, 0.36, 0.16, o.shop);
    box(b, 'trim', M, -W * 0.12, 2.9, 0.5, W * 0.62, 0.08, 1.0, o.shop, 0);
  }
  box(b, 'dark', M, W * 0.3, 1.25, 0.02, 1.1, 2.4, 0.06, o.door || 0x3a2e28);
  box(b, 'trim', M, W * 0.3, 2.55, 0.06, 1.4, 0.16, 0.12, trim);
  // roof
  if (o.roof === 'pitch') {
    const rh = o.rh || W * 0.42;
    const g = prism([[-0.2, 0], [D + 0.2, 0], [D / 2, rh]], W + 0.3);
    // triangle in (z,y), extruded along x
    b.add('roof', g, M.clone().multiply(mat4(-(W + 0.3) / 2, H, 0.2, Math.PI / 2, 0, 0)), o.roofColor || 0x4a4c56);
    if (o.chimney) box(b, 'wall', M, W * 0.3, H + rh * 0.7, -D * 0.4, 0.7, rh * 0.9, 0.7, o.chimneyColor || wall);
    if (o.dormer) for (let c = 0; c < cols; c += 2) { const x = -W / 2 + W * (c + 0.5) / cols; box(b, 'wall', M, x, H + 1.0, -1.0, 1.3, 1.6, 1.4, trim); win(b, M.clone().multiply(mat4(0, 0, -0.3)), x, H + 0.4, 0.8, 1.0, trim); }
  } else if (o.roof === 'mansard') {
    const g = prism([[0, 0], [D, 0], [D - 1.2, 2.6], [1.2, 2.6]], W);
    b.add('roof', g, M.clone().multiply(mat4(-W / 2, H, 0, Math.PI / 2, 0, 0)), o.roofColor || 0x51545e);
    for (let c = 0; c < cols; c++) { const x = -W / 2 + W * (c + 0.5) / cols; box(b, 'trim', M, x, H + 1.2, -0.8, 1.0, 1.4, 0.9, trim); box(b, 'glass', M, x, H + 1.15, -0.33, 0.7, 1.0, 0.02, 0x223040); }
  } else if (o.roof === 'flat') {
    box(b, 'trim', M, 0, H + 0.4, -0.15, W, 0.8, 0.3, o.parapet || wall);
    if (o.ac) for (let i = 0; i < 2; i++) box(b, 'trim', M, R(-W / 3, W / 3), H + 0.5, -R(2, D - 2), 1.0, 0.8, 0.7, 0xcfd2d4);
  }
}

export function win(b, M, x, y, w, h, trim, shutter) {
  box(b, 'glass', M, x, y + h / 2, -0.06, w, h, 0.04, 0x1d2836);
  const t = 0.09;
  box(b, 'trim', M, x, y + h + t / 2, 0.02, w + 2 * t, t, 0.12, trim);
  box(b, 'trim', M, x, y - t / 2, 0.06, w + 2 * t + 0.12, t * 1.4, 0.2, trim);
  box(b, 'trim', M, x - w / 2 - t / 2, y + h / 2, 0.02, t, h, 0.12, trim);
  box(b, 'trim', M, x + w / 2 + t / 2, y + h / 2, 0.02, t, h, 0.12, trim);
  box(b, 'trim', M, x, y + h * 0.62, -0.02, w, 0.05, 0.05, trim);
  box(b, 'trim', M, x, y + h / 2, -0.02, 0.05, h, 0.05, trim);
  if (shutter) { box(b, 'trim', M, x - w / 2 - 0.36, y + h / 2, 0.05, 0.5, h, 0.06, shutter); box(b, 'trim', M, x + w / 2 + 0.36, y + h / 2, 0.05, 0.5, h, 0.06, shutter); }
}

/* Dutch canal house with a stepped, bell or plain gable */
export function canalHouse(b, M, o) {
  const W = o.W, H = o.H, D = 11, gh = o.gh || W * 0.9, wall = o.color, trim = o.trim || 0xf3efe6;
  let prof;
  if (o.kind === 'step') {
    const n = 3, sw = W / 2 / (n + 1.2), sh = gh / (n + 1);
    const Rr = [[W / 2, H]]; let x = W / 2, y = H;
    for (let i = 0; i < n; i++) { y += sh; Rr.push([x, y]); x -= sw; Rr.push([x, y]); }
    y += sh; Rr.push([x, y]);
    prof = [[-W / 2, 0], [W / 2, 0], ...Rr, ...Rr.slice().reverse().map(([px, py]) => [-px, py])];
  } else if (o.kind === 'bell') {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H);
    s.quadraticCurveTo(W * 0.5, H + gh * 0.45, W * 0.22, H + gh * 0.62);
    s.lineTo(W * 0.22, H + gh * 0.9); s.quadraticCurveTo(0, H + gh * 1.08, -W * 0.22, H + gh * 0.9);
    s.lineTo(-W * 0.22, H + gh * 0.62); s.quadraticCurveTo(-W * 0.5, H + gh * 0.45, -W / 2, H); s.lineTo(-W / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: false, curveSegments: 8 });
    b.add('wall', g, M.clone().multiply(mat4(0, 0, -0.4)), wall);
    prof = null;
  } else {
    prof = [[-W / 2, 0], [W / 2, 0], [W / 2, H], [0, H + gh], [-W / 2, H]];
  }
  if (prof) b.add('wall', prism(prof, 0.4), M.clone().multiply(mat4(0, 0, -0.4)), wall);
  box(b, 'wall', M, 0, H / 2, -D / 2 - 0.2, W - 0.02, H, D - 0.4, wall);
  // roof behind the gable
  const rg = prism([[-W / 2 - 0.05, 0], [W / 2 + 0.05, 0], [0, gh * 0.92]], D - 0.4);
  b.add('roof', rg, M.clone().multiply(mat4(0, H, -D)), o.roofColor || 0x3c3a3e);
  // white trims and hoist beam
  box(b, 'trim', M, 0, H + 0.05, 0.06, W + 0.1, 0.16, 0.14, trim);
  box(b, 'trim', M, 0, H + gh * 0.72, 0.25, 0.14, 0.14, 0.7, 0x3a2a20);
  // windows: tall Dutch sashes
  const cols = W > 6 ? 3 : 2;
  for (let y = 3.5; y + 1.9 < H - 0.4; y += 3.0) for (let c = 0; c < cols; c++) win(b, M, -W / 2 + W * (c + 0.5) / cols, y, 1.0, 1.9, trim, o.shutters || null);
  win(b, M, 0, H + 0.6, 0.8, 1.2, trim);
  box(b, 'dark', M, W * 0.22, 1.25, 0.02, 1.0, 2.5, 0.06, o.door || 0x2d3b33);
  box(b, 'glass', M, -W * 0.18, 1.6, -0.04, W * 0.38, 1.6, 0.04, 0x223040);
  box(b, 'trim', M, 0, 0.3, 0.05, W + 0.02, 0.6, 0.1, 0x5f5650);
}

export function tree(b, M, x, z, h = 6, color = 0x5d8a46) {
  cyl(b, 'dark', M, x, h * 0.3, z, 0.16, h * 0.6, 0x4a3a2c);
  const c0 = new THREE.Color(color);
  for (let i = 0; i < 9; i++) {
    const c = c0.clone().offsetHSL(R(-0.02, 0.03), R(-0.08, 0.02), R(-0.07, 0.05));
    geom(b, 'leaf', M, LEAF, x + R(-1.3, 1.3), h * R(0.58, 0.9), z + R(-1.3, 1.3), c, R(0, 3), h * R(0.12, 0.17), h * R(0.1, 0.14), h * R(0.12, 0.17));
  }
}
export function lamp(b, M, x, z, side = 1) {
  cyl(b, 'dark', M, x, 2.1, z, 0.06, 4.2, 0x23262a);
  box(b, 'dark', M, x + side * 0.35, 4.15, z, 0.75, 0.06, 0.06, 0x23262a);
  box(b, 'glow', M, x + side * 0.7, 4.0, z, 0.3, 0.25, 0.3, 0xffe4b0);
}
export function bike(b, M, x, z, ry) {
  const m = M.clone().multiply(mat4(x, 0, z, ry));
  const T = new THREE.TorusGeometry(0.33, 0.025, 6, 18);
  geom(b, 'dark', m, T, -0.5, 0.35, 0, 0x1d1f22); geom(b, 'dark', m, T, 0.5, 0.35, 0, 0x1d1f22);
  box(b, 'dark', m, 0, 0.62, 0, 0.9, 0.04, 0.04, 0x2a4a6a); box(b, 'dark', m, -0.2, 0.5, 0, 0.04, 0.4, 0.04, 0x2a4a6a); box(b, 'dark', m, 0.45, 0.75, 0, 0.04, 0.3, 0.04, 0x1d1f22);
}
