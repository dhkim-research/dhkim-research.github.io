// room.js — one daylit room, six lights: About · Light & Emotion · HiDyn · Visual Comfort · Solskin · the night bench (Instruments)
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Bucket, box, cyl, geom, mat4, tree, rnd, R, pick, SPH, SPH2, CONE8, LEAF } from './kit.js?v=d1954a06';

const I = new THREE.Matrix4();
const WX = 2.4, WY0 = 0.45, WY1 = 2.85, WZ = -4;          // the window opening (wall plane z = -4, outside is -z)

/* each state: sun, sky, exposure, grade and where the camera stands */
export const ROOM_STATES = {
  about:   { sun: [31, 24, 5.0], hemi: 0.95, expo: 1.5, cam: [2.25, 1.5, 3.35], tgt: [-0.35, 1.25, -4], fov: 50,
             look: { sat: 1.12, con: 1.05, skyTop: 0x2a62c4, skyBot: 0xbfdcf2, skyMix: 0.85, bloom: 0.42 }, deck: { cov: 0.3, scale: 0.9 } },
  emotion: { sun: [3, 30, 0.0], hemi: 0.16, expo: 1.25, cam: [2.4, 1.45, 3.2], tgt: [-0.6, 1.15, -3], fov: 50, lamps: 1,
             look: { sat: 0.98, con: 1.04, lift: [0.0, 0.0, 0.03], skyTop: 0x27356e, skyBot: 0xd98a78, skyMix: 1.0, bloom: 0.6 }, deck: { cov: 0.25, scale: 1.1, lit: 0xf0a888, shade: 0x5a4a6a } },
  hidyn:   { sun: [2, 0, 0.0], hemi: 0.025, expo: 1.0, cam: [0.42, 1.34, 2.05], tgt: [-0.05, 1.2, -1.4], fov: 44, tripod: 1, bracket: 1, lab: 1,
             look: { sat: 1.0, con: 1.05, skyTop: 0x080c1a, skyBot: 0x161d33, skyMix: 1.0, bloom: 0.5 }, deck: { cov: 0.0, scale: 1.0 } },
  comfort: { sun: [13, -14, 5.4], hemi: 1.0, expo: 0.85, cam: [1.55, 1.25, -1.05], tgt: [-0.35, 1.0, -4.6], fov: 62, person: 0, seated: 1, screen: 1,
             look: { sat: 1.1, con: 1.06, lift: [0.01, 0.005, 0.0], skyTop: 0x4a76c0, skyBot: 0xf3d6b4, skyMix: 0.7, bloom: 0.6 }, deck: { cov: 0.22, scale: 1.2, lit: 0xfff0dc } },
  day:     { sun: [30, 0, 5.0], hemi: 1.0, expo: 1.5, cam: [2.7, 1.55, 3.7], tgt: [-0.7, 1.0, -4], fov: 55,
             look: { sat: 1.12, con: 1.05, skyTop: 0x2a62c4, skyBot: 0xbfdcf2, skyMix: 0.9, bloom: 0.45 }, deck: { cov: 0.28, scale: 0.9 } },
  solskin: { sun: [27, 22, 5.2], hemi: 0.95, expo: 1.45, cam: [-1.95, 1.6, 3.15], tgt: [0.7, 0.95, -3.2], fov: 52, person: 1, modules: 1,
             look: { sat: 1.12, con: 1.06, skyTop: 0x2a62c4, skyBot: 0xc6e0f4, skyMix: 0.85, bloom: 0.42 }, deck: { cov: 0.32, scale: 0.9 } },
  // Instruments: late evening, only the desk lamp, the things I measure with laid out on the desk
  bench:   { sun: [-4, 10, 0.0], hemi: 0.42, expo: 1.4, cam: [1.95, 1.32, -1.55], tgt: [1.2, 0.8, -2.85], fov: 42, lamps: 1, deskOnly: 1, bench: 1,
             look: { sat: 1.02, con: 1.05, skyTop: 0x141a3c, skyBot: 0x3a3a66, skyMix: 1.0, bloom: 0.55 }, deck: { cov: 0.0, scale: 1.0 } },
  // late: the same room as About, hours later — lamps low and warm, the city dark outside (Collaborations, Publications)
  late:    { sun: [-8, 24, 0.0], hemi: 0.22, expo: 1.3, cam: [2.25, 1.5, 3.35], tgt: [-0.35, 1.25, -4], fov: 50, lamps: 0.75,
             look: { sat: 0.98, con: 1.04, lift: [0.0, 0.0, 0.02], skyTop: 0x0e1430, skyBot: 0x2a2d55, skyMix: 1.0, bloom: 0.5 }, deck: { cov: 0.0, scale: 1.0 } }
};
// where the camera looks for each instrument on the bench: [cam, target]
const BENCH_VIEWS = [
  [[1.95, 1.32, -1.55], [1.2, 0.8, -2.85]],      // overview
  [[1.25, 1.12, -1.95], [0.72, 0.86, -2.8]],      // hdrspace: the fisheye camera
  [[1.75, 1.1, -2.0], [1.35, 0.84, -2.82]],       // AirQ-Logger: e-paper logger and nodes
  [[2.2, 1.1, -1.9], [1.82, 0.86, -2.66]]       // sensor kit: spectral puck, radiant cube
];

export function createRoom(baseMats) {
  // interior cel ramp: no fake light on faces turned away from the sun (keeps the room honest, no acne)
  const g = new THREE.DataTexture(new Uint8Array([0, 18, 175, 255]), 4, 1, THREE.RedFormat); g.minFilter = g.magFilter = THREE.NearestFilter; g.needsUpdate = true;
  const T = () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: g });
  const mats = { ...baseMats, wall: T(), trim: T(), roof: T(), dark: T(), leaf: T(), ground: T(), face: T() };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.2, 3000);
  const sky = new Sky(); sky.scale.setScalar(2500); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 2.2; su.rayleigh.value = 1.8; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;

  /* light */
  const sun = new THREE.DirectionalLight(0xfff0dc, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 1.5;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xb8cff0, 0x8a6a4c, 0.5); scene.add(hemi);
  const bounce = new THREE.PointLight(0xffd8b0, 0, 9, 1.2); scene.add(bounce);       // the floor patch lighting the room

  /* the room */
  const b = new Bucket();
  const wall = 0xeeeae2, oak = 0xb98c5c, frame = 0x2b2d30;
  box(b, 'ground', I, 0, -0.05, 0, 6.6, 0.1, 8.2, oak);                                        // floor
  for (let x = -3.2; x <= 3.2; x += 0.22) box(b, 'trim', I, x, 0.002, 0, 0.012, 0.004, 8.0, 0x9c7248); // boards
  box(b, 'wall', I, 0, 3.25, 0, 6.6, 0.1, 8.2, 0xf4f1ea);                                     // ceiling
  box(b, 'wall', I, -3.25, 1.6, 0, 0.1, 3.3, 8.2, wall); box(b, 'wall', I, 3.25, 1.6, 0, 0.1, 3.3, 8.2, wall);
  box(b, 'wall', I, 0, 1.6, 4.05, 6.6, 3.3, 0.1, wall);
  // window wall with a deep reveal
  const D = 0.35, zc = WZ - D / 2;
  box(b, 'wall', I, -(3.2 + WX) / 2 - 0.0, 1.6, zc, 3.2 - WX, 3.3, D, wall); box(b, 'wall', I, (3.2 + WX) / 2, 1.6, zc, 3.2 - WX, 3.3, D, wall);
  box(b, 'wall', I, 0, WY0 / 2, zc, WX * 2, WY0, D, wall); box(b, 'wall', I, 0, (3.3 + WY1) / 2, zc, WX * 2, 3.3 - WY1, D, wall);
  // slim steel frame and mullions
  for (const x of [-WX, -0.8, 0.8, WX]) box(b, 'dark', I, x, (WY0 + WY1) / 2, WZ - D + 0.04, 0.05, WY1 - WY0, 0.06, frame);
  for (const y of [WY0, 2.25, WY1]) box(b, 'dark', I, 0, y, WZ - D + 0.04, WX * 2, 0.05, 0.06, frame);
  box(b, 'trim', I, 0, WY0 - 0.02, WZ + 0.02, WX * 2 + 0.1, 0.04, 0.28, 0xe6e1d6);             // sill
  // skirting and a shadow gap
  box(b, 'trim', I, -3.19, 0.05, 0, 0.02, 0.1, 8, 0xd9d3c7); box(b, 'trim', I, 3.19, 0.05, 0, 0.02, 0.1, 8, 0xd9d3c7);
  // desk + chair at the window
  const desk = 0xd9cdb8;
  box(b, 'trim', I, 1.25, 0.74, -2.85, 2.1, 0.04, 0.8, desk);
  for (const [x, z] of [[0.25, -3.2], [2.25, -3.2], [0.25, -2.5], [2.25, -2.5]]) box(b, 'dark', I, x, 0.36, z, 0.04, 0.72, 0.04, frame);
  chair(b, 1.2, -2.05);
  // books and a cup on the desk
  for (let k = 0; k < 5; k++) box(b, 'trim', I, 2.0 + k * 0.045, 0.86, -3.05, 0.035, 0.2 + (k % 3) * 0.02, 0.24, [0xb3402b, 0x2a4a6a, 0xe8b030, 0x3a5a40, 0xd8d0c0][k]);
  cyl(b, 'trim', I, 0.55, 0.8, -2.7, 0.04, 0.09, 0xf4f1ea);
  // bookshelf on the left wall
  box(b, 'trim', I, -3.0, 1.1, 0.6, 0.36, 2.2, 2.4, 0xe9e4da);
  rnd.seed(5);
  for (let s = 0; s < 4; s++) { box(b, 'trim', I, -2.98, 0.2 + s * 0.55, 0.6, 0.34, 0.03, 2.36, 0xd8d1c4);
    for (let z = -0.55; z < 1.75; z += R(0.04, 0.07)) { const h = R(0.28, 0.42); box(b, 'trim', I, -2.95, 0.22 + s * 0.55 + h / 2, z, R(0.18, 0.24), h, 0.035, pick([0xb3402b, 0x2a4a6a, 0xe8b030, 0x3a5a40, 0xd8d0c0, 0x7a5a8a, 0x1d1d1d, 0xc98a5a])); } }
  // a plant by the window
  cyl(b, 'trim', I, -1.9, 0.22, -3.35, 0.2, 0.44, 0xd8c8b0);
  for (let k = 0; k < 7; k++) geom(b, 'leaf', I, LEAF, -1.9 + R(-0.3, 0.3), R(0.7, 1.35), -3.35 + R(-0.25, 0.25), pick([0x3f6a32, 0x4f7a33, 0x355f38]), R(0, 3), R(0.16, 0.24), R(0.2, 0.3), R(0.16, 0.24));
  // a rug
  box(b, 'ground', I, -0.3, 0.004, 0.4, 2.6, 0.008, 1.8, 0xcbb9a0);
  // outside: a terrace edge, a low city and trees beyond (Tokyo-ish, but unnamed)
  box(b, 'ground', I, 0, -0.3, -12, 60, 0.1, 16, 0xbdb6aa);
  box(b, 'ground', I, 0, -6, -200, 2000, 0.1, 360, 0x8f9a7c);
  rnd.seed(17);
  for (let k = 0; k < 70; k++) { const x = R(-160, 160), z = R(-60, -320), h = R(6, 40) * (1 - Math.abs(x) / 400); box(b, 'wall', I, x, h / 2 - 6, z, R(8, 22), h, R(8, 20), pick([0xd8d2c8, 0xc9c4bb, 0xb9b8b4, 0xe2dccf, 0xa8aeb4])); }
  for (let k = 0; k < 16; k++) tree(b, I, R(-30, 30), R(-22, -45), R(6, 9), 0x557a3c);
  const roomMesh = b.build(mats); roomMesh.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); scene.add(roomMesh);

  /* pendant lamps and a desk lamp (Light & Emotion) */
  const lamps = [];
  const glowMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
  for (const [x, z, h] of [[-0.9, -0.6, 2.0], [0.2, 0.4, 2.15], [1.25, -2.5, 1.85]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.2 - h), mats.dark); cord.position.y = h + (3.2 - h) / 2; g.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 24, 1, true), new THREE.MeshToonMaterial({ color: 0x24262a, side: THREE.DoubleSide })); shade.position.y = h; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 10), glowMat()); bulb.position.y = h - 0.06; g.add(bulb);
    const L = new THREE.PointLight(0xffb46b, 0, 7, 1.6); L.position.y = h - 0.12; g.add(L);
    scene.add(g); lamps.push({ L, bulb, level: 0 });
  }
  { // desk lamp
    const g = new THREE.Group(); g.position.set(2.05, 0.76, -3.0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45), mats.dark); arm.position.set(0, 0.22, 0); arm.rotation.z = 0.2; g.add(arm);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 16, 1, true), new THREE.MeshToonMaterial({ color: 0xc8402a, side: THREE.DoubleSide })); head.position.set(-0.08, 0.44, 0); head.rotation.z = 0.9; g.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glowMat()); bulb.position.set(-0.12, 0.4, 0); g.add(bulb);
    const L = new THREE.PointLight(0xffc890, 0, 3, 1.5); L.position.set(-0.14, 0.36, 0); g.add(L);
    scene.add(g); lamps.push({ L, bulb, level: 0 });
  }

  /* the occupant: a pale architectural-model figure at the desk */
  const person = new THREE.Group(); {
    const m = new THREE.MeshToonMaterial({ color: 0xe8e2d8, gradientMap: mats.wall.gradientMap });
    const add = (geo, x, y, z, rx = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.rotation.x = rx; k.castShadow = true; k.receiveShadow = true; person.add(k); };
    add(new THREE.SphereGeometry(0.11, 20, 14), 0, 1.24, 0);
    add(new THREE.CapsuleGeometry(0.16, 0.38, 6, 14), 0, 0.88, 0.04, -0.08);
    add(new THREE.CapsuleGeometry(0.07, 0.36, 4, 8), -0.1, 0.5, -0.18, Math.PI / 2); add(new THREE.CapsuleGeometry(0.07, 0.36, 4, 8), 0.1, 0.5, -0.18, Math.PI / 2);
    add(new THREE.CapsuleGeometry(0.06, 0.36, 4, 8), -0.1, 0.24, -0.4); add(new THREE.CapsuleGeometry(0.06, 0.36, 4, 8), 0.1, 0.24, -0.4);
    add(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), -0.2, 0.9, -0.22, Math.PI / 2.4); add(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), 0.2, 0.9, -0.22, Math.PI / 2.4);
  }
  person.position.set(1.2, 0, -2.0); scene.add(person);
  const EYE = new THREE.Vector3(1.2, 1.24, -2.08);
  // a faint sight-cone from the eye (person-centric sensing)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.0, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
  cone.rotation.x = -Math.PI / 2; cone.position.set(EYE.x, EYE.y, EYE.z - 1.0); scene.add(cone);

  /* HiDyn: a fisheye luminance camera on a tripod */
  const tripod = new THREE.Group(); {
    const dm = mats.dark;
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25), dm); leg.position.set(Math.cos(a) * 0.22, 0.6, Math.sin(a) * 0.22); leg.rotation.set(Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36); leg.castShadow = true; tripod.add(leg); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.1), new THREE.MeshToonMaterial({ color: 0x1d1f22 })); body.position.y = 1.26; body.castShadow = true; tripod.add(body);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x223355, metalness: 0.6, roughness: 0.05 })); lens.rotation.x = -Math.PI / 2; lens.position.set(0, 1.26, -0.06); tripod.add(lens);
  }
  tripod.position.set(0.2, 0, 0.95); tripod.rotation.y = 0; scene.add(tripod);

  /* Instruments: a night bench — fisheye camera (hdrspace), e-paper logger + air nodes (AirQ-Logger), a sensor kit */
  const bench = new THREE.Group(); bench.visible = false; scene.add(bench);
  const paper = document.createElement('canvas'); paper.width = 256; paper.height = 176;
  const paperTex = new THREE.CanvasTexture(paper); paperTex.colorSpace = THREE.SRGBColorSpace;
  const leds = [];
  {
    const ink = new THREE.MeshToonMaterial({ color: 0x1d1f22, gradientMap: g }), alu = new THREE.MeshToonMaterial({ color: 0x9a9ea4, gradientMap: g });
    const shell = new THREE.MeshToonMaterial({ color: 0xe9e6df, gradientMap: g }), orange = new THREE.MeshToonMaterial({ color: 0xd8642a, gradientMap: g });
    const put = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; bench.add(o); return o; };
    const top = 0.76;
    // hdrspace: a mirrorless body with a fisheye, on a small table tripod, looking at the window
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.4; put(new THREE.CylinderGeometry(0.006, 0.006, 0.17), ink, 0.72 + Math.cos(a) * 0.05, top + 0.07, -2.78 + Math.sin(a) * 0.05, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    put(new THREE.BoxGeometry(0.13, 0.085, 0.06), ink, 0.72, top + 0.2, -2.78);
    put(new THREE.BoxGeometry(0.035, 0.03, 0.05), ink, 0.675, top + 0.255, -2.78);
    put(new THREE.CylinderGeometry(0.032, 0.036, 0.05, 24), ink, 0.72, top + 0.2, -2.83, Math.PI / 2);
    put(new THREE.SphereGeometry(0.03, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c2a44, metalness: 0.7, roughness: 0.06 }), 0.72, top + 0.2, -2.855, -Math.PI / 2);
    // AirQ-Logger: an e-paper device standing on its foot, three air nodes around it
    put(new THREE.BoxGeometry(0.17, 0.12, 0.012), shell, 1.32, top + 0.075, -2.86, -0.22);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.103), new THREE.MeshBasicMaterial({ map: paperTex, toneMapped: false }));
    scr.position.set(1.32, top + 0.076, -2.853); scr.rotation.x = -0.22; bench.add(scr);
    for (const [x, z] of [[1.12, -2.68], [1.52, -2.66], [1.58, -2.9]]) {
      put(new THREE.BoxGeometry(0.06, 0.04, 0.06), shell, x, top + 0.02, z);
      put(new THREE.BoxGeometry(0.062, 0.006, 0.062), orange, x, top + 0.043, z);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), new THREE.MeshBasicMaterial({ color: 0x000000 })); led.position.set(x + 0.02, top + 0.03, z + 0.031); bench.add(led); leds.push(led);
    }
    // the sensor kit: a spectral puck looking up, and a small cube with a thermometer on each face (radiant temperature)
    put(new THREE.CylinderGeometry(0.045, 0.05, 0.025, 28), shell, 1.74, top + 0.013, -2.58);
    put(new THREE.SphereGeometry(0.018, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.2, transparent: true, opacity: 0.85 }), 1.74, top + 0.025, -2.58);
    put(new THREE.CylinderGeometry(0.006, 0.006, 0.14), alu, 1.9, top + 0.07, -2.72);
    const cube = put(new THREE.BoxGeometry(0.065, 0.065, 0.065), ink, 1.9, top + 0.175, -2.72, 0, 0.5, 0);
    const dot = new THREE.MeshToonMaterial({ color: 0xc8c2b6, gradientMap: g });
    for (const [nx, ny, nz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 16), dot); d.position.set(nx * 0.034, ny * 0.034, nz * 0.034); d.lookAt(nx * 2, ny * 2, nz * 2); d.rotateX(Math.PI / 2); cube.add(d); }
    // cables
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.32, top + 0.01, -2.9), new THREE.Vector3(1.4, top + 0.003, -3.05), new THREE.Vector3(1.7, top + 0.003, -3.1), new THREE.Vector3(2.0, top + 0.003, -3.0)]), 24, 0.004, 6);
    put(cable, ink, 0, 0, 0);
  }
  // the e-paper face: a day of CO₂ drawn the way the logger draws it (black on grey, no gradients)
  function drawPaper(t) {
    const c = paper.getContext('2d'), W = paper.width, H = paper.height;
    c.fillStyle = '#d9d6cc'; c.fillRect(0, 0, W, H); c.fillStyle = '#1a1a1a'; c.strokeStyle = '#1a1a1a';
    c.font = '600 15px monospace'; c.fillText('AirQ  CO2', 10, 20); c.font = '13px monospace'; c.fillText('ppm', W - 40, 20);
    c.lineWidth = 1; c.strokeRect(10, 30, W - 20, H - 52);
    c.beginPath();
    for (let i = 0; i <= 96; i++) { const h = i / 4, occ = (h > 7 && h < 9) || (h > 18 && h < 23) ? 1 : (h > 9 && h < 18) ? 0.25 : 0.55;
      const v = 0.18 + 0.6 * occ * (0.75 + 0.25 * Math.sin(i * 0.7 + t * 0.4)) * Math.min(1, (h % 24) / 2 + 0.3);
      const x = 12 + (W - 24) * i / 96, y = 30 + (H - 54) * (1 - v); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.lineWidth = 2; c.stroke();
    c.font = '11px monospace'; ['00', '06', '12', '18', '24'].forEach((s, i) => c.fillText(s, 10 + (W - 34) * i / 4, H - 8));
    paperTex.needsUpdate = true;
  }
  drawPaper(0); let paperT = 0;
  let benchView = 0;

  /* Solskin: an adaptive solar façade just outside the glass — panels that turn */
  const modules = [], MOD = new THREE.Group();
  // diamond panels on a diagonal cable net, as on the real Solskin façade
  const P0 = 0.34, DX = 0.6, DY = 0.36;
  const panelGeo = new THREE.BoxGeometry(P0, P0, 0.01);
  const pvMat = new THREE.MeshToonMaterial({ color: 0xc9ccd0, gradientMap: mats.wall.gradientMap });
  const backMat = new THREE.MeshToonMaterial({ color: 0x2b2e33, gradientMap: mats.wall.gradientMap });
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) {
    const x = -WX + 0.15 + c * DX + (r % 2 ? DX / 2 : 0), y = WY0 + 0.05 + r * DY;
    if (x > WX - 0.05) continue;
    const p = new THREE.Group(); p.position.set(x, y, WZ - 0.75);
    const d = new THREE.Group(); d.rotation.z = Math.PI / 4; p.add(d);
    const pv = new THREE.Mesh(panelGeo, pvMat); pv.castShadow = true; d.add(pv);
    const act = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), backMat); act.rotation.x = Math.PI / 2; act.position.z = 0.08; p.add(act);
    MOD.add(p); modules.push({ p, x, y, a: 0, b: 0 });
  }
  // the diagonal cable net
  const span = (WY1 - WY0) * 1.6;
  for (let k = -8; k <= 8; k++) for (const sgn of [1, -1]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, span), mats.dark);
    m.position.set(k * DX / 2 * 1.0, (WY0 + WY1) / 2, WZ - 0.78); m.rotation.z = sgn * Math.atan2(DX / 2, DY); MOD.add(m);
  }
  scene.add(MOD);

  /* HiDyn: a dark lab with Hidyni-like reference sources — seven discs, 0.1 to 100 000 cd/m² */
  const K_LUM = 2600, rig = new THREE.Group(); rig.position.set(0, 0, -1.4); scene.add(rig);
  { const al = new THREE.MeshToonMaterial({ color: 0x8c9096, gradientMap: g }), blk = new THREE.MeshToonMaterial({ color: 0x1c1d20, gradientMap: g });
    const bar = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), al); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; rig.add(m); };
    bar(0.05, 2.2, 0.05, -0.85, 1.1, 0); bar(0.05, 2.2, 0.05, 0.85, 1.1, 0); bar(0.05, 2.2, 0.05, 0, 1.1, 0.0);
    for (const y of [0.78, 1.25, 1.72]) bar(1.75, 0.05, 0.05, 0, y, 0.02);
    const spots = [[0, 1.25, 0.1], [0.62, 1.25, 1e5], [-0.62, 1.25, 1e4], [-0.36, 1.72, 1e3], [0.36, 1.72, 100], [-0.36, 0.78, 10], [0.36, 0.78, 1]];
    for (const [x, y, L] of spots) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 20), blk); h.rotation.x = Math.PI / 2; h.position.set(x, y, 0.1); h.castShadow = true; rig.add(h);
      const v = L / K_LUM;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.052, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v * 0.97, v * 0.9) })); disc.position.set(x, y, 0.222); rig.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.012, 6, 24), al); rim.position.set(x, y, 0.222); rig.add(rim);
    }
    const glowL = new THREE.PointLight(0xfff2dc, 0, 9, 1.4); glowL.position.set(0.62, 1.25, 0.6); rig.add(glowL); rig.userData.glow = glowL;
  }

  /* Visual comfort: façade screens (stripe · bamboo · Voronoi) outside the window, casting patterned sun */
  const patTex = {}, texLoader = new THREE.TextureLoader();
  for (const k of ['stripe', 'bamboo', 'voronoi']) { const t = texLoader.load(`./img/pat_${k}.png`); t.wrapS = THREE.RepeatWrapping; t.repeat.set(4.4, 1); patTex[k] = t; }
  const scrMat = new THREE.MeshToonMaterial({ color: 0x2a2b2e, gradientMap: g, alphaTest: 0.5, side: THREE.DoubleSide, alphaMap: patTex.voronoi, transparent: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(WX * 2, WY1 - WY0), scrMat);
  screen.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: patTex.voronoi, alphaTest: 0.5 });
  screen.castShadow = true; screen.position.set(0, (WY0 + WY1) / 2, WZ - 0.5); scene.add(screen);
  let pattern = 'voronoi', patAuto = true, patSince = 0, screenY = 0;
  function setPattern(k) {
    if (k === pattern) return; pattern = k; screenY = 1;   // the new screen drops in from above
    if (k !== 'none') { scrMat.alphaMap = patTex[k]; screen.customDepthMaterial.alphaMap = patTex[k]; scrMat.needsUpdate = true; screen.customDepthMaterial.needsUpdate = true; }
  }

  /* sunbeams: the window's shape pushed along the sun's direction into the room (a soft additive volume) */
  const beamGeo = new THREE.BufferGeometry();
  const beamPos = new Float32Array(8 * 3), beamFade = new Float32Array([0, 0, 0, 0, 1, 1, 1, 1]);
  beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3)); beamGeo.setAttribute('fade', new THREE.BufferAttribute(beamFade, 1));
  beamGeo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(1, 0.9, 0.75) }, uI: { value: 0 }, uT: { value: 0 } },
    vertexShader: `attribute float fade; varying float vF; varying vec3 vW; void main(){ vF = fade; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uI, uT; varying float vF; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ float dust = 0.85 + 0.15*sin(vW.x*7.0+uT*0.7)*sin(vW.y*5.0-uT*0.5)*sin(vW.z*6.0+uT*0.3);
        float a = uI * (1.0 - vF) * (0.6 + 0.4*vF) * dust; gl_FragColor = vec4(uCol*a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const beams = new THREE.Mesh(beamGeo, beamMat); beams.frustumCulled = false; beams.renderOrder = 5; scene.add(beams);
  function updateBeams(t, strength) {
    const c = [[-WX + 0.05, WY0 + 0.05], [WX - 0.05, WY0 + 0.05], [WX - 0.05, WY1 - 0.05], [-WX + 0.05, WY1 - 0.05]];
    const d = new THREE.Vector3(-L.x, -L.y, -L.z);   // light travels into the room
    c.forEach(([x, y], i) => {
      beamPos.set([x, y, WZ + 0.02], i * 3);
      const s2 = Math.min(9, (y - 0.0) / Math.max(0.08, -d.y));   // until it meets the floor
      beamPos.set([x + d.x * s2, y + d.y * s2, Math.min(4, WZ + 0.02 + d.z * s2)], (i + 4) * 3);
    });
    beamGeo.attributes.position.needsUpdate = true;
    beamMat.uniforms.uI.value = strength; beamMat.uniforms.uT.value = t;
    beamMat.uniforms.uCol.value.copy(sun.color).multiplyScalar(0.55);
  }

  /* state & blending */
  const P = { alt: 31, az: 24, sunI: 5, hemi: 0.95, expo: 1.5, fov: 50, lamps: 0, tripod: 0, person: 0, modules: 0, bracket: 0, seated: 0, lab: 0, screen: 0, bench: 0 };
  const camPos = new THREE.Vector3(2.25, 1.5, 3.35), camTgt = new THREE.Vector3(-0.35, 1.25, -4);
  let target = ROOM_STATES.about, name = 'about', since = 0, ai = 1, aiAuto = true;
  const Wt = [0.2, 0.3, 0.5];
  const L = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tc = new THREE.Color();

  function setState(n) { if (!ROOM_STATES[n]) return; if (n !== name) since = 0; name = n; target = ROOM_STATES[n]; }

  function sunVec(alt, az) { const a = THREE.MathUtils.degToRad(alt), z = THREE.MathUtils.degToRad(az); return L.set(Math.sin(z) * Math.cos(a), Math.sin(a), -Math.cos(z) * Math.cos(a)); }

  // a whole day in one scroll: dawn → noon → dusk → night (lamps)
  let dayT = 0.3;
  const SKYKEYS = [[0.0, 0x4a5a94, 0xf4b08a], [0.2, 0x3a6cc0, 0xd6e4f0], [0.45, 0x2860c4, 0xbfdcf2], [0.68, 0x3a5aa8, 0xf0d0a8], [0.8, 0x2a2f68, 0xe8885a], [0.88, 0x10183a, 0x2a3060], [1.0, 0x080c1e, 0x141a34]];
  const cA = new THREE.Color(), cB = new THREE.Color();
  function skyAt(t, idx) { let i = 0; while (i < SKYKEYS.length - 2 && t > SKYKEYS[i + 1][0]) i++; const a = SKYKEYS[i], b = SKYKEYS[i + 1], f = THREE.MathUtils.clamp((t - a[0]) / (b[0] - a[0]), 0, 1); return cA.set(a[idx]).lerp(cB.set(b[idx]), f).getHex(); }
  function applyDay() {
    const D = ROOM_STATES.day, u = Math.min(1, dayT / 0.82), night = THREE.MathUtils.smoothstep(dayT, 0.8, 0.9);
    const alt = 1 + 52 * Math.pow(Math.sin(Math.PI * u), 0.85);
    D.sun = [alt, -68 + 136 * u, 5.4 * THREE.MathUtils.smoothstep(alt, 1, 9) * (1 - night)];
    D.hemi = 0.12 + 0.88 * (1 - night) * THREE.MathUtils.smoothstep(alt, 0, 14);
    D.expo = 1.25 - 0.05 * night + 0.25 * (1 - THREE.MathUtils.smoothstep(alt, 6, 30)) * (1 - night); D.lamps = night * 0.8;
    D.look = { ...D.look, skyTop: skyAt(dayT, 1), skyBot: skyAt(dayT, 2), bloom: 0.32 + 0.2 * night, sat: 1.08 - 0.12 * night };
    D.deck = { ...D.deck, cov: 0.28 * (1 - night), lit: dayT > 0.7 ? 0xffd2b0 : 0xffffff };
  }

  function update(dt, t, look = { x: 0, y: 0 }) {
    since += dt;
    if (name === 'day') applyDay();
    const k = 1 - Math.exp(-dt * 2.2), S = target;
    P.alt += (S.sun[0] - P.alt) * k; P.az += (S.sun[1] - P.az) * k; P.sunI += (S.sun[2] - P.sunI) * k;
    P.hemi += (S.hemi - P.hemi) * k; P.expo += (S.expo - P.expo) * k; P.fov += (S.fov - P.fov) * k;
    for (const key of ['lamps', 'tripod', 'person', 'modules', 'bracket', 'seated', 'lab', 'screen', 'bench']) P[key] += ((S[key] || 0) - P[key]) * Math.min(1, k * 1.6);
    const V = name === 'bench' ? BENCH_VIEWS[benchView] : null;
    camPos.lerp(tmp.set(...(V ? V[0] : S.cam)), k); camTgt.lerp(tmp.set(...(V ? V[1] : S.tgt)), k);

    // gentle drift of the sun so light visibly moves
    const drift = name === 'day' ? 0 : name === 'comfort' ? Math.sin(t * 0.12) * 5 : Math.sin(t * 0.07) * 3;
    sunVec(P.alt, P.az + drift);
    sun.intensity = P.sunI; hemi.intensity = P.hemi;
    const warm = THREE.MathUtils.clamp((P.alt - 4) / 30, 0, 1); sun.color.setRGB(1, 0.8 + 0.14 * warm, 0.6 + 0.3 * warm);
    sun.position.copy(L).multiplyScalar(40); sun.target.position.set(0, 0, 0);
    su.sunPosition.value.copy(L);
    updateBeams(t, (name === 'day' || name === 'about') && L.y > 0.02 && !(P.modules > 0.5) && !(P.screen > 0.5) ? THREE.MathUtils.clamp(P.sunI / 5, 0, 1) : 0);
    // the floor patch: where the window-centre ray lands
    const tt = 1.6 / Math.max(0.05, L.y); bounce.position.set(-L.x * tt, 0.3, Math.min(3.5, WZ - L.z * tt)); bounce.intensity = P.sunI * 1.6 * (1 - P.lamps);

    // lamps: they come on one by one, then the room moves through three moods
    const moods = [[0xffa45a, 1.0], [0xfff1e0, 1.7], [0xff8a4a, 0.45]];
    const mood = name === 'day' || name === 'bench' || name === 'late' ? 0 : Math.floor(since / 5.5) % 3, mk = moods[mood];
    lamps.forEach((l, i) => {
      const on = name === 'day' ? P.lamps : P.lamps * THREE.MathUtils.smoothstep(since, 0.6 + i * 0.7, 1.0 + i * 0.7);
      l.level += ((target.lamps && !(target.deskOnly && i < 2) ? on : 0) - l.level) * Math.min(1, dt * 5);
      l.L.color.lerp(tc.set(mk[0]), Math.min(1, dt * 1.5));
      l.L.intensity = l.level * (i === 3 ? 0.9 : 1.5) * mk[1];
      l.bulb.material.color.copy(l.L.color).multiplyScalar(l.level * 6 * mk[1]);
    });
    state.mood = target.lamps ? ['warm · relaxed', 'cool · alert', 'dim · intimate'][mood] : '';

    tripod.visible = P.tripod > 0.5; person.visible = P.person > 0.5; MOD.visible = P.modules > 0.02;
    rig.visible = P.lab > 0.5; rig.userData.glow.intensity = P.lab * 0.22;
    bench.visible = P.bench > 0.5;
    if (bench.visible) {
      paperT += dt; if (paperT > 2) { paperT = 0; drawPaper(t); }             // e-paper refreshes slowly, as it should
      leds.forEach((l, i) => l.material.color.setRGB(0, 0, 0).setRGB(0.1, 0.9, 0.35).multiplyScalar(0.25 + 0.75 * (Math.sin(t * 2.2 + i * 2.1) > 0.92 ? 1 : 0)));
    }
    // pattern screens: auto-cycle until the visitor picks one; each new screen slides down into place
    if (name === 'comfort') { patSince += dt; if (patAuto && patSince > 6.5) { patSince = 0; const order = ['none', 'stripe', 'bamboo', 'voronoi']; setPattern(order[(order.indexOf(pattern) + 1) % 4]); } }
    screenY += (0 - screenY) * Math.min(1, dt * 2.4);
    screen.visible = P.screen > 0.5 && pattern !== 'none';
    screen.position.y = (WY0 + WY1) / 2 + screenY * (WY1 - WY0 + 0.3);
    state.pattern = pattern;
    MOD.position.y = (1 - P.modules) * 3.2;                 // the façade slides into place
    cone.material.opacity = 0.09 * P.modules * (ai ? 1 : 0.3);

    // HDR bracketing (HiDyn): the felt side steps through exposures
    state.ev = P.bracket > 0.5 ? [-4, -1, 2, 5, 8][Math.floor(since / 1.3) % 5] : 0;

    // Solskin AI: every panel's tilt and turn balances three objectives — electricity, shading, view —
    // with weights W = [e, s, v] that the page sets (from the visitor's triangle, or a learned occupant model)
    if (name === 'solskin' || P.modules > 0.02) {
      const sp = (WZ - 0.75 - EYE.z) / L.z, hx = EYE.x + L.x * sp, hy = EYE.y + L.y * sp;   // eye→sun ray on the façade
      const altR = Math.asin(Math.max(0, L.y)), azR = Math.atan2(L.x, -L.z);
      const face = THREE.MathUtils.clamp((Math.PI / 2 - altR) / 1.45, 0, 1);   // openness that turns a panel to face the sun
      const [we, ws, wv] = Wt;
      let sumE = 0, sumV = 0, sumS = 0, nS = 0;
      for (const m of modules) {
        const d = Math.hypot(m.x - hx, m.y - hy), onLine = 1 - THREE.MathUtils.smoothstep(d, 0.3, 0.95);
        const oE = face * 0.35, oS = onLine ? THREE.MathUtils.lerp(face * 0.6, 0.02, onLine) : face * 0.6, oV = 0.95;
        const o = we * oE + ws * oS + wv * oV;
        const bb = (we + ws * 0.6) * -azR * 0.8 + Math.sin(t * 0.5 + m.x * 2) * 0.02;
        m.a += (o - m.a) * Math.min(1, dt * 2.5); m.b += (bb - m.b) * Math.min(1, dt * 2.5);
        m.p.rotation.set(-m.a * 1.45, m.b, 0);
        sumE += 1 - Math.abs(m.a - face * 0.35) * 1.4; sumV += m.a; if (onLine > 0.5) { sumS += 1 - m.a; nS++; }
      }
      const n = modules.length;
      state.score = [THREE.MathUtils.clamp(sumE / n, 0, 1), nS ? THREE.MathUtils.clamp(sumS / nS, 0, 1) : 0, THREE.MathUtils.clamp(sumV / n, 0, 1)];
    }
    state.ai = ai;

    // camera, with a little look-around
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    camera.rotateY(-look.x * 0.35); camera.rotateX(look.y * 0.18);
    if (Math.abs(camera.fov - P.fov) > 0.01) { camera.fov = P.fov; camera.updateProjectionMatrix(); }
    sky.position.copy(camera.position);
  }

  const state = { mood: '', ev: 0, ai: 1, score: [0, 0, 0] };
  return {
    scene, camera, sun, sky, state, update, setState,
    get name() { return name; }, get P() { return P; }, get L() { return L; },
    setAI(v) { aiAuto = v === 'auto'; if (!aiAuto) ai = v ? 1 : 0; since = 0; },
    setDayTime(v) { dayT = v; applyDay(); },
    setBench(i) { benchView = Math.max(0, Math.min(BENCH_VIEWS.length - 1, i | 0)); },
    setPattern(k) { patAuto = false; patSince = 0; setPattern(k); },
    setWeights(w) { const z = w[0] + w[1] + w[2] || 1; Wt[0] = w[0] / z; Wt[1] = w[1] / z; Wt[2] = w[2] / z; },
    get weights() { return Wt.slice(); },
    look() { const S = ROOM_STATES[name]; return { look: S.look, deck: S.deck, expo: P.expo }; },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
  };
}

function chair(b, x, z) {
  const c = 0x2b2d30, seat = 0xd8cdb8;
  box(b, 'trim', I, x, 0.45, z, 0.46, 0.04, 0.44, seat);
  box(b, 'trim', I, x, 0.75, z + 0.22, 0.46, 0.4, 0.03, seat);
  for (const [dx, dz] of [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]]) box(b, 'dark', I, x + dx, 0.22, z + dz, 0.025, 0.45, 0.025, c);
}
