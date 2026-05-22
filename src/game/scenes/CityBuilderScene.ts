import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';
import type { BuildItem } from '../cityBuilderData';
import { useAdminStore } from '../../store/adminStore';
import type { SavedBuilding } from '../../store/userStore';

// ─── Tile / grid constants ────────────────────────────────────────────────────
const TILE_HW     = 40;    // iso tile half-width (px)
const TILE_HH     = 20;    // iso tile half-height
const GRID        = 20;
const GRID_ORIGIN_Y = 250; // world-space Y of the (0,0) tile centre (below React menus)

// ─── Road connector auto-upgrade map ─────────────────────────────────────────
// Key = sorted direction set joined by ','.  Directions: ul ur dl dr
const ROAD_CONN: Record<string, { key: string; file: string }> = {
  'dl,ul,ur':    { key: 'conn_ul_ur_dl',    file: 'Road-1x1_upleftuprightdownleft' },
  'dr,ul,ur':    { key: 'conn_ul_ur_dr',    file: 'Road-1x1_upleftuprightdownright' },
  'dl,dr,ul':    { key: 'conn_ul_dl_dr',    file: 'Road-Tile_13_upleftdownleftdownright' },
  'dl,dr,ur':    { key: 'conn_ur_dl_dr',    file: 'Road-Tile_13_uprightdownleftdownright' },
  'dl,dr,ul,ur': { key: 'conn_4',           file: 'Road-1x1_4 sides' },
};

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

  // Pinch-to-zoom
  private isPinching = false;
  private pinchDist0 = 0;
  private pinchZoom0 = 1;

  // Demolish mode
  private demolishMode = false;
  private demolishCol  = -1;
  private demolishRow  = -1;

  // Touch tap-vs-drag disambiguation
  private touchMoved  = false;
  private lastTouchSx = 0;
  private lastTouchSy = 0;

  // Road multi-drag
  private roadDragActive = false;
  private roadDragCells:  { col: number; row: number }[] = [];
  private roadDragOrigin  = { col: 0, row: 0 };
  private roadDragDir: 'h' | 'v' | null = null;

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
    this.touchMoved     = false;
    this.lastTouchSx    = 0;
    this.lastTouchSy    = 0;
    this.roadDragActive = false;
    this.roadDragCells  = [];
    this.roadDragOrigin = { col: 0, row: 0 };
    this.roadDragDir    = null;

    // Restore saved city grid from progressStore
    const saved = useProgressStore.getState().cityGrid as SavedBuilding[];
    if (saved?.length) {
      const allItems = useAdminStore.getState().getEffectiveCats()
        .flatMap(c => c.items);
      const connItems: BuildItem[] = Object.values(ROAD_CONN).map(({ key, file }) =>
        ({ key, label: 'Road Connector', cost: 0, w: 1, d: 1, file })
      );
      const itemByKey = new Map([...allItems, ...connItems].map(i => [i.key, i]));
      saved.forEach(({ key, col, row }) => {
        const item = itemByKey.get(key);
        if (!item) return;
        if (!this.canPlaceDirect(col, row, item)) return;
        for (let dr = 0; dr < item.d; dr++)
          for (let dc = 0; dc < item.w; dc++)
            this.grid[row + dr][col + dc] = { item, anchorCol: col, anchorRow: row };
      });
    }
  }

  private canPlaceDirect(col: number, row: number, item: BuildItem): boolean {
    for (let dr = 0; dr < item.d; dr++)
      for (let dc = 0; dc < item.w; dc++)
        if (col + dc >= GRID || row + dr >= GRID ||
            col + dc < 0   || row + dr < 0   ||
            this.grid[row + dr]?.[col + dc] !== null)
          return false;
    return true;
  }

  private serializeGrid(): SavedBuilding[] {
    const seen = new Set<string>();
    const out: SavedBuilding[] = [];
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        const k = `${cell.anchorCol},${cell.anchorRow}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ key: cell.item.key, col: cell.anchorCol, row: cell.anchorRow });
      }
    return out;
  }

  preload() {
    useAdminStore.getState().getEffectiveCats().forEach(cat =>
      cat.items.forEach(item =>
        this.load.image(item.key, `/Builder/${item.file}.png`)
      )
    );
    Object.values(ROAD_CONN).forEach(({ key, file }) =>
      this.load.image(key, `/Builder/${file}.png`)
    );
  }

  create() {
    this.W = this.cameras.main.width;
    const H = this.cameras.main.height;
    this.originX = this.W / 2;

    // Ensure native touch events reach the canvas on mobile
    this.game.canvas.style.touchAction = 'none';

    EventBus.emit('current-scene-ready', this);

    // ── EventBus listeners ─────────────────────────────────────────────────────
    const onRestart = (d?: { level?: number }) => setTimeout(() => this.scene.restart(d), 0);
    const onSelect  = (item: BuildItem | null) => {
      this.selectedItem   = item;
      this.roadDragActive = false;
      this.roadDragCells  = [];
      this.roadDragDir    = null;
      if (!item) this.clearPreview();
      if (item) { this.demolishMode = false; this.demolishCol = -1; this.demolishRow = -1; this.previewGfx.clear(); }
    };
    const onConfirm = () => {
      if (this.roadDragCells.length > 0) this.confirmRoadMulti();
      else this.confirmPlacement();
    };
    const onCancel  = () => {
      this.selectedItem   = null;
      this.roadDragActive = false;
      this.roadDragCells  = [];
      this.roadDragDir    = null;
      this.clearPreview();
    };

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
      const wasRoad = this.isRoadItem(item);
      for (let dr = 0; dr < item.d; dr++)
        for (let dc = 0; dc < item.w; dc++)
          this.grid[anchorRow + dr][anchorCol + dc] = null;
      if (wasRoad) {
        this.updateRoadConnectors(anchorCol, anchorRow);
      }
      this.redrawBuildings();
      const refund = Math.floor(item.cost / 2);
      if (refund > 0) {
        useProgressStore.getState().addCityCoins(refund);
        this.showCostPopup(refund, anchorCol, anchorRow);
      }
      this.demolishCol  = -1;
      this.demolishRow  = -1;
      this.demolishMode = false;
      this.previewGfx.clear();
      useProgressStore.getState().setCityGrid(this.serializeGrid());
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
    this.redrawBuildings();
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
    if (!this.selectedItem) return;
    const item = this.selectedItem;
    // Tapped cell = south corner of footprint → anchor is top-left
    const ac = col - (item.w - 1);
    const ar = row - (item.d - 1);
    if (!this.canPlace(ac, ar, item)) return;
    this.previewCol = ac;
    this.previewRow = ar;
    // Clear old preview
    if (this.previewSprite) { this.previewSprite.destroy(); this.previewSprite = null; }
    this.previewGfx.clear();
    // Highlight cells
    for (let dr = 0; dr < item.d; dr++)
      for (let dc = 0; dc < item.w; dc++) {
        const { x, y } = this.isoToScreen(ac + dc, ar + dr);
        this.previewGfx.fillStyle(0xFFFFFF, 0.18);
        this.previewGfx.fillPoints([
          { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
          { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
        ], true);
      }
    // Semi-transparent sprite
    const { x, y, targetW } = this.spriteAnchor(ac, ar, item.w, item.d);
    this.previewSprite = this.add.image(x, y, item.key).setOrigin(0.5, 1);
    this.previewSprite.setScale(targetW / this.previewSprite.width);
    this.previewSprite.setAlpha(0.65);
    this.previewSprite.setDepth(50 + ac + ar);
    EventBus.emit('citybuilder-preview-ready', true);
  }

  // ─── Road auto-connector helpers ─────────────────────────────────────────────

  private isRoadItem(item: BuildItem): boolean {
    if (Object.values(ROAD_CONN).some(c => c.key === item.key)) return true;
    const roadCat = useAdminStore.getState().getEffectiveCats().find(c => c.label === 'Road');
    if (!roadCat?.items.some(i => i.key === item.key)) return false;
    return item.label.toLowerCase().startsWith('street');
  }

  private roadDirsAt(col: number, row: number): string[] {
    const dirs: string[] = [];
    const check = (nc: number, nr: number, dir: string) => {
      if (!this.inBounds(nc, nr)) return;
      const cell = this.grid[nr][nc];
      if (cell && this.isRoadItem(cell.item)) dirs.push(dir);
    };
    check(col - 1, row,     'ul');
    check(col,     row - 1, 'ur');
    check(col,     row + 1, 'dl');
    check(col + 1, row,     'dr');
    return dirs.sort();
  }

  private applyConnector(col: number, row: number): boolean {
    const cell = this.grid[row][col];
    if (!cell || !this.isRoadItem(cell.item)) return false;
    const dirs = this.roadDirsAt(col, row);
    if (dirs.length >= 3) {
      const conn = ROAD_CONN[dirs.join(',')];
      if (!conn || cell.item.key === conn.key) return false;
      const connItem: BuildItem = { key: conn.key, label: 'Road Connector', cost: 0, w: 1, d: 1, file: conn.file };
      this.grid[row][col] = { item: connItem, anchorCol: col, anchorRow: row };
      return true;
    }
    if (dirs.length < 3 && Object.values(ROAD_CONN).some(c => c.key === cell.item.key)) {
      // Connector lost enough neighbours — remove it so no tile "transforms" unexpectedly
      this.grid[row][col] = null;
      return true;
    }
    return false;
  }

  private updateRoadConnectors(col: number, row: number) {
    const candidates = [
      [col,     row    ],
      [col - 1, row    ],
      [col,     row - 1],
      [col,     row + 1],
      [col + 1, row    ],
    ];
    for (const [c, r] of candidates) {
      if (this.inBounds(c, r)) this.applyConnector(c, r);
    }
    // Caller is responsible for calling redrawBuildings() afterwards
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
    if (this.isRoadItem(item)) {
      this.updateRoadConnectors(this.previewCol, this.previewRow);
    }
    const placedCol = this.previewCol;
    const placedRow = this.previewRow;
    this.redrawBuildings();
    if (this.previewSprite) { this.previewSprite.destroy(); this.previewSprite = null; }
    this.previewGfx.clear();
    this.previewCol = -1;
    this.previewRow = -1;
    useProgressStore.getState().setCityGrid(this.serializeGrid());
    EventBus.emit('citybuilder-preview-ready', false);
    this.showCostPopup(-item.cost, placedCol, placedRow);
  }

  // ─── Input ────────────────────────────────────────────────────────────────────

  private setupInput() {
    const cam    = this.cameras.main;
    const canvas = this.game.canvas;
    const DRAG_THRESHOLD = 10;

    // ── Phaser pointerdown: desktop (mouse) only ──
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.wasTouch) return;
      if (this.input.pointer2.isDown) {
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
      this.dragStart = { x: ptr.x, y: ptr.y };
      this.camStart  = { x: cam.scrollX, y: cam.scrollY };
    });

    this.input.on('pointerup', () => {
      if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) this.isPinching = false;
    });

    // ── Native touch: primary path on mobile ──
    const screenPt = (t: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (t.clientX - rect.left) * (this.W / rect.width),
        y: (t.clientY - rect.top)  * (cam.height / rect.height),
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        this.roadDragActive = false;
        this.isPinching     = true;
        const t1 = e.touches[0]; const t2 = e.touches[1];
        this.pinchDist0 = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        this.pinchZoom0 = cam.zoom;
        return;
      }
      if (e.touches.length !== 1) return;

      const { x: sx, y: sy } = screenPt(e.touches[0]);
      this.touchMoved  = false;
      this.lastTouchSx = sx;
      this.lastTouchSy = sy;

      // Always store camera drag start — pan is always available
      this.dragStart = { x: sx, y: sy };
      this.camStart  = { x: cam.scrollX, y: cam.scrollY };

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

      // Road multi-drag: begin collecting cells immediately on touch down
      if (this.selectedItem && this.isRoadItem(this.selectedItem)) {
        // Clear any pending road preview from a previous drag
        this.roadDragCells  = [];
        this.roadDragDir    = null;
        this.previewGfx.clear();
        EventBus.emit('citybuilder-preview-ready', false);
        if (this.inBounds(col, row) && this.canPlace(col, row, this.selectedItem)) {
          this.roadDragActive = true;
          this.roadDragOrigin = { col, row };
          this.roadDragCells  = [{ col, row }];
          this.drawRoadDragPreview();
        } else {
          this.roadDragActive = false;
        }
      }
      // setPreview for non-road items is deferred to touchEnd (!touchMoved)
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
      if (e.touches.length !== 1) return;

      const { x: sx, y: sy } = screenPt(e.touches[0]);

      if (!this.touchMoved) {
        if (Math.abs(sx - this.dragStart.x) > DRAG_THRESHOLD ||
            Math.abs(sy - this.dragStart.y) > DRAG_THRESHOLD) {
          this.touchMoved = true;
        }
      }

      if (this.roadDragActive && this.selectedItem && this.roadDragCells.length > 0) {
        // Determine direction from the first movement away from start cell
        const wp = cam.getWorldPoint(sx, sy);
        const { col, row } = this.worldToIso(wp.x, wp.y);
        const start = this.roadDragOrigin;
        if (this.roadDragDir === null && (col !== start.col || row !== start.row)) {
          this.roadDragDir = Math.abs(col - start.col) >= Math.abs(row - start.row) ? 'h' : 'v';
        }
        // Rebuild full straight line from start to current cell
        if (this.roadDragDir !== null) {
          this.rebuildRoadDragLine(col, row);
        }
        this.lastTouchSx = sx;
        this.lastTouchSy = sy;
        e.preventDefault();
        return;
      }

      // Camera pan — always available (even with selectedItem)
      if (this.touchMoved) {
        cam.scrollX = this.camStart.x - (sx - this.dragStart.x) / cam.zoom;
        cam.scrollY = this.camStart.y - (sy - this.dragStart.y) / cam.zoom;
      }
      this.lastTouchSx = sx;
      this.lastTouchSy = sy;
      e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (this.roadDragActive) {
        this.roadDragActive = false;
        if (this.roadDragCells.length > 0) {
          // Keep preview visible; confirm/cancel buttons handle placement
          EventBus.emit('citybuilder-preview-ready', true);
        } else {
          this.previewGfx.clear();
        }
      } else if (!this.touchMoved && this.selectedItem) {
        // Pure tap: set preview at touch-down position
        const wp = cam.getWorldPoint(this.lastTouchSx, this.lastTouchSy);
        const { col, row } = this.worldToIso(wp.x, wp.y);
        if (this.inBounds(col, row)) this.setPreview(col, row);
      }
      this.isPinching = false;
      this.touchMoved = false;
      e.preventDefault();
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    });
  }

  // ─── Road multi-drag preview ──────────────────────────────────────────────────

  private drawRoadDragPreview() {
    this.previewGfx.clear();
    for (const { col, row } of this.roadDragCells) {
      const { x, y } = this.isoToScreen(col, row);
      this.previewGfx.fillStyle(0xFFFFFF, 0.25);
      this.previewGfx.fillPoints([
        { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
        { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
      ], true);
      this.previewGfx.lineStyle(2, 0xFFFFFF, 0.85);
      this.previewGfx.strokePoints([
        { x, y: y - TILE_HH }, { x: x + TILE_HW, y },
        { x, y: y + TILE_HH }, { x: x - TILE_HW, y },
      ], true);
    }
  }

  // ─── Road multi-drag straight-line rebuild ────────────────────────────────────

  private rebuildRoadDragLine(targetCol: number, targetRow: number) {
    if (!this.selectedItem) return;
    const start = this.roadDragOrigin;
    const newCells: { col: number; row: number }[] = [];
    if (this.roadDragDir === 'h') {
      const minC = Math.min(start.col, targetCol);
      const maxC = Math.max(start.col, targetCol);
      for (let c = minC; c <= maxC; c++) {
        if (this.inBounds(c, start.row) && this.canPlace(c, start.row, this.selectedItem))
          newCells.push({ col: c, row: start.row });
      }
    } else if (this.roadDragDir === 'v') {
      const minR = Math.min(start.row, targetRow);
      const maxR = Math.max(start.row, targetRow);
      for (let r = minR; r <= maxR; r++) {
        if (this.inBounds(start.col, r) && this.canPlace(start.col, r, this.selectedItem))
          newCells.push({ col: start.col, row: r });
      }
    }
    this.roadDragCells = newCells.length > 0 ? newCells : [start];
    this.drawRoadDragPreview();
  }

  // ─── Road multi-drag confirm ──────────────────────────────────────────────────

  private confirmRoadMulti() {
    if (!this.selectedItem || this.roadDragCells.length === 0) return;
    const item     = this.selectedItem;
    const perCell  = item.cost;
    const placeable = this.roadDragCells.filter(({ col, row }) => this.canPlace(col, row, item));

    const clear = () => {
      this.roadDragCells  = [];
      this.roadDragDir    = null;
      this.previewGfx.clear();
      EventBus.emit('citybuilder-preview-ready', false);
    };

    if (placeable.length === 0) { clear(); return; }

    const coins = useProgressStore.getState().cityCoins;
    if (perCell > 0 && coins < perCell) {
      this.showToast(`Need 🪙${perCell} coins!`); clear(); return;
    }
    const affordable = perCell > 0 ? Math.min(placeable.length, Math.floor(coins / perCell)) : placeable.length;
    const toPlace = placeable.slice(0, affordable);

    const firstCell = toPlace[0];
    for (const { col, row } of toPlace) {
      this.grid[row][col] = { item, anchorCol: col, anchorRow: row };
    }
    if (perCell > 0) useProgressStore.getState().addCityCoins(-perCell * toPlace.length);
    for (const { col, row } of toPlace) this.updateRoadConnectors(col, row);
    this.redrawBuildings();
    this.showCostPopup(-perCell * toPlace.length, firstCell.col, firstCell.row);
    useProgressStore.getState().setCityGrid(this.serializeGrid());
    clear();
  }

  // ─── Cost popup ───────────────────────────────────────────────────────────────

  private showCostPopup(amount: number, col: number, row: number) {
    if (amount === 0) return;
    const { x, y } = this.isoToScreen(col, row);
    const label = amount > 0 ? `+${amount} 🪙` : `${amount} 🪙`;
    const popup = this.add.text(x, y - 10, label, {
      fontFamily: 'Fredoka One', fontSize: '22px', color: '#FACC15',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(200);
    this.tweens.add({
      targets: popup, y: y - 80, alpha: 0,
      duration: 1100, ease: 'Cubic.Out',
      onComplete: () => popup.destroy(),
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
      const ac = col - (w - 1);
      const ar = row - (d - 1);
      const canP = this.canPlace(ac, ar, this.selectedItem);
      for (let dr = 0; dr < d; dr++)
        for (let dc = 0; dc < w; dc++) {
          if (!this.inBounds(ac + dc, ar + dr)) continue;
          const { x, y } = this.isoToScreen(ac + dc, ar + dr);
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
