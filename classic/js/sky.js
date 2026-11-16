// sky.js — Publication Sky: a fisheye luminance map of the sky, with every paper as a light source
import { PUBS, THEMES } from './pubs.js?v=d0ccaa0d';

const Y0 = 2011, Y1 = 2026;
const TAU = Math.PI * 2;

// a smooth clear-sky luminance model (relative), with the sun low in the south-west
function skyL(alt, az, sunAlt, sunAz) {
  const cosg = Math.sin(alt) * Math.sin(sunAlt) + Math.cos(alt) * Math.cos(sunAlt) * Math.cos(az - sunAz);
  const g = Math.acos(Math.max(-1, Math.min(1, cosg)));
  const z = Math.PI / 2 - alt, zs = Math.PI / 2 - sunAlt;
  const f = (gg) => 0.91 + 10 * Math.exp(-3 * gg) + 0.45 * Math.cos(gg) ** 2;
  const phi = (zz) => 1 - Math.exp(-0.32 / Math.max(0.02, Math.cos(zz)));
  return (f(g) * phi(z)) / (f(zs) * phi(0));
}
function falseColor(t) {           // t in 0..1 → cool-to-warm, perceptually ordered
  const stops = [[0.09, 0.11, 0.35], [0.12, 0.36, 0.62], [0.2, 0.62, 0.58], [0.62, 0.78, 0.36], [0.96, 0.78, 0.3], [0.93, 0.42, 0.18], [0.98, 0.94, 0.86]];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1), i = Math.floor(x), f = x - i, a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function createSky(canvas, { onPick = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0, split = 0.36, filter = null, hover = null, pinned = null, lang = 'en';
  const felt = document.createElement('canvas'), meas = document.createElement('canvas');
  const sunAlt = 0.3, sunAz = 165 * Math.PI / 180;

  // place the stars: azimuth by theme, distance from the zenith by year (the sky fills outward over a career)
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const stars = PUBS.map((p, i) => {
    const th = THEMES[p.th], spread = 0.55;
    const az = (th.az * Math.PI / 180) + (rnd() - 0.5) * spread * 2;
    const r = p.status ? 1.02 + rnd() * 0.04 : 0.12 + 0.82 * (p.y - Y0) / (Y1 - Y0) + (rnd() - 0.5) * 0.06;
    return { ...p, i, az, r, tw: rnd() * TAU, x: 0, y: 0 };
  });

  function bake() {
    // render the two sky images once per size, at a modest resolution
    const N = Math.max(160, Math.min(420, Math.round(R * 2 / 2.2)));
    for (const [cv, mode] of [[felt, 'felt'], [meas, 'meas']]) {
      cv.width = cv.height = N; const c = cv.getContext('2d'), img = c.createImageData(N, N), d = img.data;
      const Ls = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N * 2 - 1, v = (j + 0.5) / N * 2 - 1, rr = Math.hypot(u, v), k = (j * N + i) * 4;
        if (rr > 1) { d[k + 3] = 0; continue; }
        const alt = Math.PI / 2 * (1 - rr), az = Math.atan2(u, -v);
        const L = skyL(alt, az, sunAlt, sunAz) * (1 + 0.04 * Math.sin(u * 9 + v * 4));
        let col;
        if (mode === 'felt') {
          const zen = [0.13, 0.3, 0.66], hor = [0.6, 0.74, 0.9], warm = [1.0, 0.84, 0.62];
          const h = Math.pow(rr, 2.2), s = Math.min(1, Math.max(0, (L - 2.5) / 10));
          col = [0, 1, 2].map((q) => (zen[q] + (hor[q] - zen[q]) * h) * (1 - s * 0.6) + warm[q] * s * 0.9);
          const sunD = Math.hypot(u - Math.sin(sunAz) * (1 - sunAlt / (Math.PI / 2)), v + Math.cos(sunAz) * (1 - sunAlt / (Math.PI / 2)));
          const disc = Math.exp(-sunD * 70) * 1.4 + Math.exp(-sunD * 14) * 0.25;
          col = col.map((x, q) => Math.min(1, x + disc * [1, 0.95, 0.85][q]));
        } else {
          const t = (Math.log10(Math.max(0.05, L * 5000)) - 3.25) / 1.75;     // ~ 1 800 … 100 000 cd/m²
          col = falseColor(t);
        }
        d[k] = col[0] * 255; d[k + 1] = col[1] * 255; d[k + 2] = col[2] * 255; d[k + 3] = 255;
        Ls.push(L);
      }
      c.putImageData(img, 0, 0);
      if (mode === 'meas') { // isolines every half decade, drawn as ink
        c.strokeStyle = 'rgba(21,21,21,.55)'; c.lineWidth = Math.max(1, N / 300);
        const lv = (i, j) => { const u = (i + 0.5) / N * 2 - 1, v = (j + 0.5) / N * 2 - 1; if (Math.hypot(u, v) > 1) return null; return Math.log10(Math.max(0.05, skyL(Math.PI / 2 * (1 - Math.hypot(u, v)), Math.atan2(u, -v), sunAlt, sunAz) * 5000)) * 6; };
        const id = c.getImageData(0, 0, N, N);
        for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
          const a = lv(i, j), b = lv(i + 1, j), e = lv(i, j + 1); if (a == null || b == null || e == null) continue;
          if (Math.floor(a) !== Math.floor(b) || Math.floor(a) !== Math.floor(e)) { const k = (j * N + i) * 4; id.data[k] *= 0.25; id.data[k + 1] *= 0.25; id.data[k + 2] *= 0.25; }
        }
        c.putImageData(id, 0, 0);
      }
    }
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr;
    const narrow = W < 760;
    R = narrow ? Math.min(W * 0.44, H * 0.3) : Math.min(H * 0.4, W * 0.3);
    cx = narrow ? W / 2 : W * 0.62; cy = narrow ? H * 0.42 : H * 0.53;
    bake();
  }

  function starXY(s) { const rr = s.r * R; return [cx + Math.sin(s.az) * rr, cy - Math.cos(s.az) * rr]; }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#121416'; ctx.fillRect(0, 0, W, H);
    // the sky disc: measured left of the seam, felt right of it
    const sx = W * split;
    ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, W - sx, H); ctx.clip(); ctx.drawImage(felt, cx - R, cy - R, R * 2, R * 2); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, H); ctx.clip(); ctx.drawImage(meas, cx - R, cy - R, R * 2, R * 2); ctx.restore();
    // fisheye graticule: altitude rings = years
    ctx.lineWidth = 1;
    for (const yr of [2014, 2018, 2022, 2026]) {
      const rr = (0.12 + 0.82 * (yr - Y0) / (Y1 - Y0)) * R;
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(String(yr), cx + 4, cy - rr - 4);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    // theme sectors
    for (const [k, th] of Object.entries(THEMES)) {
      const a = th.az * Math.PI / 180, on = !filter || filter === k;
      for (const e of [-0.62, 0.62]) { ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a + e) * R, cy - Math.cos(a + e) * R); ctx.stroke(); }
      const lx = cx + Math.sin(a) * (R + 26), ly = cy - Math.cos(a) * (R + 26);
      ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.textAlign = Math.sin(a) > 0.2 ? 'left' : Math.sin(a) < -0.2 ? 'right' : 'center';
      ctx.fillStyle = on ? '#f1efea' : 'rgba(241,239,234,.35)'; ctx.fillText((lang === 'ja' ? th.ja : th.en).toUpperCase(), lx, ly + 4);
    }
    // the horizon glow where unfinished work waits
    const gr = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12); gr.addColorStop(0, 'rgba(232,163,61,0)'); gr.addColorStop(0.5, 'rgba(232,163,61,.16)'); gr.addColorStop(1, 'rgba(232,163,61,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.arc(cx, cy, R * 0.96, 0, TAU, true); ctx.fill();
    // stars
    for (const s of stars) {
      const [x, y] = starXY(s); s.x = x; s.y = y;
      const on = !filter || filter === s.th, sel = (hover === s) || (pinned === s);
      const base = s.role === 'lead' ? (s.k === 'T' ? 7 : 5.2) : 2.8, tw = 0.85 + 0.15 * Math.sin(t * 1.7 + s.tw);
      const a = on ? 1 : 0.18, rad = base * tw * (sel ? 1.5 : 1);
      if (s.status) { // dawn: amber, half below the horizon
        ctx.globalAlpha = a; ctx.fillStyle = '#e8a33d'; ctx.beginPath(); ctx.arc(x, y, rad * 0.9, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(232,163,61,.8)'; ctx.beginPath(); ctx.arc(x, y, rad * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; continue;
      }
      const glow = ctx.createRadialGradient(x, y, 0, x, y, rad * (s.role === 'lead' ? 6 : 3.5));
      glow.addColorStop(0, `rgba(255,248,230,${0.9 * a})`); glow.addColorStop(0.25, `rgba(255,236,200,${0.35 * a})`); glow.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, rad * 6, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      if (s.k === 'R') ctx.fillRect(x - rad * 0.6, y - rad * 0.6, rad * 1.2, rad * 1.2);
      else { ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, TAU); ctx.fill(); }
      if (s.role === 'lead' && on) { // diffraction spikes for lead-author work
        ctx.strokeStyle = `rgba(255,250,236,${0.55 * a})`; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(x - rad * 3.2, y); ctx.lineTo(x + rad * 3.2, y); ctx.moveTo(x, y - rad * 3.2); ctx.lineTo(x, y + rad * 3.2); ctx.stroke();
      }
      if (s.k === 'T') { ctx.strokeStyle = `rgba(255,255,255,${0.7 * a})`; ctx.beginPath(); ctx.arc(x, y, rad * 1.6, 0, TAU); ctx.stroke(); }
      if (sel) { ctx.strokeStyle = '#e8a33d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, rad * 2.4 + 4, 0, TAU); ctx.stroke(); ctx.lineWidth = 1; }
    }
    // the seam
    ctx.fillStyle = 'rgba(255,248,232,.9)'; ctx.fillRect(Math.round(sx), 0, 1, H);
  }

  function pick(px, py) {
    let best = null, bd = 22;
    for (const s of stars) { if (filter && filter !== s.th) continue; const d = Math.hypot(s.x - px, s.y - py); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); const s = pick(e.clientX - r.left, e.clientY - r.top); if (s !== hover) { hover = s; if (!pinned) onPick(s, e.clientX, e.clientY); } canvas.style.cursor = s ? 'pointer' : 'default'; });
  canvas.addEventListener('pointerleave', () => { hover = null; if (!pinned) onPick(null); });
  canvas.addEventListener('click', (e) => { const r = canvas.getBoundingClientRect(); const s = pick(e.clientX - r.left, e.clientY - r.top); pinned = s; onPick(s, e.clientX, e.clientY, true); });

  addEventListener('resize', () => { if (canvas.clientWidth) resize(); });
  resize();
  return {
    draw, resize, stars,
    setSplit(v) { split = v; }, setFilter(f) { filter = f; }, setLang(l) { lang = l; },
    unpin() { pinned = null; onPick(null); }
  };
}
