import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID  = 4;
const RIVER_RATIO = 0.28;   // top 28% = river/nature zone
const FLOOR_RATIO = 0.84;   // character floor at 84%
const CHAR_SPEED  = 145;    // px/sec
const CLOSE_SECS  = 1.0;    // seconds to close a faucet

// ─── Level config ─────────────────────────────────────────────────────────────
function getLevelCfg(level: number) {
  const time           = 60;
  const openInterval   = Math.max(1.2, 5.5 - level * 0.18);
  const maxDripping    = Math.min(3, 1 + Math.floor(level / 3));
  const drainPerFaucet = 1.2 + level * 0.12;   // %/sec per open faucet
  return { time, openInterval, maxDripping, drainPerFaucet };
}

// Level 1-3: 4 faucets (2 left, 2 right)
const FAUCET_XR = [0.14, 0.35, 0.65, 0.86];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Faucet {
  id:         number;
  x:          number;
  side:       1 | -1;   // 1 = spout faces right, -1 = left
  isDripping: boolean;
  queued:     boolean;
  bodyGfx:    Phaser.GameObjects.Graphics;
  dropsGfx:   Phaser.GameObjects.Graphics;
  badge:      Phaser.GameObjects.Text;
  dirtyBody:  boolean;  // needs redraw
}

type CharState = 'idle' | 'moving' | 'closing';

// ─── Scene ────────────────────────────────────────────────────────────────────
export class WaterSaverScene extends Phaser.Scene {
  level    = 1;
  timeLeft = 60;
  done     = false;
  waterPct = 100;
  lastVitPct = 101;

  faucets:  Faucet[]   = [];
  queue:    number[]   = [];
  charState: CharState = 'idle';
  charX    = 0;
  charY    = 0;
  closingTimer = 0;
  currentId: number | null = null;

  charGfx!:      Phaser.GameObjects.Graphics;
  toolTxt!:      Phaser.GameObjects.Text;
  riverFillGfx!: Phaser.GameObjects.Graphics;
  waveGfx!:      Phaser.GameObjects.Graphics;
  pctTxt!:       Phaser.GameObjects.Text;
  treeGfxList:   Phaser.GameObjects.Graphics[] = [];
  flowerGfxList: Phaser.GameObjects.Graphics[] = [];

  nextOpen   = 3.0;
  dropPhase  = 0;
  walkPhase  = 0;
  waveOff    = 0;
  riverH     = 0;
  floorY     = 0;
  W = 0; H = 0;

  constructor() { super('WaterSaverScene'); }

  init(data?: { level?: number }) {
    if (data?.level !== undefined) {
      this.level = data.level;
    } else {
      const reg = this.registry?.get('startLevel') as number | undefined;
      if (reg != null) { this.registry.remove('startLevel'); this.level = reg; }
      else { this.level = Math.min((useProgressStore.getState().highestLevel[MISSION_ID] ?? 0) + 1, 20); }
    }
    this.waterPct    = 100;
    this.lastVitPct  = 101;
    this.done        = false;
    this.faucets     = [];
    this.queue       = [];
    this.charState   = 'idle';
    this.currentId   = null;
    this.dropPhase   = 0;
    this.walkPhase   = 0;
    this.waveOff     = 0;
    this.treeGfxList = [];
    this.flowerGfxList = [];
    this.nextOpen = Math.max(2.0, 5.0 - this.level * 0.12);
  }

  create() {
    this.W = this.cameras.main.width;
    this.H = this.cameras.main.height;
    const W = this.W, H = this.H;
    const cfg = getLevelCfg(this.level);
    this.timeLeft = cfg.time;
    this.riverH   = Math.round(H * RIVER_RATIO);
    this.floorY   = Math.round(H * FLOOR_RATIO);
    this.charX    = W / 2;
    this.charY    = this.floorY;

    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);

    const onRestart = (d: { level: number }) => setTimeout(() => this.scene.restart(d), 0);
    EventBus.on('restart-scene', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', onRestart));

    this.buildBg();
    this.buildRiver();
    this.buildPipes();
    this.buildFaucets();
    this.buildCharacter();

    this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        if (this.done) return;
        this.timeLeft--;
        EventBus.emit('game-timer', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.done = true;
          EventBus.emit('game-level-complete', this.level);
        }
      },
    });
  }

  // ── Backgrounds ───────────────────────────────────────────────────────────────

  buildBg() {
    const W = this.W, H = this.H;
    const rH = this.riverH;

    // Room walls / floor
    const room = this.add.graphics().setDepth(0);
    room.fillStyle(0xFFFBF0);
    room.fillRect(0, rH, W, H - rH);
    // Subtle wall lines
    room.lineStyle(1, 0xE8DCC8, 0.6);
    for (let y = rH + 32; y < this.floorY; y += 32) {
      room.lineBetween(0, y, W, y);
    }
    // Floor tile strip
    room.fillStyle(0xD6C9B0);
    room.fillRect(0, this.floorY + 3, W, H - this.floorY - 3);
    // Floor line
    room.lineStyle(3, 0xB0A090, 0.8);
    room.lineBetween(0, this.floorY + 3, W, this.floorY + 3);
  }

  // ── River zone ────────────────────────────────────────────────────────────────

  buildRiver() {
    const W = this.W, H = this.H;
    const rH = this.riverH;

    // Sky
    const sky = this.add.graphics().setDepth(1);
    sky.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xB8E4F7, 0xB8E4F7, 1);
    sky.fillRect(0, 0, W, rH * 0.5);

    // Static river bank (grass)
    const bank = this.add.graphics().setDepth(1);
    bank.fillStyle(0x4ADE80);
    bank.fillRect(0, rH * 0.45, W, rH * 0.55);

    // Lower bright grass strip at river bottom
    bank.fillStyle(0x16A34A);
    bank.fillRect(0, rH - 14, W, 14);

    // River channel bed (always visible)
    bank.fillStyle(0x0EA5E9);
    bank.fillRoundedRect(8, rH * 0.38, W - 16, rH * 0.42, 8);

    // Animated water fill (redrawn each frame)
    this.riverFillGfx = this.add.graphics().setDepth(3);
    this.waveGfx      = this.add.graphics().setDepth(4);

    // Trees
    const treeXs = [W * 0.07, W * 0.22, W * 0.50, W * 0.78, W * 0.93];
    for (const tx of treeXs) {
      const g = this.add.graphics().setDepth(5);
      this.drawTree(g, tx, rH * 0.55, 1);
      this.treeGfxList.push(g);
    }

    // Flowers
    const flowerData = [
      { x: W * 0.13, c: 0xFF6B6B }, { x: W * 0.30, c: 0xFFD93D },
      { x: W * 0.44, c: 0xFF8E53 }, { x: W * 0.56, c: 0x86EFAC },
      { x: W * 0.70, c: 0xFFD93D }, { x: W * 0.87, c: 0xFF6B6B },
    ];
    for (const fd of flowerData) {
      const g = this.add.graphics().setDepth(5);
      this.drawFlower(g, fd.x, rH * 0.42, 1, fd.c);
      this.flowerGfxList.push(g);
    }

    // Percentage text
    this.pctTxt = this.add.text(W / 2, rH * 0.62, '💧 100%', {
      fontFamily: 'Fredoka One', fontSize: '20px',
      color: '#0C4A6E', stroke: '#FFFFFF', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);
  }

  drawTree(g: Phaser.GameObjects.Graphics, x: number, baseY: number, vit: number) {
    g.clear();
    const crownColor = vit > 0.6 ? 0x16A34A : vit > 0.3 ? 0xCA8A04 : 0x92400E;
    const darkCrown  = vit > 0.6 ? 0x15803D : vit > 0.3 ? 0xA16207 : 0x78350F;
    g.fillStyle(0x78350F);
    g.fillRect(x - 4, baseY - 22, 8, 22);
    g.fillStyle(crownColor);
    g.fillCircle(x, baseY - 26, 17);
    if (vit > 0.35) {
      g.fillStyle(darkCrown);
      g.fillCircle(x - 8, baseY - 22, 11);
      g.fillCircle(x + 8, baseY - 20, 10);
    }
  }

  drawFlower(g: Phaser.GameObjects.Graphics, x: number, y: number, vit: number, color: number) {
    g.clear();
    const stemColor = vit > 0.5 ? 0x16A34A : 0xCA8A04;
    g.lineStyle(2, stemColor);
    g.lineBetween(x, y, x, y + 14);
    if (vit < 0.25) return;
    g.fillStyle(color);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.fillCircle(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4);
    }
    g.fillStyle(0xFEF08A);
    g.fillCircle(x, y, 3);
  }

  updateVitality() {
    const vit = this.waterPct / 100;
    const W = this.W, rH = this.riverH;
    const treeXs = [W * 0.07, W * 0.22, W * 0.50, W * 0.78, W * 0.93];
    for (let i = 0; i < this.treeGfxList.length; i++) {
      this.drawTree(this.treeGfxList[i], treeXs[i], rH * 0.55, vit);
    }
    const flowerData = [
      { x: W * 0.13, c: 0xFF6B6B }, { x: W * 0.30, c: 0xFFD93D },
      { x: W * 0.44, c: 0xFF8E53 }, { x: W * 0.56, c: 0x86EFAC },
      { x: W * 0.70, c: 0xFFD93D }, { x: W * 0.87, c: 0xFF6B6B },
    ];
    for (let i = 0; i < this.flowerGfxList.length; i++) {
      this.drawFlower(this.flowerGfxList[i], flowerData[i].x, rH * 0.42, vit, flowerData[i].c);
    }
  }

  drawRiverFill() {
    const W = this.W, rH = this.riverH;
    const chanY = rH * 0.38, chanH = rH * 0.42;
    const fillH = Math.max(3, (this.waterPct / 100) * chanH);
    const fillY = chanY + chanH - fillH;
    const wCol  = this.waterPct > 55 ? 0x0EA5E9 : this.waterPct > 25 ? 0x38BDF8 : 0xBAE6FD;

    this.riverFillGfx.clear();
    this.riverFillGfx.fillStyle(wCol, 0.88);
    this.riverFillGfx.fillRoundedRect(8, fillY, W - 16, fillH, 6);
    if (fillH > 8) {
      this.riverFillGfx.fillStyle(0xFFFFFF, 0.18);
      this.riverFillGfx.fillRoundedRect(8, fillY, W - 16, 5, 3);
    }

    // Wave lines
    this.waveGfx.clear();
    if (fillH > 6) {
      this.waveGfx.lineStyle(2, 0xFFFFFF, 0.28);
      for (let wx = 16; wx < W - 16; wx += 28) {
        const s = Math.sin((this.waveOff + wx * 0.05) % (Math.PI * 2));
        this.waveGfx.lineBetween(wx, fillY + 5 + s * 2, wx + 16, fillY + 5 + s * 2);
      }
    }

    const pct = Math.ceil(this.waterPct);
    this.pctTxt.setText(`💧 ${pct}%`);
    this.pctTxt.setColor(pct > 50 ? '#0C4A6E' : pct > 25 ? '#92400E' : '#EF4444');
  }

  // ── Pipes ─────────────────────────────────────────────────────────────────────

  buildPipes() {
    const W = this.W;
    const g = this.add.graphics().setDepth(2);
    for (const xr of FAUCET_XR) {
      const fx = W * xr;
      g.lineStyle(6, 0x94A3B8, 0.65);
      g.lineBetween(fx, this.riverH, fx, this.floorY - 55);
      g.fillStyle(0x64748B);
      g.fillCircle(fx, this.riverH, 6);
      // Pipe connector dot at faucet elbow
      g.fillStyle(0x94A3B8);
      g.fillCircle(fx, this.floorY - 55, 5);
    }
  }

  // ── Faucets ───────────────────────────────────────────────────────────────────

  buildFaucets() {
    const W = this.W;
    for (let i = 0; i < FAUCET_XR.length; i++) {
      const fx    = W * FAUCET_XR[i];
      const side  = (fx < W / 2 ? 1 : -1) as 1 | -1;

      const bodyGfx  = this.add.graphics().setDepth(8);
      const dropsGfx = this.add.graphics().setDepth(9);
      const badge    = this.add.text(fx, this.floorY - 70, '', {
        fontFamily: 'Fredoka One', fontSize: '13px', color: '#FFFFFF',
        backgroundColor: '#3B82F6', padding: { x: 5, y: 3 },
      }).setOrigin(0.5, 1).setDepth(11).setVisible(false);

      const f: Faucet = {
        id: i, x: fx, side,
        isDripping: false, queued: false,
        bodyGfx, dropsGfx, badge, dirtyBody: true,
      };
      this.drawFaucetBody(f, false);
      this.faucets.push(f);

      const zone = this.add.zone(fx, this.floorY - 30, 66, 72)
        .setInteractive().setDepth(12);
      zone.on('pointerdown', () => {
        if (this.done || !f.isDripping || f.queued) return;
        f.queued = true;
        this.queue.push(i);
        f.badge.setText(`#${this.queue.length}`).setVisible(true);
      });
    }
  }

  drawFaucetBody(f: Faucet, highlighted: boolean) {
    const g  = f.bodyGfx;
    const fx = f.x, fy = this.floorY;
    const s  = f.side;
    g.clear();

    const pipeCol   = f.isDripping ? 0x7DD3FC : 0x94A3B8;
    const handleCol = f.isDripping ? 0xEF4444 : 0x22C55E;

    // Vertical pipe (floor up 55px)
    g.fillStyle(pipeCol);
    g.fillRect(fx - 4, fy - 55, 8, 55);

    // Horizontal elbow (pointing outward based on side)
    g.fillRect(fx - 4 + (s < 0 ? -20 : 0), fy - 55, 24, 8);

    // Drip tip cap
    g.fillStyle(pipeCol);
    g.fillCircle(fx + s * 20, fy - 51, 5);

    // Handle bar (lever)
    g.fillStyle(handleCol);
    g.fillRoundedRect(fx - 11, fy - 63, 22, 7, 3);

    // Knob
    g.fillStyle(0x475569);
    g.fillCircle(fx, fy - 63, 5);

    // Highlight ring when targeted
    if (highlighted) {
      g.lineStyle(3, 0xFBBF24, 1);
      g.strokeCircle(fx, fy - 34, 28);
    }
  }

  // ── Character ─────────────────────────────────────────────────────────────────

  buildCharacter() {
    this.charGfx = this.add.graphics().setDepth(15);
    this.toolTxt = this.add.text(0, 0, '🔧', {
      fontSize: '22px',
    }).setOrigin(0.5, 1).setDepth(16).setVisible(false);
    this.redrawChar();
  }

  redrawChar() {
    const g  = this.charGfx;
    const cx = this.charX, cy = this.charY;
    const isMoving = this.charState === 'moving';
    const dir = (this.currentId !== null && this.faucets[this.currentId])
      ? (this.faucets[this.currentId].x > cx ? 1 : -1) : 1;
    const leg = isMoving ? Math.sin(this.walkPhase * 9) * 9 : 0;
    const arm = isMoving ? Math.sin(this.walkPhase * 9) * 7 : 0;

    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(cx, cy + 2, 32, 7);
    // Legs
    g.fillStyle(0x1E3A5F);
    g.fillRect(cx - 7, cy - 18, 6, 20 + leg);
    g.fillRect(cx + 1, cy - 18, 6, 20 - leg);
    // Shoes
    g.fillStyle(0x1C1917);
    g.fillEllipse(cx - 4,  cy + 2 + leg, 14, 7);
    g.fillEllipse(cx + 4,  cy + 2 - leg, 14, 7);
    // Body
    g.fillStyle(0x3B82F6);
    g.fillRoundedRect(cx - 10, cy - 38, 20, 22, 5);
    // Arms
    g.lineStyle(5, 0xFED7AA);
    if (this.charState === 'closing') {
      g.lineBetween(cx - 10, cy - 30, cx - 20, cy - 50);
      g.lineBetween(cx + 10, cy - 30, cx + 20, cy - 50);
    } else {
      g.lineBetween(cx - 10, cy - 30, cx - dir * 3 - 16, cy - 22 - arm);
      g.lineBetween(cx + 10, cy - 30, cx + dir * 3 + 16, cy - 22 + arm);
    }
    // Head
    g.fillStyle(0xFED7AA);
    g.fillCircle(cx, cy - 50, 12);
    // Hair
    g.fillStyle(0x78350F);
    g.fillRoundedRect(cx - 11, cy - 62, 22, 9, 4);
    // Eye (facing direction)
    g.fillStyle(0x1C1917);
    g.fillCircle(cx + dir * 4, cy - 52, 2);
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(_t: number, delta: number) {
    if (this.done) return;
    const dt  = delta / 1000;
    const cfg = getLevelCfg(this.level);
    this.dropPhase += dt;
    this.waveOff   += dt * 1.8;

    // Auto-open
    this.nextOpen -= dt;
    if (this.nextOpen <= 0) {
      this.tryAutoOpen(cfg.maxDripping);
      this.nextOpen = cfg.openInterval * (0.75 + Math.random() * 0.5);
    }

    // Drain
    const dripping = this.faucets.filter(f => f.isDripping).length;
    this.waterPct  = Math.max(0, this.waterPct - dripping * cfg.drainPerFaucet * dt);

    // River visuals
    this.drawRiverFill();
    if (Math.abs(this.waterPct - this.lastVitPct) >= 2) {
      this.updateVitality();
      this.lastVitPct = this.waterPct;
    }

    // Faucet drop animations
    for (const f of this.faucets) {
      if (f.isDripping) this.animDrops(f);
      if (f.dirtyBody) { this.drawFaucetBody(f, f.id === this.currentId); f.dirtyBody = false; }
    }

    // Character
    this.tickCharacter(dt);

    // Lose
    if (this.waterPct <= 0) {
      this.done = true;
      this.time.delayedCall(400, () => EventBus.emit('game-time-up', '0'));
    }
  }

  tryAutoOpen(maxDripping: number) {
    if (this.faucets.filter(f => f.isDripping).length >= maxDripping) return;
    const pool = this.faucets.filter(f => !f.isDripping);
    if (!pool.length) return;
    const f = pool[Phaser.Math.Between(0, pool.length - 1)];
    f.isDripping = true;
    f.dirtyBody  = true;

    // Alert rings
    const cx = f.x, cy = this.floorY - 34;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 110, () => {
        const r = this.add.circle(cx, cy, 16 + i * 10, 0xEF4444, 0).setDepth(20);
        r.setStrokeStyle(2.5, 0xEF4444, 1);
        this.tweens.add({ targets: r, scale: 1.9, alpha: 0, duration: 420, onComplete: () => r.destroy() });
      });
    }
  }

  animDrops(f: Faucet) {
    const g  = f.dropsGfx;
    g.clear();
    const sx = f.x + f.side * 20;
    const sy = this.floorY - 46;
    for (let i = 0; i < 4; i++) {
      const t = (this.dropPhase * 2.6 + i * 0.75) % 1;
      g.fillStyle(0x38BDF8, (1 - t) * 0.9);
      g.fillCircle(sx + Math.sin(t * 5) * 2, sy + t * 52, 3.5 - t * 1.8);
    }
  }

  tickCharacter(dt: number) {
    switch (this.charState) {
      case 'idle':
        if (this.queue.length > 0) {
          this.currentId = this.queue[0];
          this.charState = 'moving';
        }
        break;

      case 'moving': {
        const target = this.faucets[this.currentId!];
        if (!target) { this.charState = 'idle'; break; }
        const dx   = target.x - this.charX;
        const dist = Math.abs(dx);
        if (dist < 4) {
          this.charX     = target.x;
          this.charState = 'closing';
          this.closingTimer = CLOSE_SECS;
          this.toolTxt.setPosition(this.charX, this.charY - 68).setVisible(true);
          // highlight targeted faucet
          target.dirtyBody = true;
        } else {
          this.charX   += Math.sign(dx) * Math.min(CHAR_SPEED * dt, dist);
          this.walkPhase += dt;
        }
        break;
      }

      case 'closing':
        this.closingTimer -= dt;
        if (this.closingTimer <= 0) {
          this.toolTxt.setVisible(false);
          const f = this.faucets[this.currentId!];
          if (f) {
            f.isDripping = false;
            f.queued     = false;
            f.dropsGfx.clear();
            f.badge.setVisible(false);
            f.dirtyBody = true;
          }
          this.queue.shift();
          // Renumber badges
          for (let i = 0; i < this.queue.length; i++) {
            this.faucets[this.queue[i]].badge.setText(`#${i + 1}`);
          }
          this.currentId = null;
          this.charState = 'idle';
        }
        break;
    }

    this.redrawChar();
  }
}
