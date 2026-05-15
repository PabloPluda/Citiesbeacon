import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';
import { CATS } from '../cityBuilderData';
import type { BuildItem } from '../cityBuilderData';

// ─── Tile / grid constants ────────────────────────────────────────────────────
const TILE_HW     = 40;    // iso tile half-width (px)
const TILE_HH     = 20;    // iso tile half-height
const GRID        = 15;
const GRID_ORIGIN_Y = 250; // world-space Y of the (0,0) tile centre (below React menus)

// ─── Grid cell type ───────────────────────────────────────────────────────────
type GridCell = { item: BuildItem; anchorCol: number; anchorRow: number } | null;

// ─── Scene ────────────────────────────────────────────────────────────────────
export class CityBuilderScene extends Phaser.Scene {
  private W = 0;
  private originX = 0;

  private selectedItem: BuildItem | null = null;
  private previewCol = -1;
  private previewRow = -1;

  private tileGfx!:    Phaser.GameObjects.Graphics;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!:   Phaser.GameObjects.Graphics;
  private toastText!:  Phaser.GameObjects.Text;

  private grid: GridCell[][] = [];

  private buildingSprites: Phaser.GameObjects.Image[] = [];
  private previewSprite: Phaser.GameObjects.Image | null = null;

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
    this.buildingSprites = [];
    this.previewSprite = null;
  }

  preload() {
    CATS.forEach(cat =>
      cat.items.forEach(item =>
        this.load.image(item.key, `/Builder/${item.file}.png`)
      )
    );
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
      const cell = this.grid[this.demolishRow][this.demolishCol];
      if (!cell) return;
      const { anchorCol, anchorRow, item } = cell;
      for (let dr = 0; dr < item.d; dr++)
        for (let dc = 0; dc < item.w; dc++)
          this.grid[anchorRow + dr][anchorCol + dc] = null;
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
    this.tileGfx    = this.add.graphics().setDepth(2);
    this.previewGfx = this.add.graphics().setDepth(6);
    this.hoverGfx   = this.add.graphics().setDepth(7);

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

  // ─── Sprite anchor helper ─────────────────────────────────────────────────────

  private spriteAnchor(col: number, row: number, w: number, d: number) {
    const { x: cx0, y: cy0 } = this.isoToScreen(col, row);
    return {
      x: cx0 + (w - d) / 2 * TILE_HW,
      y: cy0 + (w + d - 1) * TILE_HH,
      targetW: (w + d) * TILE_HW,
    };
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

  // ─── Can-place check ─────────────────────────────────────────────────────────

  private canPlace(col: number, row: number, item: BuildItem): boolean {
    for (let dr = 0; dr < item.d; dr++)
      for (let dc = 0; dc < item.w; dc++)
        if (!this.inBounds(col + dc, row + dr) || this.grid[row + dr][col + dc] !== null)
          return false;
    return true;
  }

  // ─── Sprite rendering ─────────────────────────────────────────────────────────

  private redrawBuildings() {
    this.buildingSprites.forEach(s => s.destroy());
    this.buildingSprites = [];
    const seen = new Set<string>();
    const cells: { col: number; row: number; item: BuildItem }[] = [];
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        const k = `${cell.anchorCol},${cell.anchorRow}`;
        if (seen.has(k)) continue;
        seen.add(k);
        cells.push({ col: cell.anchorCol, row: cell.anchorRow, item: cell.item });
      }
    cells.sort((a, b) => (a.col + a.row) - (b.col + b.row));
    cells.forEach(({ col, row, item }) => {
      const { x, y, targetW } = this.spriteAnchor(col, row, item.w, item.d);
      const spr = this.add.image(x, y, item.key).setOrigin(0.5, 1);
      spr.setScale(targetW / spr.width);
      spr.setDepth(10 + col + row + item.w + item.d - 2);
      this.buildingSprites.push(spr);
    });
  }

  // ─── Placement ────────────────────────────────────────────────────────────────

  private clearPreview() {
    if (this.previewSprite) { this.previewSprite.destroy(); this.previewSprite = null; }
    this.previewGfx.clear();
    this.previewCol = -1;
    this.previewRow = -1;
    EventBus.emit('citybuilder-preview-ready', false);
  }

  private setPreview(col: number, row: number) {
    if (!this.selectedItem || !this.canPlace(col, row, this.selectedItem)) return;
    this.previewCol = col;
    this.previewRow = row;
    // Clear old preview
    if (this.previewSprite) { this.previewSprite.destroy(); this.previewSprite = null; }
    this.previewGfx.clear();
    // Highlight cells
    const item = this.selectedItem;
    for (let dr = 0; dr < item.d; dr++)
      for (let dc = 0; dc < item.w; dc++) {
        const { x, y } = this.isoToScreen(col + dc, row + dr);
        this.previewGfx.fillStyle(0xFFFFFF, 0.18);
        this.previewGfx.fillPoints([
          { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
          { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
        ], true);
      }
    // Semi-transparent sprite
    const { x, y, targetW } = this.spriteAnchor(col, row, item.w, item.d);
    this.previewSprite = this.add.image(x, y, item.key).setOrigin(0.5, 1);
    this.previewSprite.setScale(targetW / this.previewSprite.width);
    this.previewSprite.setAlpha(0.65);
    this.previewSprite.setDepth(50 + col + row);
    EventBus.emit('citybuilder-preview-ready', true);
  }

  private confirmPlacement() {
    if (this.previewCol < 0 || !this.selectedItem) return;
    const item = this.selectedItem;
    if (useProgressStore.getState().cityCoins < item.cost) {
      this.showToast(`Need 🪙${item.cost} coins!`);
      return;
    }
    if (!this.canPlace(this.previewCol, this.previewRow, item)) return;
    useProgressStore.getState().addCityCoins(-item.cost);
    for (let dr = 0; dr < item.d; dr++)
      for (let dc = 0; dc < item.w; dc++)
        this.grid[this.previewRow + dr][this.previewCol + dc] = { item, anchorCol: this.previewCol, anchorRow: this.previewRow };
    this.redrawBuildings();
    if (this.previewSprite) { this.previewSprite.destroy(); this.previewSprite = null; }
    this.previewGfx.clear();
    this.previewCol = -1;
    this.previewRow = -1;
    EventBus.emit('citybuilder-preview-ready', false);
    EventBus.emit('citybuilder-placed', { label: item.label });
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
          const cell = this.grid[row][col]!;
          this.demolishCol = cell.anchorCol;
          this.demolishRow = cell.anchorRow;
          this.previewGfx.clear();
          const { w, d } = cell.item;
          for (let dr = 0; dr < d; dr++)
            for (let dc = 0; dc < w; dc++) {
              const { x, y } = this.isoToScreen(cell.anchorCol + dc, cell.anchorRow + dr);
              this.previewGfx.fillStyle(0xFF3333, 0.22);
              this.previewGfx.fillPoints([{ x, y: y - TILE_HH }, { x: x + TILE_HW, y }, { x, y: y + TILE_HH }, { x: x - TILE_HW, y }], true);
              this.previewGfx.lineStyle(2, 0xFF3333, 0.9);
              this.previewGfx.strokePoints([{ x, y: y - TILE_HH }, { x: x + TILE_HW, y }, { x, y: y + TILE_HH }, { x: x - TILE_HW, y }], true);
            }
          EventBus.emit('citybuilder-demolish-preview', { label: cell.item.label });
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
    if (!this.inBounds(col, row)) return;

    if (this.selectedItem) {
      const { w, d } = this.selectedItem;
      const canP = this.canPlace(col, row, this.selectedItem);
      for (let dr = 0; dr < d; dr++)
        for (let dc = 0; dc < w; dc++) {
          if (!this.inBounds(col + dc, row + dr)) continue;
          const { x, y } = this.isoToScreen(col + dc, row + dr);
          this.hoverGfx.lineStyle(2, canP ? 0xFFFFFF : 0xFF6666, 0.85);
          this.hoverGfx.strokePoints([{ x, y: y - TILE_HH }, { x: x + TILE_HW, y }, { x, y: y + TILE_HH }, { x: x - TILE_HW, y }], true);
        }
    } else if (this.demolishMode && this.grid[row]?.[col]) {
      const cell = this.grid[row][col]!;
      const { w, d } = cell.item;
      for (let dr = 0; dr < d; dr++)
        for (let dc = 0; dc < w; dc++) {
          const { x, y } = this.isoToScreen(cell.anchorCol + dc, cell.anchorRow + dr);
          this.hoverGfx.lineStyle(2, 0xFF3333, 0.85);
          this.hoverGfx.strokePoints([{ x, y: y - TILE_HH }, { x: x + TILE_HW, y }, { x, y: y + TILE_HH }, { x: x - TILE_HW, y }], true);
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
