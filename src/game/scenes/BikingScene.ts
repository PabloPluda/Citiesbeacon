import Phaser from 'phaser';
import { EventBus } from '../EventBus';

const MISSION_ID = 6;

// ── Piece types ───────────────────────────────────────────────────────────────
type PieceKind = 'empty' | 'straight' | 'curve' | 'T' | 'cross';

// Base ports [top, right, bottom, left] at rotation 0
const BASE_PORTS: Record<Exclude<PieceKind, 'empty'>, [boolean, boolean, boolean, boolean]> = {
  straight: [true,  false, true,  false],   // vertical
  curve:    [true,  true,  false, false],    // top + right
  T:        [true,  true,  false, true ],    // missing bottom
  cross:    [true,  true,  true,  true ],
};

function getPorts(kind: PieceKind, rot: number): [boolean, boolean, boolean, boolean] {
  if (kind === 'empty') return [false, false, false, false];
  let p = [...BASE_PORTS[kind as Exclude<PieceKind, 'empty'>]] as [boolean, boolean, boolean, boolean];
  // CW rotation: new[top,right,bottom,left] = old[left,top,right,bottom]
  for (let i = 0; i < (rot & 3); i++) p = [p[3], p[0], p[1], p[2]];
  return p;
}

// ── Level config ───────────────────────────────────────────────────────────────
interface Endpoint {
  row: number; col: number;
  label: string; icon: string; color: number;
  openPort: number; // 0=top 1=right 2=bottom 3=left
}

interface LevelCfg {
  gridSize: number;
  timerSec: number;
  endpoints: Endpoint[];
  palette: PieceKind[];
}

function getLevelCfg(level: number): LevelCfg {
  if (level <= 1) {
    return {
      gridSize: 3, timerSec: 120,
      endpoints: [
        { row: 2, col: 0, label: 'Home',   icon: '🏠', color: 0xFF6B6B, openPort: 1 },
        { row: 0, col: 2, label: 'School', icon: '🏫', color: 0x4DA6FF, openPort: 3 },
      ],
      palette: ['straight', 'curve', 'T', 'cross'],
    };
  }
  if (level <= 4) {
    return {
      gridSize: 4, timerSec: 120,
      endpoints: [
        { row: 3, col: 0, label: 'Home',   icon: '🏠', color: 0xFF6B6B, openPort: 1 },
        { row: 0, col: 3, label: 'School', icon: '🏫', color: 0x4DA6FF, openPort: 3 },
      ],
      palette: ['straight', 'curve', 'T', 'cross'],
    };
  }
  if (level <= 10) {
    return {
      gridSize: 5, timerSec: 150,
      endpoints: [
        { row: 4, col: 0, label: 'Home',   icon: '🏠', color: 0xFF6B6B, openPort: 1 },
        { row: 0, col: 2, label: 'Park',   icon: '🌳', color: 0x22C55E, openPort: 2 },
        { row: 2, col: 4, label: 'School', icon: '🏫', color: 0x4DA6FF, openPort: 3 },
      ],
      palette: ['straight', 'curve', 'T', 'cross'],
    };
  }
  const gs = level <= 15 ? 6 : 7;
  return {
    gridSize: gs, timerSec: 180,
    endpoints: [
      { row: gs - 1, col: 0,      label: 'Home',    icon: '🏠', color: 0xFF6B6B, openPort: 1 },
      { row: 0,      col: gs - 1, label: 'School',  icon: '🏫', color: 0x4DA6FF, openPort: 3 },
      { row: 0,      col: 0,      label: 'Grandma', icon: '👵', color: 0xF59E0B, openPort: 1 },
      { row: gs - 1, col: gs - 1, label: 'Library', icon: '📚', color: 0x8B5CF6, openPort: 0 },
    ],
    palette: ['straight', 'curve', 'T', 'cross'],
  };
}

// ── Cell ───────────────────────────────────────────────────────────────────────
interface Cell {
  row: number; col: number;
  kind: PieceKind; rot: number;
  fixed: boolean;
  endpointIdx: number; // -1 = not endpoint
}

// ── Direction helpers ──────────────────────────────────────────────────────────
const DR  = [-1, 0, 1, 0];
const DC  = [0, 1, 0, -1];
const OPP = [2, 3, 0, 1] as const;

// ── Scene ──────────────────────────────────────────────────────────────────────
export class BikingScene extends Phaser.Scene {
  private level = 1;
  private timeLeft = 120;
  private timerEvent?: Phaser.Time.TimerEvent;
  private grid: Cell[][] = [];
  private cfg!: LevelCfg;
  private cellSize = 80;
  private originX = 0;
  private originY = 0;
  private cellContainers: (Phaser.GameObjects.Container | null)[][] = [];

  private highlightGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private paletteBg?: Phaser.GameObjects.Graphics;
  private paletteContainers: Phaser.GameObjects.Container[] = [];
  private startBtn?: Phaser.GameObjects.Container;
  private bikeEmoji?: Phaser.GameObjects.Text;
  private isAnimating = false;
  private connectionValid = false;

  // Drag state
  private dragKind: PieceKind | null = null;
  private dragVisual?: Phaser.GameObjects.Container;

  private W = 0;
  private H = 0;

  constructor() { super('BikingScene'); }

  init(data?: { level?: number }) {
    const sv = (data?.level ?? (this.registry.get('startLevel') as number | undefined)) ?? 1;
    this.level     = Math.max(1, Math.min(20, sv));
    this.timeLeft  = 0;
    this.grid      = [];
    this.cellContainers = [];
    this.paletteContainers = [];
    this.isAnimating    = false;
    this.connectionValid = false;
    this.dragKind  = null;
    this.dragVisual = undefined;
    this.bikeEmoji = undefined;
    this.startBtn  = undefined;
    this.paletteBg = undefined;
    this.timerEvent = undefined;
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.cfg       = getLevelCfg(this.level);
    this.timeLeft  = this.cfg.timerSec;

    // ── Layout constants
    const HUD_H      = 72;
    const PALETTE_H  = 86;
    const BTN_H      = 50;
    const BTN_GAP    = 10;
    const GRID_PAD   = 12;

    const availH = this.H - HUD_H - PALETTE_H - BTN_H - BTN_GAP - GRID_PAD * 2;
    const availW = this.W - GRID_PAD * 2;
    this.cellSize = Math.floor(Math.min(availW, availH) / this.cfg.gridSize);

    const totalPx    = this.cellSize * this.cfg.gridSize;
    this.originX     = Math.floor((this.W - totalPx) / 2);
    this.originY     = HUD_H + GRID_PAD + Math.floor((availH - totalPx) / 2);

    const startBtnY  = this.H - PALETTE_H - BTN_GAP - BTN_H / 2;
    const paletteY   = this.H - PALETTE_H / 2 + 4;

    // ── Background
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x1a2744);

    // ── Layers (must be created before cells so cells draw on top)
    this.highlightGfx = this.add.graphics();
    this.hoverGfx     = this.add.graphics();

    // ── Init grid data
    this.grid = Array.from({ length: this.cfg.gridSize }, (_, r) =>
      Array.from({ length: this.cfg.gridSize }, (_, c): Cell => ({
        row: r, col: c, kind: 'empty', rot: 0, fixed: false, endpointIdx: -1,
      }))
    );
    this.cfg.endpoints.forEach((ep, i) => {
      this.grid[ep.row][ep.col].fixed = true;
      this.grid[ep.row][ep.col].endpointIdx = i;
    });

    // ── Draw cells
    this.cellContainers = Array.from({ length: this.cfg.gridSize }, () =>
      Array(this.cfg.gridSize).fill(null)
    );
    for (let r = 0; r < this.cfg.gridSize; r++) {
      for (let c = 0; c < this.cfg.gridSize; c++) {
        this.drawCell(r, c);
      }
    }

    // ── Hint text
    this.add.text(this.W / 2, this.originY + totalPx + 6, 'Drag to place · Tap to rotate', {
      fontFamily: 'Fredoka One', fontSize: '12px', color: 'rgba(255,255,255,0.45)',
    }).setOrigin(0.5);

    // ── Global pointer events for drag-and-drop
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup',   this.onPointerUp,   this);

    // ── Palette
    this.buildPalette(paletteY);

    // ── Start button
    this.buildStartButton(startBtnY);

    // ── Timer
    EventBus.emit('game-timer', this.timeLeft);
    EventBus.emit('game-scored-update', '...');
    this.timerEvent = this.time.addEvent({
      delay: 1000, loop: true,
      callback: this.onTick, callbackScope: this,
    });

    // ── EventBus restart
    const onRestart = (d?: { level?: number }) => this.scene.restart(d);
    EventBus.on('restart-scene', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('restart-scene', onRestart);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup',   this.onPointerUp,   this);
    });

    EventBus.emit('current-scene-ready', EventBus);
  }

  // ── Timer tick ─────────────────────────────────────────────────────────────
  private onTick() {
    if (this.isAnimating) return;
    this.timeLeft = Math.max(0, this.timeLeft - 1);
    EventBus.emit('game-timer', this.timeLeft);
    if (this.timeLeft <= 0) {
      this.timerEvent?.destroy();
      if (this.connectionValid) this.triggerBikeAnimation();
      else EventBus.emit('game-time-up', 0);
    }
  }

  // ── Draw a single cell ─────────────────────────────────────────────────────
  private drawCell(row: number, col: number) {
    this.cellContainers[row][col]?.destroy();

    const cs   = this.cellSize;
    const cx   = this.originX + col * cs + cs / 2;
    const cy   = this.originY + row * cs + cs / 2;
    const cell = this.grid[row][col];
    const cont = this.add.container(cx, cy);

    // Background
    const bg = this.add.graphics();
    if (cell.endpointIdx >= 0) {
      const ep = this.cfg.endpoints[cell.endpointIdx];
      bg.fillStyle(ep.color, 0.2);
      bg.fillRoundedRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 8);
      bg.lineStyle(3, ep.color, 0.9);
      bg.strokeRoundedRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 8);
    } else {
      bg.fillStyle(0x243456, 1);
      bg.fillRoundedRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 8);
      bg.lineStyle(1, 0x334870, 1);
      bg.strokeRoundedRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 8);
    }
    cont.add(bg);

    // Endpoint: icon + label + port arm
    if (cell.endpointIdx >= 0) {
      const ep    = this.cfg.endpoints[cell.endpointIdx];
      const iSize = Math.max(14, Math.floor(cs * 0.38));
      const icon  = this.add.text(0, -Math.floor(cs * 0.08), ep.icon, { fontSize: `${iSize}px` }).setOrigin(0.5);
      const lbl   = this.add.text(0, cs / 2 - 13, ep.label, {
        fontFamily: 'Fredoka One', fontSize: '10px', color: '#ffffff',
      }).setOrigin(0.5);
      cont.add([icon, lbl]);
      this.drawEndpointArm(cont, ep.openPort, ep.color, cs);
    }

    // Piece graphic (non-endpoint cells only)
    if (cell.kind !== 'empty' && cell.endpointIdx < 0) {
      this.drawPiecePaths(cont, cell.kind, cell.rot, cs, false);
    }

    // Hit area (non-fixed: tap to rotate)
    if (!cell.fixed) {
      const hit = this.add.rectangle(0, 0, cs - 4, cs - 4, 0, 0).setInteractive();
      hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        // If dragging, ignore tap
        if (this.dragKind) return;
        this.onCellTap(row, col, ptr);
      });
      cont.add(hit);
    }

    this.cellContainers[row][col] = cont;
  }

  private drawEndpointArm(
    cont: Phaser.GameObjects.Container,
    port: number,
    color: number,
    cs: number,
  ) {
    const gfx = this.add.graphics();
    gfx.fillStyle(color, 0.85);
    const tw   = cs * 0.18;
    const half = cs / 2 - 2;
    const len  = half * 0.48;
    if (port === 0) gfx.fillRect(-tw / 2, -half, tw, len);
    if (port === 1) gfx.fillRect(half - len, -tw / 2, len, tw);
    if (port === 2) gfx.fillRect(-tw / 2, half - len, tw, len);
    if (port === 3) gfx.fillRect(-half, -tw / 2, len, tw);
    cont.add(gfx);
  }

  private drawPiecePaths(
    cont: Phaser.GameObjects.Container,
    kind: PieceKind,
    rot: number,
    cs: number,
    glowing: boolean,
  ) {
    const gfx    = this.add.graphics();
    const road   = 0x374151;
    const stripe = glowing ? 0x86EFAC : 0x22C55E;
    const tw     = cs * 0.26;
    const sw     = tw * 0.28;
    const arm    = cs / 2 - 3;
    const ports  = getPorts(kind, rot);

    // Road fill
    gfx.fillStyle(road, 1);
    gfx.fillRect(-tw / 2, -tw / 2, tw, tw);
    if (ports[0]) gfx.fillRect(-tw / 2, -arm, tw, arm);
    if (ports[1]) gfx.fillRect(0,       -tw / 2, arm, tw);
    if (ports[2]) gfx.fillRect(-tw / 2, 0,       tw,  arm);
    if (ports[3]) gfx.fillRect(-arm,    -tw / 2, arm, tw);

    // Bike lane stripe
    gfx.fillStyle(stripe, 1);
    gfx.fillRect(-sw / 2, -sw / 2, sw, sw);
    if (ports[0]) gfx.fillRect(-sw / 2, -arm, sw, arm);
    if (ports[1]) gfx.fillRect(0,       -sw / 2, arm, sw);
    if (ports[2]) gfx.fillRect(-sw / 2, 0,       sw,  arm);
    if (ports[3]) gfx.fillRect(-arm,    -sw / 2, arm, sw);

    cont.add(gfx);
  }

  // ── Cell tap → rotate ──────────────────────────────────────────────────────
  private onCellTap(row: number, col: number, _ptr: Phaser.Input.Pointer) {
    if (this.isAnimating) return;
    const cell = this.grid[row][col];
    if (cell.kind === 'empty') return;
    cell.rot = (cell.rot + 1) & 3;
    this.drawCell(row, col);
    this.checkAndHighlight();
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────
  startDrag(kind: PieceKind, startX: number, startY: number) {
    if (this.isAnimating) return;
    this.dragKind = kind;

    const sz  = Math.min(this.cellSize, 64);
    const vis = this.add.container(startX, startY);
    const bg  = this.add.graphics();
    bg.fillStyle(0x1f2937, 0.92);
    bg.fillRoundedRect(-sz / 2, -sz / 2, sz, sz, 10);
    bg.lineStyle(2, 0x22C55E, 1);
    bg.strokeRoundedRect(-sz / 2, -sz / 2, sz, sz, 10);
    vis.add(bg);
    this.drawPiecePaths(vis, kind, 0, sz, true);
    vis.setDepth(100);
    this.dragVisual = vis;
  }

  private onPointerMove(ptr: Phaser.Input.Pointer) {
    if (!this.dragKind || !this.dragVisual) return;
    this.dragVisual.setPosition(ptr.x, ptr.y);

    this.hoverGfx.clear();
    const cell = this.getCellAt(ptr.x, ptr.y);
    if (cell && !cell.fixed) {
      const px = this.originX + cell.col * this.cellSize;
      const py = this.originY + cell.row * this.cellSize;
      this.hoverGfx.lineStyle(3, 0x4ADE80, 1);
      this.hoverGfx.strokeRoundedRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4, 8);
    }
  }

  private onPointerUp(ptr: Phaser.Input.Pointer) {
    if (!this.dragKind) return;
    this.dragVisual?.destroy();
    this.dragVisual = undefined;
    this.hoverGfx.clear();

    const cell = this.getCellAt(ptr.x, ptr.y);
    if (cell && !cell.fixed) {
      cell.kind = this.dragKind;
      cell.rot  = 0;
      this.drawCell(cell.row, cell.col);
      this.checkAndHighlight();
    }

    this.dragKind = null;
  }

  private getCellAt(px: number, py: number): Cell | null {
    const col = Math.floor((px - this.originX) / this.cellSize);
    const row = Math.floor((py - this.originY) / this.cellSize);
    const gs  = this.cfg.gridSize;
    if (row < 0 || row >= gs || col < 0 || col >= gs) return null;
    return this.grid[row][col];
  }

  // ── Connection engine ──────────────────────────────────────────────────────
  private getPortsForCell(cell: Cell): [boolean, boolean, boolean, boolean] {
    if (cell.endpointIdx >= 0) {
      const ports: [boolean, boolean, boolean, boolean] = [false, false, false, false];
      ports[this.cfg.endpoints[cell.endpointIdx].openPort] = true;
      return ports;
    }
    return getPorts(cell.kind, cell.rot);
  }

  // BFS flood from endpoint[0] — checks if ALL endpoints are reachable
  private checkAllConnected(): boolean {
    const gs  = this.cfg.gridSize;
    const eps = this.cfg.endpoints;
    if (eps.length < 2) return false;

    const visited = Array.from({ length: gs }, () => Array<boolean>(gs).fill(false));
    const queue: [number, number][] = [[eps[0].row, eps[0].col]];
    visited[eps[0].row][eps[0].col] = true;

    while (queue.length) {
      const [r, c] = queue.shift()!;
      const ports  = this.getPortsForCell(this.grid[r][c]);
      for (let d = 0; d < 4; d++) {
        if (!ports[d]) continue;
        const nr = r + DR[d], nc = c + DC[d];
        if (nr < 0 || nr >= gs || nc < 0 || nc >= gs) continue;
        if (visited[nr][nc]) continue;
        if (!this.getPortsForCell(this.grid[nr][nc])[OPP[d]]) continue;
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
    return eps.every(ep => visited[ep.row][ep.col]);
  }

  // BFS flood from endpoint[0] — returns all connected cells in order (for animation)
  private getConnectedCells(): [number, number][] {
    const gs      = this.cfg.gridSize;
    const ep0     = this.cfg.endpoints[0];
    const visited = Array.from({ length: gs }, () => Array<boolean>(gs).fill(false));
    const order: [number, number][] = [];
    const queue: [number, number][] = [[ep0.row, ep0.col]];
    visited[ep0.row][ep0.col] = true;

    while (queue.length) {
      const [r, c] = queue.shift()!;
      order.push([r, c]);
      const ports  = this.getPortsForCell(this.grid[r][c]);
      for (let d = 0; d < 4; d++) {
        if (!ports[d]) continue;
        const nr = r + DR[d], nc = c + DC[d];
        if (nr < 0 || nr >= gs || nc < 0 || nc >= gs) continue;
        if (visited[nr][nc]) continue;
        if (!this.getPortsForCell(this.grid[nr][nc])[OPP[d]]) continue;
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
    return order;
  }

  private checkAndHighlight() {
    this.connectionValid = this.checkAllConnected();

    this.highlightGfx.clear();
    if (this.connectionValid) {
      const cells = this.getConnectedCells();
      this.highlightGfx.fillStyle(0x4ADE80, 0.10);
      for (const [r, c] of cells) {
        const px = this.originX + c * this.cellSize;
        const py = this.originY + r * this.cellSize;
        this.highlightGfx.fillRoundedRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4, 8);
      }
    }

    this.startBtn?.setAlpha(this.connectionValid ? 1 : 0.45);
    EventBus.emit('game-scored-update', this.connectionValid ? '✓ Go!' : '...');
  }

  // ── Palette ────────────────────────────────────────────────────────────────
  private buildPalette(centerY: number) {
    this.paletteBg?.destroy();
    this.paletteContainers.forEach(c => c.destroy());
    this.paletteContainers = [];

    const kinds  = this.cfg.palette;
    const itemSz = Math.min(56, Math.floor((this.W - 40) / kinds.length) - 10);
    const totalW = kinds.length * (itemSz + 10) - 10;
    const startX = (this.W - totalW) / 2;
    const stripTop = centerY - itemSz / 2 - 8;
    const stripH   = itemSz + 16;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d1526, 0.92);
    bg.fillRoundedRect(8, stripTop, this.W - 16, stripH, 14);
    this.paletteBg = bg;

    const LABELS: Record<PieceKind, string> = {
      empty: '', straight: 'Straight', curve: 'Curve', T: 'T-turn', cross: 'Cross',
    };

    kinds.forEach((kind, i) => {
      const cx   = startX + i * (itemSz + 10) + itemSz / 2;
      const cont = this.add.container(cx, centerY);

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x1f2937, 1);
      btnBg.fillRoundedRect(-itemSz / 2, -itemSz / 2, itemSz, itemSz, 10);
      btnBg.lineStyle(2, 0x374151, 1);
      btnBg.strokeRoundedRect(-itemSz / 2, -itemSz / 2, itemSz, itemSz, 10);
      cont.add(btnBg);

      this.drawPiecePaths(cont, kind, 0, itemSz, false);

      const lbl = this.add.text(0, itemSz / 2 - 8, LABELS[kind], {
        fontFamily: 'Fredoka One', fontSize: '9px', color: '#6EE7B7',
      }).setOrigin(0.5);
      cont.add(lbl);

      const hit = this.add.rectangle(0, 0, itemSz, itemSz, 0, 0).setInteractive();
      hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        this.startDrag(kind, ptr.x, ptr.y);
      });
      cont.add(hit);

      this.paletteContainers.push(cont);
    });
  }

  // ── Start button ───────────────────────────────────────────────────────────
  private buildStartButton(centerY: number) {
    const btnW = 200;
    const btnH = 48;
    const cont = this.add.container(this.W / 2, centerY);

    const bg = this.add.graphics();
    bg.fillStyle(0x16A34A, 1);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 24);
    cont.add(bg);

    const lbl = this.add.text(0, 0, 'Start Biking! 🚲', {
      fontFamily: 'Fredoka One', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5);
    cont.add(lbl);

    const hit = this.add.rectangle(0, 0, btnW, btnH, 0, 0).setInteractive();
    hit.on('pointerdown', () => this.onStartBiking());
    cont.add(hit);

    cont.setAlpha(0.45);
    this.startBtn = cont;
  }

  // ── Bike animation ─────────────────────────────────────────────────────────
  private onStartBiking() {
    if (this.isAnimating) return;
    if (!this.connectionValid) {
      // Shake feedback
      this.tweens.add({
        targets: this.startBtn,
        x: { from: this.W / 2 - 8, to: this.W / 2 + 8 },
        duration: 70, yoyo: true, repeat: 3,
        onComplete: () => this.startBtn?.setX(this.W / 2),
      });
      return;
    }
    this.triggerBikeAnimation();
  }

  private triggerBikeAnimation() {
    this.isAnimating = true;
    this.timerEvent?.destroy();
    this.startBtn?.setVisible(false);

    const cells = this.getConnectedCells();
    const wps   = cells.map(([r, c]) => ({
      x: this.originX + c * this.cellSize + this.cellSize / 2,
      y: this.originY + r * this.cellSize + this.cellSize / 2,
    }));

    const bikeSize = Math.max(20, Math.floor(this.cellSize * 0.52));
    this.bikeEmoji = this.add.text(wps[0].x, wps[0].y, '🚲', {
      fontSize: `${bikeSize}px`,
    }).setOrigin(0.5).setDepth(20);

    if (wps.length <= 1) {
      this.time.delayedCall(300, () => EventBus.emit('game-level-complete', this.level));
      return;
    }

    const stepDur = Math.max(180, 420 - this.level * 12);
    this.animateStep(wps, 1, stepDur);
  }

  private animateStep(wps: { x: number; y: number }[], idx: number, dur: number) {
    if (idx >= wps.length) {
      this.time.delayedCall(300, () => EventBus.emit('game-level-complete', this.level));
      return;
    }
    this.tweens.add({
      targets:  this.bikeEmoji,
      x: wps[idx].x,
      y: wps[idx].y,
      duration: dur,
      ease:     'Linear',
      onComplete: () => this.animateStep(wps, idx + 1, dur),
    });
  }

  update() { /* intentionally empty */ }
}
