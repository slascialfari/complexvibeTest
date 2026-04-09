/* ============================================================
   STREET WALKER — app.js
   A simple side-scrolling walker: tap-hold to walk, reach
   the end of the level to win.
   ============================================================ */

// ─── Frame list (8 walk cycle frames, in order) ───────────────
const FRAMES = [
  'assets/frame_01.png',
  'assets/frame_02.png',
  'assets/frame_03.png',
  'assets/frame_04.png',
  'assets/frame_05.png',
  'assets/frame_06.png',
  'assets/frame_07.png',
  'assets/frame_08.png',
];

// ─── Config ───────────────────────────────────────────────────
const CFG = {
  fps:           10,          // animation frame rate (walk cycle speed)
  walkSpeed:     2.2,         // hero px/frame movement (at 60fps tick)
  bgParallax:    1.0,         // bg scrolls 1:1 with hero movement
  heroBottomPct: 0.07,        // hero sits 7% from bottom of screen
  heroWidthPct:  0.30,        // hero width = 30% of screen width
  levelWidthPx:  3000,        // total virtual level width in px
  startXPct:     0.15,        // hero starts at 15% from left
  finishXPct:    0.85,        // finish line at 85% of level (virtual)
};

// ─── State ────────────────────────────────────────────────────
let state = {
  phase: 'start',   // 'start' | 'playing' | 'won'
  walking: false,   // is the user holding down?
  heroX: 0,         // hero position in VIRTUAL level coords (0–levelWidthPx)
  frameIdx: 0,      // current walk animation frame
  frameTick: 0,     // counts game loop iterations for animation pacing
  bgOffsetX: 0,     // background scroll offset in CSS px
};

// ─── DOM refs ────────────────────────────────────────────────
const container    = document.getElementById('game-container');
const bgLayer      = document.getElementById('bg-layer');
const hero         = document.getElementById('hero');
const finishLine   = document.getElementById('finish-line');
const startScreen  = document.getElementById('start-screen');
const winScreen    = document.getElementById('win-screen');
const restartBtn   = document.getElementById('restart-btn');
const ambient      = document.getElementById('ambient');

// ─── Progress bar (injected dynamically) ─────────────────────
const progressWrap = document.createElement('div');
progressWrap.id = 'progress-bar-wrap';
const progressBar = document.createElement('div');
progressBar.id = 'progress-bar';
progressWrap.appendChild(progressBar);
container.appendChild(progressWrap);

// ─── Preload all frames ───────────────────────────────────────
const frameImgs = FRAMES.map(src => {
  const img = new Image();
  img.src = src;
  return img;
});

// ─── Viewport helpers ─────────────────────────────────────────
let vw = 0, vh = 0;
let heroDisplayW = 0, heroDisplayH = 0;
let heroScreenX = 0;   // fixed screen X where hero is drawn
let bgNaturalW = 0, bgNaturalH = 0;
let bgDisplayH = 0, bgDisplayW = 0;  // bg rendered size

function measureViewport() {
  vw = container.clientWidth;
  vh = container.clientHeight;

  // Hero size: proportional to viewport width
  heroDisplayW = Math.round(vw * CFG.heroWidthPct);
  // Maintain natural aspect ratio of the sprite (237×443)
  heroDisplayH = Math.round(heroDisplayW * (443 / 237));

  // Hero fixed screen position (left-anchored at ~25% from left)
  heroScreenX = Math.round(vw * 0.25);

  // Apply hero CSS size
  hero.style.width  = heroDisplayW + 'px';
  hero.style.height = heroDisplayH + 'px';
  hero.style.left   = heroScreenX + 'px';
  hero.style.bottom = Math.round(vh * CFG.heroBottomPct) + 'px';

  // Background: fill full screen height
  bgDisplayH = vh;
  // bg natural is 1920×1080; scale to fill height
  bgDisplayW = Math.round(1920 * (vh / 1080));
  bgLayer.style.height = bgDisplayH + 'px';
  bgLayer.style.width  = bgDisplayW + 'px';

  // Reposition finish line on resize
  updateFinishLine();
}

// ─── Finish line screen position ─────────────────────────────
function updateFinishLine() {
  // The finish line is at heroX = CFG.levelWidthPx * CFG.finishXPct
  // We draw it at its world position relative to the camera
  const finishWorld = CFG.levelWidthPx * CFG.finishXPct;
  const finishScreen = worldToScreen(finishWorld);
  finishLine.style.left = finishScreen + 'px';
  if (finishScreen >= 0 && finishScreen <= vw) {
    finishLine.classList.add('visible');
  } else {
    finishLine.classList.remove('visible');
  }
}

// Convert a world X coordinate to screen X
function worldToScreen(worldX) {
  // Camera follows hero: screen X = heroScreenX when worldX == state.heroX
  return heroScreenX + (worldX - state.heroX);
}

// ─── Background scroll ───────────────────────────────────────
function updateBgScroll() {
  // Camera: hero is pinned at heroScreenX on screen.
  // bg should scroll so that when heroX=0 we see bg start,
  // and when heroX=levelWidthPx we've scrolled the full bg width.
  const scrollRatio = state.heroX / (CFG.levelWidthPx * CFG.finishXPct);
  // Max scroll: bg wider than screen
  const maxScroll = Math.max(0, bgDisplayW - vw);
  state.bgOffsetX = -Math.min(scrollRatio * maxScroll, maxScroll);
  bgLayer.style.transform = `translateX(${state.bgOffsetX}px)`;
}

// ─── Walk animation ───────────────────────────────────────────
// How many 60fps ticks between frame advances
const TICKS_PER_FRAME = Math.round(60 / CFG.fps);

function stepAnimation() {
  state.frameTick++;
  if (state.frameTick >= TICKS_PER_FRAME) {
    state.frameTick = 0;
    state.frameIdx = (state.frameIdx + 1) % FRAMES.length;
    hero.src = FRAMES[state.frameIdx];
  }
}

function resetAnimation() {
  state.frameIdx = 0;
  state.frameTick = 0;
  hero.src = FRAMES[0];
}

// ─── Progress bar update ─────────────────────────────────────
function updateProgress() {
  const pct = Math.min(state.heroX / (CFG.levelWidthPx * CFG.finishXPct), 1) * 100;
  progressBar.style.width = pct + '%';
}

// ─── Game loop ───────────────────────────────────────────────
let lastRaf = null;

function gameLoop() {
  if (state.phase === 'won') return;

  if (state.walking && state.phase === 'playing') {
    // Move hero forward
    state.heroX += CFG.walkSpeed;

    // Animate sprite
    stepAnimation();

    // Scroll background
    updateBgScroll();

    // Update finish line position
    updateFinishLine();

    // Update progress bar
    updateProgress();

    // Check win condition
    const finishWorld = CFG.levelWidthPx * CFG.finishXPct;
    if (state.heroX >= finishWorld) {
      triggerWin();
      return;
    }
  }

  lastRaf = requestAnimationFrame(gameLoop);
}

// ─── State transitions ────────────────────────────────────────
function startGame() {
  // Hide start screen
  startScreen.classList.remove('active');

  // Start ambient audio (must be triggered by user gesture on iOS)
  ambient.volume = 0.7;
  ambient.play().catch(() => {});

  state.phase = 'playing';
  state.heroX = CFG.levelWidthPx * CFG.startXPct;
  state.bgOffsetX = 0;
  resetAnimation();
  updateBgScroll();
  updateFinishLine();
  updateProgress();

  // Show progress bar
  progressWrap.style.display = 'block';

  lastRaf = requestAnimationFrame(gameLoop);
}

function triggerWin() {
  state.phase = 'won';
  state.walking = false;

  // Freeze on last frame
  hero.src = FRAMES[4];

  // Show win screen
  winScreen.classList.add('active');

  // Fade ambient
  let vol = ambient.volume;
  const fadeInterval = setInterval(() => {
    vol = Math.max(0, vol - 0.05);
    ambient.volume = vol;
    if (vol <= 0) {
      clearInterval(fadeInterval);
      ambient.pause();
    }
  }, 80);
}

function resetGame() {
  winScreen.classList.remove('active');
  state.phase = 'start';
  state.walking = false;
  state.heroX = 0;
  state.bgOffsetX = 0;
  state.frameIdx = 0;
  state.frameTick = 0;

  hero.src = FRAMES[0];
  bgLayer.style.transform = 'translateX(0)';
  progressBar.style.width = '0%';
  progressWrap.style.display = 'none';
  finishLine.classList.remove('visible');

  // Small delay then show start screen
  setTimeout(() => {
    startScreen.classList.add('active');
  }, 200);
}

// ─── Touch / pointer input ───────────────────────────────────
// Tap & hold = walk. Release = stop.

let activeTouches = 0;

function onTouchStart(e) {
  e.preventDefault();
  activeTouches = e.touches.length;

  if (state.phase === 'start') {
    startGame();
  }

  if (state.phase === 'playing') {
    state.walking = true;
    // Ensure loop is running
    if (!lastRaf) lastRaf = requestAnimationFrame(gameLoop);
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  activeTouches = e.touches.length;

  if (activeTouches === 0 && state.phase === 'playing') {
    state.walking = false;
    // Return to idle frame
    resetAnimation();
  }
}

function onTouchCancel(e) {
  onTouchEnd(e);
}

// Pointer events fallback (for desktop testing)
function onPointerDown(e) {
  if (e.pointerType === 'touch') return; // handled by touch events
  if (state.phase === 'start') startGame();
  if (state.phase === 'playing') {
    state.walking = true;
    if (!lastRaf) lastRaf = requestAnimationFrame(gameLoop);
  }
}
function onPointerUp(e) {
  if (e.pointerType === 'touch') return;
  if (state.phase === 'playing') {
    state.walking = false;
    resetAnimation();
  }
}

container.addEventListener('touchstart',  onTouchStart,  { passive: false });
container.addEventListener('touchend',    onTouchEnd,    { passive: false });
container.addEventListener('touchcancel', onTouchCancel, { passive: false });
container.addEventListener('pointerdown', onPointerDown);
container.addEventListener('pointerup',   onPointerUp);

// Restart button
restartBtn.addEventListener('click', resetGame);
restartBtn.addEventListener('touchend', (e) => { e.preventDefault(); resetGame(); });

// ─── Resize handler ───────────────────────────────────────────
window.addEventListener('resize', () => {
  measureViewport();
  updateBgScroll();
});

// ─── Init ─────────────────────────────────────────────────────
function init() {
  progressWrap.style.display = 'none'; // hidden until game starts
  measureViewport();
  hero.src = FRAMES[0];
  hero.style.imageRendering = 'auto';
}

// Wait for DOM images to be ready, then init
window.addEventListener('load', init);
