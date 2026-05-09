import Phaser from 'phaser';
import { EventBus } from '../EventBus';

const DPR = window.devicePixelRatio || 2;

// ── Piece types ───────────────────────────────────────────────────────────────
type PieceKind = 'empty' | 'straight' | 'curve' | 'T' | 'cross';

const BASE_PORTS: Record<Exclude<PieceKind, 'empty'>, [boolean, boolean, boolean, boolean]> = {
  straight: [true,  false, true,  false],
  curve:    [true,  true,  false, false],
  T:        [true,  true,  false, true ],
  cross:    [true,  true,  true,  true ],
};

function getPorts(kind: PieceKind, rot: number): [boolean, boolean, boolean, boolean] {
  if (kind === 'empty') return [false, false, false, false];
  let p = [...BASE_PORTS[kind as Exclude<PieceKind, 'empty'>]] as [boolean, boolean, boolean, boolean];
  for (let i = 0; i < (rot & 3); i++) p = [p[3], p[0], p[1], p[2]];
  return p;
}

// ── Catalog ───────────────────────────────────────────────────────────────────
interface PaletteItem { kind: Exclude<PieceKind, 'empty'>; rot: number; label: string; }

const ALL_PIECE_TYPES: PaletteItem[] = [
  { kind: 'straight', rot: 0, label: '│' },
  { kind: 'straight', rot: 1, label: '─' },
  { kind: 'curve',    rot: 0, label: '└' },
  { kind: 'curve',    rot: 1, label: '┌' },
  { kind: 'curve',    rot: 2, label: '┐' },
  { kind: 'curve',    rot: 3, label: '┘' },
  { kind: 'cross',    rot: 0, label: '┼' },
];

const QUEUE_SIZE = 6;

function randomPiece(): PaletteItem {
  return { ...ALL_PIECE_TYPES[Math.floor(Math.random() * ALL_PIECE_TYPES.length)] };
}

// ── Direction helpers ──────────────────────────────────────────────────────────
const DR  = [-1, 0, 1, 0];
const DC  = [0, 1, 0, -1];
const OPP = [2, 3, 0, 1] as const;

// ── Level config ───────────────────────────────────────────────────────────────
interface Endpoint {
  row: number; col: number;
  label: string; icon: string; color: number;
}

interface LevelCfg {
  gridRows: number;
  gridCols: number;
  timerSec: number;
  endpoints: Endpoint[];
}

// Endpoints on each edge, varied by level. No openPort needed — all endpoints are crosses.
function generateEndpoints4(rows: number, cols: number, level: number): Endpoint[] {
  const rangeC = cols - 2;
  const rangeR = rows - 2;

  const topC   = 1 + (level * 3)     % rangeC;
  const rightR = 1 + (level * 5 + 1) % rangeR;
  const botC   = 1 + (level * 2 + 2) % rangeC;
  const leftR  = 1 + (level * 7 + 3) % rangeR;

  const rot = Math.floor(level / 4) % 4;
  const edgeDefs = [
    { row: 0,        col: topC     },
    { row: rightR,   col: cols - 1 },
    { row: rows - 1, col: botC     },
    { row: leftR,    col: 0        },
  ];

  const meta = [
    { label: 'Home',    icon: '🏠', color: 0xFF6B6B },
    { label: 'Park',    icon: '🌳', color: 0x22C55E },
    { label: 'School',  icon: '🏫', color: 0x4DA6FF },
    { label: 'Library', icon: '📚', color: 0x8B5CF6 },
  ];

  return [0, 1, 2, 3].map(i => ({
    ...edgeDefs[(i + rot) % 4],
    ...meta[i],
  }));
}

function getLevelCfg(level: number): LevelCfg {
  if (level <= 4) {
    return {
      gridRows: 5, gridCols: 4, timerSec: 120,
      endpoints: [
        { row: 4, col: 0, label: 'Home',   icon: '🏠', color: 0xFF6B6B },
        { row: 0, col: 3, label: 'School', icon: '🏫', color: 0x4DA6FF },
      ],
    };
  }
  if (level <= 10) {
    return {
      gridRows: 6, gridCols: 5, timerSec: 150,
      endpoints: [
        { row: 5, col: 0, label: 'Home',   icon: '🏠', color: 0xFF6B6B },
        { row: 0, col: 2, label: 'Park',   icon: '🌳', color: 0x22C55E },
        { row: 2, col: 4, label: 'School', icon: '🏫', color: 0x4DA6FF },
      ],
    };
  }
  const [gridRows, gridCols] = level <= 15 ? [7, 6] : [8, 7];
  return { gridRows, gridCols, timerSec: 180, endpoints: generateEndpoints4(gridRows, gridCols, level) };
}

// ── Cell ───────────────────────────────────────────────────────────────────────
interface Cell {
  row: number; col: number;
  kind: PieceKind; rot: number;
  fixed: boolean; endpointIdx: number; isObstacle: boolean;
}

// ── Scene ──────────────────────────────────────────────────────────────────────
export class BikingScene extends Phaser.Scene {
  private level = 1;
  private timeLeft = 120;
  private timerEvent?: Phaser.Time.TimerEvent;
  private grid: Cell[][] = [];
  private cfg!: LevelCfg;
  private rows = 0;
  private cols = 0;
  private cellSize = 80;
  private originX = 0;
  private originY = 0;
  private cellContainers: (Phaser.GameObjects.Container | null)[][] = [];

  private highlightGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private catalogBg?: Phaser.GameObjects.Graphics;
  private catalogLabelText?: Phaser.GameObjects.Text;
  private catalogTopY = 0;
  private catalogH = 0;
  private pieceQueue: PaletteItem[] = [];
  private catalogContainers: Phaser.GameObjects.Container[] = [];
  private guideText?: Phaser.GameObjects.Text;
  private startBtn?: Phaser.GameObjects.Container;
  private bikeEmoji?: Phaser.GameObjects.Text;
  private isAnimating = false;
  private connectionValid = false;
  private connectedUpTo = 0;

  private dragItem: PaletteItem | null = null;
  private dragVisual?: Phaser.GameObjects.Container;
  private W = 0;
  private H = 0;

  constructor() { super('BikingScene'); }

  init(data?: { level?: number }) {
    const sv = (data?.level ?? (this.registry.get('startLevel') as number | undefined)) ?? 1;
    this.level             = Math.max(1, Math.min(20, sv));
    this.timeLeft          = 0;
    this.grid              = [];
    this.cellContainers    = [];
    this.catalogContainers = [];
    this.isAnimating       = false;
    this.connectionValid   = false;
    this.connectedUpTo     = 0;
    this.dragItem          = null;
    this.dragVisual        = undefined;
    this.bikeEmoji         = undefined;
    this.startBtn          = undefined;
    this.catalogBg         = undefined;
    this.catalogLabelText  = undefined;
    this.catalogTopY       = 0;
    this.catalogH          = 0;
    this.pieceQueue        = [];
    this.guideText         = undefined;
    this.timerEvent        = undefined;
    this.rows              = 0;
    this.cols              = 0;
  }

  create() {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.cfg      = getLevelCfg(this.level);
    this.timeLeft = this.cfg.timerSec;
    this.rows     = this.cfg.gridRows;
    this.cols     = this.cfg.gridCols;

    const HUD_H    = 72;
    const CAT_H    = 100;
    const GUIDE_H  = 26;
    const BTN_H    = 50;
    const BTN_GAP  = 12;
    const GRID_PAD = 10;

    const availH = this.H - HUD_H - CAT_H - GUIDE_H - BTN_H - BTN_GAP - GRID_PAD * 2;
    const availW = this.W - GRID_PAD * 2;
    this.cellSize = Math.floor(Math.min(availW / this.cols, availH / this.rows));

    const totalPixW = this.cellSize * this.cols;
    const totalPixH = this.cellSize * this.rows;
    this.originX = Math.floor((this.W - totalPixW) / 2);
    this.originY = HUD_H + CAT_H + GUIDE_H + GRID_PAD + Math.floor((availH - totalPixH) / 2);

    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x1a2744);
    this.highlightGfx = this.add.graphics();
    this.hoverGfx     = this.add.graphics();

    this.grid = Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c): Cell => ({
        row: r, col: c, kind: 'empty', rot: 0,
        fixed: false, endpointIdx: -1, isObstacle: false,
      }))
    );
    this.cfg.endpoints.forEach((ep, i) => {
      this.grid[ep.row][ep.col].fixed = true;
      this.grid[ep.row][ep.col].endpointIdx = i;
    });

    const numObstacles = this.level >= 4 ? this.cols - 3 : 0;
    this.placeObstacles(numObstacles);

    this.cellContainers = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill(null)
    );
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        this.drawCell(r, c);

    this.add.text(this.W / 2, this.originY + totalPixH + 5, 'Tap a placed piece to rotate it', {
      fontFamily: 'Fredoka One', fontSize: '12px', color: 'rgba(255,255,255,0.4)', resolution: DPR,
    }).setOrigin(0.5, 0);

    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup',   this.onPointerUp,   this);

    this.catalogTopY = HUD_H;
    this.catalogH    = CAT_H;
    this.pieceQueue  = Array.from({ length: QUEUE_SIZE }, randomPiece);
    this.buildCatalog(HUD_H, CAT_H);

    this.guideText = this.add.text(this.W / 2, HUD_H + CAT_H + 4, '', {
      fontFamily: 'Fredoka One', fontSize: '13px', color: '#FCD34D', resolution: DPR,
    }).setOrigin(0.5, 0);
    this.updateGuide(0);

    this.buildStartButton(this.H - BTN_H / 2 - BTN_GAP);

    EventBus.emit('game-timer', this.timeLeft);
    EventBus.emit('game-scored-update', '...');
    this.timerEvent = this.time.addEvent({ delay: 1000, loop: true, callback: this.onTick, callbackScope: this });

    const onRestart = (d?: { level?: number }) => this.scene.restart(d);
    EventBus.on('restart-scene', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('restart-scene', onRestart);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup',   this.onPointerUp,   this);
    });
    EventBus.emit('current-scene-ready', EventBus);
  }

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

  // ── Draw cell ──────────────────────────────────────────────────────────────
  private drawCell(row: number, col: number) {
    this.cellContainers[row][col]?.destroy();
    const cs   = this.cellSize;
    const cx   = this.originX + col * cs + cs / 2;
    const cy   = this.originY + row * cs + cs / 2;
    const cell = this.grid[row][col];
    const cont = this.add.container(cx, cy);

    if (cell.isObstacle) {
      const bg = this.add.graphics();
      bg.fillStyle(0x1e1b2e, 1);
      bg.fillRoundedRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 8);
      bg.lineStyle(2.5, 0xB45309, 0.9);
      bg.strokeRoundedRect(-cs / 2 + 2, -cs / 2 + 2, cs - 4, cs - 4, 8);
      cont.add(bg);
      const wgfx = this.add.graphics();
      const wSz = Math.max(3, Math.floor(cs * 0.11));
      const wGap = Math.floor(cs * 0.08);
      wgfx.fillStyle(0xFBBF24, 0.75);
      for (let wr = 0; wr < 2; wr++)
        for (let wc = 0; wc < 3; wc++)
          wgfx.fillRect((wc - 1) * (wSz + wGap) - wSz / 2, (wr - 0.5) * (wSz + wGap) - wSz / 2, wSz, wSz);
      const dgfx = this.add.graphics();
      dgfx.fillStyle(0x92400E, 1);
      const dw = Math.floor(cs * 0.14), dh = Math.floor(cs * 0.18);
      dgfx.fillRect(-dw / 2, cs / 2 - 2 - dh, dw, dh);
      cont.add([wgfx, dgfx]);
      this.cellContainers[row][col] = cont;
      return;
    }

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

    if (cell.endpointIdx >= 0) {
      const ep    = this.cfg.endpoints[cell.endpointIdx];
      const iSize = Math.max(14, Math.floor(cs * 0.34));
      const icon  = this.add.text(0, -Math.floor(cs * 0.06), ep.icon, { fontSize: `${iSize}px`, resolution: DPR }).setOrigin(0.5);
      const lbl   = this.add.text(0, cs / 2 - 13, ep.label, { fontFamily: 'Fredoka One', fontSize: '10px', color: '#ffffff', resolution: DPR }).setOrigin(0.5);
      cont.add([icon, lbl]);
      // Endpoints act as crosses — draw arms in all 4 directions
      for (let d = 0; d < 4; d++) this.drawEndpointArm(cont, d, ep.color, cs, 0.85);
    }

    if (cell.kind !== 'empty' && cell.endpointIdx < 0)
      this.drawPiecePaths(cont, cell.kind, cell.rot, cs, false);

    if (!cell.fixed) {
      const hit = this.add.rectangle(0, 0, cs - 4, cs - 4, 0, 0).setInteractive();
      hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => { if (!this.dragItem) this.onCellTap(row, col, ptr); });
      cont.add(hit);
    }
    this.cellContainers[row][col] = cont;
  }

  private drawEndpointArm(cont: Phaser.GameObjects.Container, port: number, color: number, cs: number, alpha: number) {
    const gfx = this.add.graphics();
    gfx.fillStyle(color, alpha);
    const tw = cs * 0.18, half = cs / 2 - 2, len = half * 0.48;
    if (port === 0) gfx.fillRect(-tw / 2, -half, tw, len);
    if (port === 1) gfx.fillRect(half - len, -tw / 2, len, tw);
    if (port === 2) gfx.fillRect(-tw / 2, half - len, tw, len);
    if (port === 3) gfx.fillRect(-half, -tw / 2, len, tw);
    cont.add(gfx);
  }

  private drawPiecePaths(cont: Phaser.GameObjects.Container, kind: PieceKind, rot: number, cs: number, glowing: boolean) {
    const gfx = this.add.graphics();
    const tw = cs * 0.26, sw = tw * 0.28, arm = cs / 2 - 3;
    const ports = getPorts(kind, rot);
    gfx.fillStyle(0x374151, 1);
    gfx.fillRect(-tw / 2, -tw / 2, tw, tw);
    if (ports[0]) gfx.fillRect(-tw / 2, -arm, tw, arm);
    if (ports[1]) gfx.fillRect(0, -tw / 2, arm, tw);
    if (ports[2]) gfx.fillRect(-tw / 2, 0, tw, arm);
    if (ports[3]) gfx.fillRect(-arm, -tw / 2, arm, tw);
    gfx.fillStyle(glowing ? 0x86EFAC : 0x22C55E, 1);
    gfx.fillRect(-sw / 2, -sw / 2, sw, sw);
    if (ports[0]) gfx.fillRect(-sw / 2, -arm, sw, arm);
    if (ports[1]) gfx.fillRect(0, -sw / 2, arm, sw);
    if (ports[2]) gfx.fillRect(-sw / 2, 0, sw, arm);
    if (ports[3]) gfx.fillRect(-arm, -sw / 2, arm, sw);
    cont.add(gfx);
  }

  private onCellTap(row: number, col: number, _ptr: Phaser.Input.Pointer) {
    if (this.isAnimating) return;
    const cell = this.grid[row][col];
    if (cell.kind === 'empty') return;
    cell.rot = (cell.rot + 1) & 3;
    this.drawCell(row, col);
    this.checkAndHighlight();
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  startDrag(item: PaletteItem, startX: number, startY: number) {
    if (this.isAnimating) return;
    this.dragItem = item;
    const sz  = Math.min(this.cellSize, 64);
    const vis = this.add.container(startX, startY);
    const bg  = this.add.graphics();
    bg.fillStyle(0x1f2937, 0.92);
    bg.fillRoundedRect(-sz / 2, -sz / 2, sz, sz, 10);
    bg.lineStyle(2, 0x22C55E, 1);
    bg.strokeRoundedRect(-sz / 2, -sz / 2, sz, sz, 10);
    vis.add(bg);
    this.drawPiecePaths(vis, item.kind, item.rot, sz, true);
    vis.setDepth(100);
    this.dragVisual = vis;
  }

  private onPointerMove(ptr: Phaser.Input.Pointer) {
    if (!this.dragItem || !this.dragVisual) return;
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
    if (!this.dragItem) return;
    this.dragVisual?.destroy(); this.dragVisual = undefined;
    this.hoverGfx.clear();
    const cell = this.getCellAt(ptr.x, ptr.y);
    if (cell && !cell.fixed) {
      cell.kind = this.dragItem.kind;
      cell.rot  = this.dragItem.rot;
      this.drawCell(cell.row, cell.col);
      this.checkAndHighlight();
      this.pieceQueue.shift();
      this.pieceQueue.push(randomPiece());
      this.buildCatalog(this.catalogTopY, this.catalogH);
    }
    this.dragItem = null;
  }

  private getCellAt(px: number, py: number): Cell | null {
    const col = Math.floor((px - this.originX) / this.cellSize);
    const row = Math.floor((py - this.originY) / this.cellSize);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    const cell = this.grid[row][col];
    return cell.isObstacle ? null : cell;
  }

  // ── Connection engine ──────────────────────────────────────────────────────
  private portsFor2(cell: Cell): [boolean, boolean, boolean, boolean] {
    if (cell.isObstacle) return [false, false, false, false];
    if (cell.endpointIdx >= 0) return [true, true, true, true];
    return getPorts(cell.kind, cell.rot);
  }

  private portsForSolvability(r: number, c: number): [boolean, boolean, boolean, boolean] {
    const cell = this.grid[r][c];
    if (cell.isObstacle) return [false, false, false, false];
    return [true, true, true, true];
  }

  private bfsVisited(startR: number, startC: number, useActualPieces: boolean): boolean[][] {
    const visited = Array.from({ length: this.rows }, () => Array<boolean>(this.cols).fill(false));
    const queue: [number, number][] = [[startR, startC]];
    visited[startR][startC] = true;
    while (queue.length) {
      const [r, c] = queue.shift()!;
      const ports  = useActualPieces ? this.portsFor2(this.grid[r][c]) : this.portsForSolvability(r, c);
      for (let d = 0; d < 4; d++) {
        if (!ports[d]) continue;
        const nr = r + DR[d], nc = c + DC[d];
        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols || visited[nr][nc]) continue;
        const nPorts = useActualPieces ? this.portsFor2(this.grid[nr][nc]) : this.portsForSolvability(nr, nc);
        if (!nPorts[OPP[d]]) continue;
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
    return visited;
  }

  private checkAllConnected(): boolean {
    const eps = this.cfg.endpoints;
    if (eps.length < 2) return false;
    const v = this.bfsVisited(eps[0].row, eps[0].col, true);
    return eps.every(ep => v[ep.row][ep.col]);
  }

  private getConnectedUpTo(): number {
    const eps = this.cfg.endpoints;
    const v   = this.bfsVisited(eps[0].row, eps[0].col, true);
    let count = 0;
    for (let i = 1; i < eps.length; i++) {
      if (v[eps[i].row][eps[i].col]) count = i; else break;
    }
    return count;
  }

  private getConnectedCells(): [number, number][] {
    const eps      = this.cfg.endpoints;
    const v        = this.bfsVisited(eps[0].row, eps[0].col, true);
    const order: [number, number][] = [];
    const visited2 = Array.from({ length: this.rows }, () => Array<boolean>(this.cols).fill(false));
    const queue: [number, number][] = [[eps[0].row, eps[0].col]];
    visited2[eps[0].row][eps[0].col] = true;
    while (queue.length) {
      const [r, c] = queue.shift()!;
      order.push([r, c]);
      const ports = this.portsFor2(this.grid[r][c]);
      for (let d = 0; d < 4; d++) {
        if (!ports[d]) continue;
        const nr = r + DR[d], nc = c + DC[d];
        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols || visited2[nr][nc]) continue;
        if (!this.portsFor2(this.grid[nr][nc])[OPP[d]]) continue;
        visited2[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
    return order.filter(([r, c]) => v[r][c]);
  }

  private isPuzzleSolvable(): boolean {
    const eps = this.cfg.endpoints;
    for (const ep of eps) {
      let hasExit = false;
      for (let d = 0; d < 4; d++) {
        const nr = ep.row + DR[d], nc = ep.col + DC[d];
        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue;
        if (this.portsForSolvability(nr, nc)[OPP[d]]) { hasExit = true; break; }
      }
      if (!hasExit) return false;
    }
    const v = this.bfsVisited(eps[0].row, eps[0].col, false);
    return eps.every(ep => v[ep.row][ep.col]);
  }

  private checkAndHighlight() {
    this.connectionValid = this.checkAllConnected();
    this.highlightGfx.clear();
    if (this.connectionValid) {
      this.highlightGfx.fillStyle(0x4ADE80, 0.10);
      for (const [r, c] of this.getConnectedCells()) {
        this.highlightGfx.fillRoundedRect(
          this.originX + c * this.cellSize + 2,
          this.originY + r * this.cellSize + 2,
          this.cellSize - 4, this.cellSize - 4, 8
        );
      }
    }
    const newUpTo = this.getConnectedUpTo();
    if (newUpTo > this.connectedUpTo) {
      for (let i = this.connectedUpTo + 1; i <= newUpTo; i++) this.showCelebration(i);
      this.connectedUpTo = newUpTo;
      this.updateGuide(newUpTo);
    }
    this.startBtn?.setAlpha(this.connectionValid ? 1 : 0.45);
    EventBus.emit('game-scored-update', this.connectionValid ? '✓ Go!' : '...');
  }

  // ── Guide text ─────────────────────────────────────────────────────────────
  private updateGuide(upTo: number) {
    const eps  = this.cfg.endpoints;
    const last = eps.length - 1;
    if (upTo >= last) {
      this.guideText?.setText('All connected! Press Start! 🚲');
    } else {
      const routeStr = eps.map(ep => ep.label).join(' - ');
      this.guideText?.setText(`Route: ${routeStr}`);
    }
  }

  private showCelebration(epIdx: number) {
    const ep   = this.cfg.endpoints[epIdx];
    const cx   = this.originX + ep.col * this.cellSize + this.cellSize / 2;
    const cy   = this.originY + ep.row * this.cellSize + this.cellSize / 2;
    const msgs = ['Well done! 🎉', 'Amazing! ⭐', 'Perfect! 🌟', 'Great! 💫'];
    const txt  = this.add.text(cx, cy - 16, msgs[(epIdx - 1) % msgs.length], {
      fontFamily: 'Fredoka One', fontSize: '15px', color: '#FBBF24',
      stroke: '#000000', strokeThickness: 3, resolution: DPR,
    }).setOrigin(0.5, 1).setDepth(50);
    this.tweens.add({
      targets: txt, y: cy - 56, alpha: 0, duration: 1800, ease: 'Cubic.Out',
      onComplete: () => txt.destroy(),
    });
  }

  // ── Obstacle system ────────────────────────────────────────────────────────
  private bfsPath(fromR: number, fromC: number, toR: number, toC: number): [number, number][] | null {
    type Pos = [number, number];
    const visited = Array.from({ length: this.rows }, () => Array<boolean>(this.cols).fill(false));
    const parent  = Array.from({ length: this.rows }, () => Array<Pos | null>(this.cols).fill(null));
    const queue: Pos[] = [[fromR, fromC]];
    visited[fromR][fromC] = true;
    while (queue.length) {
      const [r, c] = queue.shift()!;
      if (r === toR && c === toC) {
        const path: Pos[] = [];
        let cur: Pos | null = [r, c];
        while (cur) { path.unshift(cur); cur = parent[cur[0]][cur[1]]; }
        return path;
      }
      const ports = this.portsForSolvability(r, c);
      for (let d = 0; d < 4; d++) {
        if (!ports[d]) continue;
        const nr = r + DR[d], nc = c + DC[d];
        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols || visited[nr][nc]) continue;
        if (!this.portsForSolvability(nr, nc)[OPP[d]]) continue;
        visited[nr][nc] = true;
        parent[nr][nc] = [r, c];
        queue.push([nr, nc]);
      }
    }
    return null;
  }

  private placeObstacles(numObstacles: number) {
    if (numObstacles <= 0) return;
    const eps         = this.cfg.endpoints;
    const numSegments = eps.length - 1;
    const epKey       = (r: number, c: number) => `${r},${c}`;
    const epSet       = new Set(eps.map(ep => epKey(ep.row, ep.col)));
    const base        = Math.floor(numObstacles / numSegments);
    const remainder   = numObstacles % numSegments;

    for (let seg = 0; seg < numSegments; seg++) {
      const count = base + (seg < remainder ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const path = this.bfsPath(eps[seg].row, eps[seg].col, eps[seg + 1].row, eps[seg + 1].col);
        if (!path || path.length < 3) break;
        const candidates = path.filter(([r, c]) => !epSet.has(epKey(r, c)));
        if (!candidates.length) break;
        const mid    = Math.floor(candidates.length / 2);
        const sorted = candidates
          .map((pos, i) => ({ pos, dist: Math.abs(i - mid) }))
          .sort((a, b) => a.dist - b.dist)
          .map(x => x.pos);
        for (const [r, c] of sorted) {
          this.grid[r][c].isObstacle = true;
          this.grid[r][c].fixed      = true;
          if (this.isPuzzleSolvable()) break;
          this.grid[r][c].isObstacle = false;
          this.grid[r][c].fixed      = false;
        }
      }
    }
  }

  // ── Catalog ────────────────────────────────────────────────────────────────
  private buildCatalog(topY: number, height: number) {
    this.catalogBg?.destroy();
    this.catalogLabelText?.destroy();
    this.catalogContainers.forEach(c => c.destroy());
    this.catalogContainers = [];

    const bg = this.add.graphics();
    bg.fillStyle(0x0d1526, 0.94);
    bg.fillRoundedRect(8, topY + 4, this.W - 16, height - 8, 12);
    this.catalogBg = bg;

    this.catalogLabelText = this.add.text(this.W / 2, topY + 8, 'Drag the first piece →', {
      fontFamily: 'Fredoka One', fontSize: '11px', color: '#6EE7B7', resolution: DPR,
    }).setOrigin(0.5, 0);

    const gap    = 6;
    const iS     = Math.max(32, Math.floor(Math.min(44, (this.W - 24 - gap * (QUEUE_SIZE - 1)) / (QUEUE_SIZE + 0.3))));
    const aS     = Math.min(Math.floor(iS * 1.35), height - 22);
    const totalW = aS + (QUEUE_SIZE - 1) * (iS + gap);
    let cx = (this.W - totalW) / 2;
    const itemCY = topY + 20 + (height - 20) / 2;

    this.pieceQueue.forEach((item, i) => {
      const isActive = i === 0;
      const sz   = isActive ? aS : iS;
      const cont = this.add.container(cx + sz / 2, itemCY);

      const btnBg = this.add.graphics();
      if (isActive) {
        btnBg.fillStyle(0x162a18, 1);
        btnBg.fillRoundedRect(-sz / 2, -sz / 2, sz, sz, 10);
        btnBg.lineStyle(2.5, 0x4ADE80, 1);
        btnBg.strokeRoundedRect(-sz / 2, -sz / 2, sz, sz, 10);
      } else {
        btnBg.fillStyle(0x161b2e, 1);
        btnBg.fillRoundedRect(-sz / 2, -sz / 2, sz, sz, 7);
        btnBg.lineStyle(1, 0x2d3748, 0.7);
        btnBg.strokeRoundedRect(-sz / 2, -sz / 2, sz, sz, 7);
      }
      cont.add(btnBg);
      this.drawPiecePaths(cont, item.kind, item.rot, sz, isActive);

      if (!isActive) {
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.45);
        overlay.fillRoundedRect(-sz / 2, -sz / 2, sz, sz, 7);
        cont.add(overlay);
      }

      if (isActive) {
        const hit = this.add.rectangle(0, 0, sz, sz, 0, 0).setInteractive();
        hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.startDrag(item, ptr.x, ptr.y));
        cont.add(hit);
      }

      this.catalogContainers.push(cont);
      cx += sz + gap;
    });
  }

  // ── Start button ───────────────────────────────────────────────────────────
  private buildStartButton(centerY: number) {
    const cont = this.add.container(this.W / 2, centerY);
    const bg   = this.add.graphics();
    bg.fillStyle(0x16A34A, 1);
    bg.fillRoundedRect(-100, -24, 200, 48, 24);
    cont.add(bg);
    cont.add(this.add.text(0, 0, 'Start Biking! 🚲', { fontFamily: 'Fredoka One', fontSize: '18px', color: '#ffffff', resolution: DPR }).setOrigin(0.5));
    const hit = this.add.rectangle(0, 0, 200, 48, 0, 0).setInteractive();
    hit.on('pointerdown', () => this.onStartBiking());
    cont.add(hit);
    cont.setAlpha(0.45);
    this.startBtn = cont;
  }

  // ── Bike animation ─────────────────────────────────────────────────────────
  private onStartBiking() {
    if (this.isAnimating) return;
    if (!this.connectionValid) {
      this.tweens.add({ targets: this.startBtn, x: { from: this.W / 2 - 8, to: this.W / 2 + 8 }, duration: 70, yoyo: true, repeat: 3, onComplete: () => this.startBtn?.setX(this.W / 2) });
      return;
    }
    this.triggerBikeAnimation();
  }

  private triggerBikeAnimation() {
    this.isAnimating = true;
    this.timerEvent?.destroy();
    this.startBtn?.setVisible(false);
    const cells    = this.getConnectedCells();
    const wps      = cells.map(([r, c]) => ({ x: this.originX + c * this.cellSize + this.cellSize / 2, y: this.originY + r * this.cellSize + this.cellSize / 2 }));
    const bikeSize = Math.max(20, Math.floor(this.cellSize * 0.52));
    this.bikeEmoji = this.add.text(wps[0].x, wps[0].y, '🚲', { fontSize: `${bikeSize}px`, resolution: DPR }).setOrigin(0.5).setDepth(20);
    if (wps.length <= 1) { this.time.delayedCall(300, () => EventBus.emit('game-level-complete', this.level)); return; }
    this.animateStep(wps, 1, Math.max(180, 420 - this.level * 12));
  }

  private animateStep(wps: { x: number; y: number }[], idx: number, dur: number) {
    if (idx >= wps.length) { this.time.delayedCall(300, () => EventBus.emit('game-level-complete', this.level)); return; }
    this.tweens.add({ targets: this.bikeEmoji, x: wps[idx].x, y: wps[idx].y, duration: dur, ease: 'Linear', onComplete: () => this.animateStep(wps, idx + 1, dur) });
  }

  update() { /* intentionally empty */ }
}
