// cities.js — six streets, each walked away from the sun so the family's shadows fall ahead
import * as THREE from 'three';
import { Bucket, rnd, R, pick, box, cyl, geom, prism, mat4, building, canalHouse, tree, lamp, bike, win, BOX, CYL, CYL6, SPH, SPH2, CONE4, CONE8 } from './kit.js?v=d1954a06';

const I = new THREE.Matrix4();

/* the common street: roadway, pavements, kerbs, centre line */
function street(b, o) {
  const zA = 40, zB = o.end || -135, L = zA - zB, zc = (zA + zB) / 2;
  if (!o.noRoad) box(b, 'ground', I, 0, -0.05, zc, o.road * 2, 0.1, L, o.asphalt || 0x55585e);
  const wx = o.road + o.walk / 2;
  box(b, 'ground', I, -wx, 0.07, zc, o.walk, 0.14, L, o.pave || 0xa8a39a);
  if (!o.oneSide) box(b, 'ground', I, wx, 0.07, zc, o.walk, 0.14, L, o.pave || 0xa8a39a);
  box(b, 'trim', I, -o.road - 0.08, 0.08, zc, 0.16, 0.16, L, 0xd5d0c6);
  if (!o.oneSide) box(b, 'trim', I, o.road + 0.08, 0.08, zc, 0.16, 0.16, L, 0xd5d0c6);
  if (o.centerLine) for (let z = zA; z > zB; z -= 6) box(b, 'trim', I, 0, 0.005, z, 0.15, 0.01, 3, 0xe8e4da);
  // pavement joints
  for (let z = zA; z > zB; z -= 1.6) { box(b, 'trim', I, -wx, 0.142, z, o.walk, 0.005, 0.03, 0x8e897f); if (!o.oneSide) box(b, 'trim', I, wx, 0.142, z, o.walk, 0.005, 0.03, 0x8e897f); }
  // the square at the end of the street
  box(b, 'ground', I, 0, 0.02, zB - 60, 140, 0.1, 120, o.square || 0xb3aca0);
}

/* a row of buildings along one side; fn(W) returns building options */
function row(b, side, xFace, zFrom, zTo, fn, gap = 0) {
  let z = zFrom;
  while (z > zTo) {
    const o = fn();
    const W = o.W, zc = z - W / 2;
    const M = mat4(xFace, 0, zc, side < 0 ? Math.PI / 2 : -Math.PI / 2);
    (o.canal ? canalHouse : building)(b, M, o);
    z -= W + gap;
  }
}

/* ------------------------------------------------------------------ landmarks */
function clockTower(b, x, z) {
  const M = mat4(x, 0, z), st = 0xcbb889, st2 = 0xb6a374, gold = 0xd6b25a;
  box(b, 'wall', M, 0, 26, 0, 11, 52, 11, st);
  for (let i = -2; i <= 2; i++) { box(b, 'trim', M, i * 2.2, 26, 5.6, 0.35, 50, 0.4, st2); box(b, 'trim', M, 5.6, 26, i * 2.2, 0.4, 50, 0.35, st2); box(b, 'trim', M, -5.6, 26, i * 2.2, 0.4, 50, 0.35, st2); }
  for (let y = 8; y < 50; y += 6) box(b, 'trim', M, 0, y, 0, 11.4, 0.4, 11.4, st2);
  box(b, 'wall', M, 0, 58, 0, 13, 12, 13, st);
  for (const [nx, nz, ry] of [[0, 6.55, 0], [6.55, 0, Math.PI / 2], [0, -6.55, Math.PI], [-6.55, 0, -Math.PI / 2]]) {
    const F = M.clone().multiply(mat4(nx, 58, nz, ry));
    geom(b, 'face', F, new THREE.CylinderGeometry(4.3, 4.3, 0.2, 40), 0, 0, 0.05, 0xf3ecd2, 0, 1, 1, 1, Math.PI / 2);
    geom(b, 'trim', F, new THREE.TorusGeometry(4.4, 0.25, 6, 40), 0, 0, 0.12, gold);
    box(b, 'dark', F, 0, 1.4, 0.22, 0.22, 2.8, 0.08, 0x1c1c1c); box(b, 'dark', F, 1.0, -0.3, 0.22, 2.0, 0.2, 0.08, 0x1c1c1c);
  }
  box(b, 'wall', M, 0, 67, 0, 10, 6, 10, st);
  for (let i = -1; i <= 1; i++) { box(b, 'glass', M, i * 3, 67, 5.05, 1.6, 4, 0.1, 0x1d2836); box(b, 'glass', M, 5.05, 67, i * 3, 0.1, 4, 1.6, 0x1d2836); box(b, 'glass', M, -5.05, 67, i * 3, 0.1, 4, 1.6, 0x1d2836); }
  geom(b, 'roof', M, CONE4, 0, 81, 0, 0x3f5560, 0, 10.5, 22, 10.5);
  for (const [cx, cz] of [[5, 5], [-5, 5], [5, -5], [-5, -5]]) geom(b, 'roof', M, CONE4, cx, 74, cz, 0x3f5560, 0, 1.4, 8, 1.4);
  cyl(b, 'trim', M, 0, 94, 0, 0.2, 5, gold);
  // the long hall beside it
  box(b, 'wall', M, -26, 11, 8, 40, 22, 16, st);
  for (let i = 0; i < 12; i++) { box(b, 'glass', M, -44 + i * 3.3, 10, 16.05, 1.3, 6, 0.1, 0x1d2836); box(b, 'trim', M, -44 + i * 3.3, 11, 16.2, 0.4, 22, 0.3, st2); geom(b, 'roof', M, CONE4, -44 + i * 3.3, 24, 16, 0x3f5560, 0, 0.8, 4, 0.8); }
  b.add('roof', prism([[0, 0], [16, 0], [8, 6]], 40), M.clone().multiply(mat4(-46, 22, 16, Math.PI / 2)), 0x3f5560);
}

function delftHall(b, x, z) {
  const M = mat4(x, 0, z), st = 0xece6d8, red = 0xb3302b, br = 0x7e4a33;
  box(b, 'wall', M, 0, 8, 0, 26, 16, 14, st);
  for (let f = 0; f < 3; f++) for (let c = 0; c < 7; c++) {
    const wx = -10.8 + c * 3.6, wy = 2 + f * 4.6;
    win(b, M.clone().multiply(mat4(0, 0, 7)), wx, wy, 1.3, 2.6, 0xf4f0e6, null);
    // red and white chevron shutters
    for (const s of [-1, 1]) { box(b, 'trim', M, wx + s * 1.05, wy + 1.3, 7.06, 0.6, 2.6, 0.06, 0xf4f0e6); for (let k = 0; k < 4; k++) box(b, 'trim', M, wx + s * 1.05, wy + 0.32 + k * 0.65, 7.1, 0.62, 0.22, 0.04, red); }
  }
  // stepped central gable with scrolls and a gilded crest
  const g = [[-6, 0], [6, 0], [6, 2], [4.5, 2], [4.5, 4], [3, 4], [3, 6], [1.5, 6], [1.5, 8], [-1.5, 8], [-1.5, 6], [-3, 6], [-3, 4], [-4.5, 4], [-4.5, 2], [-6, 2]];
  b.add('wall', prism(g, 1), M.clone().multiply(mat4(0, 16, 6.2)), st);
  geom(b, 'trim', M, SPH2, 0, 25, 6.8, 0xd6b25a, 0, 0.9, 0.9, 0.3);
  box(b, 'trim', M, 0, 16.1, 7.1, 26.6, 0.5, 0.4, 0xd8d1c0);
  b.add('roof', prism([[-13, 0], [13, 0], [0, 8]], 13), M.clone().multiply(mat4(0, 16, -6.5)), 0x3c3a3e);
  // the old tower behind
  box(b, 'wall', M, 0, 18, -11, 10, 36, 10, br);
  for (let y = 6; y < 34; y += 7) for (const s of [-1, 1]) box(b, 'dark', M, s * 2.2, y, -5.95, 1.2, 3.5, 0.1, 0x2a221e);
  box(b, 'wall', M, 0, 38, -11, 8, 4, 8, st);
  geom(b, 'roof', M, CONE8, 0, 46, -11, 0x3d6b5d, 0, 9, 14, 9);
  cyl(b, 'trim', M, 0, 54.5, -11, 0.15, 3, 0xd6b25a);
}

function cityHallTower(b, x, z) {
  const M = mat4(x, 0, z), br = 0x8f4430, br2 = 0x7a3726, cu = 0x6aa38e, gold = 0xe0b84a;
  box(b, 'wall', M, 0, 32, 0, 12, 64, 12, br);
  for (let y = 4; y < 62; y += 3.2) box(b, 'trim', M, 0, y, 0, 12.2, 0.2, 12.2, br2);
  for (let y = 10; y < 58; y += 9) for (const s of [-1, 0, 1]) box(b, 'dark', M, s * 3, y, 6.05, 0.9, 4.5, 0.1, 0x2a1d18);
  for (const [cx, cz] of [[5.6, 5.6], [-5.6, 5.6], [5.6, -5.6], [-5.6, -5.6]]) { cyl(b, 'wall', M, cx, 66, cz, 1.2, 6, br); geom(b, 'roof', M, CONE8, cx, 71, cz, cu, 0, 2.6, 4, 2.6); }
  box(b, 'wall', M, 0, 70, 0, 8, 12, 8, br);
  cyl(b, 'roof', M, 0, 79, 0, 3.6, 6, cu, CYL6);
  geom(b, 'roof', M, CONE8, 0, 86, 0, cu, 0, 6, 8, 6);
  cyl(b, 'trim', M, 0, 92, 0, 0.18, 6, gold);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const cx = Math.cos(a) * 0.9, cz = Math.sin(a) * 0.9; geom(b, 'glow', M, new THREE.TorusGeometry(0.55, 0.12, 6, 14), cx, 94.4 + (i === 0 ? 0.9 : 0), cz, gold, a, 1, 0.6, 1, Math.PI / 2); geom(b, 'glow', M, CONE8, cx, 94.9 + (i === 0 ? 0.9 : 0), cz, gold, 0, 0.9, 0.7, 0.9); }
  // low hall wings
  box(b, 'wall', M, -22, 9, 6, 32, 18, 14, br);
  for (let i = 0; i < 9; i++) box(b, 'glass', M, -35 + i * 3.4, 9, 13.05, 1.2, 5, 0.1, 0x1d2836);
  b.add('roof', prism([[0, 0], [14, 0], [7, 5]], 32), M.clone().multiply(mat4(-38, 18, 13, Math.PI / 2)), cu);
}

function grossmunster(b, x, z) {
  const M = mat4(x, 0, z), st = 0xd9c9a6, st2 = 0xc6b48d, dome = 0x4c4038;
  box(b, 'wall', M, 0, 11, 6, 22, 22, 26, st);
  b.add('roof', prism([[-11.5, 0], [11.5, 0], [0, 9]], 26), M.clone().multiply(mat4(0, 22, -7)), 0x8c5a43);
  for (const s of [-1, 1]) {
    box(b, 'wall', M, s * 7, 24, 18, 7.5, 48, 7.5, st);
    for (let y = 6; y < 46; y += 8) box(b, 'trim', M, s * 7, y, 18, 7.8, 0.4, 7.8, st2);
    for (let y = 26; y < 46; y += 8) { box(b, 'dark', M, s * 7, y, 21.8, 1.1, 3.2, 0.1, 0x2a2420); }
    geom(b, 'face', M, new THREE.CylinderGeometry(1.4, 1.4, 0.15, 30), s * 7, 41, 21.85, 0xf2ecda, 0, 1, 1, 1, Math.PI / 2);
    box(b, 'wall', M, s * 7, 49, 18, 6.6, 3, 6.6, st);
    geom(b, 'roof', M, SPH2, s * 7, 53, 18, dome, 0, 3.4, 5.4, 3.4);
    geom(b, 'roof', M, CONE8, s * 7, 60, 18, dome, 0, 1.2, 4, 1.2);
    cyl(b, 'trim', M, s * 7, 63, 18, 0.1, 2.5, 0xd6b25a);
  }
  box(b, 'dark', M, 0, 4, 19.1, 4, 8, 0.4, 0x3a2e26);
  geom(b, 'glass', M, new THREE.CylinderGeometry(2.4, 2.4, 0.2, 30), 0, 15, 19.1, 0x24324a, 0, 1, 1, 1, Math.PI / 2);
}

function tokyoTower(b, x, z, s = 1) {
  const M = mat4(x, 0, z, 0.3, 0, 0, s, s, s), OR = 0xe9561f, WH = 0xf2f0ea;
  const H = 150, band = (y) => (Math.floor(y / (H / 7)) % 2 === 0 ? OR : WH);
  const half = (y) => 22 * Math.pow(1 - y / 175, 1.9) + 1.6;
  const lv = []; for (let y = 0; y <= 132; y += 6) lv.push(y);
  for (let i = 0; i < lv.length - 1; i++) {
    const y0 = lv[i], y1 = lv[i + 1], a = half(y0), c = half(y1), col = band((y0 + y1) / 2);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p0 = new THREE.Vector3(sx * a, y0, sz * a), p1 = new THREE.Vector3(sx * c, y1, sz * c);
      member(b, M, p0, p1, 0.55, col);
    }
    for (const f of [0, 1, 2, 3]) {
      const ax = [[1, 1, -1, 1], [1, -1, 1, 1], [-1, -1, 1, -1], [-1, 1, -1, -1]][f];
      const p0 = new THREE.Vector3(ax[0] * a, y0, ax[1] * a), p1 = new THREE.Vector3(ax[2] * c, y1, ax[3] * c);
      member(b, M, p0, p1, 0.18, col);
      member(b, M, new THREE.Vector3(ax[2] * a, y0, ax[3] * a), new THREE.Vector3(ax[0] * c, y1, ax[1] * c), 0.18, col);
      member(b, M, new THREE.Vector3(ax[0] * c, y1, ax[1] * c), new THREE.Vector3(ax[2] * c, y1, ax[3] * c), 0.22, col);
    }
  }
  box(b, 'wall', M, 0, 56, 0, 16, 6, 16, WH); for (let i = 0; i < 4; i++) box(b, 'glass', M, 0, 56, 0, 16.2, 3, 16.2 * (i % 2 ? 1 : 0.999), 0x30405a);
  box(b, 'wall', M, 0, 101, 0, 8, 3.5, 8, WH);
  cyl(b, 'wall', M, 0, 136, 0, 0.9, 8, OR); cyl(b, 'wall', M, 0, 148, 0, 0.5, 18, WH); cyl(b, 'wall', M, 0, 160, 0, 0.25, 10, OR);
  box(b, 'wall', M, 0, 6, 0, 30, 12, 30, 0xd8d4cc);
}
const _up = new THREE.Vector3(0, 1, 0);
function member(b, M, p0, p1, r, col) {
  const d = new THREE.Vector3().subVectors(p1, p0), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d.clone().normalize());
  const m = new THREE.Matrix4().compose(p0.clone().add(p1).multiplyScalar(0.5), q, new THREE.Vector3(r * 2, L, r * 2));
  b.add('wall', BOX, M.clone().multiply(m), col);
}

function morgesCastle(b, x, z) {
  const M = mat4(x, 0, z, 0.4), st = 0xd8cdb6;
  box(b, 'wall', M, 0, 6, 0, 26, 12, 26, st);
  for (const [cx, cz] of [[13, 13], [-13, 13], [13, -13], [-13, -13]]) { cyl(b, 'wall', M, cx, 8, cz, 3.4, 16, st); geom(b, 'roof', M, CONE8, cx, 19, cz, 0x7a3d2c, 0, 7.6, 7, 7.6); }
  b.add('roof', prism([[-13, 0], [13, 0], [0, 7]], 26), M.clone().multiply(mat4(0, 12, -13)), 0x7a3d2c);
}

/* ------------------------------------------------------------------ moving things */
function makeBus() {
  const b = new Bucket(), red = 0xc9221d;
  box(b, 'wall', I, 0, 1.25, 0, 2.5, 1.9, 10.4, red); box(b, 'wall', I, 0, 3.3, 0, 2.5, 2.0, 10.4, red);
  box(b, 'trim', I, 0, 4.35, 0, 2.4, 0.15, 10.2, 0x26282b);
  for (const y of [1.55, 3.45]) { box(b, 'glass', I, 1.27, y, 0, 0.04, 1.0, 9.6, 0x1b2430); box(b, 'glass', I, -1.27, y, 0, 0.04, 1.0, 9.6, 0x1b2430); box(b, 'glass', I, 0, y, 5.22, 2.2, 1.0, 0.04, 0x1b2430); }
  box(b, 'trim', I, 0, 2.35, 0, 2.56, 0.12, 10.46, 0xe9e4d6);
  for (const z of [-3.6, 3.4]) for (const x of [-1.15, 1.15]) cyl(b, 'dark', I, x, 0.5, z, 0.5, 0.36, 0x18191b, new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateZ(Math.PI / 2));
  box(b, 'glow', I, 0, 2.62, 5.21, 1.5, 0.3, 0.04, 0xfff0b8);
  return b;
}
function makeTram() {
  const b = new Bucket(), wh = 0xf3f3f0, bl = 0x2363b5;
  for (let k = 0; k < 3; k++) {
    const z = (k - 1) * 9.3;
    box(b, 'wall', I, 0, 1.75, z, 2.4, 2.6, 9, wh);
    box(b, 'trim', I, 0, 0.72, z, 2.42, 0.55, 9.02, bl); box(b, 'trim', I, 0, 3.0, z, 2.42, 0.18, 9.02, bl);
    box(b, 'glass', I, 1.21, 2.05, z, 0.03, 1.1, 8.2, 0x1b2430); box(b, 'glass', I, -1.21, 2.05, z, 0.03, 1.1, 8.2, 0x1b2430);
  }
  box(b, 'glass', I, 0, 2.1, 13.97, 2.0, 1.2, 0.04, 0x1b2430);
  box(b, 'dark', I, 0, 3.5, 0, 0.1, 0.9, 1.6, 0x222);
  return b;
}
function makeSteamer() {
  const b = new Bucket(), wh = 0xf4f1ea;
  box(b, 'wall', I, 0, 1.2, 0, 7, 2.4, 40, 0x253042); box(b, 'wall', I, 0, 2.9, 0, 7.2, 1.0, 40.4, wh);
  box(b, 'wall', I, 0, 4.6, -2, 5.6, 2.4, 26, wh); for (let i = 0; i < 10; i++) box(b, 'glass', I, 2.82, 4.6, -13 + i * 2.6, 0.04, 1.2, 1.6, 0x1b2430);
  box(b, 'wall', I, 0, 6.5, -2, 5, 1.4, 16, wh);
  for (const s of [-1, 1]) cyl(b, 'wall', I, s * 4.3, 2.8, 2, 3, 1.4, wh, new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2));
  for (const z of [-6, 4]) { cyl(b, 'trim', I, 0, 9.4, z, 0.8, 5, 0xe0b44a); box(b, 'trim', I, 0, 11.9, z, 1.7, 0.4, 1.7, 0x1c1c1c); }
  box(b, 'trim', I, 0, 7.4, -18, 0.15, 6, 0.15, 0x222);
  return b;
}

/* ------------------------------------------------------------------ posters (canvas paintings) */
export function vermeerTexture() {
  // after Johannes Vermeer, "Girl with a Pearl Earring" (c. 1665, public domain): a painted homage, not a copy
  const c = document.createElement('canvas'); c.width = 384; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#0d0f10'; g.fillRect(0, 0, 384, 512);
  const r = g.createRadialGradient(150, 220, 10, 190, 260, 300); r.addColorStop(0, 'rgba(40,46,44,0.6)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 384, 512);
  g.fillStyle = '#c99a3a'; g.beginPath(); g.moveTo(232, 150); g.bezierCurveTo(290, 220, 300, 330, 268, 420); g.lineTo(236, 420); g.bezierCurveTo(250, 320, 240, 240, 210, 170); g.fill();
  g.fillStyle = '#7a5a2a'; g.beginPath(); g.ellipse(190, 500, 170, 120, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#e8e3d6'; g.beginPath(); g.ellipse(175, 395, 55, 22, -0.2, 0, Math.PI * 2); g.fill();
  const f = g.createLinearGradient(110, 0, 250, 0); f.addColorStop(0, '#f2d6b8'); f.addColorStop(0.55, '#d9b08c'); f.addColorStop(1, '#6e4f3a');
  g.fillStyle = f; g.beginPath(); g.ellipse(180, 265, 70, 92, -0.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3a2a22'; g.beginPath(); g.ellipse(152, 250, 9, 6, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(205, 255, 8, 5.5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(150, 248, 2.5, 0, 7); g.fill(); g.beginPath(); g.arc(203, 253, 2, 0, 7); g.fill();
  g.fillStyle = '#b5443a'; g.beginPath(); g.ellipse(170, 318, 17, 8, -0.1, 0, Math.PI * 2); g.fill();
  const t = g.createLinearGradient(120, 0, 260, 0); t.addColorStop(0, '#3c64b4'); t.addColorStop(0.6, '#2a4a92'); t.addColorStop(1, '#152a58');
  g.fillStyle = t; g.beginPath(); g.ellipse(190, 182, 92, 62, -0.15, Math.PI * 1.02, Math.PI * 2.05); g.closePath(); g.fill();
  g.fillStyle = '#d6b04a'; g.fillRect(118, 192, 150, 14);
  const p = g.createRadialGradient(117, 318, 1, 120, 322, 13); p.addColorStop(0, '#ffffff'); p.addColorStop(0.5, '#cfd2d6'); p.addColorStop(1, '#6c7076');
  g.fillStyle = p; g.beginPath(); g.arc(120, 322, 11, 0, 7); g.fill();
  g.strokeStyle = '#b08a3c'; g.lineWidth = 16; g.strokeRect(8, 8, 368, 496); g.strokeStyle = '#6e5420'; g.lineWidth = 4; g.strokeRect(18, 18, 348, 476);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
export function alpineTexture() {
  // a vintage Swiss travel-poster style: Alps, meadow, a girl and two goats (after the 1881 novel, not any film)
  const c = document.createElement('canvas'); c.width = 640; c.height = 440; const g = c.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, 300); s.addColorStop(0, '#79a9d6'); s.addColorStop(1, '#efe6cf'); g.fillStyle = s; g.fillRect(0, 0, 640, 440);
  g.fillStyle = '#f6e9b8'; g.beginPath(); g.arc(520, 90, 34, 0, 7); g.fill();
  const mt = (pts, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => g.lineTo(p[0], p[1])); g.fill(); };
  mt([[0, 300], [150, 90], [230, 170], [330, 60], [470, 210], [640, 150], [640, 320], [0, 320]], '#6f86a6');
  mt([[120, 120], [150, 90], [178, 120], [160, 112], [140, 126]], '#fbfbf8'); mt([[296, 102], [330, 60], [368, 108], [340, 98], [318, 112]], '#fbfbf8');
  mt([[0, 330], [180, 270], [380, 300], [640, 250], [640, 440], [0, 440]], '#7fae4b'); mt([[0, 380], [260, 330], [640, 360], [640, 440], [0, 440]], '#5f9238');
  // girl
  g.fillStyle = '#2f5ea8'; g.beginPath(); g.moveTo(190, 330); g.lineTo(165, 395); g.lineTo(215, 395); g.fill();
  g.fillStyle = '#f4f1ea'; g.fillRect(182, 340, 16, 40);
  g.fillStyle = '#f0c9a6'; g.beginPath(); g.arc(190, 318, 12, 0, 7); g.fill();
  g.strokeStyle = '#7a4a24'; g.lineWidth = 5; g.beginPath(); g.moveTo(181, 312); g.quadraticCurveTo(170, 330, 174, 350); g.stroke();
  g.strokeStyle = '#3a2a20'; g.lineWidth = 4; g.beginPath(); g.moveTo(182, 395); g.lineTo(182, 412); g.moveTo(198, 395); g.lineTo(198, 412); g.stroke();
  // goats
  const goat = (x, y) => { g.fillStyle = '#f7f5ef'; g.beginPath(); g.ellipse(x, y, 30, 15, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 30, y - 14, 10, 8, -0.4, 0, 7); g.fill(); g.strokeStyle = '#3a3a3a'; g.lineWidth = 3; g.beginPath(); [-18, -8, 10, 20].forEach((d) => { g.moveTo(x + d, y + 10); g.lineTo(x + d, y + 30); }); g.moveTo(x + 34, y - 22); g.lineTo(x + 40, y - 32); g.stroke(); };
  goat(290, 370); goat(380, 352);
  g.fillStyle = '#c8261e'; g.fillRect(0, 404, 640, 36);
  g.fillStyle = '#ffffff'; g.fillRect(300, 412, 20, 20); g.fillStyle = '#c8261e'; g.fillRect(307, 415, 6, 14); g.fillRect(303, 419, 14, 6);
  g.strokeStyle = '#f2ebda'; g.lineWidth = 12; g.strokeRect(6, 6, 628, 428);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function poster(tex, w, h, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex }));
  m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; return m;
}

function signTexture(word, bg) {
  const c = document.createElement('canvas'); c.width = 96; c.height = 420; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 96, 420); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 5; g.strokeRect(6, 6, 84, 408);
  const light = bg === '#f4efe2' || bg === '#e8b030';
  g.fillStyle = light ? '#1d1d1d' : '#fbf6ea'; g.font = '700 64px "Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ch = [...word], step = 360 / Math.max(ch.length, 2);
  ch.forEach((k, i) => g.fillText(k, 48, 40 + step * (i + 0.5)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function norenTexture(bg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = bg; for (let i = 0; i < 3; i++) g.fillRect(i * 86, 0, 82, 128);
  g.fillStyle = bg === '#e8e2d2' ? '#2a2a2a' : '#f4efe2'; g.beginPath(); g.arc(128, 60, 24, 0, 7); g.fill();
  g.fillStyle = bg; g.beginPath(); g.arc(128, 60, 14, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function beckoningCat(b, M) {
  geom(b, 'face', M, SPH2, 0, 0.18, 0, 0xf6f2ea, 0, 0.17, 0.2, 0.15);
  geom(b, 'face', M, SPH2, 0, 0.45, 0, 0xf6f2ea, 0, 0.14, 0.13, 0.13);
  geom(b, 'face', M, CONE4, -0.08, 0.58, 0, 0xf6f2ea, 0, 0.06, 0.08, 0.04); geom(b, 'face', M, CONE4, 0.08, 0.58, 0, 0xf6f2ea, 0, 0.06, 0.08, 0.04);
  geom(b, 'face', M, SPH2, 0.15, 0.48, 0.02, 0xf6f2ea, 0, 0.05, 0.1, 0.05);
  box(b, 'trim', M, 0, 0.33, 0.1, 0.18, 0.03, 0.04, 0xc8261e); geom(b, 'trim', M, SPH2, 0, 0.29, 0.13, 0xe0b44a, 0, 0.03, 0.03, 0.03);
  box(b, 'dark', M, -0.05, 0.46, 0.125, 0.03, 0.012, 0.01, 0x222222); box(b, 'dark', M, 0.05, 0.46, 0.125, 0.03, 0.012, 0.01, 0x222222);
}

/* ------------------------------------------------------------------ the six streets */
const C = (h) => new THREE.Color(h);
export const CITIES = [
  // London — grey, drizzly, the muted "BBC" palette: lifted teal shadows, low saturation, soft light
  { key: 'london', name: 'London', lat: 51.5, camX: 5.0, yaw: 0.2, sun: { alt: 24, az: -14 }, sky: { turbidity: 10, rayleigh: 0.6, mie: 0.02, g: 0.7 }, fog: [0x9ea6ab, 30, 260], expo: 1.25,
    weather: 'rain', clouds: 0, cloudDeck: { cov: 0.55, scale: 1.6, lit: 0xc8cdd0, shade: 0xa7aeb3, wind: [0.02, 0.006] }, family: 'one', grade: [0.97, 1.0, 1.0],
    look: { sat: 0.72, con: 0.9, lift: [0.035, 0.05, 0.055], skyTop: 0x7c858c, skyBot: 0xb7bdc0, overcast: 1, bloom: 0.18, shadowSoft: 7, sunI: 1.1, hemiI: 2.3, sunCol: 0xdfe4e6, hemiSky: 0xc4ccd2, art: 2 } },
  // Delft — Dutch-master skies: big moving cumulus over clear, slightly cool light; brick reds sing
  { key: 'delft', name: 'Delft', lat: 52.0, camX: 5.6, yaw: 0.3, sun: { alt: 22, az: -14 }, sky: { turbidity: 2.6, rayleigh: 2.4, mie: 0.005, g: 0.8 }, fog: [0xcad8e6, 60, 380], expo: 0.95,
    cloudDeck: { cov: 0.5, scale: 0.9, lit: 0xfffaf0, shade: 0x9aa3b8, wind: [0.03, 0.01] }, family: 'two', grade: [1.0, 1.0, 1.03],
    look: { sat: 1.12, con: 1.05, lift: [0.0, 0.01, 0.02], skyTop: 0x3d6fb4, skyBot: 0xd9e6f0, skyMix: 0.45, bloom: 0.28, art: 1 } },
  // Lausanne — alpine clarity over the lake, deep blue, sharp mountains
  { key: 'lausanne', name: 'Lausanne', lat: 46.5, camX: -0.6, yaw: 0.0, cloudY: 380, sun: { alt: 17, az: 20 }, sky: { turbidity: 1.6, rayleigh: 1.6, mie: 0.003, g: 0.8 }, fog: [0xd2dae4, 160, 2800], expo: 0.66,
    cloudDeck: { cov: 0.22, scale: 1.1, lit: 0xffffff, shade: 0xc4cde0 }, family: 'pram', grade: [1.02, 1.0, 1.0],
    look: { sat: 1.12, con: 1.04, lift: [0.02, 0.025, 0.035], skyTop: 0x2f66c0, skyBot: 0xcfe0ef, skyMix: 0.6, bloom: 0.3 } },
  // Stockholm — the low northern sun: long gold light, pastel facades, a pink-apricot sky
  { key: 'stockholm', name: 'Stockholm', lat: 59.3, camX: -1.2, yaw: 0.04, sun: { alt: 8, az: -4 }, sky: { turbidity: 2.4, rayleigh: 2.8, mie: 0.008, g: 0.86 }, fog: [0xe4c8ac, 60, 400], expo: 1.0,
    cloudDeck: { cov: 0.3, scale: 1.6, lit: 0xffe2c4, shade: 0xc49a9a }, family: 'pram', grade: [1.05, 0.99, 0.94],
    look: { sat: 1.08, con: 1.02, lift: [0.03, 0.015, 0.0], skyTop: 0x6f8fc0, skyBot: 0xf3c9a2, skyMix: 0.55, bloom: 0.42 } },
  // Zürich — Föhn-clear: crisp, cool, clean
  { key: 'zurich', name: 'Zürich', lat: 47.4, camX: 5.4, yaw: 0.2, sun: { alt: 24, az: -14 }, sky: { turbidity: 1.8, rayleigh: 1.7, mie: 0.004, g: 0.8 }, fog: [0xcfdbe8, 70, 440], expo: 0.92,
    cloudDeck: { cov: 0.18, scale: 1.3, lit: 0xffffff, shade: 0xc8d0e2 }, family: 'three', grade: [0.99, 1.0, 1.03],
    look: { sat: 1.1, con: 1.08, lift: [0.0, 0.005, 0.015], skyTop: 0x2e65bd, skyBot: 0xd4e3f0, skyMix: 0.55, bloom: 0.26 } },
  // Tokyo — the clear Tokyo blue: saturated sky, white cumulus, bright and sharp
  { key: 'tokyo', name: 'Tokyo', lat: 35.7, camX: 0.5, yaw: 0.1, sun: { alt: 27, az: -12 }, sky: { turbidity: 2.0, rayleigh: 2.2, mie: 0.006, g: 0.85 }, fog: [0xd6e4f0, 80, 1100], expo: 1.0,
    cloudDeck: { cov: 0.36, scale: 0.8, lit: 0xffffff, litI: 1.1, shade: 0xb4c4e4, wind: [0.008, 0.012] }, family: 'tokyo', grade: [1.0, 1.0, 1.02],
    look: { sat: 1.18, con: 1.06, skyTop: 0x1550c4, skyBot: 0xa9d4f2, skyMix: 1.0, bloom: 0.34 } }
];

export function buildCity(i, mats, ctx) {
  rnd.seed(101 + i * 37);
  const b = new Bucket(), root = new THREE.Group(), movers = [], waters = [];
  const key = CITIES[i].key;

  if (key === 'london') {
    street(b, { road: 4.6, walk: 3.4, centerLine: true });
    const fx = 8.0;
    const f = () => rnd.next() < 0.4
      ? { W: R(14, 20), H: R(11, 13.5), color: pick([0x8a4a38, 0x9b5a43, 0x7c4436, 0xa0654a]), trim: 0xf0ebe0, roof: 'pitch', roofColor: 0x4b4f59, chimney: true, dormer: true, fh: 3.0, g0: 3.3, bay: 2.0 }
      : { W: R(12, 18), H: R(17, 26), color: pick([0xd1c3a2, 0xdcd1b8, 0xc2b597, 0xe2d9c4]), trim: 0xf3eee2, roof: 'mansard', roofColor: 0x4f5560, shop: pick([0x1f3b2d, 0x6a1f22, 0x1e2e4a, 0x2b2b2b]), bay: 2.3 };
    row(b, -1, -fx, 40, -128, f); row(b, 1, fx, 40, -128, f);
    for (let z = 30; z > -125; z -= 19) lamp(b, I, -5.1, z, 1);
    clockTower(b, 0, -190);
    waters.push({ w: 9.0, l: 175, x: 0, y: 0.01, z: -45, wet: true });
    const bus = makeBus().build(mats); bus.position.set(2.3, 0, -120); bus.rotation.y = Math.PI; root.add(bus);
    movers.push((t, cz) => { const L = 175; bus.position.z = cz - 120 + ((t * 8.5) % L); });
  }

  if (key === 'delft') {
    street(b, { road: 3.6, walk: 5.4, noRoad: true, pave: 0x9d978d });
    // canal walls and water
    box(b, 'wall', I, -3.65, -0.55, -45, 0.3, 1.2, 170, 0x6e4636); box(b, 'wall', I, 3.65, -0.55, -45, 0.3, 1.2, 170, 0x6e4636);
    box(b, 'ground', I, 0, -1.3, -45, 7.0, 0.1, 170, 0x2b3a3a);
    waters.push({ w: 7.0, l: 170, x: 0, y: -0.75, z: -45 });
    const kinds = ['step', 'bell', 'tri', 'step', 'bell'];
    const f = () => ({ canal: true, kind: pick(kinds), W: R(5.2, 7.6), H: R(8.5, 12.5), gh: R(4.5, 6.5), color: pick([0x7d3a28, 0x8e4632, 0x6a3426, 0x9a5a3e, 0x7a4a3a, 0xe6dccb]), shutters: rnd.next() < 0.3 ? pick([0x2f5a46, 0xb3302b]) : null });
    row(b, -1, -9.0, 40, -128, f, 0.05); row(b, 1, 9.0, 40, -128, f, 0.05);
    for (let z = 30; z > -125; z -= 12.5) { tree(b, I, -4.3, z, 10.5, 0x46653a); tree(b, I, 4.3, z - 6, 10.5, 0x46653a); }
    for (let z = 22; z > -120; z -= 23) bike(b, I, -4.2, z, 0.25);
    // a stone bridge over the canal
    const BM = mat4(0, 0, -64);
    box(b, 'wall', BM, 0, 0.5, 0, 8.6, 0.4, 4.2, 0x8a5a44);
    geom(b, 'wall', BM, new THREE.TorusGeometry(2.6, 0.45, 6, 18, Math.PI), 0, -1.0, 0, 0x8a5a44, 0, 1, 0.6, 9.2);
    box(b, 'trim', BM, 0, 0.95, 2.0, 8.6, 0.5, 0.2, 0xd8d1c4); box(b, 'trim', BM, 0, 0.95, -2.0, 8.6, 0.5, 0.2, 0xd8d1c4);
    delftHall(b, 0, -180);
    root.add(poster(ctx.vermeer, 3.2, 4.2, 8.93, 5.6, -46, -Math.PI / 2));
  }

  if (key === 'lausanne') {
    street(b, { road: 0.01, walk: 9.0, noRoad: true, oneSide: true, pave: 0x8a857c, end: -150 });
    box(b, 'ground', I, 1.55, 0.07, -55, 3.2, 0.14, 190, 0x8f897f); box(b, 'trim', I, 3.1, 0.2, -55, 0.4, 0.4, 190, 0xdad3c6); box(b, 'wall', I, 3.25, -0.4, -55, 0.3, 1.2, 190, 0x9a9488); box(b, 'dark', I, 3.1, 1.0, -55, 0.07, 0.07, 190, 0x2b2e33);
    for (let z = 38; z > -150; z -= 2.4) cyl(b, 'dark', I, 3.1, 0.7, z, 0.03, 0.6, 0x2b2e33);
    const f = () => ({ W: R(13, 19), H: R(14, 21), color: pick([0xe9dcc3, 0xe2cfb2, 0xd8d6cf, 0xf0e4cc, 0xe8d0bb]), trim: 0xf6f2ea, roof: rnd.next() < 0.5 ? 'mansard' : 'pitch', roofColor: pick([0x5a5d66, 0x8c4c39]), shop: rnd.next() < 0.5 ? pick([0x2b4a5a, 0x5a2b2b]) : null, shutters: rnd.next() < 0.6 ? pick([0x5e7f5c, 0x9fb5b7, 0xd8d0c0]) : null, bay: 2.3 });
    row(b, -1, -8.4, 40, -150, f);
    for (let z = 34; z > -145; z -= 11) tree(b, I, -2.0, z, 9, 0x56803e);
    for (let z = 30; z > -140; z -= 22) lamp(b, I, 2.4, z - 5, -1);
    morgesCastle(b, 40, -215);
    waters.push({ w: 6000, l: 6000, x: 3003, y: -0.6, z: -2000, big: true });
    const st = makeSteamer().build(mats); st.position.set(70, -0.3, -200); root.add(st);
    movers.push((t, cz) => { st.position.z = cz - 230 + ((t * 2.2) % 260); });
    // the Alps across the lake: a ridge strip seen across ~13 km of water, hazed toward the sky
    const NZ = 320, NV = 14, ridge = (zz) => 300 + 170 * Math.sin(zz * 0.0016 + 0.7) + 120 * Math.sin(zz * 0.0047 + 2.1) + 55 * Math.abs(Math.sin(zz * 0.013)) + 22 * Math.sin(zz * 0.041);
    const verts = [], cols = [], idx = [];
    const haze = new THREE.Color(0xb9c6d8), rock = new THREE.Color(0x6f7f99), snow = new THREE.Color(0xf4f6fa);
    for (let i = 0; i <= NZ; i++) {
      const zz = 1200 - i * 22, top = ridge(zz);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV, y = -30 + v * (top + 30), x = 2300 + (1 - v) * -260 + Math.sin(zz * 0.02 + v * 3) * 30 * v;
        verts.push(x, y, zz);
        const sn = THREE.MathUtils.smoothstep(y, top * 0.62 + 30 * Math.sin(zz * 0.05), top * 0.7 + 30 * Math.sin(zz * 0.05));
        const c = rock.clone().lerp(snow, sn).lerp(haze, 0.35 + 0.25 * (1 - v));
        cols.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NV; j++) { const a0 = i * (NV + 1) + j, a1 = a0 + NV + 1; idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); ag.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); ag.setIndex(idx); ag.computeVertexNormals();
    const alps = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, color: new THREE.Color(1.15, 1.15, 1.15) }));
    root.add(alps);
  }

  if (key === 'stockholm') {
    street(b, { road: 3.4, walk: 2.0, pave: 0x9f978c, asphalt: 0x6e6a66 });
    // cobbles
    for (let z = 40; z > -135; z -= 0.9) box(b, 'trim', I, 0, 0.004, z, 6.8, 0.01, 0.05, 0x5c5854);
    const f = () => ({ W: R(6.5, 10), H: R(13, 19), color: pick([0xc9923e, 0xa8503a, 0xd8b25c, 0xc98a7c, 0xb7b38f, 0xd59f63]), trim: 0xf2e8d4, roof: 'pitch', rh: R(5, 7), roofColor: pick([0x3f3a39, 0x6a3a2c]), chimney: true, fh: 3.0, g0: 3.4, bay: 2.0, shop: rnd.next() < 0.3 ? pick([0x2a3a2a, 0x3a2a24]) : null });
    row(b, -1, -5.4, 40, -128, f); row(b, 1, 5.4, 40, -128, f);
    cityHallTower(b, 6, -175);
  }

  if (key === 'zurich') {
    street(b, { road: 5.0, walk: 3.4, asphalt: 0x5a5c60 });
    for (const x of [-2.15, -0.75, 0.75, 2.15]) box(b, 'trim', I, x, 0.01, -45, 0.08, 0.02, 170, 0x9a9ea4);
    for (let z = 40; z > -130; z -= 28) { for (const s of [-1, 1]) cyl(b, 'dark', I, s * 4.7, 4, z, 0.12, 8, 0x5f6368); }
    for (const x of [-1.45, 1.45]) cyl(b, 'dark', I, x, 6.4, -45, 0.02, 170, 0x222, new THREE.CylinderGeometry(0.5, 0.5, 1, 4).rotateX(Math.PI / 2));
    for (let z = 40; z > -130; z -= 28) box(b, 'dark', I, 0, 6.6, z, 9.4, 0.03, 0.03, 0x222);
    const f = () => ({ W: R(13, 18), H: R(15, 20), color: pick([0xe6dcc6, 0xd9e2df, 0xe7cfc3, 0xcad7e3, 0xeee6d2]), trim: 0xf7f4ee, roof: 'pitch', roofColor: pick([0xa4523c, 0x8f4a38]), dormer: true, shop: rnd.next() < 0.5 ? pick([0x2a3f5a, 0x4a3a2a, 0x1f2a24]) : null, bay: 2.2 });
    row(b, -1, -8.4, 40, -128, f); row(b, 1, 8.4, 40, -128, f);
    grossmunster(b, 0, -190);
    const tram = makeTram().build(mats); tram.position.set(1.45, 0, -100); tram.rotation.y = Math.PI; root.add(tram);
    movers.push((t, cz) => { tram.position.z = cz - 125 + ((t * 7) % 170); });
    root.add(poster(ctx.alpine, 5.2, 3.6, 8.33, 5.2, -50, -Math.PI / 2));
  }

  if (key === 'tokyo') {
    street(b, { road: 3.0, walk: 0.9, asphalt: 0x6b6c70, pave: 0x8a8781, end: -150 });
    for (const s of [-1, 1]) box(b, 'trim', I, s * 2.75, 0.006, -50, 0.12, 0.01, 180, 0xe8e6e0);
    const f = () => ({ W: R(6, 10), H: R(6.2, 10.5), D: 9, color: pick([0xe8e2d6, 0xcfc9bf, 0xb9b3ab, 0xddd5c5, 0xd6cfc4, 0xa9a49e]), trim: 0xeceae4, roof: 'flat', ac: true, fh: 2.9, g0: 3.0, bay: 2.4, wh: 1.3, plinth: 0x77736d, courses: false, shop: rnd.next() < 0.35 ? pick([0x2a5aa0, 0xc8402a, 0x2a8a5a, 0xe0a020]) : null });
    row(b, -1, -3.9, 40, -150, f, 0.4); row(b, 1, 3.9, 40, -150, f, 0.4);
    // utility poles and their sagging wires
    const poles = []; for (let z = 36; z > -150; z -= 15) { poles.push(z); cyl(b, 'dark', I, 3.3, 4.8, z, 0.16, 9.6, 0x8e8b86); box(b, 'dark', I, 3.3, 8.7, z, 1.8, 0.1, 0.1, 0x6a6864); box(b, 'dark', I, 3.3, 8.0, z, 1.3, 0.1, 0.1, 0x6a6864); cyl(b, 'dark', I, 3.05, 7.2, z + 0.3, 0.28, 0.9, 0x9a9894); }
    for (let k = 0; k < poles.length - 1; k++) for (const [dx, y] of [[-0.8, 8.7], [0.8, 8.7], [-0.55, 8.0], [0.55, 8.0], [0, 6.6]]) {
      const a = new THREE.Vector3(3.3 + dx, y, poles[k]), c = new THREE.Vector3(3.3 + dx, y, poles[k + 1]), m = a.clone().add(c).multiplyScalar(0.5); m.y -= 0.55;
      b.add('dark', new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, c), 10, 0.022, 4), I, 0x222326);
      if (k % 2 === 0 && dx === 0) { const d = new THREE.Vector3(-3.6, 5.5, poles[k] - 3); const mm = a.clone().add(d).multiplyScalar(0.5); mm.y -= 0.4; b.add('dark', new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mm, d), 8, 0.02, 4), I, 0x222326); }
    }
    // vending machines and signs
    for (let z = 30; z > -140; z -= 21) { const x = rnd.next() < 0.5 ? -3.45 : 3.0; box(b, 'wall', I, x, 0.95, z, 0.75, 1.9, 1.0, 0xf2f2f0); box(b, 'glow', I, x + (x < 0 ? 0.39 : -0.39), 1.25, z, 0.02, 0.9, 0.85, pick([0xffffff, 0xe8f4ff])); box(b, 'trim', I, x + (x < 0 ? 0.4 : -0.4), 0.55, z, 0.02, 0.18, 0.7, 0x1c1c1c); }
    for (let z = 26; z > -140; z -= 13) { const s = rnd.next() < 0.5 ? -1 : 1; box(b, 'glow', I, s * 3.85, R(3.4, 6), z, 0.15, R(1.5, 2.6), 0.55, pick([0xff7a3a, 0x4ab0ff, 0xffe066, 0xff5a7a, 0x6affb0])); }
    tokyoTower(b, 14, -430, 1.0);
    // vertical shop signs and noren (painted canvas atlas)
    const words = ['喫茶', 'ラーメン', 'たばこ', '薬', '酒', '本', 'パン', '花', '理容', 'そば', '珈琲', '湯'];
    for (let k = 0, z = 31; z > -140; z -= R(7, 12), k++) {
      const side = k % 2 ? 1 : -1, x = side * 3.72;
      const tex = signTexture(words[k % words.length], pick(['#c8402a', '#1f4f8a', '#f4efe2', '#2a6a4a', '#e8b030', '#3a3a3a']));
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.12), [ctx.blank, ctx.blank, ctx.blank, ctx.blank, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6) }), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6) })]);
      m.position.set(side * 3.35, R(3.6, 5.2), z); m.castShadow = true; root.add(m);
      if (rnd.next() < 0.55) { // noren over a door
        const nt = norenTexture(pick(['#1f3a6a', '#7a1f1f', '#2f2f2f', '#e8e2d2']));
        const nm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshToonMaterial({ map: nt, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
        nm.position.set(side * 3.83, 2.05, z - 2.5); nm.rotation.y = -side * Math.PI / 2; nm.castShadow = true; root.add(nm);
      }
    }
    // potted plants and a beckoning cat in a shop window
    for (let z = 34; z > -140; z -= R(4, 9)) { const s2 = rnd.next() < 0.5 ? -1 : 1; cyl(b, 'dark', I, s2 * 3.6, 0.2, z, 0.17, 0.4, pick([0x8a5a3a, 0x5a6a7a, 0xb8b2a8])); geom(b, 'leaf', I, SPH, s2 * 3.6, 0.72, z, pick([0x3f6a32, 0x355f38, 0x4f7a33]), R(0, 3), 0.3, 0.36, 0.3); }
    for (let z = 20; z > -140; z -= 31) { box(b, 'trim', I, 0, 0.004, z, 6, 0.01, 0.35, 0xeeeeea); for (let k = -2; k <= 2; k++) box(b, 'trim', I, k * 1.1, 0.004, z - 2.5, 0.5, 0.01, 3.2, 0xeeeeea); }
    beckoningCat(b, mat4(-3.75, 1.1, -24, Math.PI / 2));
  }

  root.add(b.build(mats));
  return { root, movers, waters };
}
