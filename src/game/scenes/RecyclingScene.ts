import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID      = 8;
const MAX_MISTAKES    = 5;
const COINS_PER_CATCH = 4;
const ITEM_DISPLAY    = 64;
const HINT_COUNT      = 15;
const INITIAL_ACTIVE  = 3;
const ITEMS_PER_LEVEL = 4;

const CATS = [
  { key: 'ewaste',  label: 'E-Waste',  binTex: 'bin-grey',   itemPrefix: 'ewaste',  itemCount: 5 },
  { key: 'glass',   label: 'Glass',    binTex: 'bin-green',  itemPrefix: 'glass',   itemCount: 5 },
  { key: 'metal',   label: 'Metal',    binTex: 'bin-red',    itemPrefix: 'metal',   itemCount: 6 },
  { key: 'organic', label: 'Organic',  binTex: 'bin-orange', itemPrefix: 'organic', itemCount: 6 },
  { key: 'paper',   label: 'Paper',    binTex: 'bin-blue',   itemPrefix: 'paper',   itemCount: 7 },
  { key: 'plastic', label: 'Plastic',  binTex: 'bin-yellow', itemPrefix: 'plastic', itemCount: 5 },
] as const;

type CatKey = typeof CATS[number]['key'];

// Order in which bins are unlocked; first INITIAL_ACTIVE are active from the start
const BIN_ORDER: CatKey[] = ['organic', 'paper', 'glass', 'plastic', 'metal', 'ewaste'];

interface BeltItem {
  container: Phaser.GameObjects.Container;
  cat: CatKey;
  phase: 'belt1' | 'belt2' | 'belt3' | 'falling' | 'done';
  vX: number;
  vY: number;
  hintText?: Phaser.GameObjects.Text; // separate (non-rotating) label
}

export class RecyclingScene extends Phaser.Scene {
  private score        = 0;
  private mistakes     = 0;
  private sessionCoins = 0;
  private gameOver     = false;
  private spawnedTotal = 0;
  private activeBinCount = INITIAL_ACTIVE;
  private nextLevelScore = ITEMS_PER_LEVEL;

  private W  = 0;
  private H  = 0;
  private BW = 0;
  private BH = 0;

  private belt1Y = 0;
  private belt2Y = 0;
  private belt3Y = 0;
  private binsY  = 0;

  private binGroupX     = 0;
  private binMinX       = 0;
  private binMaxX       = 0;
  private isDragging    = false;
  private dragStartX    = 0;
  private dragStartBinX = 0;

  private items: BeltItem[] = [];

  private binImages:     Phaser.GameObjects.Image[] = [];
  private binLabelTexts: Phaser.GameObjects.Text[]  = [];
  private highlightGfx!: Phaser.GameObjects.Graphics;

  private hudCoins!:  Phaser.GameObjects.Text;
  private hudScored!: Phaser.GameObjects.Text;
  private hudBest!:   Phaser.GameObjects.Text;
  private hudLives!:  Phaser.GameObjects.Text;

  constructor() { super('RecyclingScene'); }

  init() {
    this.score          = 0;
    this.mistakes       = 0;
    this.sessionCoins   = 0;
    this.gameOver       = false;
    this.isDragging     = false;
    this.spawnedTotal   = 0;
    this.activeBinCount = INITIAL_ACTIVE;
    this.nextLevelScore = ITEMS_PER_LEVEL;
    this.items          = [];
    this.binImages      = [];
    this.binLabelTexts  = [];
  }

  preload() {
    for (const c of ['blue','green','grey','orange','red','yellow'] as const) {
      this.load.image(`bin-${c}`, `/recycling/Bin_${c}.png`);
    }
    const itemDefs: Array<{ key: CatKey; prefix: string; count: number }> = [
      { key: 'ewaste',  prefix: 'electric', count: 5 },
      { key: 'glass',   prefix: 'glass',    count: 5 },
      { key: 'metal',   prefix: 'metal',    count: 6 },
      { key: 'organic', prefix: 'organic',  count: 6 },
      { key: 'paper',   prefix: 'Paper',    count: 7 },
      { key: 'plastic', prefix: 'Plastic',  count: 5 },
    ];
    for (const { key, prefix, count } of itemDefs) {
      for (let i = 1; i <= count; i++) {
        this.load.image(`${key}-${i}`, `/recycling/${prefix}_${i}.png`);
      }
    }
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    this.W = W; this.H = H;

    this.belt1Y = H * 0.22;   // pushed down to leave room for top HUD
    this.belt2Y = H * 0.36;
    this.belt3Y = H * 0.50;
    this.binsY  = H * 0.72;
    this.BW     = Math.floor(W / 3);
    this.BH     = Math.min(H * 0.20, 175);

    this.binGroupX = 0;       // centre bin of initial 3 at the drop point
    this.updateBinLayout();   // sets binMin/MaxX and clamps binGroupX

    EventBus.emit('current-scene-ready', this);
    const onRestart = () => setTimeout(() => this.scene.restart(), 0);
    EventBus.on('restart-scene', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', onRestart));

    this.drawBackground();
    this.buildHud();
    this.drawBelts();
    this.drawDropZoneLine();
    this.buildBins();
    this.setupInput();

    this.time.delayedCall(1400, () => this.spawnTick());
  }

  update(_t: number, delta: number) {
    if (this.gameOver || this.items.length === 0) return;
    const dt = delta / 1000;

    for (const item of this.items) {
      if (item.phase === 'done') continue;

      if (item.phase === 'belt1') {
        item.container.x += item.vX * dt;
        item.container.angle -= 0.9;
        if (item.container.x <= ITEM_DISPLAY / 2) {
          item.phase = 'belt2';
          item.container.x = ITEM_DISPLAY / 2;
          item.container.y = this.belt2Y;
          item.vX = Math.abs(item.vX);
        }
      } else if (item.phase === 'belt2') {
        item.container.x += item.vX * dt;
        item.container.angle -= 0.5;
        if (item.container.x >= this.W - ITEM_DISPLAY / 2) {
          item.phase = 'belt3';
          item.container.x = this.W - ITEM_DISPLAY / 2;
          item.container.y = this.belt3Y;
          item.vX = -Math.abs(item.vX);
        }
      } else if (item.phase === 'belt3') {
        item.container.x += item.vX * dt;
        item.container.angle -= 0.9;
        if (item.container.x <= this.W / 2) {
          item.phase = 'falling';
          item.container.x = this.W / 2;
          item.vX = 0;
          item.vY = 460;
        }
      } else if (item.phase === 'falling') {
        item.vY += 360 * dt;
        item.container.y += item.vY * dt;
        item.container.angle += 2;
        if (item.container.y >= this.binsY - 10) {
          item.phase = 'done';
          this.resolveItem(item);
        }
      }

      // Keep hint label horizontal above the spinning container
      if (item.hintText?.active) {
        item.hintText.setPosition(item.container.x, item.container.y - ITEM_DISPLAY * 0.70);
      }
    }
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground() {
    const g = this.add.graphics().setDepth(-10);
    g.fillGradientStyle(0x0F172A, 0x0F172A, 0x1A2744, 0x1A2744, 1);
    g.fillRect(0, 0, this.W, this.H);
  }

  // ─── HUD (top strip — matches ThrowToBin layout) ─────────────────────────────

  private buildHud() {
    const W = this.W;
    const BACK_END = 64, stripH = 78;
    const hudW  = W - BACK_END;
    const hudCX = BACK_END + hudW / 2;

    this.add.rectangle(hudCX, stripH / 2, hudW, stripH, 0x000000, 0.52)
      .setDepth(48).setScrollFactor(0);
    this.add.rectangle(hudCX, stripH, hudW, 1.5, 0xFFFFFF, 0.10)
      .setDepth(49).setScrollFactor(0);

    this.ensureHudTextures();

    const col1 = BACK_END + hudW * 0.14;
    const col2 = BACK_END + hudW * 0.48;
    const col3 = BACK_END + hudW * 0.76;
    const labelY = 17, valueY = 53;

    const mkLabel = (x: number, txt: string, col: string) =>
      this.add.text(x, labelY, txt, {
        fontFamily: 'Fredoka One, cursive', fontSize: '16px',
        color: col, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(50).setScrollFactor(0).setResolution(2);

    mkLabel(col1, 'City Coins', '#93C5FD');
    mkLabel(col2, 'Score',      '#86EFAC');
    mkLabel(col3, 'My Record',  '#FDE68A');

    const iconSize = 22, iconOffX = 13;
    const valStyle = { fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#fff', stroke: '#000', strokeThickness: 3 };

    this.add.image(col1 - iconOffX, valueY, 'hud-coin').setDisplaySize(iconSize, iconSize).setDepth(50).setScrollFactor(0);
    this.add.image(col2 - iconOffX, valueY, 'hud-bin' ).setDisplaySize(iconSize, iconSize).setDepth(50).setScrollFactor(0);
    this.add.image(col3 - iconOffX, valueY, 'hud-star').setDisplaySize(iconSize, iconSize).setDepth(50).setScrollFactor(0);

    this.hudCoins  = this.add.text(col1 + iconOffX - 8, valueY, '0', valStyle).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0).setResolution(2);
    this.hudScored = this.add.text(col2 + iconOffX - 8, valueY, '0', valStyle).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0).setResolution(2);
    this.hudBest   = this.add.text(col3 + iconOffX - 8, valueY, '0', valStyle).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0).setResolution(2);

    // Lives: compact indicator at far right of top strip
    this.hudLives = this.add.text(W - 10, valueY, `❤️ ×${MAX_MISTAKES}`, {
      fontFamily: 'Fredoka One, cursive', fontSize: '18px', color: '#FCA5A5',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(50).setScrollFactor(0).setResolution(2);

    this.refreshHud();

    // Instruction label just below the HUD strip
    this.add.text(W / 2, stripH + 8, '♻️  Sort the waste into the right bin!', {
      fontFamily: 'Fredoka One, cursive', fontSize: '12px',
      color: '#94A3B8', stroke: '#000', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5, 0).setDepth(6).setResolution(2);
  }

  private ensureHudTextures() {
    if (!this.textures.exists('hud-coin')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xFFD700); g.fillCircle(13, 13, 12);
      g.lineStyle(2, 0xC49A00); g.strokeCircle(13, 13, 12);
      g.fillStyle(0xFFFFFF, 0.30); g.fillCircle(9, 9, 4.5);
      g.generateTexture('hud-coin', 26, 26); g.destroy();
    }
    if (!this.textures.exists('hud-bin')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x15803D); g.fillRoundedRect(9, 1, 8, 5, 2.5);
      g.fillStyle(0x16A34A); g.fillRoundedRect(2, 4, 22, 5, 2.5);
      g.fillStyle(0x15803D); g.fillRoundedRect(3, 9, 20, 17, { tl: 0, tr: 0, bl: 4, br: 4 });
      [7, 12, 17].forEach(x => { g.fillStyle(0xFFFFFF, 0.22); g.fillRect(x, 11, 3, 13); });
      g.generateTexture('hud-bin', 26, 28); g.destroy();
    }
    if (!this.textures.exists('hud-star')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xFFD700);
      const cx = 13, cy = 13, R = 11, r = 4.5, pts = 5;
      g.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const a   = (i * Math.PI / pts) - Math.PI / 2;
        const rad = i % 2 === 0 ? R : r;
        if (i === 0) g.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        else         g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      g.closePath(); g.fillPath();
      g.generateTexture('hud-star', 26, 26); g.destroy();
    }
  }

  private refreshHud() {
    const state = useProgressStore.getState();
    this.hudCoins .setText(String(state.cityCoins ?? 0));
    this.hudScored.setText(String(this.score));
    this.hudBest  .setText(String(Math.max(state.highScores?.[MISSION_ID] ?? 0, this.score)));
    const rem = MAX_MISTAKES - this.mistakes;
    this.hudLives .setText(rem > 0 ? `❤️ ×${rem}` : '💔 ×0');
  }

  // ─── Belts ───────────────────────────────────────────────────────────────────

  private drawBelts() {
    const g = this.add.graphics().setDepth(5);
    const BELT_H = 44, W = this.W;

    const drawBelt = (x: number, y: number, w: number, goLeft: boolean) => {
      g.fillStyle(0x000000, 0.30);
      g.fillRoundedRect(x, y - BELT_H / 2 + 3, w, BELT_H, 8);
      g.fillStyle(0x374151, 1);
      g.fillRoundedRect(x, y - BELT_H / 2, w, BELT_H, 8);
      g.fillStyle(0xFFFFFF, 0.07);
      g.fillRoundedRect(x, y - BELT_H / 2, w, BELT_H * 0.4, { tl: 8, tr: 8, bl: 0, br: 0 });
      g.lineStyle(1.5, 0x4B5563, 0.8);
      g.lineBetween(x, y - BELT_H / 2, x + w, y - BELT_H / 2);
      g.lineBetween(x, y + BELT_H / 2, x + w, y + BELT_H / 2);
      const step = 54;
      for (
        let tx = goLeft ? x + w - 20 : x + 20;
        goLeft ? tx > x + 10 : tx < x + w - 10;
        goLeft ? tx -= step : tx += step
      ) {
        g.fillStyle(0x6B7280, 0.45);
        if (goLeft) g.fillTriangle(tx - 9, y, tx + 7, y - 7, tx + 7, y + 7);
        else        g.fillTriangle(tx + 9, y, tx - 7, y - 7, tx - 7, y + 7);
      }
    };

    drawBelt(0,     this.belt1Y, W,     true);   // full width, right→left
    drawBelt(0,     this.belt2Y, W,     false);  // full width, left→right
    drawBelt(W / 2, this.belt3Y, W / 2, true);   // right half, right→centre

    // Left chute (belt1→belt2) and right chute (belt2→belt3)
    g.fillStyle(0x374151, 1);
    g.fillRect(0,      this.belt1Y + BELT_H / 2 - 2, 18, this.belt2Y - this.belt1Y - BELT_H + 4);
    g.fillRect(W - 18, this.belt2Y + BELT_H / 2 - 2, 18, this.belt3Y - this.belt2Y - BELT_H + 4);

    // Direction arrows
    this.add.text(W - 10, this.belt1Y, '←', { fontFamily: 'Fredoka One', fontSize: '18px', color: '#9CA3AF' })
      .setOrigin(1, 0.5).setDepth(6).setResolution(2);
    this.add.text(10,     this.belt2Y, '→', { fontFamily: 'Fredoka One', fontSize: '18px', color: '#9CA3AF' })
      .setOrigin(0, 0.5).setDepth(6).setResolution(2);
    this.add.text(W - 10, this.belt3Y, '←', { fontFamily: 'Fredoka One', fontSize: '18px', color: '#9CA3AF' })
      .setOrigin(1, 0.5).setDepth(6).setResolution(2);
  }

  // ─── Drop zone ───────────────────────────────────────────────────────────────

  private drawDropZoneLine() {
    const g = this.add.graphics().setDepth(8);
    const x = this.W / 2;
    let y = this.belt3Y + 26;
    while (y < this.binsY - 22) {
      g.lineStyle(1.5, 0xFFFFFF, 0.18);
      g.lineBetween(x, y, x, y + 12);
      y += 20;
    }
  }

  // ─── Bins ────────────────────────────────────────────────────────────────────

  private buildBins() {
    this.highlightGfx = this.add.graphics().setDepth(29);
    for (let i = 0; i < INITIAL_ACTIVE; i++) this.createBinAt(i);
    this.repositionBins();
  }

  private createBinAt(orderIdx: number) {
    const key = BIN_ORDER[orderIdx];
    const cat = CATS.find(c => c.key === key)!;

    const img = this.add.image(0, this.binsY, cat.binTex)
      .setOrigin(0.5, 0).setDisplaySize(this.BW * 0.88, this.BH).setDepth(30);
    this.binImages.push(img);

    const lbl = this.add.text(0, this.binsY + this.BH - 16, cat.label, {
      fontFamily: 'Fredoka One, cursive', fontSize: '13px',
      color: '#fff', stroke: '#000', strokeThickness: 2.5, align: 'center',
    }).setOrigin(0.5, 1).setDepth(32).setResolution(2);
    this.binLabelTexts.push(lbl);
  }

  private updateBinLayout() {
    const N = this.binImages.length || INITIAL_ACTIVE;
    this.binMaxX   = this.W / 2 - this.BW / 2;
    this.binMinX   = this.W / 2 - (N - 0.5) * this.BW;
    this.binGroupX = Phaser.Math.Clamp(this.binGroupX, this.binMinX, this.binMaxX);
    if (this.highlightGfx) this.repositionBins();
  }

  private repositionBins() {
    this.highlightGfx.clear();
    const dropIdx = this.binAtDrop();

    for (let i = 0; i < this.binImages.length; i++) {
      const cx = this.binGroupX + i * this.BW + this.BW / 2;
      this.binImages[i].setX(cx);
      this.binLabelTexts[i].setX(cx);
    }

    const ax = this.W / 2, ay = this.binsY - 18;
    this.highlightGfx.fillStyle(0xFFFFFF, 0.55);
    this.highlightGfx.fillTriangle(ax - 11, ay - 10, ax + 11, ay - 10, ax, ay);

    if (dropIdx >= 0) {
      const cx = this.binGroupX + dropIdx * this.BW + this.BW / 2;
      this.highlightGfx.lineStyle(3.5, 0xFFFFFF, 0.9);
      this.highlightGfx.strokeRoundedRect(cx - this.BW * 0.45, this.binsY - 4, this.BW * 0.9, this.BH + 4, 8);
    }
  }

  private binAtDrop(): number {
    const drop = this.W / 2;
    for (let i = 0; i < this.binImages.length; i++) {
      if (Math.abs(this.binGroupX + i * this.BW + this.BW / 2 - drop) < this.BW * 0.55) return i;
    }
    return -1;
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return;
      this.isDragging    = true;
      this.dragStartX    = p.x;
      this.dragStartBinX = this.binGroupX;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.gameOver) return;
      this.binGroupX = Phaser.Math.Clamp(
        this.dragStartBinX + (p.x - this.dragStartX),
        this.binMinX, this.binMaxX,
      );
      this.repositionBins();
    });
    this.input.on('pointerup', () => { this.isDragging = false; });
  }

  // ─── Spawning ────────────────────────────────────────────────────────────────

  private getSpawnInterval(): number {
    if (this.score >= 14) return 4000;
    if (this.score >= 7)  return 5000;
    return 6000;
  }

  private spawnTick() {
    if (this.gameOver) return;
    this.spawnItem();
    this.time.delayedCall(this.getSpawnInterval(), () => this.spawnTick());
  }

  private spawnItem() {
    if (this.gameOver) return;

    // Only spawn from currently active categories
    const activeCatKeys = BIN_ORDER.slice(0, this.activeBinCount) as string[];
    const activeCats    = CATS.filter(c => activeCatKeys.includes(c.key));
    const cat  = activeCats[Math.floor(Math.random() * activeCats.length)];
    const idx  = Math.floor(Math.random() * cat.itemCount) + 1;
    const tex  = `${cat.key}-${idx}`;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.28);
    shadow.fillEllipse(0, ITEM_DISPLAY * 0.52, ITEM_DISPLAY * 0.9, ITEM_DISPLAY * 0.28);

    const img = this.add.image(0, 0, tex)
      .setDisplaySize(ITEM_DISPLAY, ITEM_DISPLAY).setOrigin(0.5);

    const container = this.add.container(this.W + ITEM_DISPLAY, this.belt1Y, [shadow, img]);
    container.setDepth(40);

    const speed = Phaser.Math.Clamp(80 + this.score * 4, 80, 160);
    const item: BeltItem = { container, cat: cat.key as CatKey, phase: 'belt1', vX: -speed, vY: 0 };

    // Category hint: separate text (not in container) so it doesn't rotate
    if (this.spawnedTotal < HINT_COUNT) {
      item.hintText = this.add.text(
        this.W + ITEM_DISPLAY,
        this.belt1Y - ITEM_DISPLAY * 0.70,
        cat.label,
        {
          fontFamily: 'Fredoka One, cursive', fontSize: '13px',
          color: '#FFFFFF', stroke: '#000000', strokeThickness: 3,
          backgroundColor: 'rgba(0,0,0,0.55)',
          padding: { x: 6, y: 3 },
        }
      ).setOrigin(0.5, 1).setResolution(2).setDepth(42);
    }
    this.spawnedTotal++;

    this.items.push(item);
  }

  // ─── Resolution ──────────────────────────────────────────────────────────────

  private resolveItem(item: BeltItem) {
    if (this.gameOver) {
      item.hintText?.destroy();
      item.container.destroy();
      return;
    }

    // Hide hint immediately on resolution
    if (item.hintText?.active) item.hintText.destroy();

    const hitIdx = this.binAtDrop();
    // Correctness: check against BIN_ORDER (bin images are in BIN_ORDER sequence)
    const correct = hitIdx >= 0 && BIN_ORDER[hitIdx] === item.cat;

    if (correct) {
      this.score++;
      this.sessionCoins += COINS_PER_CATCH;
      useProgressStore.getState().addCityCoins(COINS_PER_CATCH);
      this.showFeedback(true, hitIdx);

      if (this.activeBinCount < 6 && this.score >= this.nextLevelScore) {
        this.nextLevelScore += ITEMS_PER_LEVEL;
        this.activeBinCount++;
        this.unlockNextBin();
      }
    } else {
      this.mistakes++;
      this.showFeedback(false, hitIdx);
      this.cameras.main.shake(200, 0.011);
    }
    this.refreshHud();

    this.time.delayedCall(450, () => {
      const idx = this.items.indexOf(item);
      if (idx >= 0) this.items.splice(idx, 1);
      if (item.container?.active) item.container.destroy();
      if (this.gameOver) return;
      if (this.mistakes >= MAX_MISTAKES) this.triggerGameOver();
    });
  }

  // ─── Level-up ────────────────────────────────────────────────────────────────

  private unlockNextBin() {
    const newKey = BIN_ORDER[this.activeBinCount - 1];
    const cat    = CATS.find(c => c.key === newKey);

    // Add new bin to the layout
    this.createBinAt(this.activeBinCount - 1);
    this.updateBinLayout();

    // Golden screen flash
    const flash = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0xF6C90E, 0.20).setDepth(89);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });

    // "LEVEL UP!" message — fades in, holds ~3 s, fades out
    const label = cat?.label ?? newKey;
    const t = this.add.text(
      this.W / 2, this.H * 0.44,
      `⬆️ LEVEL UP!\nNew category unlocked:\n${label}`,
      {
        fontFamily: 'Fredoka One, cursive', fontSize: '28px',
        color: '#F6C90E', stroke: '#000000', strokeThickness: 5,
        align: 'center', lineSpacing: 4,
      }
    ).setOrigin(0.5).setDepth(100).setResolution(2).setAlpha(0);

    this.tweens.add({
      targets: t, alpha: 1, duration: 350,
      onComplete: () => {
        this.tweens.add({
          targets: t, alpha: 0, delay: 2500, duration: 600,
          onComplete: () => t.destroy(),
        });
      },
    });
  }

  // ─── Feedback ────────────────────────────────────────────────────────────────

  private showFeedback(correct: boolean, binIdx: number) {
    const x = this.W / 2, y = this.binsY - 26;
    const t = this.add.text(x, y, correct ? `✅ +${COINS_PER_CATCH} 🪙` : '❌ Wrong bin!', {
      fontFamily: 'Fredoka One, cursive', fontSize: '28px',
      color: correct ? '#4ADE80' : '#EF4444',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80).setResolution(2);

    this.tweens.add({
      targets: t, y: y - 68, alpha: 0, duration: 750, ease: 'Power2',
      onComplete: () => t.destroy(),
    });

    if (correct && binIdx >= 0) {
      const fx = this.add.graphics().setDepth(33);
      const bx = this.binGroupX + binIdx * this.BW + this.BW / 2;
      fx.fillStyle(0xFFFFFF, 0.35);
      fx.fillRoundedRect(bx - this.BW * 0.45, this.binsY, this.BW * 0.9, this.BH, 8);
      this.tweens.add({ targets: fx, alpha: 0, duration: 350, onComplete: () => fx.destroy() });
    }
  }

  // ─── Game over ───────────────────────────────────────────────────────────────

  private triggerGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;

    for (const item of this.items) {
      if (item.hintText?.active) item.hintText.destroy();
      if (item.container?.active) item.container.destroy();
    }
    this.items = [];

    const state = useProgressStore.getState();
    state.updateHighScore(MISSION_ID, this.score);

    const flash = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0xFF0000, 0.28).setDepth(90);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });

    this.time.delayedCall(700, () => EventBus.emit('game-over-recycling', {
      scored:       this.score,
      wasNewRecord: this.score > (state.highScores?.[MISSION_ID] ?? 0),
      prevBest:     state.highScores?.[MISSION_ID] ?? 0,
      coinsEarned:  this.sessionCoins,
      totalCoins:   state.cityCoins,
    }));
  }
}
