import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID = 5;
const MOVE_DUR   = 140; // ms per tile

// ─── Types ────────────────────────────────────────────────────────────────────
interface TilePos { tx: number; ty: number }
interface DoorInfo {
  doorTile: TilePos;
  keyTile:  TilePos;
  open:     boolean;
  keySprite?: Phaser.GameObjects.Text;
}
interface CatObj {
  pos:    TilePos;
  sprite: Phaser.GameObjects.Text;
  active: boolean;
}
interface LevelConfig {
  roomsW:   number; // ≈ 2:3 ratio with roomsH — whole maze fits on screen
  roomsH:   number;
  numCats:  number;
  hasDoors: boolean;
  coins:    number;
  dogDelay: number;
  time:     number;
}

// ─── Level table ──────────────────────────────────────────────────────────────
const LEVELS: LevelConfig[] = [
  { roomsW: 3, roomsH:  5, numCats: 0, hasDoors: false, coins: 50, dogDelay: 600, time:  80 }, // L1
  { roomsW: 4, roomsH:  6, numCats: 0, hasDoors: false, coins: 50, dogDelay: 560, time:  90 }, // L2
  { roomsW: 5, roomsH:  8, numCats: 0, hasDoors: false, coins: 50, dogDelay: 520, time: 105 }, // L3
  { roomsW: 6, roomsH:  9, numCats: 0, hasDoors: false, coins: 50, dogDelay: 480, time: 115 }, // L4
  { roomsW: 6, roomsH: 10, numCats: 0, hasDoors: false, coins: 50, dogDelay: 440, time: 120 }, // L5
  { roomsW: 7, roomsH: 11, numCats: 0, hasDoors: false, coins: 50, dogDelay: 400, time: 130 }, // L6
  { roomsW: 8, roomsH: 12, numCats: 0, hasDoors: false, coins: 50, dogDelay: 360, time: 140 }, // L7
  { roomsW: 8, roomsH: 13, numCats: 0, hasDoors: false, coins: 60, dogDelay: 320, time: 150 }, // L8+
];

function getLevelConfig(level: number): LevelConfig {
  return LEVELS[Math.min(level - 1, LEVELS.length - 1)];
}

// ─── Maze Generator (Maximum-Distance + Controlled Safe Loops) ───────────────
//
// 1. DFS builds a perfect spanning-tree maze from room (0,0) = tile (1,1).
// 2. Force-open a second exit from (1,1) for two branching paths at the start.
// 3. BFS Flood Fill from (1,1) computes real step-count to every tile.
// 4. Owner placed at the ROOM TILE requiring the most real steps.
// 5. Reconstruct main-path room tiles from start to owner via BFS dist[].
// 6. Controlled wall removal (Safe Loops only):
//    - A wall may only be removed if it joins two non-main-path DEAD-END rooms.
//    - The last third of the main path (near owner) is always fully protected.
//    - At least 60% of off-path rooms remain strict dead-ends after removal.
// 7. Dead-end the owner tile: close all passages except the single entry.
//
function generateMaze(roomsW: number, roomsH: number): { grid: number[][]; ownerTile: TilePos } {
  const gridW = roomsW * 2 + 1;
  const gridH = roomsH * 2 + 1;

  // ── 1. DFS perfect maze from room (0,0) ───────────────────────────────────
  const grid = Array.from({ length: gridH }, () => new Array(gridW).fill(1));
  const vis  = Array.from({ length: roomsH }, () => new Array(roomsW).fill(false));

  function dfs(rx: number, ry: number) {
    vis[ry][rx] = true;
    grid[ry * 2 + 1][rx * 2 + 1] = 0;
    const dirs: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy] of dirs) {
      const nx = rx + dx, ny = ry + dy;
      if (nx < 0 || nx >= roomsW || ny < 0 || ny >= roomsH || vis[ny][nx]) continue;
      grid[ry * 2 + 1 + dy][rx * 2 + 1 + dx] = 0;
      dfs(nx, ny);
    }
  }
  dfs(0, 0);

  // ── 2. Guarantee two exits from start tile (1,1) ─────────────────────────
  const startExits: [number, number][] = [];
  if (gridW > 2) startExits.push([2, 1]);
  if (gridH > 2) startExits.push([1, 2]);
  const openAtStart = startExits.filter(([tx, ty]) => grid[ty][tx] === 0).length;
  if (openAtStart < 2) {
    for (const [tx, ty] of startExits) {
      if (grid[ty][tx] === 1) { grid[ty][tx] = 0; break; }
    }
  }

  // ── 3. BFS Flood Fill from (1,1) — exact step count to every tile ─────────
  const dist: number[][] = Array.from({ length: gridH }, () => new Array(gridW).fill(-1));
  dist[1][1] = 0;
  const bfsQ: [number, number][] = [[1, 1]];
  let head = 0;
  while (head < bfsQ.length) {
    const [tx, ty] = bfsQ[head++];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number, number][]) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
      if (grid[ny][nx] !== 0 || dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[ty][tx] + 1;
      bfsQ.push([nx, ny]);
    }
  }

  // ── 4. Owner = room tile with maximum real distance from start ────────────
  let maxDist = -1;
  let ownerTile: TilePos = { tx: gridW - 2, ty: gridH - 2 };
  for (let ty = 1; ty < gridH; ty += 2) {
    for (let tx = 1; tx < gridW; tx += 2) {
      if (tx === 1 && ty === 1) continue;
      if (dist[ty][tx] > maxDist) { maxDist = dist[ty][tx]; ownerTile = { tx, ty }; }
    }
  }

  // ── 5. Reconstruct main-path room tiles (owner → start via BFS back-trace) ──
  const mainPathRoomSet = new Set<string>();
  {
    let curTx = ownerTile.tx, curTy = ownerTile.ty;
    for (let safety = 0; safety < gridW * gridH + 4; safety++) {
      if (curTx % 2 === 1 && curTy % 2 === 1) mainPathRoomSet.add(`${curTx},${curTy}`);
      if (curTx === 1 && curTy === 1) break;
      const curD = dist[curTy][curTx];
      let moved = false;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
        const nx = curTx + dx, ny = curTy + dy;
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        if (grid[ny][nx] === 0 && dist[ny][nx] === curD - 1) {
          curTx = nx; curTy = ny; moved = true; break;
        }
      }
      if (!moved) break;
    }
    mainPathRoomSet.add('1,1');
  }

  // ── 5.5. Off-path connected components ───────────────────────────────────
  // BFS through open passages without crossing main-path rooms.
  // Two off-path rooms in different components (branching from different main-path nodes)
  // must never be directly connected — doing so would create a shortcut bypassing
  // part of the correct path.
  const offPathComp = new Map<string, number>();
  let nextComp = 0;
  for (let ry = 0; ry < roomsH; ry++) {
    for (let rx = 0; rx < roomsW; rx++) {
      const rk = `${rx * 2 + 1},${ry * 2 + 1}`;
      if (mainPathRoomSet.has(rk) || offPathComp.has(rk)) continue;
      const cid = nextComp++;
      const compQ: [number, number][] = [[rx, ry]];
      offPathComp.set(rk, cid);
      let ch = 0;
      while (ch < compQ.length) {
        const [cx, cy] = compQ[ch++];
        for (const [ddx, ddy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
          const nx = cx + ddx, ny = cy + ddy;
          if (nx < 0 || nx >= roomsW || ny < 0 || ny >= roomsH) continue;
          const nk = `${nx * 2 + 1},${ny * 2 + 1}`;
          if (mainPathRoomSet.has(nk) || offPathComp.has(nk)) continue;
          // Passage tile between these two room tiles must be open
          const px = cx * 2 + 1 + ddx, py = cy * 2 + 1 + ddy;
          if (grid[py][px] !== 0) continue;
          offPathComp.set(nk, cid);
          compQ.push([nx, ny]);
        }
      }
    }
  }

  // ── 6. Controlled wall removal: Safe Loops only ───────────────────────────
  // Count open passage tiles adjacent to a room tile
  const openPassages = (rtx: number, rty: number): number => {
    let c = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
      const px = rtx + dx, py = rty + dy;
      if (px > 0 && px < gridW - 1 && py > 0 && py < gridH - 1 && grid[py][px] === 0) c++;
    }
    return c;
  };

  // Count dead-ends among non-main-path, non-start, non-owner room tiles
  const countNonPathDeadEnds = (): { total: number; deadEnds: number } => {
    let total = 0, deadEnds = 0;
    for (let ty = 1; ty < gridH; ty += 2) {
      for (let tx = 1; tx < gridW; tx += 2) {
        const k = `${tx},${ty}`;
        if (k === '1,1' || k === `${ownerTile.tx},${ownerTile.ty}`) continue;
        if (mainPathRoomSet.has(k)) continue;
        total++;
        if (openPassages(tx, ty) === 1) deadEnds++;
      }
    }
    return { total, deadEnds };
  };

  // Candidate walls: internal passage walls whose both sides are non-main-path dead-end rooms
  const safeWalls: [number, number][] = [];
  for (let ty = 1; ty < gridH - 1; ty++) {
    for (let tx = 1; tx < gridW - 1; tx++) {
      if (grid[ty][tx] !== 1) continue;
      if (!((tx % 2 === 0) !== (ty % 2 === 0))) continue; // only passage tiles
      const [r1x, r1y, r2x, r2y] = tx % 2 === 0
        ? [tx - 1, ty, tx + 1, ty]
        : [tx, ty - 1, tx, ty + 1];
      if (r1x <= 0 || r1y <= 0 || r2x >= gridW - 1 || r2y >= gridH - 1) continue;
      if (grid[r1y][r1x] !== 0 || grid[r2y][r2x] !== 0) continue;
      const r1k = `${r1x},${r1y}`, r2k = `${r2x},${r2y}`;
      // Both rooms must be off the main path (this also protects the last-third zone)
      if (mainPathRoomSet.has(r1k) || mainPathRoomSet.has(r2k)) continue;
      // Both rooms must currently be dead-ends
      if (openPassages(r1x, r1y) !== 1 || openPassages(r2x, r2y) !== 1) continue;
      // Both rooms must be in the same off-path component to prevent cross-branch shortcuts
      if (offPathComp.get(r1k) !== offPathComp.get(r2k)) continue;
      safeWalls.push([tx, ty]);
    }
  }

  for (let i = safeWalls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [safeWalls[i], safeWalls[j]] = [safeWalls[j], safeWalls[i]];
  }

  // Remove at most as many walls as the 60% dead-end floor allows
  // Each removal turns 2 dead-ends into non-dead-ends, so max = floor((D - 60%·T) / 2)
  const { total: T, deadEnds: D } = countNonPathDeadEnds();
  const maxRem = T > 0 ? Math.max(0, Math.floor((D - Math.ceil(T * 0.60)) / 2)) : 0;
  for (let i = 0; i < Math.min(maxRem, safeWalls.length); i++) {
    const [wtx, wty] = safeWalls[i];
    grid[wty][wtx] = 0;
  }

  // ── 7. Dead-end the owner tile (keep only one entry passage) ─────────────
  const { tx: ownTx, ty: ownTy } = ownerTile;
  const adjPassages = (
    [[ownTx + 1, ownTy], [ownTx - 1, ownTy], [ownTx, ownTy + 1], [ownTx, ownTy - 1]] as [number,number][]
  ).filter(([px, py]) =>
    px > 0 && px < gridW - 1 && py > 0 && py < gridH - 1 && grid[py][px] === 0
  );
  if (adjPassages.length > 1) {
    for (let i = adjPassages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [adjPassages[i], adjPassages[j]] = [adjPassages[j], adjPassages[i]];
    }
    for (let i = 1; i < adjPassages.length; i++) {
      const [px, py] = adjPassages[i];
      grid[py][px] = 1;
    }
  }

  return { grid, ownerTile };
}

const FUN_MESSAGES = [
  'Good job! 🐾', "Don't lose him!",
  "You're doing great! ⭐",
  'Stay together! 🐾',
  'Keep going! 💪',
  "The dog is counting on you! 🐕",
];

const OWNER_CALLS = [
  "Firulais! Where are you? 🏠",
  "Firulai, come home! 🏡",
  "Firulais! I'm waiting! 😢",
  "Firulai! Here boy! 🐾",
  "Come on Firulai, dinner time! 🍖",
  "Firulais! Don't get lost! 😟",
];

// ─── Scene ────────────────────────────────────────────────────────────────────
export class NotMyDogScene extends Phaser.Scene {
  level          = 1;
  timeLeft       = 120;
  done           = false;
  tutorialActive = false;

  private cfg!: LevelConfig;
  private grid: number[][] = [];
  private gridW = 0;
  private gridH = 0;
  private ownerTile: TilePos = { tx: 1, ty: 1 }; // set by generateMaze()

  // Computed in create() to fit the whole maze on screen
  private tileSize = 32;
  private offsetX  = 0;
  private offsetY  = 0;

  private playerPos: TilePos = { tx: 1, ty: 1 };
  private dogPos:    TilePos = { tx: 1, ty: 1 };
  private playerAtGoal       = false;
  private isPlayerMoving     = false;
  private isDogMoving        = false;
  private dogDistractedUntil = 0;

  private dirX = 0;
  private dirY = 0;

  private mazeGfx!:      Phaser.GameObjects.Graphics;
  private mazeTileImages: Phaser.GameObjects.Image[] = [];
  private tileWallVariant: number[][] = [];
  private tilePathVariant: number[][] = [];
  private playerSprite!: Phaser.GameObjects.Text;
  private dogSprite!:    Phaser.GameObjects.Text;
  private ownerSprite!:  Phaser.GameObjects.Text;

  private cats:           CatObj[]        = [];
  private door:           DoorInfo | null = null;
  private leversCollected = 0;

  private ownerBubble?:   Phaser.GameObjects.Text;
  private ownerBubbleBg?: Phaser.GameObjects.Graphics;
  private doorHintShownAt = 0;

  constructor() { super('NotMyDogScene'); }

  // ── preload ───────────────────────────────────────────────
  preload() {
    for (let i = 1; i <= 4; i++) this.load.image(`arbol${i}`, `/notmydog/arbol${i}.png`);
    for (let i = 1; i <= 3; i++) this.load.image(`camino${i}`, `/notmydog/camino${i}.png`);
  }

  // ── init ──────────────────────────────────────────────────
  init(data?: { level?: number }) {
    if (data?.level !== undefined) {
      this.level = data.level;
    } else {
      const reg = this.registry?.get('startLevel') as number | undefined;
      if (reg != null) { this.registry.remove('startLevel'); this.level = reg; }
      else { this.level = (useProgressStore.getState().highestLevel[MISSION_ID] ?? 0) + 1; }
    }
    this.cfg   = getLevelConfig(this.level);
    this.gridW = this.cfg.roomsW * 2 + 1;
    this.gridH = this.cfg.roomsH * 2 + 1;
    this.timeLeft = this.cfg.time;
    this.done     = false;
    this.tutorialActive = false;

    this.playerPos = { tx: 1, ty: 1 };
    this.dogPos    = { tx: 1, ty: 1 };
    this.ownerTile = { tx: this.gridW - 2, ty: this.gridH - 2 }; // placeholder until create()
    this.playerAtGoal   = false;
    this.isPlayerMoving = false;
    this.isDogMoving    = false;
    this.dogDistractedUntil = 0;
    this.dirX = 0; this.dirY = 0;

    this.cats  = [];
    this.door  = null;
    this.leversCollected = 0;
    this.ownerBubble   = undefined;
    this.ownerBubbleBg = undefined;
    this.doorHintShownAt = 0;
    this.mazeTileImages = [];
    this.tileWallVariant = [];
    this.tilePathVariant = [];
  }

  // ── create ────────────────────────────────────────────────
  create() {
    const SW = this.cameras.main.width;
    const SH = this.cameras.main.height;

    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);
    this.emitScore();

    const handleRestart = (d: { level: number }) => setTimeout(() => this.scene.restart(d), 0);
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', handleRestart));

    // ── Compute tile size so entire maze fits on screen ────
    const HUD_H       = 72;
    const CTRL_H      = 44;
    const BOTTOM_SAFE = 56;
    const mazeAreaW   = SW - 4;
    const mazeAreaH   = SH - HUD_H - CTRL_H - BOTTOM_SAFE - 4;

    this.tileSize = Math.max(12, Math.floor(Math.min(
      mazeAreaW / this.gridW,
      mazeAreaH / this.gridH
    )));

    const mazeW = this.gridW * this.tileSize;
    const mazeH = this.gridH * this.tileSize;
    this.offsetX = Math.floor((SW - mazeW) / 2);
    this.offsetY = HUD_H + Math.floor((mazeAreaH - mazeH) / 2) + 2;

    // Background
    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x1A3A0A);
    bgGfx.fillRect(0, 0, SW, SH);

    // ── Generate maze (Maximum Distance algorithm) ────────
    const result = generateMaze(this.cfg.roomsW, this.cfg.roomsH);
    this.grid      = result.grid;
    this.ownerTile = result.ownerTile;
    this.assignTileVariants();

    // Door placement (before drawing — modifies grid)
    if (this.cfg.hasDoors) this.placeDoor();

    // Draw maze
    this.mazeGfx = this.add.graphics().setDepth(4);
    this.drawMaze();

    // Goal highlight at owner tile
    const { tx: gTx, ty: gTy } = this.ownerTile;
    const goalGfx = this.add.graphics().setDepth(2);
    goalGfx.fillStyle(0xFFD700, 0.35);
    goalGfx.fillRect(
      this.offsetX + gTx * this.tileSize + 2,
      this.offsetY + gTy * this.tileSize + 2,
      this.tileSize - 4, this.tileSize - 4
    );

    const fs      = Math.max(14, Math.round(this.tileSize * 0.72));
    const fsSmall = Math.max(12, Math.round(this.tileSize * 0.58));

    this.ownerSprite = this.add.text(
      this.wx(gTx), this.wy(gTy), '🧑', { fontSize: `${fs}px` }
    ).setOrigin(0.5).setDepth(5);

    this.placeCats(fsSmall);

    this.dogSprite = this.add.text(
      this.wx(1), this.wy(1), '🐕', { fontSize: `${fs}px` }
    ).setOrigin(0.5).setDepth(6);

    this.playerSprite = this.add.text(
      this.wx(1), this.wy(1), '🧒', { fontSize: `${fs}px` }
    ).setOrigin(0.5).setDepth(7);

    // Controls
    this.buildControls(SW, SH, CTRL_H, BOTTOM_SAFE);

    // Countdown timer
    this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        if (this.done || this.tutorialActive) return;
        this.timeLeft--;
        EventBus.emit('game-timer', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.done = true;
          this.time.delayedCall(300, () => EventBus.emit('game-time-up', this.leversCollected));
        }
      }
    });

    this.startDogTimer();
    this.scheduleFunMessage();
    this.scheduleOwnerCall();

    // Tutorial or prelevel overlay
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

  // ── Screen coordinate helpers ─────────────────────────────
  private wx(tx: number) { return this.offsetX + tx * this.tileSize + this.tileSize / 2; }
  private wy(ty: number) { return this.offsetY + ty * this.tileSize + this.tileSize / 2; }

  private emitScore() {
    EventBus.emit('game-scored-update', this.cfg.hasDoors ? `🔧${this.leversCollected}/1` : '🐾');
  }

  // ── Tile variant assignment (called once after maze generation) ──────────
  private assignTileVariants() {
    this.tileWallVariant = Array.from({ length: this.gridH }, () =>
      Array.from({ length: this.gridW }, () => Phaser.Math.Between(1, 4))
    );
    this.tilePathVariant = Array.from({ length: this.gridH }, () =>
      Array.from({ length: this.gridW }, () => Phaser.Math.Between(1, 3))
    );
  }

  // ── Maze drawing ──────────────────────────────────────────
  private drawMaze() {
    for (const img of this.mazeTileImages) img.destroy();
    this.mazeTileImages = [];

    const ox = this.offsetX, oy = this.offsetY, ts = this.tileSize;

    // First pass: path tiles (depth 1)
    for (let ty = 0; ty < this.gridH; ty++) {
      for (let tx = 0; tx < this.gridW; tx++) {
        if (this.grid[ty][tx] === 0) {
          const key = `camino${this.tilePathVariant[ty][tx]}`;
          const img = this.add.image(
            ox + tx * ts + ts / 2,
            oy + ty * ts + ts / 2,
            key
          ).setDisplaySize(ts, ts).setDepth(1);
          this.mazeTileImages.push(img);
        }
      }
    }

    // Second pass: wall/tree tiles (depth 3, bottom-anchored so tall trees overlap tile above)
    for (let ty = 0; ty < this.gridH; ty++) {
      for (let tx = 0; tx < this.gridW; tx++) {
        if (this.grid[ty][tx] === 1) {
          const key = `arbol${this.tileWallVariant[ty][tx]}`;
          const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
          const displayH = src.width > 0 ? Math.round((src.height / src.width) * ts) : ts;
          const img = this.add.image(
            ox + tx * ts + ts / 2,
            oy + (ty + 1) * ts,
            key
          ).setOrigin(0.5, 1).setDisplaySize(ts, displayH).setDepth(3);
          this.mazeTileImages.push(img);
        }
      }
    }

    // Door overlay: red rectangle on top of the door tile
    this.mazeGfx.clear();
    if (this.door && !this.door.open) {
      const { tx, ty } = this.door.doorTile;
      const pad = Math.max(2, Math.floor(ts * 0.08));
      this.mazeGfx.fillStyle(0xEF4444);
      this.mazeGfx.fillRect(ox + tx * ts + pad, oy + ty * ts + pad, ts - pad * 2, ts - pad * 2);
    }
  }

  // ── Door placement ────────────────────────────────────────
  private placeDoor() {
    const mainPath = this.mainPathTiles();

    // Passage tiles on main path: exactly one of (tx, ty) is even
    const passages: TilePos[] = [];
    for (const k of mainPath) {
      const [tx, ty] = k.split(',').map(Number);
      if ((tx % 2 === 0) !== (ty % 2 === 0)) passages.push({ tx, ty });
    }
    passages.sort(() => Math.random() - 0.5);

    for (const pass of passages) {
      this.grid[pass.ty][pass.tx] = 1;

      const reachable   = this.bfsReachableTiles(1, 1);
      const candidates: TilePos[] = [];
      for (const k of reachable) {
        const [tx, ty] = k.split(',').map(Number);
        if (tx % 2 === 1 && ty % 2 === 1 && !(tx === 1 && ty === 1)) {
          candidates.push({ tx, ty });
        }
      }

      if (candidates.length >= 2) {
        const keyPos = candidates[Math.floor(Math.random() * candidates.length)];
        const spr = this.add.text(
          this.wx(keyPos.tx), this.wy(keyPos.ty), '🔧',
          { fontSize: `${Math.max(12, Math.round(this.tileSize * 0.58))}px` }
        ).setOrigin(0.5).setDepth(5);
        this.tweens.add({ targets: spr, scaleX: 1.15, scaleY: 1.15, yoyo: true, repeat: -1, duration: 700 });
        this.door = { doorTile: { tx: pass.tx, ty: pass.ty }, keyTile: keyPos, open: false, keySprite: spr };
        return;
      }

      this.grid[pass.ty][pass.tx] = 0; // undo and try next
    }
  }

  // ── BFS helpers (tile space) ──────────────────────────────
  // Path from start (1,1) to the owner tile (maximum-distance cell)
  private mainPathTiles(): Set<string> {
    const goalKey = `${this.ownerTile.tx},${this.ownerTile.ty}`;
    const prev = new Map<string, string>([['1,1', '']]);
    const queue: TilePos[] = [{ tx: 1, ty: 1 }];
    while (queue.length) {
      const { tx, ty } = queue.shift()!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue;
        if (this.grid[ny][nx] !== 0) continue;
        const k = `${nx},${ny}`;
        if (prev.has(k)) continue;
        prev.set(k, `${tx},${ty}`);
        if (k === goalKey) {
          const path = new Set<string>();
          let cur = k;
          while (cur !== '') { path.add(cur); cur = prev.get(cur) ?? ''; }
          return path;
        }
        queue.push({ tx: nx, ty: ny });
      }
    }
    return new Set();
  }

  private bfsReachableTiles(startTx: number, startTy: number): Set<string> {
    const visited = new Set<string>([`${startTx},${startTy}`]);
    const queue: TilePos[] = [{ tx: startTx, ty: startTy }];
    while (queue.length) {
      const { tx, ty } = queue.shift()!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue;
        if (this.grid[ny][nx] !== 0) continue;
        const k = `${nx},${ny}`;
        if (!visited.has(k)) { visited.add(k); queue.push({ tx: nx, ty: ny }); }
      }
    }
    return visited;
  }

  private bfsDistance(a: TilePos, b: TilePos): number {
    if (a.tx === b.tx && a.ty === b.ty) return 0;
    const visited = new Set<string>([`${a.tx},${a.ty}`]);
    const queue: { pos: TilePos; dist: number }[] = [{ pos: a, dist: 0 }];
    while (queue.length) {
      const { pos, dist } = queue.shift()!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = pos.tx + dx, ny = pos.ty + dy;
        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue;
        if (this.grid[ny][nx] !== 0) continue;
        const k = `${nx},${ny}`;
        if (visited.has(k)) continue;
        if (nx === b.tx && ny === b.ty) return dist + 1;
        visited.add(k);
        queue.push({ pos: { tx: nx, ty: ny }, dist: dist + 1 });
      }
    }
    return 999;
  }

  private bfsNextStep(from: TilePos, to: TilePos): TilePos | null {
    if (from.tx === to.tx && from.ty === to.ty) return null;
    const startKey = `${from.tx},${from.ty}`;
    const endKey   = `${to.tx},${to.ty}`;
    const prev = new Map<string, string>([[startKey, '']]);
    const queue: TilePos[] = [{ ...from }];
    while (queue.length) {
      const { tx, ty } = queue.shift()!;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || nx >= this.gridW || ny < 0 || ny >= this.gridH) continue;
        if (this.grid[ny][nx] !== 0) continue;
        const k = `${nx},${ny}`;
        if (prev.has(k)) continue;
        prev.set(k, `${tx},${ty}`);
        if (k === endKey) {
          let cur = k;
          while (prev.get(cur) !== startKey) cur = prev.get(cur) ?? startKey;
          const [c, r] = cur.split(',').map(Number);
          return { tx: c, ty: r };
        }
        queue.push({ tx: nx, ty: ny });
      }
    }
    return null;
  }

  // ── Cat placement (on room tiles, away from start/owner) ──
  private placeCats(fs: number) {
    if (this.cfg.numCats === 0) return;
    const pool: TilePos[] = [];
    for (let ty = 1; ty < this.gridH; ty += 2) {
      for (let tx = 1; tx < this.gridW; tx += 2) {
        if (tx === 1 && ty === 1) continue;
        if (tx === this.ownerTile.tx && ty === this.ownerTile.ty) continue;
        pool.push({ tx, ty });
      }
    }
    pool.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(this.cfg.numCats, pool.length); i++) {
      const pos = pool[i];
      const spr = this.add.text(this.wx(pos.tx), this.wy(pos.ty), '😺', { fontSize: `${fs}px` })
        .setOrigin(0.5).setDepth(5);
      this.tweens.add({ targets: spr, y: spr.y - 3, yoyo: true, repeat: -1, duration: 900 + Math.random() * 400 });
      this.cats.push({ pos, sprite: spr, active: true });
    }
  }

  // ── Controls ──────────────────────────────────────────────
  private buildControls(SW: number, SH: number, ctrlH: number, bottomSafe: number) {
    const stripY = SH - bottomSafe - Math.floor(ctrlH / 2);
    this.add.text(SW / 2, stripY, '← Swipe anywhere to move →', {
      fontSize: '13px', color: '#A7F3D0'
    }).setOrigin(0.5).setDepth(20).setAlpha(0.7);

    const arrowTxt = this.add.text(SW / 2, stripY - 22, '', {
      fontSize: '22px'
    }).setOrigin(0.5).setDepth(21);

    const ARROWS: Record<string, string> = { '1,0': '▶', '-1,0': '◀', '0,1': '▼', '0,-1': '▲' };
    const SWIPE_THRESHOLD = 12;
    let downX = 0, downY = 0, committed = false;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.done || this.tutorialActive) return;
      downX = ptr.x; downY = ptr.y; committed = false;
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || this.done || this.tutorialActive) return;
      const dx = ptr.x - downX, dy = ptr.y - downY;
      if (Math.sqrt(dx * dx + dy * dy) < SWIPE_THRESHOLD) return;
      const rdx = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : -1) : 0;
      const rdy = Math.abs(dx) >= Math.abs(dy) ? 0 : (dy > 0 ? 1 : -1);
      if (!committed || this.dirX !== rdx || this.dirY !== rdy) {
        committed = true;
        this.dirX = rdx; this.dirY = rdy;
        arrowTxt.setText(ARROWS[`${rdx},${rdy}`] ?? '');
        downX = ptr.x; downY = ptr.y;
      }
    });
    this.input.on('pointerup', () => {
      this.dirX = 0; this.dirY = 0; committed = false; arrowTxt.setText('');
    });
  }

  // ── Messages ──────────────────────────────────────────────
  private scheduleFunMessage() {
    this.time.delayedCall(Phaser.Math.Between(18000, 28000), () => {
      if (!this.done) {
        EventBus.emit('show-dog-message', FUN_MESSAGES[Math.floor(Math.random() * FUN_MESSAGES.length)]);
        this.scheduleFunMessage();
      }
    });
  }

  private scheduleOwnerCall() {
    this.time.addEvent({ delay: 10000, loop: true, callback: () => {
      if (this.done) return;
      this.showOwnerBubble(OWNER_CALLS[Math.floor(Math.random() * OWNER_CALLS.length)]);
      this.time.delayedCall(3500, () => {
        this.tweens.add({
          targets: [this.ownerBubble, this.ownerBubbleBg], alpha: 0, duration: 400,
          onComplete: () => {
            this.ownerBubble?.destroy(); this.ownerBubble = undefined;
            this.ownerBubbleBg?.destroy(); this.ownerBubbleBg = undefined;
          }
        });
      });
    }});
  }

  private showOwnerBubble(msg: string) {
    this.ownerBubble?.destroy();
    this.ownerBubbleBg?.destroy();

    const ownerX = this.wx(this.ownerTile.tx);
    const ownerY = this.wy(this.ownerTile.ty);
    const fontSize = Math.min(14, Math.max(10, Math.round(this.tileSize * 0.5)));
    const maxTxtW  = Math.min(150, Math.max(80, this.gridW * this.tileSize * 0.55));
    const pad = 8, tailH = 8, radius = 8;

    const probe = this.add.text(0, -999, msg, {
      fontFamily: '"Fredoka One", Arial, sans-serif',
      fontSize: `${fontSize}px`, wordWrap: { width: maxTxtW },
    }).setVisible(false);
    const bw = Math.ceil(probe.width) + pad * 2;
    const bh = Math.ceil(probe.height) + pad * 2;
    probe.destroy();

    const bRight  = Math.min(this.cameras.main.width - 5, ownerX + Math.floor(bw * 0.35));
    const bLeft   = Math.max(5, bRight - bw);
    const bBottom = ownerY - Math.round(this.tileSize * 0.55);
    const bTop    = bBottom - bh;
    const tailX   = bLeft + bw - Math.round(bw * 0.28);

    const bg = this.add.graphics().setDepth(14);
    bg.fillStyle(0x000000, 0.15);
    bg.fillRoundedRect(bLeft + 3, bTop + 3, bw, bh, radius);
    bg.fillStyle(0xFFFDE7, 1);
    bg.fillTriangle(tailX - 6, bBottom, tailX + 6, bBottom, tailX, bBottom + tailH);
    bg.fillRoundedRect(bLeft, bTop, bw, bh, radius);
    bg.lineStyle(2, 0xB45309, 1);
    bg.strokeRoundedRect(bLeft, bTop, bw, bh, radius);

    this.ownerBubble = this.add.text(bLeft + pad, bTop + pad, msg, {
      fontFamily: '"Fredoka One", Arial, sans-serif',
      fontSize: `${fontSize}px`, color: '#1F2937',
      wordWrap: { width: maxTxtW }, align: 'center',
    }).setDepth(15);
    this.ownerBubbleBg = bg;
  }

  // ── Player movement ───────────────────────────────────────
  private maybeShowDoorHint(ntx: number, nty: number) {
    if (!this.door || this.door.open) return;
    if (this.door.doorTile.tx !== ntx || this.door.doorTile.ty !== nty) return;
    if (this.time.now - this.doorHintShownAt < 3000) return;
    this.doorHintShownAt = this.time.now;
    EventBus.emit('show-dog-message', '🔑 You need the key to open the door!');
  }

  private tryMove(dc: number, dr: number) {
    if (this.isPlayerMoving || this.done || this.tutorialActive) return;
    const { tx, ty } = this.playerPos;
    const ntx = tx + dc, nty = ty + dr;
    if (ntx < 0 || ntx >= this.gridW || nty < 0 || nty >= this.gridH) return;
    if (this.grid[nty][ntx] !== 0) { this.maybeShowDoorHint(ntx, nty); return; }

    this.isPlayerMoving = true;
    this.playerPos = { tx: ntx, ty: nty };
    this.tweens.add({
      targets: this.playerSprite,
      x: this.wx(ntx), y: this.wy(nty),
      duration: MOVE_DUR, ease: 'Linear',
      onComplete: () => { this.isPlayerMoving = false; this.onPlayerCell(); }
    });
  }

  private onPlayerCell() {
    const { tx, ty } = this.playerPos;
    if (tx === this.ownerTile.tx && ty === this.ownerTile.ty) this.playerAtGoal = true;

    if (this.door && !this.door.open && this.door.keyTile.tx === tx && this.door.keyTile.ty === ty) {
      this.door.open = true;
      this.door.keySprite?.destroy();
      this.grid[this.door.doorTile.ty][this.door.doorTile.tx] = 0;
      this.drawMaze();
      this.leversCollected++;
      this.emitScore();
      EventBus.emit('show-dog-message', '🔓 Door opened!');
    }
  }

  // ── Dog AI (BFS toward player, then toward owner once player arrives) ───────
  private startDogTimer() {
    this.time.addEvent({ delay: this.cfg.dogDelay, loop: true, callback: this.advanceDog, callbackScope: this });
  }

  private advanceDog() {
    if (this.isDogMoving || this.done) return;
    if (this.time.now < this.dogDistractedUntil) return;

    if (this.playerAtGoal) {
      const next = this.bfsNextStep(this.dogPos, this.ownerTile);
      if (!next) return;
      this.isDogMoving = true;
      this.tweens.add({
        targets: this.dogSprite,
        x: this.wx(next.tx), y: this.wy(next.ty),
        duration: MOVE_DUR, ease: 'Linear',
        onComplete: () => { this.isDogMoving = false; this.dogPos = { ...next }; this.onDogCell(); }
      });
      return;
    }

    const dist = this.bfsDistance(this.dogPos, this.playerPos);
    if (dist <= 1) return;
    if (dist > 20) {
      EventBus.emit('show-dog-message', "Stay close to Firulai — go call him! 🐾");
      return;
    }

    const next = this.bfsNextStep(this.dogPos, this.playerPos);
    if (!next) return;
    this.isDogMoving = true;
    this.tweens.add({
      targets: this.dogSprite,
      x: this.wx(next.tx), y: this.wy(next.ty),
      duration: MOVE_DUR, ease: 'Linear',
      onComplete: () => { this.isDogMoving = false; this.dogPos = { ...next }; this.onDogCell(); }
    });
  }

  private onDogCell() {
    const { tx, ty } = this.dogPos;

    if (tx === this.ownerTile.tx && ty === this.ownerTile.ty && !this.done) {
      this.done = true;
      const state = useProgressStore.getState();
      const isNew = this.level > (state.highestLevel[MISSION_ID] ?? 0);
      state.addCityCoins(this.cfg.coins);
      if (isNew) {
        useProgressStore.setState(s => ({
          highestLevel: { ...s.highestLevel, [MISSION_ID]: this.level },
          puzzlePieces: { ...s.puzzlePieces, [MISSION_ID]: Math.min(20, (s.puzzlePieces[MISSION_ID] ?? 0) + 1) },
        }));
      }
      const totalCoins = useProgressStore.getState().cityCoins;
      this.tweens.add({
        targets: [this.playerSprite, this.dogSprite, this.ownerSprite],
        y: '-=6', yoyo: true, repeat: 2, duration: 180,
        onComplete: () => EventBus.emit('show-dog-complete', { level: this.level, coins: this.cfg.coins, totalCoins })
      });
      return;
    }

    // Cat encounter (distract dog when within 2 tile-steps = neighbouring room)
    for (const cat of this.cats) {
      if (!cat.active) continue;
      if (Math.abs(cat.pos.tx - tx) + Math.abs(cat.pos.ty - ty) <= 2) {
        cat.active = false;
        this.tweens.add({ targets: cat.sprite, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 500,
          onComplete: () => cat.sprite.destroy() });
        this.dogDistractedUntil = this.time.now + 4000;
        this.tweens.add({ targets: this.dogSprite, x: this.dogSprite.x + 5, yoyo: true, repeat: 6, duration: 80 });
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
