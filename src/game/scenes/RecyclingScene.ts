import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID      = 8;
const MAX_MISTAKES    = 5;
const COINS_PER_CATCH = 4;
const ITEM_DISPLAY    = 64; // px for item sprite

const CATS = [
  { key: 'ewaste',  label: 'E-Waste',  binTex: 'bin-grey',   itemPrefix: 'ewaste',  itemCount: 5 },
  { key: 'glass',   label: 'Glass',    binTex: 'bin-green',  itemPrefix: 'glass',   itemCount: 5 },
  { key: 'metal',   label: 'Metal',    binTex: 'bin-red',    itemPrefix: 'metal',   itemCount: 6 },
  { key: 'organic', label: 'Organic',  binTex: 'bin-orange', itemPrefix: 'organic', itemCount: 6 },
  { key: 'paper',   label: 'Paper',    binTex: 'bin-blue',   itemPrefix: 'paper',   itemCount: 7 },
  { key: 'plastic', label: 'Plastic',  binTex: 'bin-yellow', itemPrefix: 'plastic', itemCount: 5 },
] as const;

type CatKey = typeof CATS[number]['key'];

interface BeltItem {
  container: Phaser.GameObjects.Container;
  cat: CatKey;
  phase: 'belt1' | 'belt2' | 'falling' | 'done';
}

export class RecyclingScene extends Phaser.Scene {
  private score        = 0;
  private mistakes     = 0;
  private sessionCoins = 0;
  private gameOver     = false;

  private W  = 0;
  private H  = 0;
  private BW = 0;
  private BH = 0;

  private belt1Y = 0;
  private belt2Y = 0;
  private binsY  = 0;

  private binGroupX  = 0;
  private binMinX    = 0;
  private binMaxX    = 0;
  private isDragging    = false;
  private dragStartX    = 0;
  private dragStartBinX = 0;

  private currentItem: BeltItem | null = null;
  private itemVX = 0;
  private itemVY = 0;

  private binImages:     Phaser.GameObjects.Image[] = [];
  private binLabelTexts: Phaser.GameObjects.Text[]  = [];
  private highlightGfx!: Phaser.GameObjects.Graphics;

  private livesTexts: Phaser.GameObjects.Text[] = [];
  private hudCoins!:  Phaser.GameObjects.Text;
  private hudScored!: Phaser.GameObjects.Text;
  private hudBest!:   Phaser.GameObjects.Text;

  constructor() { super('RecyclingScene'); }

  init() {
    this.score        = 0;
    this.mistakes     = 0;
    this.sessionCoins = 0;
    this.gameOver     = false;
    this.isDragging   = false;
    this.currentItem  = null;
    this.binImages     = [];
    this.binLabelTexts = [];
    this.livesTexts    = [];
  }

  preload() {
    // Bin images
    for (const c of ['blue','green','grey','orange','red','yellow'] as const) {
      this.load.image(`bin-${c}`, `/recycling/Bin_${c}.png`);
    }
    // Item images by category
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
    this.W = W;  this.H = H;

    this.belt1Y = H * 0.14;
    this.belt2Y = H * 0.28;
    this.binsY  = H * 0.62;
    this.BW     = Math.floor(W / 3);
    this.BH     = Math.min(H * 0.24, 200);

    this.binMinX   = W / 2 - 5 * this.BW - this.BW / 2;
    this.binMaxX   = W / 2 - this.BW / 2;
    this.binGroupX = Phaser.Math.Clamp(W / 2 - 2 * this.BW - this.BW / 2, this.binMinX, this.binMaxX);

    EventBus.emit('current-scene-ready', this);

    const onRestart = () => setTimeout(() => this.scene.restart(), 0);
    EventBus.on('restart-scene', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', onRestart));

    this.drawBackground();
    this.drawBelts();
    this.drawDropZoneLine();
    this.buildBins();
    this.buildHud();
    this.buildLives();
    this.setupInput();

    this.scheduleItem(1400);
  }

  update(_t: number, delta: number) {
    if (this.gameOver || !this.currentItem) return;
    const dt   = delta / 1000;
    const item = this.currentItem;

    if (item.phase === 'belt1') {
      item.container.x += this.itemVX * dt;
      item.container.angle -= 0.9;
      if (item.container.x <= ITEM_DISPLAY / 2) {
        item.phase = 'belt2';
        item.container.x = ITEM_DISPLAY / 2;
        item.container.y = this.belt2Y;
        this.itemVX = -this.itemVX;
      }
    } else if (item.phase === 'belt2') {
      item.container.x += this.itemVX * dt;
      item.container.angle -= 0.5;
      if (item.container.x >= this.W / 2) {
        item.phase = 'falling';
        item.container.x = this.W / 2;
        this.itemVX = 0;
        this.itemVY = 460;
      }
    } else if (item.phase === 'falling') {
      this.itemVY += 360 * dt;
      item.container.y += this.itemVY * dt;
      item.container.angle += 2;
      if (item.container.y >= this.binsY - 10) {
        item.phase = 'done';
        this.resolveItem(item);
      }
    }
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground() {
    const g = this.add.graphics().setDepth(-10);
    g.fillGradientStyle(0x0F172A, 0x0F172A, 0x1A2744, 0x1A2744, 1);
    g.fillRect(0, 0, this.W, this.H);
  }

  // ─── Belts ───────────────────────────────────────────────────────────────────

  private drawBelts() {
    const g = this.add.graphics().setDepth(5);
    const BELT_H = 46, W = this.W;

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
      for (let tx = goLeft ? x + w - 20 : x + 20; goLeft ? tx > x + 10 : tx < x + w - 10; goLeft ? tx -= step : tx += step) {
        g.fillStyle(0x6B7280, 0.45);
        if (goLeft) g.fillTriangle(tx - 9, y, tx + 7, y - 7, tx + 7, y + 7);
        else        g.fillTriangle(tx + 9, y, tx - 7, y - 7, tx - 7, y + 7);
      }
    };

    drawBelt(0, this.belt1Y, W,     true);   // full width, right→left
    drawBelt(0, this.belt2Y, W / 2, false);  // left half, left→right

    // Chute linking the two belts at the left edge
    g.fillStyle(0x374151, 1);
    g.fillRect(0, this.belt1Y + BELT_H / 2 - 2, 18, this.belt2Y - this.belt1Y - BELT_H / 2 + 4);

    // Instruction label
    this.add.text(W / 2, this.belt1Y - 28, '♻️  Sort the waste into the right bin!', {
      fontFamily: 'Fredoka One, cursive', fontSize: '13px',
      color: '#94A3B8', stroke: '#000', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5).setDepth(6).setResolution(2);

    // Direction labels
    this.add.text(W - 10,     this.belt1Y, '←', { fontFamily: 'Fredoka One', fontSize: '18px', color: '#9CA3AF' })
      .setOrigin(1, 0.5).setDepth(6).setResolution(2);
    this.add.text(W / 2 - 6, this.belt2Y, '→', { fontFamily: 'Fredoka One', fontSize: '18px', color: '#9CA3AF' })
      .setOrigin(1, 0.5).setDepth(6).setResolution(2);
  }

  // ─── Drop zone ───────────────────────────────────────────────────────────────

  private drawDropZoneLine() {
    const g = this.add.graphics().setDepth(8);
    const x = this.W / 2;
    let y = this.belt2Y + 27;
    while (y < this.binsY - 24) {
      g.lineStyle(1.5, 0xFFFFFF, 0.18);
      g.lineBetween(x, y, x, y + 12);
      y += 20;
    }
  }

  // ─── Bins ────────────────────────────────────────────────────────────────────

  private buildBins() {
    this.highlightGfx = this.add.graphics().setDepth(29);

    for (let i = 0; i < 6; i++) {
      const cat = CATS[i];

      const img = this.add.image(0, this.binsY, cat.binTex)
        .setOrigin(0.5, 0)
        .setDisplaySize(this.BW * 0.88, this.BH)
        .setDepth(30);
      this.binImages.push(img);

      const lbl = this.add.text(0, this.binsY + this.BH - 18, cat.label, {
        fontFamily: 'Fredoka One, cursive', fontSize: '13px',
        color: '#fff', stroke: '#000', strokeThickness: 2.5, align: 'center',
      }).setOrigin(0.5, 1).setDepth(32).setResolution(2);
      this.binLabelTexts.push(lbl);
    }
    this.repositionBins();
  }

  private repositionBins() {
    this.highlightGfx.clear();
    const dropIdx = this.binAtDrop();

    for (let i = 0; i < 6; i++) {
      const cx = this.binGroupX + i * this.BW + this.BW / 2;
      this.binImages[i].setX(cx);
      this.binLabelTexts[i].setX(cx);
    }

    // Active bin highlight + drop arrow
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
    for (let i = 0; i < 6; i++) {
      if (Math.abs(this.binGroupX + i * this.BW + this.BW / 2 - drop) < this.BW * 0.55) return i;
    }
    return -1;
  }

  // ─── HUD (bottom strip) ──────────────────────────────────────────────────────

  private buildHud() {
    const W = this.W, H = this.H;
    const BACK_END = 64, stripH = 72;
    const hudW  = W - BACK_END;
    const hudCX = BACK_END + hudW / 2;

    this.add.rectangle(hudCX, H - stripH / 2, hudW, stripH, 0x000000, 0.62)
      .setDepth(48).setScrollFactor(0);
    this.add.rectangle(hudCX, H - stripH, hudW, 1.5, 0xFFFFFF, 0.12)
      .setDepth(49).setScrollFactor(0);

    this.ensureHudTextures();

    const col1 = BACK_END + hudW * 0.14;
    const col2 = BACK_END + hudW * 0.52;
    const col3 = BACK_END + hudW * 0.83;
    const lY   = H - stripH + 17;
    const vY   = H - stripH + 53;

    const lbl = (x: number, txt: string, col: string) =>
      this.add.text(x, lY, txt, {
        fontFamily: 'Fredoka One, cursive', fontSize: '18px',
        color: col, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(50).setScrollFactor(0).setResolution(2);

    lbl(col1, 'Coins:',  '#93C5FD');
    lbl(col2, 'Score:',  '#86EFAC');
    lbl(col3, 'Record:', '#FDE68A');

    const IS = 24, IO = 14;
    const vs = { fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#fff', stroke: '#000', strokeThickness: 3 };
    this.add.image(col1 - IO, vY, 'hud-coin').setDisplaySize(IS, IS).setDepth(50).setScrollFactor(0);
    this.add.image(col2 - IO, vY, 'hud-bin').setDisplaySize(IS, IS).setDepth(50).setScrollFactor(0);
    this.add.image(col3 - IO, vY, 'hud-star').setDisplaySize(IS, IS).setDepth(50).setScrollFactor(0);

    this.hudCoins  = this.add.text(col1 + IO - 10, vY, '0', vs).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0).setResolution(2);
    this.hudScored = this.add.text(col2 + IO - 10, vY, '0', vs).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0).setResolution(2);
    this.hudBest   = this.add.text(col3 + IO - 10, vY, '0', vs).setOrigin(0, 0.5).setDepth(50).setScrollFactor(0).setResolution(2);

    this.refreshHud();
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
        const a = (i * Math.PI / pts) - Math.PI / 2;
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
    this.hudCoins.setText(String(state.cityCoins ?? 0));
    this.hudScored.setText(String(this.score));
    this.hudBest.setText(String(Math.max(state.highScores?.[MISSION_ID] ?? 0, this.score)));
  }

  // ─── Lives ───────────────────────────────────────────────────────────────────

  private buildLives() {
    for (let i = MAX_MISTAKES - 1; i >= 0; i--) {
      this.livesTexts.push(
        this.add.text(this.W - 14 - (MAX_MISTAKES - 1 - i) * 28, 34, '❤️', {
          fontSize: '22px',
        }).setOrigin(0.5).setDepth(50).setScrollFactor(0).setResolution(2)
      );
    }
  }

  private refreshLives() {
    this.livesTexts.forEach((t, i) => t.setText(i < this.mistakes ? '🖤' : '❤️'));
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

  private scheduleItem(delay: number) {
    if (this.gameOver) return;
    this.time.delayedCall(delay, () => { if (!this.gameOver) this.spawnItem(); });
  }

  private spawnItem() {
    const cat = CATS[Math.floor(Math.random() * CATS.length)];
    const idx = Math.floor(Math.random() * cat.itemCount) + 1;
    const tex = `${cat.key}-${idx}`;

    // Drop shadow circle
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(0, ITEM_DISPLAY * 0.52, ITEM_DISPLAY * 0.9, ITEM_DISPLAY * 0.28);

    const img = this.add.image(0, 0, tex)
      .setDisplaySize(ITEM_DISPLAY, ITEM_DISPLAY)
      .setOrigin(0.5);

    const container = this.add.container(this.W + ITEM_DISPLAY, this.belt1Y, [g, img]);
    container.setDepth(40);

    this.currentItem = { container, cat: cat.key as CatKey, phase: 'belt1' };
    const speed = Phaser.Math.Clamp(85 + this.score * 7, 85, 210);
    this.itemVX = -speed;
    this.itemVY = 0;
  }

  // ─── Resolution ──────────────────────────────────────────────────────────────

  private resolveItem(item: BeltItem) {
    const hitIdx = this.binAtDrop();
    const correct = hitIdx >= 0 && CATS[hitIdx].key === item.cat;

    if (correct) {
      this.score++;
      this.sessionCoins += COINS_PER_CATCH;
      useProgressStore.getState().addCityCoins(COINS_PER_CATCH);
      this.showFeedback(true, hitIdx);
    } else {
      this.mistakes++;
      this.refreshLives();
      this.showFeedback(false, hitIdx);
      this.cameras.main.shake(200, 0.011);
    }
    this.refreshHud();

    this.time.delayedCall(450, () => {
      item.container.destroy();
      this.currentItem = null;
      if (this.gameOver) return;
      if (this.mistakes >= MAX_MISTAKES) {
        this.triggerGameOver();
      } else {
        this.scheduleItem(Phaser.Math.Clamp(1700 - this.score * 38, 600, 1700));
      }
    });
  }

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
    if (this.currentItem) { this.currentItem.container.destroy(); this.currentItem = null; }

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
