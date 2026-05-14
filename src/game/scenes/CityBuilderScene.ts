import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';
import type { BuildItem } from '../cityBuilderData';

// ─── Tile / grid constants ────────────────────────────────────────────────────
const TILE_HW     = 24;    // iso tile half-width (px)
const TILE_HH     = 12;    // iso tile half-height
const GRID        = 15;
const GRID_ORIGIN_Y = 215; // world-space Y of the (0,0) tile centre (below React menus)

// ─── Scene ────────────────────────────────────────────────────────────────────
export class CityBuilderScene extends Phaser.Scene {
  private W = 0;
  private originX = 0;

  private selectedItem: BuildItem | null = null;
  private previewCol = -1;
  private previewRow = -1;

  private tileGfx!:     Phaser.GameObjects.Graphics;
  private buildingGfx!: Phaser.GameObjects.Graphics;
  private previewGfx!:  Phaser.GameObjects.Graphics;
  private hoverGfx!:    Phaser.GameObjects.Graphics;
  private toastText!:   Phaser.GameObjects.Text;

  private grid: (BuildItem | null)[][] = [];

  // Camera drag
  private dragStart  = { x: 0, y: 0 };
  private camStart   = { x: 0, y: 0 };
  private dragging   = false;

  // Pinch-to-zoom
  private isPinching = false;
  private pinchDist0 = 0;
  private pinchZoom0 = 1;

  // Demolish mode
  private demolishMode = false;
  private demolishCol  = -1;
  private demolishRow  = -1;

  constructor() { super('CityBuilderScene'); }

  init() {
    this.selectedItem = null;
    this.previewCol   = -1;
    this.previewRow   = -1;
    this.grid = Array.from({ length: GRID }, () => Array(GRID).fill(null));
    this.demolishMode = false;
    this.demolishCol  = -1;
    this.demolishRow  = -1;
  }

  create() {
    this.W = this.cameras.main.width;
    const H = this.cameras.main.height;
    this.originX = this.W / 2;

    // Ensure native touch events reach the canvas on mobile
    this.game.canvas.style.touchAction = 'none';

    // Seed coins for testing
    const store = useProgressStore.getState();
    if (store.cityCoins < 9999) store.addCityCoins(9999 - store.cityCoins);

    EventBus.emit('current-scene-ready', this);

    // ── EventBus listeners ─────────────────────────────────────────────────────
    const onRestart = (d?: { level?: number }) => setTimeout(() => this.scene.restart(d), 0);
    const onSelect  = (item: BuildItem | null) => {
      this.selectedItem = item;
      if (!item) this.clearPreview();
      if (item) { this.demolishMode = false; this.demolishCol = -1; this.demolishRow = -1; this.previewGfx.clear(); }
    };
    const onConfirm = () => this.confirmPlacement();
    const onCancel  = () => { this.selectedItem = null; this.clearPreview(); };

    const onDemolishMode = (on: boolean) => {
      this.demolishMode = on;
      if (on) { this.selectedItem = null; this.clearPreview(); }
      else    { this.demolishCol = -1; this.demolishRow = -1; this.previewGfx.clear(); }
    };
    const onDemolishConfirm = () => {
      if (this.demolishCol < 0) return;
      this.grid[this.demolishRow][this.demolishCol] = null;
      this.redrawBuildings();
      this.demolishCol  = -1;
      this.demolishRow  = -1;
      this.demolishMode = false;
      this.previewGfx.clear();
      EventBus.emit('citybuilder-demolish-done');
    };
    const onDemolishCancel = () => {
      this.demolishCol = -1;
      this.demolishRow = -1;
      this.previewGfx.clear();
      EventBus.emit('citybuilder-demolish-preview', null);
    };

    EventBus.on('restart-scene',            onRestart);
    EventBus.on('citybuilder-select',       onSelect);
    EventBus.on('citybuilder-confirm',      onConfirm);
    EventBus.on('citybuilder-cancel',       onCancel);
    EventBus.on('citybuilder-demolish-mode',    onDemolishMode);
    EventBus.on('citybuilder-demolish-confirm', onDemolishConfirm);
    EventBus.on('citybuilder-demolish-cancel',  onDemolishCancel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('restart-scene',            onRestart);
      EventBus.off('citybuilder-select',       onSelect);
      EventBus.off('citybuilder-confirm',      onConfirm);
      EventBus.off('citybuilder-cancel',       onCancel);
      EventBus.off('citybuilder-demolish-mode',    onDemolishMode);
      EventBus.off('citybuilder-demolish-confirm', onDemolishConfirm);
      EventBus.off('citybuilder-demolish-cancel',  onDemolishCancel);
    });

    // ── Background ─────────────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xB0E0E6, 0xB0E0E6, 1);
    bg.fillRect(-2000, -500, 6000, 4000);

    // ── Layers ─────────────────────────────────────────────────────────────────
    this.tileGfx     = this.add.graphics().setDepth(2);
    this.buildingGfx = this.add.graphics().setDepth(4);
    this.previewGfx  = this.add.graphics().setDepth(6);
    this.hoverGfx    = this.add.graphics().setDepth(7);

    // Toast (screen-fixed)
    this.toastText = this.add.text(this.W / 2, H - 120, '', {
      fontFamily: 'Fredoka One', fontSize: '15px', color: '#FCD34D',
      stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5).setDepth(110).setScrollFactor(0).setAlpha(0);

    this.drawGrid();
    this.setupInput();
  }

  // ─── Coordinate helpers ───────────────────────────────────────────────────────

  isoToScreen(col: number, row: number) {
    return {
      x: this.originX + (col - row) * TILE_HW,
      y: GRID_ORIGIN_Y + (col + row) * TILE_HH,
    };
  }

  private worldToIso(wx: number, wy: number) {
    const dx = wx - this.originX;
    const dy = wy - GRID_ORIGIN_Y;
    return {
      col: Math.round((dx / TILE_HW + dy / TILE_HH) / 2),
      row: Math.round((dy / TILE_HH - dx / TILE_HW) / 2),
    };
  }

  private inBounds(col: number, row: number) {
    return col >= 0 && col < GRID && row >= 0 && row < GRID;
  }

  private darken(color: number, f: number) {
    return (
      (Math.round(((color >> 16) & 0xFF) * f) << 16) |
      (Math.round(((color >>  8) & 0xFF) * f) <<  8) |
       Math.round(  (color        & 0xFF) * f)
    );
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────────

  private drawGrid() {
    const g = this.tileGfx;
    g.clear();
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const { x, y } = this.isoToScreen(col, row);
        const shade = (col + row) % 2 === 0 ? 0x86EFAC : 0x4ADE80;
        g.fillStyle(shade, 1);
        g.fillPoints([
          { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
          { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
        ], true);
        g.lineStyle(1, 0x000000, 0.12);
        g.strokePoints([
          { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
          { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
        ], true);
      }
    }
  }

  private drawBlock(
    g: Phaser.GameObjects.Graphics,
    col: number, row: number,
    item: BuildItem,
    alpha = 1,
  ) {
    const { x: cx, y: cy } = this.isoToScreen(col, row);
    const bh = item.bh;
    const c  = item.color;

    g.fillStyle(c, alpha);
    g.fillPoints([
      { x: cx,            y: cy - bh - TILE_HH },
      { x: cx + TILE_HW,  y: cy - bh },
      { x: cx,            y: cy - bh + TILE_HH },
      { x: cx - TILE_HW,  y: cy - bh },
    ], true);

    g.fillStyle(this.darken(c, 0.58), alpha);
    g.fillPoints([
      { x: cx - TILE_HW,  y: cy - bh },
      { x: cx,            y: cy - bh + TILE_HH },
      { x: cx,            y: cy + TILE_HH },
      { x: cx - TILE_HW,  y: cy },
    ], true);

    g.fillStyle(this.darken(c, 0.74), alpha);
    g.fillPoints([
      { x: cx,            y: cy - bh + TILE_HH },
      { x: cx + TILE_HW,  y: cy - bh },
      { x: cx + TILE_HW,  y: cy },
      { x: cx,            y: cy + TILE_HH },
    ], true);

    g.lineStyle(1, 0x000000, alpha * 0.28);
    g.strokePoints([
      { x: cx,            y: cy - bh - TILE_HH },
      { x: cx + TILE_HW,  y: cy - bh },
      { x: cx,            y: cy - bh + TILE_HH },
      { x: cx - TILE_HW,  y: cy - bh },
    ], true);
  }

  private redrawBuildings() {
    const g = this.buildingGfx;
    g.clear();
    const cells: { col: number; row: number; item: BuildItem }[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const item = this.grid[row][col];
        if (item) cells.push({ col, row, item });
      }
    }
    cells.sort((a, b) => (a.col + a.row) - (b.col + b.row));
    cells.forEach(({ col, row, item }) => this.drawBlock(g, col, row, item));
  }

  // ─── Placement ────────────────────────────────────────────────────────────────

  private clearPreview() {
    this.previewGfx.clear();
    this.previewCol = -1;
    this.previewRow = -1;
    EventBus.emit('citybuilder-preview-ready', false);
  }

  private setPreview(col: number, row: number) {
    if (!this.selectedItem) return;
    this.previewCol = col;
    this.previewRow = row;
    this.previewGfx.clear();
    this.drawBlock(this.previewGfx, col, row, this.selectedItem, 0.52);
    EventBus.emit('citybuilder-preview-ready', true);
  }

  private confirmPlacement() {
    if (this.previewCol < 0 || !this.selectedItem) return;
    const cost = this.selectedItem.cost;
    if (useProgressStore.getState().cityCoins < cost) {
      this.showToast(`Need 🪙${cost} coins!`);
      return;
    }
    useProgressStore.getState().addCityCoins(-cost);
    this.grid[this.previewRow][this.previewCol] = this.selectedItem;
    this.redrawBuildings();
    this.previewGfx.clear();
    this.previewCol = -1;
    this.previewRow = -1;
    EventBus.emit('citybuilder-preview-ready', false);
    EventBus.emit('citybuilder-placed', { label: this.selectedItem.label });
  }

  // ─── Input ────────────────────────────────────────────────────────────────────

  private setupInput() {
    const cam    = this.cameras.main;
    const canvas = this.game.canvas;

    // ── Phaser pointerdown: desktop (mouse) only — mobile uses native touchstart ──
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.wasTouch) return;   // native touchstart already handled it
      if (this.input.pointer2.isDown) {
        this.dragging   = false;
        this.isPinching = true;
        this.pinchDist0 = Phaser.Math.Distance.Between(
          this.input.pointer1.x, this.input.pointer1.y,
          this.input.pointer2.x, this.input.pointer2.y,
        );
        this.pinchZoom0 = cam.zoom;
        return;
      }
      if (this.selectedItem) {
        const wp = cam.getWorldPoint(ptr.x, ptr.y);
        const { col, row } = this.worldToIso(wp.x, wp.y);
        if (this.inBounds(col, row)) this.setPreview(col, row);
        return;
      }
      this.dragging  = true;
      this.dragStart = { x: ptr.x, y: ptr.y };
      this.camStart  = { x: cam.scrollX, y: cam.scrollY };
    });

    this.input.on('pointerup', () => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) this.isPinching = false;
      this.dragging = false;
    });

    // ── Native touch: primary path on mobile (bypasses Phaser delivery issues) ──
    const screenPt = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (t.clientX - rect.left) * (this.W / rect.width),
        y: (t.clientY - rect.top)  * (cam.height / rect.height),
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        this.dragging   = false;
        this.isPinching = true;
        const t1 = e.touches[0]; const t2 = e.touches[1];
        this.pinchDist0 = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        this.pinchZoom0 = cam.zoom;
        return;
      }
      if (e.touches.length !== 1) return;
      const { x: sx, y: sy } = screenPt(e.touches[0]);
      const wp = cam.getWorldPoint(sx, sy);
      const { col, row } = this.worldToIso(wp.x, wp.y);

      if (this.demolishMode) {
        if (this.inBounds(col, row) && this.grid[row][col]) {
          this.demolishCol = col;
          this.demolishRow = row;
          this.previewGfx.clear();
          const { x, y } = this.isoToScreen(col, row);
          this.previewGfx.fillStyle(0xFF3333, 0.22);
          this.previewGfx.fillPoints([
            { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
            { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
          ], true);
          this.previewGfx.lineStyle(2, 0xFF3333, 0.9);
          this.previewGfx.strokePoints([
            { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
            { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
          ], true);
          EventBus.emit('citybuilder-demolish-preview', { label: this.grid[row][col]!.label });
        } else {
          this.demolishCol = -1;
          this.demolishRow = -1;
          this.previewGfx.clear();
          EventBus.emit('citybuilder-demolish-preview', null);
        }
        return;
      }

      if (this.selectedItem) {
        if (this.inBounds(col, row)) this.setPreview(col, row);
      } else {
        this.dragging  = true;
        this.dragStart = { x: sx, y: sy };
        this.camStart  = { x: cam.scrollX, y: cam.scrollY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (this.isPinching) {
        if (e.touches.length >= 2) {
          const t1 = e.touches[0]; const t2 = e.touches[1];
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          if (this.pinchDist0 > 0)
            cam.setZoom(Phaser.Math.Clamp(this.pinchZoom0 * (dist / this.pinchDist0), 0.4, 3.0));
        }
        e.preventDefault();
        return;
      }
      if (!this.dragging || e.touches.length !== 1) return;
      const { x: sx, y: sy } = screenPt(e.touches[0]);
      cam.scrollX = this.camStart.x - (sx - this.dragStart.x) / cam.zoom;
      cam.scrollY = this.camStart.y - (sy - this.dragStart.y) / cam.zoom;
      e.preventDefault();
    };

    const onTouchEnd = () => { this.dragging = false; this.isPinching = false; };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    });
  }

  // ─── Update: hover highlight ──────────────────────────────────────────────────

  update() {
    if ((!this.selectedItem && !this.demolishMode) || this.isPinching) {
      this.hoverGfx.clear();
      return;
    }
    const ptr = this.input.activePointer;
    if (!ptr) { this.hoverGfx.clear(); return; }

    const cam = this.cameras.main;
    const wp  = cam.getWorldPoint(ptr.x, ptr.y);
    const { col, row } = this.worldToIso(wp.x, wp.y);
    this.hoverGfx.clear();
    if (this.inBounds(col, row)) {
      const { x, y } = this.isoToScreen(col, row);
      const canDemolish = this.demolishMode && !!this.grid[row][col];
      if (!this.demolishMode || canDemolish) {
        this.hoverGfx.lineStyle(2, this.demolishMode ? 0xFF3333 : 0xFFFFFF, 0.85);
        this.hoverGfx.strokePoints([
          { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
          { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
        ], true);
      }
    }
  }

  // ─── Toast ────────────────────────────────────────────────────────────────────

  private showToast(msg: string) {
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.time.delayedCall(1400, () => {
      this.tweens.add({ targets: this.toastText, alpha: 0, duration: 500 });
    });
  }
}
