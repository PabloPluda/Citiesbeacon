import Phaser from 'phaser';
import { EventBus } from '../EventBus';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Cell { N: boolean; S: boolean; E: boolean; W: boolean }
interface GridPos { col: number; row: number }
interface DoorPair {
  leverPos: GridPos;
  doorCell: GridPos;
  doorSide: 'N' | 'S' | 'E' | 'W';
  open: boolean;
  leverSprite?: Phaser.GameObjects.Text;
}
interface CatObj {
  pos: GridPos;
  sprite: Phaser.GameObjects.Text;
  active: boolean;
}
interface LevelConfig {
  cols: number; rows: number; dogDelay: number;
  hasPuddles: boolean; numPuddles: number;
  hasWaterBowls: boolean; numBowls: number;
  numCats: number;
  hasDoors: boolean;
  time: number;
}

// ─── Level table + infinite extension ────────────────────────────────────────
function getLevelConfig(level: number): LevelConfig {
  const idx = Math.min(level - 1, LEVELS.length - 1);
  if (level <= LEVELS.length) return LEVELS[idx];
  // Beyond level 20: keep max difficulty, grow grid and tighten time
  const extra = level - LEVELS.length; // 1-based extra
  const base  = LEVELS[LEVELS.length - 1];
  const cols  = Math.min(14, base.cols  + Math.floor(extra / 3));
  const rows  = Math.min(18, base.rows  + Math.floor(extra / 2));
  const time  = Math.max(30, base.time  - extra * 2);
  return { ...base, cols, rows, time };
}

const LEVELS: LevelConfig[] = [
  { cols:6, rows:7,  dogDelay:5, hasPuddles:false, numPuddles:0, hasWaterBowls:false, numBowls:0, numCats:1, hasDoors:false, time:110 }, // L1  (was L3)
  { cols:6, rows:8,  dogDelay:5, hasPuddles:false, numPuddles:0, hasWaterBowls:false, numBowls:0, numCats:1, hasDoors:false, time:105 }, // L2
  { cols:7, rows:8,  dogDelay:4, hasPuddles:false, numPuddles:0, hasWaterBowls:false, numBowls:0, numCats:1, hasDoors:false, time:100 }, // L3
  { cols:7, rows:9,  dogDelay:4, hasPuddles:true,  numPuddles:3, hasWaterBowls:false, numBowls:0, numCats:2, hasDoors:false, time:95  }, // L4
  { cols:7, rows:9,  dogDelay:4, hasPuddles:true,  numPuddles:4, hasWaterBowls:false, numBowls:0, numCats:2, hasDoors:false, time:90  }, // L5
  { cols:8, rows:9,  dogDelay:3, hasPuddles:true,  numPuddles:4, hasWaterBowls:false, numBowls:0, numCats:2, hasDoors:false, time:90  }, // L6
  { cols:8, rows:10, dogDelay:3, hasPuddles:true,  numPuddles:5, hasWaterBowls:false, numBowls:0, numCats:2, hasDoors:false, time:85  }, // L7
  { cols:8, rows:10, dogDelay:3, hasPuddles:true,  numPuddles:6, hasWaterBowls:false, numBowls:0, numCats:3, hasDoors:false, time:85  }, // L8
  { cols:8, rows:10, dogDelay:3, hasPuddles:true,  numPuddles:4, hasWaterBowls:true,  numBowls:2, numCats:3, hasDoors:false, time:80  }, // L9
  { cols:8, rows:11, dogDelay:3, hasPuddles:true,  numPuddles:5, hasWaterBowls:true,  numBowls:2, numCats:3, hasDoors:false, time:80  }, // L10
  { cols:9, rows:11, dogDelay:2, hasPuddles:true,  numPuddles:5, hasWaterBowls:true,  numBowls:3, numCats:3, hasDoors:false, time:75  }, // L11
  { cols:9, rows:12, dogDelay:2, hasPuddles:true,  numPuddles:6, hasWaterBowls:true,  numBowls:3, numCats:3, hasDoors:false, time:75  }, // L12
  { cols:9, rows:12, dogDelay:2, hasPuddles:true,  numPuddles:6, hasWaterBowls:true,  numBowls:3, numCats:4, hasDoors:false, time:70  }, // L13
  { cols:9, rows:12, dogDelay:2, hasPuddles:true,  numPuddles:5, hasWaterBowls:true,  numBowls:2, numCats:4, hasDoors:true,  time:70  }, // L14
  { cols:9, rows:13, dogDelay:2, hasPuddles:true,  numPuddles:5, hasWaterBowls:true,  numBowls:2, numCats:4, hasDoors:true,  time:65  }, // L15
  { cols:10,rows:13, dogDelay:2, hasPuddles:true,  numPuddles:6, hasWaterBowls:true,  numBowls:2, numCats:4, hasDoors:true,  time:65  }, // L16
  { cols:10,rows:13, dogDelay:2, hasPuddles:true,  numPuddles:6, hasWaterBowls:true,  numBowls:2, numCats:4, hasDoors:true,  time:60  }, // L17
  { cols:10,rows:14, dogDelay:2, hasPuddles:true,  numPuddles:7, hasWaterBowls:true,  numBowls:3, numCats:4, hasDoors:true,  time:60  }, // L18
  { cols:11,rows:14, dogDelay:2, hasPuddles:true,  numPuddles:7, hasWaterBowls:true,  numBowls:3, numCats:4, hasDoors:true,  time:55  }, // L19
  { cols:11,rows:15, dogDelay:2, hasPuddles:true,  numPuddles:8, hasWaterBowls:true,  numBowls:3, numCats:4, hasDoors:true,  time:55  }, // L20
];

const FUN_MESSAGES = [
  'Good job! 🐾', "Don't lose him!",
  "You're doing great! ⭐",
  'Stay together! 🐾',
  'Keep going! 💪',
  "The dog is counting on you! 🐕",
  "Find the water bowl! 💧",
];

const OWNER_CALLS = [
  "Firulais! Where are you? 🏠",
  "Firulai, come home! 🏡",
  "Firulais! I'm waiting! 😢",
  "Firulai! Here boy! 🐾",
  "Come on Firulai, dinner time! 🍖",
  "Firulais! Don't get lost! 😟",
];

const MOVE_DUR = 170;   // ms per cell

// ─── BFS solution path ────────────────────────────────────────────────────────
function computeSolutionPath(grid: Cell[][], cols: number, rows: number): GridPos[] {
  const goalCol = cols - 1, goalRow = rows - 1;
  const prev = new Map<string, string>([['0,0', '']]);
  const queue: GridPos[] = [{ col: 0, row: 0 }];
  while (queue.length) {
    const pos = queue.shift()!;
    const cell = grid[pos.row][pos.col];
    const nbs = [
      { col: pos.col,   row: pos.row-1, wall: cell.N },
      { col: pos.col,   row: pos.row+1, wall: cell.S },
      { col: pos.col+1, row: pos.row,   wall: cell.E },
      { col: pos.col-1, row: pos.row,   wall: cell.W },
    ];
    for (const nb of nbs) {
      if (nb.wall || nb.col < 0 || nb.col >= cols || nb.row < 0 || nb.row >= rows) continue;
      const k = `${nb.col},${nb.row}`;
      if (prev.has(k)) continue;
      prev.set(k, `${pos.col},${pos.row}`);
      if (nb.col === goalCol && nb.row === goalRow) {
        const path: GridPos[] = [];
        let cur = `${goalCol},${goalRow}`;
        while (cur) {
          const [c, r] = cur.split(',').map(Number);
          path.unshift({ col: c, row: r });
          cur = prev.get(cur) ?? '';
        }
        return path;
      }
      queue.push({ col: nb.col, row: nb.row });
    }
  }
  return [];
}

// ─── Two-Arm Maze Generator ───────────────────────────────────────────────────
// DESIGN: From (0,0) two passages open immediately — one EAST (dead-end arm),
// one SOUTH (solution arm). This guarantees the player sees a hard choice at
// the very first cell. Both arms are grown to cover at least 25% of the grid
// before filling in any remaining cells.
//
// Arm A (dead-end):  starts EAST, biased AWAY from goal, never touches goal cell.
//                    Grows until it covers TARGET_DEAD_END_RATIO of total cells.
// Arm B (solution):  starts SOUTH, fills all remaining unvisited cells including
//                    the goal. Has mild random bias to produce interesting paths.
function generateMaze(cols: number, rows: number): Cell[][] {
  const GOAL_COL = cols - 1, GOAL_ROW = rows - 1;
  const totalCells = cols * rows;
  // Dead-end arm targets 28–35% of cells. Larger grids → use lower ratio so
  // the solution arm still has room to be long.
  const TARGET_DEAD = Math.floor(totalCells * (totalCells > 60 ? 0.28 : 0.32));

  type Dir = { dc:number; dr:number; from:'N'|'S'|'E'|'W'; to:'N'|'S'|'E'|'W' };
  const DIRS: Dir[] = [
    { dc: 0, dr:-1, from:'N', to:'S' },
    { dc: 0, dr: 1, from:'S', to:'N' },
    { dc: 1, dr: 0, from:'E', to:'W' },
    { dc:-1, dr: 0, from:'W', to:'E' },
  ];

  function shuffled<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function attempt(): Cell[][] | null {
    if (cols < 2 || rows < 2) return null;

    const grid: Cell[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ N: true, S: true, E: true, W: true }))
    );
    const visited: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));

    // ── Reserve BOTH exits from (0,0) up front ────────────────────────────────
    // Arm A leaves EAST  → (col=1, row=0) = visited[0][1]
    // Arm B leaves SOUTH → (col=0, row=1) = visited[1][0]
    //
    // CRITICAL: mark arm B's starting cell as visited NOW, before carving arm A.
    // Without this, arm A's DFS snakes back along row 1 and claims (col=0, row=1),
    // leaving arm B with no starting point — the maze disconnects, all retries fail,
    // and we fall back to a plain backtracker with no two-arm guarantee.
    visited[0][0] = true;
    visited[0][1] = true;  // arm A start: col=1, row=0 — passage opened below
    visited[1][0] = true;  // arm B start: col=0, row=1 — RESERVED, passage opened after arm A

    grid[0][0]['E'] = false;  grid[0][1]['W'] = false;  // open EAST passage now
    // South passage opened later, after arm A is done
    let deadCount = 1;  // arm A start cell already counted

    // ── ARM A: dead-end arm (strong bias away from goal) ──────────────────────
    function carveDeadArm(c: number, r: number) {
      if (deadCount >= TARGET_DEAD) return;
      const dirs = shuffled(DIRS).sort((a, b) => {
        const aD = Math.abs((c+a.dc) - GOAL_COL) + Math.abs((r+a.dr) - GOAL_ROW);
        const bD = Math.abs((c+b.dc) - GOAL_COL) + Math.abs((r+b.dr) - GOAL_ROW);
        return (bD - aD) * 2.0;  // strong bias away from goal
      });
      for (const d of dirs) {
        if (deadCount >= TARGET_DEAD) break;
        const nc = c + d.dc, nr = r + d.dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (visited[nr][nc]) continue;              // respects arm B reservation
        if (nc === GOAL_COL && nr === GOAL_ROW) continue;  // arm A can never reach goal
        visited[nr][nc] = true;
        deadCount++;
        grid[r][c][d.from] = false;
        grid[nr][nc][d.to]  = false;
        carveDeadArm(nc, nr);
      }
    }

    carveDeadArm(1, 0);

    // Arm A must cover at least 22% of the grid to be a meaningful dead-end
    if (deadCount < Math.floor(totalCells * 0.22)) return null;

    // ── ARM B: solution arm — fills everything arm A left untouched ───────────
    function carveSolutionArm(c: number, r: number) {
      for (const d of shuffled(DIRS)) {
        const nc = c + d.dc, nr = r + d.dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (visited[nr][nc]) continue;
        visited[nr][nc] = true;
        grid[r][c][d.from] = false;
        grid[nr][nc][d.to]  = false;
        carveSolutionArm(nc, nr);
      }
    }

    // Now open the SOUTH passage and expand arm B from the reserved cell
    grid[0][0]['S'] = false;  grid[1][0]['N'] = false;
    carveSolutionArm(0, 1);

    // Safety net: connect any remaining isolated cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!visited[r][c]) { visited[r][c] = true; carveSolutionArm(c, r); }
      }
    }

    // Validate: (0,0) must have both EAST and SOUTH open, goal must be reachable
    const c0 = grid[0][0];
    if (c0.E || c0.S) return null;  // either passage missing → bad maze
    const sPath = computeSolutionPath(grid, cols, rows);
    if (sPath.length < Math.floor(totalCells * 0.25)) return null;  // solution path too short

    return grid;
  }

  // Retry up to 12 times; fallback to a plain backtracker if all fail
  for (let i = 0; i < 12; i++) {
    const g = attempt();
    if (g) return g;
  }
  // Fallback: plain DFS backtracker (always produces a valid maze)
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ N: true, S: true, E: true, W: true }))
  );
  const vis: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  function carve(c: number, r: number) {
    vis[r][c] = true;
    const dirs = [
      { dc:0, dr:-1, from:'N' as const, to:'S' as const },
      { dc:0, dr:1,  from:'S' as const, to:'N' as const },
      { dc:1, dr:0,  from:'E' as const, to:'W' as const },
      { dc:-1,dr:0,  from:'W' as const, to:'E' as const },
    ].sort(() => Math.random() - 0.5);
    for (const d of dirs) {
      const nc = c+d.dc, nr = r+d.dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !vis[nr][nc]) {
        grid[r][c][d.from] = false; grid[nr][nc][d.to] = false;
        carve(nc, nr);
      }
    }
  }
  carve(0, 0);
  return grid;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export class NotMyDogScene extends Phaser.Scene {
  level       = 1;
  timeLeft    = 120;
  done        = false;
  tutorialActive = false;

  private cfg!: LevelConfig;
  private maze: Cell[][] = [];
  private cellSize = 48;
  private offsetX  = 0;
  private offsetY  = 0;

  // Positions
  private playerPos: GridPos = { col: 0, row: 0 };
  private dogPos: GridPos    = { col: 0, row: 0 };
  private playerAtGoal       = false;
  private isPlayerMoving     = false;
  private isDogMoving        = false;
  private dogDistractedUntil = 0;

  // Score
  private bowlsCollected = 0;
  private leversCollected = 0;

  // Input direction
  private dirX = 0;
  private dirY = 0;

  // Sprites / graphics
  private mazeGfx!: Phaser.GameObjects.Graphics;
  private playerSprite!: Phaser.GameObjects.Text;
  private dogSprite!: Phaser.GameObjects.Text;
  private ownerSprite!: Phaser.GameObjects.Text;

  // Special elements
  private puddleCells  = new Set<string>();
  private waterBowlSprites = new Map<string, Phaser.GameObjects.Text>();
  private cats: CatObj[] = [];
  private doorPairs: DoorPair[] = [];
  // Main path computed on the fully-open maze (before any door closes a passage).
  // Used by placeCats and placeDoor so items are guaranteed off the true solution route.
  private openMainPath: Set<string> = new Set();


  constructor() { super('NotMyDogScene'); }

  // ── init ──────────────────────────────────────────────────
  init(data?: { level?: number }) {
    this.level  = data?.level ?? 1;
    this.cfg    = getLevelConfig(this.level);
    this.timeLeft = this.cfg.time;
    this.done   = false;
    this.tutorialActive = false;

    this.playerPos      = { col: 0, row: 0 };
    this.dogPos         = { col: 0, row: 0 };
    this.playerAtGoal   = false;
    this.isPlayerMoving = false;
    this.isDogMoving    = false;
    this.dogDistractedUntil = 0;

    this.bowlsCollected  = 0;
    this.leversCollected = 0;
    this.dirX = 0;
    this.dirY = 0;

    this.puddleCells = new Set();
    this.waterBowlSprites = new Map();
    this.cats = [];
    this.doorPairs = [];
    this.openMainPath = new Set();

  }

  // ── create ────────────────────────────────────────────────
  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    EventBus.emit('current-scene-ready', this);
    this.emitScore();
    EventBus.emit('game-timer', this.timeLeft);

    // Restart listener
    const handleRestart = (d: { level: number }) => {
      setTimeout(() => this.scene.restart(d), 0);
    };
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,
      () => EventBus.off('restart-scene', handleRestart));

    // ── Layout ─────────────────────────────────────────────
    const HUD_H       = 72;
    const CTRL_H      = 44;   // slim hint strip only
    const BOTTOM_SAFE = 56;   // Android browser nav bar height
    const mazeAreaW   = W - 8;
    const mazeAreaH   = H - HUD_H - CTRL_H - BOTTOM_SAFE - 4;

    this.cellSize = Math.max(26, Math.floor(Math.min(
      mazeAreaW / this.cfg.cols,
      mazeAreaH / this.cfg.rows
    )));

    const mazeW = this.cfg.cols * this.cellSize;
    const mazeH = this.cfg.rows * this.cellSize;
    this.offsetX = Math.floor((W - mazeW) / 2);
    this.offsetY = HUD_H + Math.floor((mazeAreaH - mazeH) / 2) + 2;

    // ── Backgrounds ────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x1A3A0A); // deep forest bg
    bg.fillRect(0, 0, W, H);

    // ── Maze generation ─────────────────────────────────────
    this.maze = generateMaze(this.cfg.cols, this.cfg.rows);

    // Compute main path NOW, on the fully-open maze, before any door closes
    // a passage. Both placeDoor and placeCats will use this snapshot so that
    // cats and keys are guaranteed to sit off the true solution route.
    this.openMainPath = this.mainPathCells();

    // ── Place special items ─────────────────────────────────
    // puddles disabled for now
    this.placeWaterBowls();
    if (this.cfg.hasDoors) this.placeDoor();

    // ── Draw maze ───────────────────────────────────────────
    this.mazeGfx = this.add.graphics().setDepth(2);
    this.drawMaze();

    // ── Goal cell highlight ─────────────────────────────────
    const gx = this.cfg.cols - 1, gy = this.cfg.rows - 1;
    const goalGfx = this.add.graphics().setDepth(1);
    goalGfx.fillStyle(0xFFD700, 0.35);
    goalGfx.fillRect(
      this.offsetX + gx * this.cellSize + 2,
      this.offsetY + gy * this.cellSize + 2,
      this.cellSize - 4, this.cellSize - 4
    );

    // ── Sprites ─────────────────────────────────────────────
    const fs = Math.round(this.cellSize * 0.62);
    const fsSmall = Math.round(this.cellSize * 0.52);

    this.ownerSprite = this.add.text(
      this.cx(gx), this.cy(gy), '🧑',
      { fontSize: `${fs}px` }
    ).setOrigin(0.5).setDepth(3);

    this.placeCats(fsSmall);

    this.dogSprite = this.add.text(
      this.cx(0), this.cy(0), '🐕',
      { fontSize: `${fs}px` }
    ).setOrigin(0.5).setDepth(4);

    this.playerSprite = this.add.text(
      this.cx(0), this.cy(0), '🧒',
      { fontSize: `${fs}px` }
    ).setOrigin(0.5).setDepth(5);

    // ── Control buttons ─────────────────────────────────────
    this.buildControls(W, H, CTRL_H, BOTTOM_SAFE);

    // ── Countdown ───────────────────────────────────────────
    this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        if (this.done || this.tutorialActive) return;
        this.timeLeft--;
        EventBus.emit('game-timer', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.done = true;
          this.time.delayedCall(300, () => EventBus.emit('game-time-up', this.bowlsCollected));
        }
      }
    });

    // ── Dog timer ───────────────────────────────────────────
    this.startDogTimer();

    // ── Fun messages + owner callout ─────────────────────────
    this.scheduleFunMessage();
    this.scheduleOwnerCall();

    // ── Tutorial or pre-level ───────────────────────────────
    this.tutorialActive = true;
    if (this.level === 1) {
      EventBus.emit('show-dog-tutorial');
      const onDone = () => { this.tutorialActive = false; };
      EventBus.once('dog-tutorial-done', onDone);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('dog-tutorial-done', onDone));
    } else {
      EventBus.emit('show-dog-prelevel', { level: this.level, cfg: this.cfg });
      const onDone = () => { this.tutorialActive = false; };
      EventBus.once('dog-prelevel-done', onDone);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('dog-prelevel-done', onDone));
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  private cx(col: number) { return this.offsetX + col * this.cellSize + this.cellSize / 2; }
  private cy(row: number) { return this.offsetY + row * this.cellSize + this.cellSize / 2; }

  private emitScore() {
    if (this.cfg.hasWaterBowls) {
      EventBus.emit('game-scored-update', `💧${this.bowlsCollected}/${this.cfg.numBowls}`);
    } else if (this.cfg.hasDoors) {
      const total = this.doorPairs.length;
      EventBus.emit('game-scored-update', `🔧${this.leversCollected}/${total}`);
    } else {
      EventBus.emit('game-scored-update', '🐾');
    }
  }

  // ── Maze draw ─────────────────────────────────────────────
  // Hedge style: background is hedge (dark green), we carve sandy paths
  private drawMaze() {
    const g = this.mazeGfx;
    g.clear();

    const cs  = this.cellSize;
    const ox  = this.offsetX;
    const oy  = this.offsetY;
    // Wall thickness on each side of the passage
    const W   = Math.max(3, Math.round(cs * 0.18));
    // Passage inner size
    const P   = cs - W * 2;

    // ── 1. Hedge background over entire maze area ───────────
    g.fillStyle(0x2D6A1E); // mid hedge green
    g.fillRect(ox, oy, this.cfg.cols * cs, this.cfg.rows * cs);

    // ── 2. Carve path cells (sandy dirt) ───────────────────
    g.fillStyle(0xC8A86B); // sandy path
    for (let r = 0; r < this.cfg.rows; r++) {
      for (let c = 0; c < this.cfg.cols; c++) {
        const cell = this.maze[r][c];
        const cx   = ox + c * cs + W;
        const cy   = oy + r * cs + W;
        // Cell interior
        g.fillRect(cx, cy, P, P);
        // Open N passage
        if (!cell.N) g.fillRect(cx, oy + r * cs, P, W);
        // Open S passage
        if (!cell.S) g.fillRect(cx, oy + r * cs + W + P, P, W);
        // Open E passage
        if (!cell.E) g.fillRect(ox + c * cs + W + P, cy, W, P);
        // Open W passage
        if (!cell.W) g.fillRect(ox + c * cs, cy, W, P);
      }
    }

    // ── 3. Hedge detail lines (darker vein inside hedge) ───
    g.lineStyle(1, 0x1A4A10, 0.35);
    for (let r = 0; r < this.cfg.rows; r++) {
      for (let c = 0; c < this.cfg.cols; c++) {
        const cell = this.maze[r][c];
        const x = ox + c * cs, y = oy + r * cs;
        if (cell.S && r < this.cfg.rows - 1) g.strokeLineShape(new Phaser.Geom.Line(x + W, y + cs, x + cs - W, y + cs));
        if (cell.E && c < this.cfg.cols - 1) g.strokeLineShape(new Phaser.Geom.Line(x + cs, y + W, x + cs, y + cs - W));
      }
    }

    // ── 4. Closed doors (red bar across passage) ───────────
    for (const dp of this.doorPairs) {
      if (dp.open) continue;
      const { col, row } = dp.doorCell;
      const x = ox + col * cs, y = oy + row * cs;
      g.fillStyle(0xEF4444);
      switch (dp.doorSide) {
        case 'N': g.fillRect(x + W, y,        P, W); break;
        case 'S': g.fillRect(x + W, y + W + P, P, W); break;
        case 'E': g.fillRect(x + W + P, y + W, W, P); break;
        case 'W': g.fillRect(x,        y + W, W, P); break;
      }
    }
  }

  // ── Special item placement ────────────────────────────────
  private randomCells(n: number, excluded: Set<string>): string[] {
    const pool: string[] = [];
    for (let r = 0; r < this.cfg.rows; r++)
      for (let c = 0; c < this.cfg.cols; c++) {
        const k = `${c},${r}`;
        if (!excluded.has(k)) pool.push(k);
      }
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, n);
  }

  private placeWaterBowls() {
    if (!this.cfg.hasWaterBowls) return;
    const ex = new Set(['0,0', `${this.cfg.cols-1},${this.cfg.rows-1}`, ...this.puddleCells]);
    const fs = Math.round(this.cellSize * 0.48);
    for (const k of this.randomCells(this.cfg.numBowls, ex)) {
      const [c, r] = k.split(',').map(Number);
      const spr = this.add.text(this.cx(c), this.cy(r), '💧', { fontSize: `${fs}px` })
        .setOrigin(0.5).setDepth(2);
      this.waterBowlSprites.set(k, spr);
    }
  }

  // Returns set of cells on the BFS shortest path start→goal
  private mainPathCells(): Set<string> {
    const goal = { col: this.cfg.cols-1, row: this.cfg.rows-1 };
    const prev = new Map<string, string>();
    const startKey = '0,0';
    prev.set(startKey, '');
    const queue: GridPos[] = [{ col: 0, row: 0 }];
    while (queue.length) {
      const pos = queue.shift()!;
      const cell = this.maze[pos.row][pos.col];
      for (const d of [
        { col: pos.col, row: pos.row-1, w: cell.N },
        { col: pos.col, row: pos.row+1, w: cell.S },
        { col: pos.col+1, row: pos.row,  w: cell.E },
        { col: pos.col-1, row: pos.row,  w: cell.W },
      ]) {
        if (d.w || d.col < 0 || d.col >= this.cfg.cols || d.row < 0 || d.row >= this.cfg.rows) continue;
        const k = `${d.col},${d.row}`;
        if (prev.has(k)) continue;
        prev.set(k, `${pos.col},${pos.row}`);
        if (d.col === goal.col && d.row === goal.row) {
          // Trace back
          const path = new Set<string>();
          let cur = k;
          while (cur) { path.add(cur); cur = prev.get(cur) ?? ''; }
          return path;
        }
        queue.push({ col: d.col, row: d.row });
      }
    }
    return new Set();
  }

  private placeCats(fs: number) {
    if (this.cfg.numCats === 0) return;
    // Use pre-computed open-maze main path so cats are never on the solution route
    const mainPath = this.openMainPath;
    const candidates = this.randomCells(this.cfg.numCats * 3, new Set(['0,0', `${this.cfg.cols-1},${this.cfg.rows-1}`]))
      .filter(k => !mainPath.has(k));
    const chosen = candidates.slice(0, this.cfg.numCats);
    for (const k of chosen) {
      const [c, r] = k.split(',').map(Number);
      const spr = this.add.text(this.cx(c), this.cy(r), '😺', { fontSize: `${fs}px` })
        .setOrigin(0.5).setDepth(3);
      this.tweens.add({ targets: spr, y: spr.y - 4, yoyo: true, repeat: -1, duration: 900 + Math.random() * 400 });
      this.cats.push({ pos: { col: c, row: r }, sprite: spr, active: true });
    }
  }

  private placeDoor() {
    // Collect open passages
    const passages: { c1:number, r1:number, c2:number, r2:number, side:'E'|'S' }[] = [];
    for (let r = 0; r < this.cfg.rows; r++)
      for (let c = 0; c < this.cfg.cols; c++) {
        if (!this.maze[r][c].E && c < this.cfg.cols - 1) passages.push({ c1:c, r1:r, c2:c+1, r2:r, side:'E' });
        if (!this.maze[r][c].S && r < this.cfg.rows - 1) passages.push({ c1:c, r1:r, c2:c, r2:r+1, side:'S' });
      }
    passages.sort(() => Math.random() - 0.5);

    for (const p of passages) {
      // Temporarily close passage
      if (p.side === 'E') { this.maze[p.r1][p.c1].E = true; this.maze[p.r2][p.c2].W = true; }
      else                { this.maze[p.r1][p.c1].S = true; this.maze[p.r2][p.c2].N = true; }

      const reachable = this.bfsReachable(0, 0);
      const goalKey = `${this.cfg.cols-1},${this.cfg.rows-1}`;

      if (!reachable.has(goalKey)) {
        // Use the pre-computed open-maze main path so the key is never on the
        // direct route — the player must detour into a dead-end branch to get it.
        const ex = new Set(['0,0', goalKey, ...this.puddleCells, ...this.waterBowlSprites.keys()]);
        const offPath = [...reachable].filter(k => !ex.has(k) && !this.openMainPath.has(k));
        const candidates = offPath.length >= 2 ? offPath : [...reachable].filter(k => !ex.has(k));

        if (candidates.length > 0) {
          // Prefer dead-end cells (only 1 open exit) so the player has to go in
          // and come back out — maximising the "I need to find the key" feeling.
          const deadEnds = candidates.filter(k => {
            const [cc, rr] = k.split(',').map(Number);
            const cell = this.maze[rr][cc];
            return (cell.N?0:1)+(cell.S?0:1)+(cell.E?0:1)+(cell.W?0:1) === 1;
          });
          const pool = deadEnds.length > 0 ? deadEnds : candidates;
          const leverKey = pool[Math.floor(Math.random() * pool.length)];
          const [lc, lr] = leverKey.split(',').map(Number);
          const doorSide = p.side === 'E' ? 'E' : 'S';
          const doorCell = { col: p.c1, row: p.r1 };

          const fs = Math.round(this.cellSize * 0.5);
          const leverSpr = this.add.text(this.cx(lc), this.cy(lr), '🔧', { fontSize: `${fs}px` })
            .setOrigin(0.5).setDepth(3);
          this.tweens.add({ targets: leverSpr, scaleX: 1.15, scaleY: 1.15, yoyo: true, repeat: -1, duration: 700 });

          this.doorPairs.push({ leverPos: { col: lc, row: lr }, doorCell, doorSide, open: false, leverSprite: leverSpr });
          return; // success — door stays closed in maze
        }
      }

      // Undo
      if (p.side === 'E') { this.maze[p.r1][p.c1].E = false; this.maze[p.r2][p.c2].W = false; }
      else                { this.maze[p.r1][p.c1].S = false; this.maze[p.r2][p.c2].N = false; }
    }
  }

  private bfsReachable(startCol: number, startRow: number): Set<string> {
    const visited = new Set<string>([`${startCol},${startRow}`]);
    const queue: GridPos[] = [{ col: startCol, row: startRow }];
    while (queue.length) {
      const { col, row } = queue.shift()!;
      const cell = this.maze[row][col];
      const dirs = [
        { dc: 0, dr:-1, w:'N' as const }, { dc: 0, dr: 1, w:'S' as const },
        { dc: 1, dr: 0, w:'E' as const }, { dc:-1, dr: 0, w:'W' as const },
      ];
      for (const d of dirs) {
        if (!cell[d.w]) {
          const nc = col + d.dc, nr = row + d.dr;
          if (nc >= 0 && nc < this.cfg.cols && nr >= 0 && nr < this.cfg.rows) {
            const k = `${nc},${nr}`;
            if (!visited.has(k)) { visited.add(k); queue.push({ col: nc, row: nr }); }
          }
        }
      }
    }
    return visited;
  }

  // ── Controls ──────────────────────────────────────────────
  // Full-screen swipe: drag anywhere → set intended direction.
  // Player auto-moves in that direction until a junction or wall,
  // then stops and waits for next swipe.
  private buildControls(W: number, H: number, _ctrlH: number, bottomSafe = 0) {
    // Hint strip at bottom
    const stripY = H - bottomSafe - 36;
    this.add.text(W / 2, stripY + 18, '← Swipe anywhere to move →', {
      fontSize: '13px', color: '#A7F3D0'
    }).setOrigin(0.5).setDepth(20).setAlpha(0.7);

    // Swipe arrow indicator
    const arrowTxt = this.add.text(W / 2, stripY - 6, '', {
      fontSize: '24px'
    }).setOrigin(0.5).setDepth(21);

    const ARROWS: Record<string, string> = {
      '1,0': '▶', '-1,0': '◀', '0,1': '▼', '0,-1': '▲'
    };

    const SWIPE_THRESHOLD = 12; // px — how far before direction commits
    let downX = 0, downY = 0;
    let committed = false;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.done || this.tutorialActive) return;
      downX = ptr.x; downY = ptr.y;
      committed = false;
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || this.done || this.tutorialActive) return;
      const dx = ptr.x - downX;
      const dy = ptr.y - downY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SWIPE_THRESHOLD) return;

      // Commit direction; keep it until finger lifts
      const rdx = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
      const rdy = Math.abs(dx) >= Math.abs(dy) ? 0 : (dy > 0 ? 1 : -1);

      if (!committed || this.dirX !== rdx || this.dirY !== rdy) {
        committed = true;
        this.dirX = rdx; this.dirY = rdy;
        arrowTxt.setText(ARROWS[`${rdx},${rdy}`] ?? '');
        // Reset origin so next swipe from current finger pos
        downX = ptr.x; downY = ptr.y;
      }
    });

    this.input.on('pointerup', () => {
      this.dirX = 0; this.dirY = 0;
      committed = false;
      arrowTxt.setText('');
    });
  }

  // ── Fun messages ──────────────────────────────────────────
  private scheduleFunMessage() {
    this.time.delayedCall(Phaser.Math.Between(18000, 28000), () => {
      if (!this.done) {
        EventBus.emit('show-dog-message', FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)]);
        this.scheduleFunMessage();
      }
    });
  }

  // ── Owner callout bubble ──────────────────────────────────
  private ownerBubble?: Phaser.GameObjects.Text;

  private scheduleOwnerCall() {
    this.time.addEvent({ delay: 10000, loop: true, callback: () => {
      if (this.done) return;
      const msg = OWNER_CALLS[Math.floor(Math.random() * OWNER_CALLS.length)];
      // Show bubble just below the owner sprite (bottom-right cell)
      const bx = this.cx(this.cfg.cols - 1);
      const by = this.cy(this.cfg.rows - 1) + Math.round(this.cellSize * 0.7);
      this.ownerBubble?.destroy();
      this.ownerBubble = this.add.text(bx, by, msg, {
        fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
        fontSize: `${Math.max(10, Math.round(this.cellSize * 0.38))}px`,
        color: '#1F2937',
        backgroundColor: '#FEF9C3',
        padding: { x: 6, y: 4 },
        align: 'center',
        wordWrap: { width: Math.min(160, this.cfg.cols * this.cellSize * 0.8) },
      }).setOrigin(0.5, 0).setDepth(15);
      // Auto-hide after 3s
      this.time.delayedCall(3000, () => {
        this.tweens.add({ targets: this.ownerBubble, alpha: 0, duration: 400,
          onComplete: () => { this.ownerBubble?.destroy(); this.ownerBubble = undefined; } });
      });
    }});
  }

  // ── Player movement ───────────────────────────────────────
  private doorHintShownAt = 0;
  private maybeShowDoorHint(col: number, row: number, side: 'N'|'S'|'E'|'W') {
    // Only show hint if there's actually a closed door here (not just a wall)
    if (this.time.now - this.doorHintShownAt < 3000) return;
    for (const dp of this.doorPairs) {
      if (dp.open) continue;
      const dc = dp.doorCell, ds = dp.doorSide;
      const isThisDoor =
        (ds === side && dc.col === col && dc.row === row) ||
        (ds === 'E' && side === 'W' && dc.col === col - 1 && dc.row === row) ||
        (ds === 'S' && side === 'N' && dc.col === col   && dc.row === row - 1) ||
        (ds === 'N' && side === 'S' && dc.col === col   && dc.row === row + 1) ||
        (ds === 'W' && side === 'E' && dc.col === col + 1 && dc.row === row);
      if (isThisDoor) {
        this.doorHintShownAt = this.time.now;
        EventBus.emit('show-dog-message', '🔑 You need the key to open the door!');
        return;
      }
    }
  }

  private tryMove(dc: number, dr: number) {
    if (this.isPlayerMoving || this.done || this.tutorialActive || this.playerAtGoal) return;
    const { col, row } = this.playerPos;
    const cell = this.maze[row][col];
    // Check if blocked by a closed door → show hint
    if (dc === 1 && cell.E) { this.maybeShowDoorHint(col, row, 'E'); return; }
    if (dc ===-1 && cell.W) { this.maybeShowDoorHint(col, row, 'W'); return; }
    if (dr === 1 && cell.S) { this.maybeShowDoorHint(col, row, 'S'); return; }
    if (dr ===-1 && cell.N) { this.maybeShowDoorHint(col, row, 'N'); return; }
    const nc = col + dc, nr = row + dr;
    if (nc < 0 || nc >= this.cfg.cols || nr < 0 || nr >= this.cfg.rows) return;

    this.isPlayerMoving = true;
    this.playerPos = { col: nc, row: nr };

    this.tweens.add({
      targets: this.playerSprite,
      x: this.cx(nc), y: this.cy(nr),
      duration: MOVE_DUR,
      ease: 'Linear',
      onComplete: () => {
        this.isPlayerMoving = false;
        this.onPlayerCell();
      }
    });
  }

  private onPlayerCell() {
    // Lock player at goal so dog can catch up
    if (this.playerPos.col === this.cfg.cols - 1 && this.playerPos.row === this.cfg.rows - 1) {
      this.playerAtGoal = true;
    }
    const key = `${this.playerPos.col},${this.playerPos.row}`;

    // Lever check
    for (const dp of this.doorPairs) {
      if (!dp.open && dp.leverPos.col === this.playerPos.col && dp.leverPos.row === this.playerPos.row) {
        dp.open = true;
        dp.leverSprite?.destroy();
        // Open passage in maze
        const { col, row } = dp.doorCell;
        if (dp.doorSide === 'E') { this.maze[row][col].E = false; this.maze[row][col+1].W = false; }
        else if (dp.doorSide === 'S') { this.maze[row][col].S = false; this.maze[row+1][col].N = false; }
        else if (dp.doorSide === 'N') { this.maze[row][col].N = false; this.maze[row-1][col].S = false; }
        else { this.maze[row][col].W = false; this.maze[row][col-1].E = false; }
        this.drawMaze();
        this.leversCollected++;
        this.emitScore();
        EventBus.emit('show-dog-message', '🔓 Door opened!');
      }
    }

    // Water bowl check (player picks it up, adds time)
    if (this.waterBowlSprites.has(key)) {
      const spr = this.waterBowlSprites.get(key)!;
      this.tweens.add({ targets: spr, y: spr.y - 24, alpha: 0, duration: 450, onComplete: () => spr.destroy() });
      this.waterBowlSprites.delete(key);
      this.bowlsCollected++;
      this.timeLeft += 15;
      EventBus.emit('game-timer', this.timeLeft);
      this.emitScore();
      EventBus.emit('show-dog-message', '+15 secs! 💧');
    }
  }

  // ── Dog movement ──────────────────────────────────────────
  private startDogTimer() {
    // Interval scales with dogDelay config: higher delay = slower dog
    const interval = Math.max(280, this.cfg.dogDelay * 110);
    this.time.addEvent({ delay: interval, loop: true, callback: this.advanceDog, callbackScope: this });
  }

  // Manhattan BFS distance (steps through maze walls)
  private bfsDistance(a: GridPos, b: GridPos): number {
    if (a.col === b.col && a.row === b.row) return 0;
    const visited = new Set<string>([`${a.col},${a.row}`]);
    const queue: { pos: GridPos; dist: number }[] = [{ pos: a, dist: 0 }];
    while (queue.length) {
      const { pos, dist } = queue.shift()!;
      const cell = this.maze[pos.row][pos.col];
      for (const d of [
        { col: pos.col, row: pos.row-1, w: cell.N },
        { col: pos.col, row: pos.row+1, w: cell.S },
        { col: pos.col+1, row: pos.row,  w: cell.E },
        { col: pos.col-1, row: pos.row,  w: cell.W },
      ]) {
        if (d.w || d.col < 0 || d.col >= this.cfg.cols || d.row < 0 || d.row >= this.cfg.rows) continue;
        const k = `${d.col},${d.row}`;
        if (visited.has(k)) continue;
        if (d.col === b.col && d.row === b.row) return dist + 1;
        visited.add(k); queue.push({ pos: { col: d.col, row: d.row }, dist: dist + 1 });
      }
    }
    return 999;
  }

  private advanceDog() {
    if (this.isDogMoving || this.done) return;
    if (this.time.now < this.dogDistractedUntil) return;

    const dist = this.bfsDistance(this.dogPos, this.playerPos);
    if (dist === 0) return;

    // Stay exactly 1 cell behind the player while exploring —
    // the dog and player should never overlap mid-maze.
    // Exception: once the player reaches the goal, allow the dog
    // to close the gap fully so the level-complete trigger fires.
    if (!this.playerAtGoal && dist <= 1) return;

    // If player ran too far ahead, freeze dog and warn
    const TOO_FAR = 8;
    if (dist > TOO_FAR) {
      EventBus.emit('show-dog-message', "Stay close to Firulai — go call him! 🐾");
      return;
    }

    const next = this.bfsNextStep(this.dogPos, this.playerPos);
    if (!next) return;

    this.isDogMoving = true;
    this.tweens.add({
      targets: this.dogSprite,
      x: this.cx(next.col), y: this.cy(next.row),
      duration: MOVE_DUR,
      ease: 'Linear',
      onComplete: () => {
        this.isDogMoving = false;
        this.dogPos = { ...next };
        this.onDogCell();
      }
    });
  }

  // BFS: returns the first step from `from` toward `to` respecting maze walls
  private bfsNextStep(from: GridPos, to: GridPos): GridPos | null {
    if (from.col === to.col && from.row === to.row) return null;
    const prev = new Map<string, string>();
    const startKey = `${from.col},${from.row}`;
    const endKey   = `${to.col},${to.row}`;
    prev.set(startKey, '');
    const queue: GridPos[] = [from];
    while (queue.length > 0) {
      const pos = queue.shift()!;
      const cell = this.maze[pos.row][pos.col];
      const moves = [
        { col: pos.col,   row: pos.row-1, wall: cell.N },
        { col: pos.col,   row: pos.row+1, wall: cell.S },
        { col: pos.col+1, row: pos.row,   wall: cell.E },
        { col: pos.col-1, row: pos.row,   wall: cell.W },
      ];
      for (const nb of moves) {
        if (nb.wall) continue;
        if (nb.col < 0 || nb.col >= this.cfg.cols || nb.row < 0 || nb.row >= this.cfg.rows) continue;
        const nbKey = `${nb.col},${nb.row}`;
        if (prev.has(nbKey)) continue;
        prev.set(nbKey, `${pos.col},${pos.row}`);
        if (nbKey === endKey) {
          // Trace back to the first step from start
          let cur = nbKey;
          while (prev.get(cur) !== startKey) cur = prev.get(cur)!;
          const [c, r] = cur.split(',').map(Number);
          return { col: c, row: r };
        }
        queue.push({ col: nb.col, row: nb.row });
      }
    }
    return null;
  }

  private onDogCell() {
    // Check goal
    if (this.dogPos.col === this.cfg.cols - 1 && this.dogPos.row === this.cfg.rows - 1 && !this.done) {
      this.done = true;
      this.tweens.add({
        targets: [this.playerSprite, this.dogSprite, this.ownerSprite],
        y: '-=8', yoyo: true, repeat: 2, duration: 180,
        onComplete: () => EventBus.emit('game-level-complete', this.level)
      });
      return;
    }

    // Cat encounter — dog gets attracted to adjacent cats (1 cell away)
    for (const cat of this.cats) {
      if (!cat.active) continue;
      const dr = Math.abs(cat.pos.row - this.dogPos.row);
      const dc = Math.abs(cat.pos.col - this.dogPos.col);
      if (dr + dc <= 1) {
        cat.active = false;
        this.tweens.add({ targets: cat.sprite, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 500,
          onComplete: () => cat.sprite.destroy() });
        this.dogDistractedUntil = this.time.now + 4000;
        this.tweens.add({ targets: this.dogSprite, x: this.dogSprite.x + 6, yoyo: true, repeat: 6, duration: 80 });
        EventBus.emit('show-dog-message', '😾 Firulai got distracted by a cat — go find him!');
      }
    }
  }

  // ── Main loop ─────────────────────────────────────────────
  update() {
    if (this.done || this.tutorialActive) return;
    if (!this.isPlayerMoving && (this.dirX !== 0 || this.dirY !== 0)) {
      this.tryMove(this.dirX, this.dirY);
    }
  }
}
