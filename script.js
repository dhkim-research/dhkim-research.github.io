const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
let particles = [];
let ww, wh;

function resize() {
  ww = canvas.width = window.innerWidth;
  wh = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Particle {
  constructor(x, y) {
    this.x = Math.random() * ww;
    this.y = Math.random() * wh;
    this.dest = { x, y };
    this.r = 2;
    this.vx = (Math.random() - 0.5) * 10;
    this.vy = (Math.random() - 0.5) * 10;
    this.color = `rgb(${150 + Math.random() * 100},${150 + Math.random() * 100},255)`;
  }
  update() {
    this.x += (this.dest.x - this.x) * 0.02 + this.vx * 0.9;
    this.y += (this.dest.y - this.y) * 0.02 + this.vy * 0.9;
  }
  draw() {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function init() {
  particles = [];
  const cols = 40, rows = 25;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      particles.push(new Particle((i / cols) * ww, (j / rows) * wh));
}
init();

function animate() {
  requestAnimationFrame(animate);
  ctx.clearRect(0, 0, ww, wh);
  particles.forEach(p => { p.update(); p.draw(); });
}
animate();
