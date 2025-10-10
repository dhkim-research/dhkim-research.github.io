

const canvas = document.getElementById('brain');
const ctx = canvas.getContext('2d');

const COLORS = ["#70989D", "#87AFB4", "#BCE4E9", "#84ACB1", "#6F979C"];
let particles = [];
let mouse = { x: 0, y: 0 };
let ww, wh;

// resize canvas
function resize() {
  ww = canvas.width = 280;
  wh = canvas.height = 220;
}
resize();

// draw pixel data for the shape
function createShape() {
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  off.width = ww;
  off.height = wh;

  offCtx.fillStyle = '#000';
  // Draw a simplified "brain" shape
  offCtx.beginPath();
  offCtx.moveTo(40, 100);
  offCtx.bezierCurveTo(40, 20, 240, 20, 240, 100);
  offCtx.bezierCurveTo(240, 180, 40, 180, 40, 100);
  offCtx.fill();

  const imageData = offCtx.getImageData(0, 0, ww, wh).data;
  for (let y = 0; y < wh; y += 4) {
    for (let x = 0; x < ww; x += 4) {
      const alpha = imageData[(y * ww + x) * 4 + 3];
      if (alpha > 128) {
        particles.push({
          x: x + Math.random() * 2,
          y: y + Math.random() * 2,
          ox: x,
          oy: y,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 1.4 + Math.random() * 1.2
        });
      }
    }
  }
}

createShape();

// track mouse movement
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

// animate particles
function animate() {
  ctx.clearRect(0, 0, ww, wh);
  for (let p of particles) {
    const dx = mouse.x - p.x;
    const dy = mouse.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const force = Math.max(-20, Math.min(20, 200 / (dist + 0.1)));

    p.x += (p.ox - p.x) * 0.05 - (dx / dist) * force * 0.02;
    p.y += (p.oy - p.y) * 0.05 - (dy / dist) * force * 0.02;

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  requestAnimationFrame(animate);
}
animate();
