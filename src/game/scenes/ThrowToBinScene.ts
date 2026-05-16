import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID     = 1;
const TRASH_EMOJIS   = ['🥤', '🍌', '🍾', '🥫', '📦', '🗞️'];
const MAX_PULL       = 140;
const MAX_SPEED      = 1500;
const GRAVITY        = 1000;
const MAX_FLOOR_ITEMS = 10;
const FLOOR_Y_RATIO  = 0.78;
const SPAWN_BASE     = 5000;   // ms — 5 seconds initially
const SPAWN_MIN      = 1500;   // ms

interface ThrownItem {
  container: Phaser.GameObjects.Container;
  vx: number; vy: number; rotDir: number; done: boolean;
}

interface FallingItem {
  container: Phaser.GameObjects.Container;
  vx: number; vy: number; rotDir: number; bounces: number;
}

export class ThrowToBinScene extends Phaser.Scene {
  private totalScored = 0;
  private gameOver    = false;
  private floorY      = 0;

  private binCX    = 0;
  private binRimY  = 100;
  private binHalfW = 62;
  private binBodyH = 130;
  private binContainer: Phaser.GameObjects.Container | null = null;

  private trashItems:   Phaser.GameObjects.Container[] = [];
  private thrownItems:  ThrownItem[]  = [];
  private fallingItems: FallingItem[] = [];

  private selectedTrash: Phaser.GameObjects.Container | null = null;
  private isDragging   = false;
  private dragOriginX  = 0;
  private dragOriginY  = 0;

  private slingshotGfx!:      Phaser.GameObjects.Graphics;
  private spawnBarGfx!:       Phaser.GameObjects.Graphics;
  private floorIndicatorGfx!: Phaser.GameObjects.Graphics;
  private floorWarningText!:  Phaser.GameObjects.Text;
  private hudScored!:         Phaser.GameObjects.Text;
  private hudBest!:           Phaser.GameObjects.Text;
  private hudCoins!:          Phaser.GameObjects.Text;

  private spawnTimer = 0;

  constructor() { super('ThrowToBinScene'); }

  init() {
    this.totalScored   = 0;
    this.gameOver      = false;
    this.isDragging    = false;
    this.selectedTrash = null;
    this.trashItems    = [];
    this.thrownItems   = [];
    this.fallingItems  = [];
    this.binContainer  = null;
    this.floorY        = 0;
    this.spawnTimer    = 0;
  }

  preload() {
    this.load.image('back_trash', '/back_trash.jpg');
  }

  create() {
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-scored-update', '');

    const handleRestart = () => { setTimeout(() => this.scene.restart(), 0); };
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', handleRestart));

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    this.floorY = H * FLOOR_Y_RATIO;

    if (this.textures.exists('back_trash')) {
      const bg = this.add.image(W / 2, H / 2, 'back_trash');
      bg.setScale(Math.max(W / bg.width, H / bg.height)).setDepth(-10);
    }
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25).setDepth(-9);

    this.slingshotGfx = this.add.graphics().setDepth(20);
    this.buildBin(W);
    this.buildHud(W);
    this.buildSpawnBar();
    this.buildFloorIndicator();

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup',   this.onUp,   this);

    // Spawn 3 initial items from sides
    for (let i = 0; i < 3; i++) {
      this.spawnFromSide();
    }
  }

  // ─── HUD (top-right strip, avoids back button on top-left) ───────────────────

  private buildHud(W: number) {
    const BACK_END = 64;  // back button ends around x=58, give 6px gap
    const hudW     = W - BACK_END;
    const hudCX    = BACK_END + hudW / 2;
    const hudY     = 32;

    this.add.rectangle(hudCX, hudY, hudW, 56, 0x000000, 0.40)
      .setDepth(48).setScrollFactor(0);

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Fredoka One, cursive',
      fontSize: '18px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    };

    const col1 = BACK_END + hudW * 0.20;
    const col2 = BACK_END + hudW * 0.55;
    const col3 = BACK_END + hudW * 0.88;

    this.hudScored = this.add.text(col1, hudY, '', style).setOrigin(0.5).setDepth(50).setScrollFactor(0);
    this.hudBest   = this.add.text(col2, hudY, '', style).setOrigin(0.5).setDepth(50).setScrollFactor(0);
    this.hudCoins  = this.add.text(col3, hudY, '', style).setOrigin(0.5).setDepth(50).setScrollFactor(0);
    this.updateHud();
  }

  private updateHud() {
    const state = useProgressStore.getState();
    const best  = Math.max(state.highScores[MISSION_ID] ?? 0, this.totalScored);
    if (this.hudScored?.active) this.hudScored.setText(`🗑️ ${this.totalScored}`);
    if (this.hudBest?.active)   this.hudBest.setText(`⭐ ${best}`);
    if (this.hudCoins?.active)  this.hudCoins.setText(`🪙 ${state.cityCoins}`);
  }

  // ─── Left vertical fill bar (5-second countdown to next spawn) ───────────────

  private buildSpawnBar() {
    this.spawnBarGfx = this.add.graphics().setDepth(49).setScrollFactor(0);
  }

  private drawSpawnBar(ratio: number) {
    const H = this.cameras.main.height;
    const g = this.spawnBarGfx;
    g.clear();

    const barX   = 8;
    const barW   = 14;
    const barTop = 68;                          // just below HUD
    const barBot = H * FLOOR_Y_RATIO - 24;
    const barH   = barBot - barTop;

    // Background track
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(barX, barTop, barW, barH, 7);

    // Fill from bottom upward
    const fillH = ratio * barH;
    if (fillH > 1) {
      const col = ratio < 0.5 ? 0x22C55E : ratio < 0.8 ? 0xFFBB00 : 0xFF4444;
      g.fillStyle(col, 0.9);
      g.fillRoundedRect(barX, barTop + barH - fillH, barW, fillH, 7);
    }

    // Border
    g.lineStyle(1.5, 0xFFFFFF, 0.4);
    g.strokeRoundedRect(barX, barTop, barW, barH, 7);
  }

  // ─── Floor indicator (10 circles at bottom) ──────────────────────────────────

  private buildFloorIndicator() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.floorIndicatorGfx = this.add.graphics().setDepth(49).setScrollFactor(0);

    this.floorWarningText = this.add.text(W / 2, H * FLOOR_Y_RATIO + 52, '', {
      fontFamily: 'Fredoka One, cursive',
      fontSize: '16px',
      color: '#FF5555',
      stroke: '#000',
      strokeThickness: 4,
      align: 'center',
    }).setOrigin(0.5).setDepth(50).setScrollFactor(0).setAlpha(0);
  }

  private drawFloorIndicator(count: number) {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const g = this.floorIndicatorGfx;
    g.clear();

    const R      = 9;
    const gap    = 6;
    const step   = R * 2 + gap;
    const totalW = step * MAX_FLOOR_ITEMS - gap;
    const startX = (W - totalW) / 2 + R;
    const circY  = H * FLOOR_Y_RATIO + 28;

    for (let i = 0; i < MAX_FLOOR_ITEMS; i++) {
      const cx     = startX + i * step;
      const filled = i < count;
      let fillCol: number;
      if (!filled)   fillCol = 0x333333;
      else if (i < 5) fillCol = 0x22C55E;
      else if (i < 7) fillCol = 0xFFBB00;
      else if (i < 9) fillCol = 0xFF6B00;
      else             fillCol = 0xFF2222;

      g.fillStyle(fillCol, filled ? 0.95 : 0.30);
      g.fillCircle(cx, circY, R);
      g.lineStyle(1.5, filled ? 0xFFFFFF : 0x555555, filled ? 0.65 : 0.25);
      g.strokeCircle(cx, circY, R);
    }

    if (this.floorWarningText?.active) {
      if (count >= 9) {
        this.floorWarningText.setText('⚠️ Danger! Too much trash!').setAlpha(1);
      } else if (count >= 7) {
        this.floorWarningText.setText('Hurry! Street is getting too dirty! 🧹').setAlpha(1);
      } else {
        this.floorWarningText.setAlpha(0);
      }
    }
  }

  // ─── Spawn from side ─────────────────────────────────────────────────────────

  private get spawnInterval(): number {
    return Math.max(SPAWN_MIN, SPAWN_BASE - Math.floor(this.totalScored / 5) * 200);
  }

  private spawnFromSide() {
    if (this.gameOver) return;
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    const fromLeft = Phaser.Math.Between(0, 1) === 0;
    const startX   = fromLeft ? -30 : W + 30;
    const startY   = H * Phaser.Math.FloatBetween(0.18, 0.48);
    const vx       = fromLeft
      ? Phaser.Math.Between(280, 520)
      : -Phaser.Math.Between(280, 520);
    const vy       = Phaser.Math.Between(-60, 100);

    const emoji   = Phaser.Utils.Array.GetRandom(TRASH_EMOJIS) as string;
    const emojiGO = this.add.text(0, 0, emoji, { fontSize: '54px' }).setOrigin(0.5);
    const shadow  = this.add.ellipse(0, 32, 54, 14, 0x000000, 0.2);
    const c       = this.add.container(startX, startY, [shadow, emojiGO]);
    c.setSize(64, 64).setDepth(8);

    const rotDir = fromLeft ? 1 : -1;
    this.fallingItems.push({ container: c, vx, vy, rotDir, bounces: 0 });
  }

  private settleItem(c: Phaser.GameObjects.Container) {
    const W  = this.cameras.main.width;
    const sx = Phaser.Math.Clamp(c.x, 65, W - 65);
    c.setPosition(sx, this.floorY);
    c.setAngle(0);
    c.setInteractive();
    c.setData('ox', sx);
    c.setData('oy', this.floorY);

    this.tweens.add({
      targets: c, y: this.floorY - 14,
      duration: 900 + Phaser.Math.Between(0, 300),
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.trashItems.push(c);
  }

  // ─── Game over ───────────────────────────────────────────────────────────────

  private triggerGameOver() {
    if (this.gameOver) return;
    this.gameOver = true;

    const state       = useProgressStore.getState();
    const currentBest = state.highScores[MISSION_ID] ?? 0;
    if (this.totalScored > currentBest) {
      useProgressStore.setState({
        highScores: { ...state.highScores, [MISSION_ID]: this.totalScored },
      });
    }

    const W = this.cameras.main.width, H = this.cameras.main.height;
    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xFF0000, 0.35).setDepth(90);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });

    this.time.delayedCall(700, () => EventBus.emit('game-time-up', this.totalScored));
  }

  // ─── Bin ─────────────────────────────────────────────────────────────────────

  private buildBin(W: number) {
    this.binCX    = W / 2;
    this.binRimY  = 100;
    this.binHalfW = 62;
    this.binBodyH = 130;

    const cx = 0, ry = this.binRimY, hw = this.binHalfW, bh = this.binBodyH, bw = hw * 2;
    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(cx, ry + bh + 10, bw + 16, 16);
    g.fillStyle(0x16A34A);
    g.fillRoundedRect(cx - hw, ry + 10, bw, bh, { tl: 4, tr: 4, bl: 14, br: 14 });
    g.fillStyle(0xFFFFFF, 0.1);
    g.fillRoundedRect(cx - hw + 8, ry + 18, 22, bh - 24, 6);
    g.lineStyle(1.5, 0x000000, 0.1);
    for (let rx = cx - hw + 32; rx < cx + hw - 10; rx += 26) {
      g.beginPath(); g.moveTo(rx, ry + 14); g.lineTo(rx, ry + bh - 6); g.strokePath();
    }
    g.fillStyle(0xFFFFFF, 0.88);
    g.fillCircle(cx, ry + bh * 0.52, 26);
    g.fillStyle(0x16A34A);
    for (let i = 0; i < 3; i++) {
      const a = (i * 120 * Math.PI) / 180 - Math.PI / 2;
      g.fillTriangle(
        cx + Math.cos(a) * 18,       ry + bh * 0.52 + Math.sin(a) * 18,
        cx + Math.cos(a + 0.9) * 10, ry + bh * 0.52 + Math.sin(a + 0.9) * 10,
        cx + Math.cos(a - 0.9) * 10, ry + bh * 0.52 + Math.sin(a - 0.9) * 10,
      );
    }
    g.fillStyle(0x22C55E);
    g.fillEllipse(cx, ry + 8, bw + 10, 30);
    g.fillStyle(0x16A34A);
    g.fillEllipse(cx, ry + 6, bw, 19);
    g.fillStyle(0x052E16);
    g.fillEllipse(cx, ry + 4, bw - 20, 12);
    g.fillStyle(0x15803D);
    g.fillRoundedRect(cx - 22, ry - 14, 44, 18, 7);
    g.fillStyle(0x22C55E);
    g.fillRoundedRect(cx - 18, ry - 11, 36, 11, 5);
    g.fillStyle(0xFFFFFF, 0.35);
    g.fillTriangle(cx, ry + 38, cx - 10, ry + 25, cx + 10, ry + 25);

    this.binContainer = this.add.container(W / 2, 0, [g]);
    this.binContainer.setDepth(10);
  }

  // ─── Input ───────────────────────────────────────────────────────────────────

  private onDown(pointer: Phaser.Input.Pointer) {
    if (this.gameOver) return;
    let best: Phaser.GameObjects.Container | null = null;
    let bestD = 85;
    for (const item of this.trashItems) {
      if (!item.active) continue;
      const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, item.x, item.y);
      if (d < bestD) { bestD = d; best = item; }
    }
    if (!best) return;
    this.selectedTrash = best;
    this.isDragging    = true;
    this.dragOriginX   = best.x;
    this.dragOriginY   = best.y;
    this.tweens.killTweensOf(best);
    best.setDepth(22);
    this.tweens.add({ targets: best, scaleX: 1.1, scaleY: 1.1, duration: 80 });
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging || !this.selectedTrash) return;
    const ox = this.dragOriginX, oy = this.dragOriginY;
    const rawDx = pointer.x - ox, rawDy = pointer.y - oy;
    const rawDist = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;
    const clampD  = Math.min(rawDist, MAX_PULL);
    const nx = rawDx / rawDist, ny = rawDy / rawDist;

    this.selectedTrash.x = ox + nx * clampD;
    this.selectedTrash.y = oy + ny * clampD;

    const power = clampD / MAX_PULL;
    this.slingshotGfx.clear();

    const px = -ny, py = nx, fd = 20;
    const f1x = ox + px * fd, f1y = oy + py * fd;
    const f2x = ox - px * fd, f2y = oy - py * fd;
    const cx  = ox + nx * clampD, cy = oy + ny * clampD;

    this.slingshotGfx.lineStyle(5, 0xFFAA00, 0.9);
    this.slingshotGfx.beginPath(); this.slingshotGfx.moveTo(f1x, f1y); this.slingshotGfx.lineTo(cx, cy); this.slingshotGfx.strokePath();
    this.slingshotGfx.beginPath(); this.slingshotGfx.moveTo(f2x, f2y); this.slingshotGfx.lineTo(cx, cy); this.slingshotGfx.strokePath();
    this.slingshotGfx.fillStyle(0xFFAA00);
    this.slingshotGfx.fillCircle(f1x, f1y, 7);
    this.slingshotGfx.fillCircle(f2x, f2y, 7);

    // Trajectory dots
    let sx = ox, sy = oy, svx = -nx * power * MAX_SPEED, svy = -ny * power * MAX_SPEED;
    const dt = 0.06;
    for (let s = 1; s <= 10; s++) {
      svy += GRAVITY * dt; sx += svx * dt; sy += svy * dt;
      this.slingshotGfx.fillStyle(0xFFFFFF, Math.max(0, 0.8 - s * 0.07));
      this.slingshotGfx.fillCircle(sx, sy, Math.max(2, 5.5 - s * 0.35));
    }

    // Power bar
    const bx = ox + 55, barH = 100, by = oy;
    this.slingshotGfx.fillStyle(0x333333, 0.8);
    this.slingshotGfx.fillRoundedRect(bx - 9, by - barH / 2, 18, barH, 9);
    const fillH   = power * barH;
    const fillCol = power < 0.4 ? 0x22C55E : power < 0.75 ? 0xFFBB00 : 0xFF4444;
    this.slingshotGfx.fillStyle(fillCol, 0.95);
    this.slingshotGfx.fillRoundedRect(bx - 7, by + barH / 2 - fillH, 14, fillH, 7);
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    this.slingshotGfx.clear();
    if (!this.isDragging || !this.selectedTrash) return;
    this.isDragging = false;
    const trash = this.selectedTrash;
    this.selectedTrash = null;

    const ox = this.dragOriginX, oy = this.dragOriginY;
    const dx = pointer.x - ox, dy = pointer.y - oy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < 18) {
      this.tweens.add({
        targets: trash, x: ox, y: oy, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut',
        onComplete: () => this.tweens.add({ targets: trash, y: oy - 14, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      });
      return;
    }

    const power  = Math.min(dist / MAX_PULL, 1.0);
    const nx = dx / dist, ny = dy / dist;
    const vx = -nx * power * MAX_SPEED;
    const vy = -ny * power * MAX_SPEED;

    this.trashItems = this.trashItems.filter(t => t !== trash);
    trash.setDepth(22);
    this.thrownItems.push({ container: trash, vx, vy, rotDir: dx > 0 ? 1 : -1, done: false });
  }

  // ─── Scoring ─────────────────────────────────────────────────────────────────

  private onScored(trash: Phaser.GameObjects.Container, type: 'clean' | 'rim' = 'clean') {
    this.totalScored++;
    const coins = type === 'rim' ? 2 : 3;
    useProgressStore.getState().addCityCoins(coins);
    this.updateHud();

    this.tweens.add({
      targets: trash, scaleX: 0, scaleY: 0, alpha: 0, y: this.binRimY + 40,
      duration: 200, ease: 'Quad.easeIn', onComplete: () => trash.destroy(),
    });
    this.showGreat(trash.x, trash.y - 20);
    this.showCoinPopup(trash.x + 30, trash.y - 40, coins);
  }

  private rimBounceAndScore(ti: ThrownItem) {
    ti.done = true;
    const trash    = ti.container;
    const sideSign = trash.x > this.binCX ? 1 : -1;
    this.tweens.add({
      targets: trash,
      x: trash.x - sideSign * 14, y: trash.y - 30,
      angle: (trash.angle as number) + sideSign * 25,
      duration: 190, ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: trash, x: this.binCX, y: this.binRimY + 22,
          duration: 260, ease: 'Quad.easeIn',
          onComplete: () => this.onScored(trash, 'rim'),
        });
      },
    });
  }

  private showCoinPopup(x: number, y: number, coins: number) {
    const t = this.add.text(x, y, `+${coins} 🪙`, {
      fontFamily: 'Fredoka One, sans-serif', fontSize: '26px',
      color: '#FFD700', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(27);
    this.tweens.add({ targets: t, y: y - 55, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private showGreat(x: number, y: number) {
    const words = ['Great!', 'Nice!', 'Perfect!', 'Awesome!'];
    const t = this.add.text(x, y, Phaser.Utils.Array.GetRandom(words) as string, {
      fontFamily: 'Fredoka One, sans-serif', fontSize: '32px',
      color: '#22C55E', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(26).setScale(0.3);
    this.tweens.add({
      targets: t, scale: 1.1, duration: 180, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 700, onComplete: () => t.destroy() }),
    });
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.binContainer) this.binCX = this.binContainer.x;
    if (this.gameOver) return;

    const W  = this.cameras.main.width;
    const dt = delta / 1000;

    // Spawn bar / timer
    this.spawnTimer += delta;
    const spawnRatio = Math.min(1, this.spawnTimer / this.spawnInterval);
    this.drawSpawnBar(spawnRatio);
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnFromSide();
    }

    // Floor indicator (updated every frame, cheap redraw)
    const floorCount = this.trashItems.filter(t => t.active).length;
    this.drawFloorIndicator(floorCount);

    // Thrown items (player-launched)
    for (let i = this.thrownItems.length - 1; i >= 0; i--) {
      const ti = this.thrownItems[i];
      if (ti.done) { this.thrownItems.splice(i, 1); continue; }

      ti.vy += GRAVITY * dt;
      ti.container.x += ti.vx * dt;
      ti.container.y += ti.vy * dt;
      ti.container.angle += ti.rotDir * 4;

      // Side-wall bounce
      if (ti.container.x < 30)      { ti.container.x = 30;      ti.vx =  Math.abs(ti.vx) * 0.75; }
      if (ti.container.x > W - 30)  { ti.container.x = W - 30;  ti.vx = -Math.abs(ti.vx) * 0.75; }

      // Bin hit — only when descending
      if (ti.vy > 0) {
        const dx = Math.abs(ti.container.x - this.binCX);
        const dy = ti.container.y - this.binRimY;
        if (dx >= this.binHalfW - 20 && dx < this.binHalfW + 8 && dy >= -8 && dy < 22) {
          this.rimBounceAndScore(ti); this.thrownItems.splice(i, 1); continue;
        }
        if (dx < this.binHalfW - 20 && dy >= -4 && dy < 28) {
          ti.done = true; this.onScored(ti.container, 'clean'); this.thrownItems.splice(i, 1); continue;
        }
      }

      // Missed bin → convert to bouncing item at floor
      if (ti.vy > 0 && ti.container.y >= this.floorY) {
        this.fallingItems.push({ container: ti.container, vx: ti.vx * 0.5, vy: ti.vy, rotDir: ti.rotDir, bounces: 0 });
        this.thrownItems.splice(i, 1); continue;
      }
    }

    // Falling / bouncing items
    for (let i = this.fallingItems.length - 1; i >= 0; i--) {
      const fi = this.fallingItems[i];

      fi.vy += GRAVITY * dt;
      fi.vx *= (1 - Math.min(0.8 * dt, 0.4));
      fi.container.x += fi.vx * dt;
      fi.container.y += fi.vy * dt;
      fi.container.angle += fi.rotDir * 3;

      // Side-wall bounce
      if (fi.container.x < 30)     { fi.container.x = 30;     fi.vx =  Math.abs(fi.vx) * 0.6; }
      if (fi.container.x > W - 30) { fi.container.x = W - 30; fi.vx = -Math.abs(fi.vx) * 0.6; }

      // Floor bounce → settle
      if (fi.container.y >= this.floorY && fi.vy > 0) {
        fi.vy = -fi.vy * 0.35;
        fi.vx *= 0.7;
        fi.container.y = this.floorY;
        fi.bounces++;

        if (Math.abs(fi.vy) < 80 || fi.bounces >= 4) {
          this.settleItem(fi.container);
          this.fallingItems.splice(i, 1); continue;
        }
      }
    }

    // Check game over (in case items piled up)
    if (floorCount >= MAX_FLOOR_ITEMS) {
      this.triggerGameOver();
    }
  }
}
