(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("highScore");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnRestart = document.getElementById("btnRestart");

  const dpad = document.getElementById("dpad");

  const GRID_SIZE = 20; // cells per row/column
  const INITIAL_SNAKE_LENGTH = 4;
  const INITIAL_SPEED_CELLS_PER_SEC = 8; // cells per second
  const SPEED_INCREMENT = 0.15; // on eat

  const CELL_COLOR = "#14b8a6"; // teal
  const CELL_HEAD_COLOR = "#22c55e"; // green
  const FOOD_COLOR = "#f59e0b"; // amber
  const GRID_COLOR = "#1f2337";

  let cellPixelSize = Math.floor(canvas.width / GRID_SIZE);

  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  /** @type {{x:number,y:number}[]} */
  let snakeBody = [];
  /** @type {{x:number,y:number}} */
  let snakeDirection = directions.right;
  /** @type {{x:number,y:number}} */
  let pendingDirection = directions.right; // to avoid instant reverse
  /** @type {{x:number,y:number}} */
  let foodCell = { x: 10, y: 10 };
  let isRunning = false;
  let isPaused = false;
  let elapsedAccumulatorMs = 0;
  let speedCellsPerSec = INITIAL_SPEED_CELLS_PER_SEC;
  let score = 0;
  let highScore = Number(localStorage.getItem("snake.highScore") || 0);
  highScoreEl.textContent = String(highScore);

  function resetGame() {
    score = 0;
    speedCellsPerSec = INITIAL_SPEED_CELLS_PER_SEC;
    elapsedAccumulatorMs = 0;
    snakeDirection = directions.right;
    pendingDirection = directions.right;
    const startX = Math.floor(GRID_SIZE / 3);
    const startY = Math.floor(GRID_SIZE / 2);
    snakeBody = [];
    // Ensure the head is at the rightmost segment so moving right is safe
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
      snakeBody.push({ x: startX - i, y: startY });
    }
    placeFood();
    scoreEl.textContent = "0";
  }

  function placeFood() {
    const occupied = new Set(snakeBody.map(c => `${c.x},${c.y}`));
    let x, y;
    do {
      x = Math.floor(Math.random() * GRID_SIZE);
      y = Math.floor(Math.random() * GRID_SIZE);
    } while (occupied.has(`${x},${y}`));
    foodCell = { x, y };
  }

  function resizeCanvasToDisplaySize() {
    const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 640);
    const target = Math.max(240, Math.floor(size));
    // keep canvas square and cell integer sizes
    canvas.width = target;
    canvas.height = target;
    cellPixelSize = Math.floor(target / GRID_SIZE);
  }

  function drawGrid() {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID_SIZE; i++) {
      const p = i * cellPixelSize + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, canvas.height);
      ctx.moveTo(0, p);
      ctx.lineTo(canvas.width, p);
    }
    ctx.stroke();
  }

  function drawCell(cell, color) {
    const padding = Math.max(1, Math.floor(cellPixelSize * 0.08));
    ctx.fillStyle = color;
    ctx.fillRect(
      cell.x * cellPixelSize + padding,
      cell.y * cellPixelSize + padding,
      cellPixelSize - padding * 2,
      cellPixelSize - padding * 2
    );
  }

  function stepSnake() {
    snakeDirection = pendingDirection;
    const newHead = {
      x: snakeBody[0].x + snakeDirection.x,
      y: snakeBody[0].y + snakeDirection.y
    };

    // wall collision -> game over
    if (
      newHead.x < 0 || newHead.y < 0 ||
      newHead.x >= GRID_SIZE || newHead.y >= GRID_SIZE
    ) {
      return false;
    }

    // self collision
    for (let i = 0; i < snakeBody.length; i++) {
      const s = snakeBody[i];
      if (s.x === newHead.x && s.y === newHead.y) return false;
    }

    snakeBody.unshift(newHead);

    if (newHead.x === foodCell.x && newHead.y === foodCell.y) {
      score += 10;
      scoreEl.textContent = String(score);
      speedCellsPerSec += SPEED_INCREMENT;
      placeFood();
    } else {
      snakeBody.pop();
    }

    return true;
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    // food
    drawCell(foodCell, FOOD_COLOR);
    // snake
    for (let i = snakeBody.length - 1; i >= 1; i--) {
      drawCell(snakeBody[i], CELL_COLOR);
    }
    drawCell(snakeBody[0], CELL_HEAD_COLOR);
  }

  let rafId = 0;
  let lastTimestamp = 0;
  function loop(ts) {
    if (!isRunning || isPaused) return;
    rafId = requestAnimationFrame(loop);
    if (!lastTimestamp) lastTimestamp = ts;
    const dt = ts - lastTimestamp;
    lastTimestamp = ts;
    elapsedAccumulatorMs += dt;

    const msPerStep = 1000 / speedCellsPerSec;
    while (elapsedAccumulatorMs >= msPerStep) {
      elapsedAccumulatorMs -= msPerStep;
      const ok = stepSnake();
      if (!ok) {
        gameOver();
        return;
      }
    }
    render();
  }

  function startGame() {
    if (isRunning && !isPaused) return;
    if (!isRunning) {
      resetGame();
      isRunning = true;
    }
    isPaused = false;
    overlay.hidden = true;
    lastTimestamp = 0;
    rafId = requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (!isRunning) return;
    isPaused = !isPaused;
    if (!isPaused) {
      overlay.hidden = true;
      lastTimestamp = 0;
      rafId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafId);
      showOverlay("已暂停", "点击继续或使用按钮继续游戏");
    }
  }

  function restartGame() {
    cancelAnimationFrame(rafId);
    isRunning = false;
    isPaused = false;
    resetGame();
    render();
    showOverlay("准备好了？", "按开始重新进入游戏");
  }

  function gameOver() {
    cancelAnimationFrame(rafId);
    isRunning = false;
    isPaused = false;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("snake.highScore", String(highScore));
      highScoreEl.textContent = String(highScore);
    }
    showOverlay("游戏结束", `本局得分 ${score}，再来一局？`);
  }

  function showOverlay(title, desc) {
    overlayTitle.textContent = title;
    overlayDesc.textContent = desc;
    overlay.hidden = false;
  }

  // Input handling
  function setPendingDirection(dir) {
    // prevent 180-degree turns
    const opposite = (a, b) => a.x + b.x === 0 && a.y + b.y === 0;
    if (opposite(dir, snakeDirection)) return;
    pendingDirection = dir;
  }

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp": case "w": case "W":
        setPendingDirection(directions.up);
        if (!isRunning) startGame();
        break;
      case "ArrowDown": case "s": case "S":
        setPendingDirection(directions.down);
        if (!isRunning) startGame();
        break;
      case "ArrowLeft": case "a": case "A":
        setPendingDirection(directions.left);
        if (!isRunning) startGame();
        break;
      case "ArrowRight": case "d": case "D":
        setPendingDirection(directions.right);
        if (!isRunning) startGame();
        break;
      case " ": case "Enter":
        if (!isRunning) {
          startGame();
        } else {
          pauseGame();
        }
        break;
    }
  });

  // Touch swipe controls
  let touchStartX = 0, touchStartY = 0, touchActive = false;
  const SWIPE_THRESHOLD = 24; // px
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      touchStartX = t.clientX; touchStartY = t.clientY; touchActive = true;
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (!touchActive) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      setPendingDirection(dx > 0 ? directions.right : directions.left);
      touchActive = false;
    } else if (Math.abs(dy) > SWIPE_THRESHOLD) {
      setPendingDirection(dy > 0 ? directions.down : directions.up);
      touchActive = false;
    }
  }, { passive: true });
  canvas.addEventListener("touchend", () => { touchActive = false; }, { passive: true });

  // Click canvas to start
  canvas.addEventListener("click", () => { if (!isRunning) startGame(); });

  // D-Pad buttons
  dpad.querySelectorAll(".dir").forEach(btn => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-dir");
      if (!dir) return;
      setPendingDirection(directions[dir]);
      if (!isRunning) startGame();
    });
  });

  // Action buttons
  function bindClick(id, handler) { document.getElementById(id).addEventListener("click", handler); }
  bindClick("btnStart", startGame);
  bindClick("btnPause", pauseGame);
  bindClick("btnRestart", restartGame);
  bindClick("startBtn", startGame);
  bindClick("pauseBtn", pauseGame);
  bindClick("restartBtn", restartGame);

  // Resize handling
  const resizeObserver = new ResizeObserver(() => { resizeCanvasToDisplaySize(); render(); });
  resizeObserver.observe(document.body);
  window.addEventListener("orientationchange", () => { setTimeout(() => { resizeCanvasToDisplaySize(); render(); }, 200); });
  window.addEventListener("load", () => { resizeCanvasToDisplaySize(); resetGame(); render(); showOverlay("开始游戏", "按开始或任意方向启动"); });
})();


