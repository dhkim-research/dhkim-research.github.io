// Default configuration
let config = {
  particleColor: [150, 190, 195],
  colorNoise: 80,
  particleFriction: 0.18,
  particleFrictionNoise: 0.05,
  mouseAvoidanceStrength: 2,
  mouseAvoidanceStrengthNoise: 2,
  mouseAvoidanceDistance: 50,
  mouseAvoidanceDistanceNoise: 50,
};
function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  updateScene();
}

// Constants and global variables
const retinaIndex = window.devicePixelRatio;
const canvas = document.querySelector("#scene");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
let windowWidth = window.innerWidth;
let mouse = { x: 9999, y: 9999 };
let mouseOverCanvas = true;
let particles = [];
let lastUsedImage = null;
let allInEndPosition = false;
let ww = canvas.scrollWidth;
let wh = canvas.scrollHeight;
let particleRadius = 5 * retinaIndex;
let radius;
let numParticles = 0;

// Set up context
ctx.globalCompositeOperation = "difference";

// Particle constructor
function Particle(x, y) {
  // Initialize the properties with default values
  this.x = Math.random() * ww;
  this.y = Math.random() * wh;
  this.dest = { x: x, y: y };
  this.r = particleRadius;
  this.vx = (Math.random() - 0.5) * 20;
  this.vy = (Math.random() - 0.5) * 20;
  this.accX = 0;
  this.accY = 0;
  this.friction =
    (Math.random() - 0.5) * config.particleFrictionNoise +
    (1 - config.particleFriction);

  const colorValue = (Math.random() - 0.5) * config.colorNoise;
  this.color = `rgb(${config.particleColor[0] + colorValue},${
    config.particleColor[1] + colorValue
  },${config.particleColor[2] + colorValue})`;
}
Particle.prototype.render = function () {
  ctx.fillStyle = this.color;
  ctx.beginPath();
  ctx.arc(this.x, this.y, this.r, Math.PI * 2, false);
  ctx.fill();
};
function updateParticlePosition(particle) {
  particle.accX = (particle.dest.x - particle.x) / 100;
  particle.accY = (particle.dest.y - particle.y) / 100;
  particle.vx += particle.accX;
  particle.vy += particle.accY;
  particle.vx *= particle.friction;
  particle.vy *= particle.friction;
  particle.x += particle.vx;
  particle.y += particle.vy;

  if (
    Math.abs(particle.dest.x - particle.x) > 0.1 ||
    Math.abs(particle.dest.y - particle.y) > 0.1 ||
    particle.vx > 0.1 ||
    particle.vy > 0.1
  ) {
    allInEndPosition = false;
  }

  if (mouseOverCanvas) {
    let dx = particle.x - mouse.x;
    let dy = particle.y - mouse.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (
      distance <
      radius * config.mouseAvoidanceDistance +
        (Math.random() - 0.5) * radius * config.mouseAvoidanceDistanceNoise
    ) {
      particle.accX =
        (particle.x - mouse.x) *
        (config.mouseAvoidanceStrength / 100 +
          ((Math.random() - 0.5) * config.mouseAvoidanceStrengthNoise) / 100);
      particle.accY =
        (particle.y - mouse.y) *
        (config.mouseAvoidanceStrength / 100 +
          ((Math.random() - 0.5) * config.mouseAvoidanceStrengthNoise) / 100);
      particle.vx += particle.accX;
      particle.vy += particle.accY;
    }
  }
}

// Event handling functions
function mouseStatus(value) {
  mouseOverCanvas = value;
}
function onMouseMove(e) {
  mouse.x = (e.pageX - canvas.offsetLeft) * retinaIndex;
  mouse.y = (e.pageY - canvas.offsetTop) * retinaIndex;
}
function click(e) {
  mouse.x = (e.pageX - canvas.offsetLeft) * retinaIndex;
  mouse.y = (e.pageY - canvas.offsetTop) * retinaIndex;
  mouseOverCanvas = true;
  debounce(stopClick, 500)();
}
function stopClick() {
  mouse.x = 9999;
  mouse.y = 9999;
  mouseOverCanvas = false;
}

// Main functions
function initScene(base64Img) {
  lastUsedImage = base64Img;
  resetParticles();

  particles = [];
  numParticles = 0;
  radius = 3 * retinaIndex;
  particleRadius = 4 * retinaIndex;
  if (ww < 500) {
    radius = 2 * retinaIndex;
  }
  if (ww < 250 || window.innerWidth < 1000) {
    radius = 1.5 * retinaIndex;
  }
  if (window.innerWidth < 500) {
    particleRadius = 2 * retinaIndex;
  }
  allInEndPosition = false;

  ww = canvas.width = canvas.scrollWidth * retinaIndex;
  wh = canvas.height = canvas.scrollHeight * retinaIndex;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let imageWidth = ww / 2;
  let imageHeight = Math.round(imageWidth / 1.2);
  if (imageHeight >= 0.9 * wh) {
    imageHeight = 0.8 * wh;
    imageWidth = imageHeight * 1.2;
  }

  var image = new Image();
  image.onload = function () {
    ctx.drawImage(
      image,
      ww / 2 - imageWidth / 2,
      wh / 2 - imageHeight / 2,
      imageWidth,
      imageHeight
    );
    var data = ctx.getImageData(0, 0, ww, wh).data;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "screen";

    for (var i = 0; i < ww; i += (particleRadius + 2) * 2) {
      for (var j = 0; j < wh; j += (particleRadius + 2) * 2) {
        if (data[(i + j * ww) * 4 + 3] > 0) {
          particles.push(new Particle(i, j));
        }
      }
    }
    numParticles = particles.length;
  };

  image.src = `data:image/png;base64,${lastUsedImage}`;
}
function updateScene() {
  var x = 0;
}

function handleResize() {
  if (windowWidth !== window.innerWidth && lastUsedImage) {
    windowWidth = window.innerWidth;
    initScene();
  }
}

function resetParticles() {
  particles = [];
  radius = 3 * retinaIndex;
  particleRadius = 4 * retinaIndex;
  allInEndPosition = false;

  if (ww < 500) {
    radius = 2 * retinaIndex;
  }
  if (ww < 250 || window.innerWidth < 1000) {
    radius = 1.5 * retinaIndex;
  }
  if (window.innerWidth < 500) {
    particleRadius = 2 * retinaIndex;
  }
}

function render() {
  if (!allInEndPosition || mouseOverCanvas) {
    if (numParticles > 0) {
      allInEndPosition = true;
      for (let i = 0; i < numParticles; i++) {
        updateParticlePosition(particles[i]);
      }
      if (!allInEndPosition) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < numParticles; i++) {
          particles[i].render();
        }
      }
    }
  }
  requestAnimationFrame(render);
}

// Event listeners
window.addEventListener("resize", debounce(handleResize, 200));
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("touchstart", click);
window.addEventListener("DOMContentLoaded", () => {
  requestAnimationFrame(render);
});

// Expose initScene and updateConfig to global scope
window.initScene = initScene;
window.updateConfig = updateConfig;

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
}