import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID  = 4;
const RIVER_RATIO = 0.28;
const CHAR_SPEED  = 150;
const CLOSE_SECS  = 0.9;
const SINK_W      = 60;
const SINK_H      = 50;
const WALL_W      = 80;   // wall strip width on each side

// ─── Level config ──────────────────────────────────────────────────────────────
function getLevelCfg(level: number) {
  let faucetCount: number, time: number;
  if      (level <= 3)  { faucetCount = 6;  time = 45;  }
  else if (level <= 8)  { faucetCount = 8;  time = 80;  }
  else if (level <= 14) { faucetCount = 10; time = 100; }
  else                  { faucetCount = 12; time = 120; }

  const openInterval   = Math.max(1.0, 5.2 - level * 0.2);
  const maxDripping    = Math.min(Math.floor(faucetCount * 0.55), 1 + Math.floor(level / 3));
  const drainPerFaucet = 1.0 + level * 0.1;
  return { time, faucetCount, openInterval, maxDripping, drainPerFaucet };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Faucet {
  id:         number;
  x:          number;
  y:          number;
  wallSide:   -1 | 1;   // -1 = left wall, 1 = right wall
  isDripping: boolean;
  queued:     boolean;
  bodyGfx:    Phaser.GameObjects.Graphics;
  dripsGfx:   Phaser.GameObjects.Graphics;
  badge:      Phaser.GameObjects.Text;
  dirtyBody:  boolean;
}

type CharState = 'idle' | 'moving' | 'closing';

// ─── Scene ────────────────────────────────────────────────────────────────────
export class WaterSaverScene extends Phaser.Scene {
  level      = 1;
  timeLeft   = 45;
  done       = false;
  waterPct   = 100;
  lastVitPct = 101;

  faucets:   Faucet[]  = [];
  queue:     number[]  = [];
  charState: CharState = 'idle';
  charX      = 0;
  charY      = 0;
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
    this.waterPct     = 100;
    this.lastVitPct   = 101;
    this.done         = false;
    this.faucets      = [];
    this.queue        = [];
    this.charState    = 'idle';
    this.currentId    = null;
    this.dropPhase    = 0;
    this.walkPhase    = 0;
    this.waveOff      = 0;
    this.treeGfxList  = [];
    this.flowerGfxList = [];
    this.nextOpen     = Math.max(2.5, 5.5 - this.level * 0.15);
  }

  create() {
    this.W = this.cameras.main.width;
    this.H = this.cameras.main.height;
    const W = this.W, H = this.H;
    const cfg = getLevelCfg(this.level);
    this.timeLeft = cfg.time;
    this.riverH   = Math.round(H * RIVER_RATIO);
    this.charX    = W / 2;
    this.charY    = this.riverH + (H - this.riverH) / 2;

    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);

    const onRestart = (d: { level: number }) => setTimeout(() => this.scene.restart(d), 0);
    EventBus.on('restart-scene', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', onRestart));

    this.buildBathroomFloor();
    this.buildRiver();
    this.buildFaucets(cfg.faucetCount);
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

  // ── Bathroom floor ────────────────────────────────────────────────────────────

  buildBathroomFloor() {
    const W = this.W, H = this.H;
    const rH = this.riverH;
    const g = this.add.graphics().setDepth(0);

    // Center corridor floor — large creamy off-white tiles
    g.fillStyle(0xEDE7E0);
    g.fillRect(0, rH, W, H - rH);

    // Large tile squares (subtle, no harsh lines)
    const TILE = 80;
    g.lineStyle(1, 0xD4CCBF, 0.22);
    for (let x = TILE; x < W - WALL_W; x += TILE) g.lineBetween(x, rH, x, H);
    for (let y = rH + TILE; y < H; y += TILE) g.lineBetween(WALL_W, y, W - WALL_W, y);

    // Left wall strip (matte ceramic look)
    g.fillStyle(0xD9D2CA);
    g.fillRect(0, rH, WALL_W, H - rH);
    // Left counter edge
    g.lineStyle(2.5, 0xB8B0A8);
    g.lineBetween(WALL_W, rH, WALL_W, H);

    // Right wall strip
    g.fillStyle(0xD9D2CA);
    g.fillRect(W - WALL_W, rH, WALL_W, H - rH);
    // Right counter edge
    g.lineStyle(2.5, 0xB8B0A8);
    g.lineBetween(W - WALL_W, rH, W - WALL_W, H);

    // Mirror strip on left wall (top decorative element above sinks)
    g.fillStyle(0xC5D8E4, 0.55);
    g.fillRect(2, rH + 4, WALL_W - 4, 12);
    g.fillStyle(0xC5D8E4, 0.55);
    g.fillRect(W - WALL_W + 2, rH + 4, WALL_W - 4, 12);

    // River/bathroom divider
    g.lineStyle(3, 0xA09890, 0.8);
    g.lineBetween(0, rH, W, rH);
  }

  // ── River zone ────────────────────────────────────────────────────────────────

  buildRiver() {
    const W = this.W;
    const rH = this.riverH;

    const sky = this.add.graphics().setDepth(1);
    sky.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xB8E4F7, 0xB8E4F7, 1);
    sky.fillRect(0, 0, W, rH * 0.5);

    const bank = this.add.graphics().setDepth(1);
    bank.fillStyle(0x4ADE80);
    bank.fillRect(0, rH * 0.45, W, rH * 0.55);
    bank.fillStyle(0x16A34A);
    bank.fillRect(0, rH - 14, W, 14);
    bank.fillStyle(0x0EA5E9);
    bank.fillRoundedRect(8, rH * 0.38, W - 16, rH * 0.42, 8);

    this.riverFillGfx = this.add.graphics().setDepth(3);
    this.waveGfx      = this.add.graphics().setDepth(4);

    const treeXs = [W * 0.07, W * 0.22, W * 0.50, W * 0.78, W * 0.93];
    for (const tx of treeXs) {
      const g = this.add.graphics().setDepth(5);
      this.drawTree(g, tx, rH * 0.55, 1);
      this.treeGfxList.push(g);
    }

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

    this.pctTxt = this.add.text(W / 2, rH * 0.62, '💧 100%', {
      fontFamily: 'Fredoka One', fontSize: '20px',
      color: '#0C4A6E', stroke: '#FFFFFF', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);
  }

  drawTree(g: Phaser.GameObjects.Graphics, x: number, baseY: number, vit: number) {
    g.clear();
    const crown = vit > 0.6 ? 0x16A34A : vit > 0.3 ? 0xCA8A04 : 0x92400E;
    const dark  = vit > 0.6 ? 0x15803D : vit > 0.3 ? 0xA16207 : 0x78350F;
    g.fillStyle(0x78350F);
    g.fillRect(x - 4, baseY - 22, 8, 22);
    g.fillStyle(crown);
    g.fillCircle(x, baseY - 26, 17);
    if (vit > 0.35) {
      g.fillStyle(dark);
      g.fillCircle(x - 8, baseY - 22, 11);
      g.fillCircle(x + 8, baseY - 20, 10);
    }
  }

  drawFlower(g: Phaser.GameObjects.Graphics, x: number, y: number, vit: number, color: number) {
    g.clear();
    g.lineStyle(2, vit > 0.5 ? 0x16A34A : 0xCA8A04);
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
    const fds = [
      { x: W * 0.13, c: 0xFF6B6B }, { x: W * 0.30, c: 0xFFD93D },
      { x: W * 0.44, c: 0xFF8E53 }, { x: W * 0.56, c: 0x86EFAC },
      { x: W * 0.70, c: 0xFFD93D }, { x: W * 0.87, c: 0xFF6B6B },
    ];
    for (let i = 0; i < this.flowerGfxList.length; i++) {
      this.drawFlower(this.flowerGfxList[i], fds[i].x, rH * 0.42, vit, fds[i].c);
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

  // ── Sinks / Faucets ───────────────────────────────────────────────────────────

  buildFaucets(count: number) {
    const W = this.W, H = this.H;
    const perSide = count / 2;
    const my    = 48;
    const playH = H - this.riverH - my * 2;
    const leftX  = WALL_W / 2;
    const rightX = W - WALL_W / 2;

    let id = 0;
    for (let i = 0; i < perSide; i++) {
      const fy = this.riverH + my + playH * (i + 0.5) / perSide;
      this.makeSink(id++, leftX,  fy, -1);
      this.makeSink(id++, rightX, fy,  1);
    }
  }

  makeSink(id: number, x: number, y: number, wallSide: -1 | 1) {
    const bodyGfx  = this.add.graphics().setDepth(5);
    const dripsGfx = this.add.graphics().setDepth(7);
    const badge    = this.add.text(x, y - SINK_H / 2 - 12, '', {
      fontFamily: 'Fredoka One', fontSize: '14px', color: '#FFFFFF',
      backgroundColor: '#2563EB', padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(11).setVisible(false);

    const f: Faucet = {
      id, x, y, wallSide,
      isDripping: false, queued: false,
      bodyGfx, dripsGfx, badge, dirtyBody: true,
    };
    this.drawSink(f, false);
    this.faucets.push(f);

    const zone = this.add.zone(x, y, SINK_W + 22, SINK_H + 22)
      .setInteractive().setDepth(12);
    zone.on('pointerdown', () => {
      if (this.done || !f.isDripping || f.queued) return;
      f.queued = true;
      this.queue.push(id);
      f.badge.setText(`#${this.queue.length}`).setVisible(true);
      f.dirtyBody = true;
    });
  }

  drawSink(f: Faucet, highlighted: boolean) {
    const g  = f.bodyGfx;
    const { x, y, wallSide: ws } = f;
    const bx = x - SINK_W / 2, by = y - SINK_H / 2;
    g.clear();

    // ── Counter surface ──
    g.fillStyle(0xCBC4BC);
    g.fillRoundedRect(bx - 6, by - 6, SINK_W + 12, SINK_H + 12, 8);
    // Counter highlight edge (inner bevel)
    g.lineStyle(1.5, 0xE0D8D0, 0.7);
    g.strokeRoundedRect(bx - 4, by - 4, SINK_W + 8, SINK_H + 8, 7);

    // ── Porcelain basin ──
    const basinFill = f.isDripping ? 0xC8E8F5 : 0xF4F2EF;
    g.fillStyle(basinFill);
    g.fillRoundedRect(bx, by, SINK_W, SINK_H, 10);
    // Basin inner shadow (subtle depth)
    g.lineStyle(2, 0xB8B0A8, 0.45);
    g.strokeRoundedRect(bx, by, SINK_W, SINK_H, 10);
    g.lineStyle(1, 0xFFFFFF, 0.5);
    g.strokeRoundedRect(bx + 2, by + 2, SINK_W - 4, SINK_H - 4, 8);

    // ── Water fill (when dripping) ──
    if (f.isDripping) {
      g.fillStyle(0x38BDF8, 0.45);
      g.fillRoundedRect(bx + 4, by + 4, SINK_W - 8, SINK_H - 8, 7);
      // Water shimmer line
      g.fillStyle(0xFFFFFF, 0.28);
      g.fillRoundedRect(bx + 5, by + 5, SINK_W - 10, 6, 3);
    }

    // ── Drain (bottom center) ──
    const drainCol = f.isDripping ? 0x0369A1 : 0x8E9CAA;
    g.fillStyle(drainCol);
    g.fillCircle(x, y + 10, 6);
    g.fillStyle(basinFill);
    g.fillCircle(x, y + 10, 3.5);
    // Cross slits
    g.lineStyle(1.2, drainCol, 0.8);
    g.lineBetween(x - 4, y + 10, x + 4, y + 10);
    g.lineBetween(x, y + 6.5, x, y + 13.5);

    // ── Faucet assembly (top of basin) ──
    const spoutDir = ws < 0 ? 1 : -1;    // left wall → spout points right (toward center)
    const fY       = by + 8;              // faucet base Y
    const chrome   = f.isDripping ? 0x9EC8DC : 0xD0D5D8;
    const chromeLt = f.isDripping ? 0xBCDBEA : 0xE8EBED;
    const handle   = f.isDripping ? 0xDC2626 : 0x16A34A;
    const handleDk = f.isDripping ? 0xB91C1C : 0x15803D;

    // Pipe base (vertical)
    g.fillStyle(chrome);
    g.fillRoundedRect(x - 4.5, fY - 2, 9, 16, 4);
    g.fillStyle(chromeLt);
    g.fillRoundedRect(x - 2, fY - 1, 4, 7, 2);

    // Spout arm (horizontal, toward center)
    const armStart = spoutDir > 0 ? x : x - 20;
    g.fillStyle(chrome);
    g.fillRoundedRect(armStart, fY + 8, 21, 6, 3);
    g.fillStyle(chromeLt);
    g.fillRoundedRect(armStart, fY + 8, 21, 3, 2);
    // Spout tip (rounded end)
    g.fillStyle(chrome);
    g.fillCircle(x + spoutDir * 18, fY + 11, 5);
    // Inner opening
    g.fillStyle(f.isDripping ? 0x38BDF8 : 0x6B7280);
    g.fillCircle(x + spoutDir * 18, fY + 11, 2.5);

    // Handle lever (T-bar)
    g.fillStyle(handle);
    g.fillRoundedRect(x - 12, fY - 6, 24, 6, 3);
    g.fillStyle(handleDk);
    g.fillRoundedRect(x - 3, fY - 12, 6, 14, 3);
    // Knob center
    g.fillStyle(handle);
    g.fillCircle(x, fY - 3, 5);
    g.fillStyle(0xFFFFFF, 0.35);
    g.fillCircle(x - 1.5, fY - 4.5, 2);

    // ── Selection ring ──
    if (highlighted) {
      g.lineStyle(3.5, 0xFBBF24, 1);
      g.strokeRoundedRect(bx - 7, by - 7, SINK_W + 14, SINK_H + 14, 10);
    } else if (f.queued) {
      g.lineStyle(2.5, 0x60A5FA, 0.9);
      g.strokeRoundedRect(bx - 7, by - 7, SINK_W + 14, SINK_H + 14, 10);
    }
  }

  // ── Character ─────────────────────────────────────────────────────────────────

  buildCharacter() {
    this.charGfx = this.add.graphics().setDepth(15);
    this.toolTxt = this.add.text(0, 0, '🔧', {
      fontSize: '20px',
    }).setOrigin(0.5).setDepth(16).setVisible(false);
    this.redrawChar();
  }

  redrawChar() {
    const g  = this.charGfx;
    const cx = this.charX, cy = this.charY;
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.13);
    g.fillEllipse(cx, cy + 18, 30, 11);

    // Legs (animated when walking)
    const ls = this.charState === 'moving' ? Math.sin(this.walkPhase * 10) * 7 : 0;
    g.fillStyle(0x1E3A5F);
    g.fillEllipse(cx - 5, cy + 10 + ls, 8, 15);
    g.fillEllipse(cx + 5, cy + 10 - ls, 8, 15);

    // Body (blue shirt)
    g.fillStyle(0x3B82F6);
    g.fillEllipse(cx, cy + 2, 24, 20);
    g.fillStyle(0x2563EB);
    g.fillEllipse(cx, cy - 2, 22, 12);

    // Arms
    g.lineStyle(5, 0xFED7AA);
    if (this.charState === 'closing') {
      g.lineBetween(cx - 12, cy - 1, cx - 22, cy - 14);
      g.lineBetween(cx + 12, cy - 1, cx + 22, cy - 14);
    } else {
      const as = this.charState === 'moving' ? Math.sin(this.walkPhase * 10 + Math.PI) * 7 : 0;
      g.lineBetween(cx - 12, cy - 1, cx - 22, cy + 3 - as);
      g.lineBetween(cx + 12, cy - 1, cx + 22, cy + 3 + as);
    }

    // Head
    g.fillStyle(0xFED7AA);
    g.fillCircle(cx, cy - 12, 11);
    // Hair
    g.fillStyle(0x78350F);
    g.fillRoundedRect(cx - 11, cy - 24, 22, 11, 6);

    // Eyes (look toward target when moving)
    let eyeAngle = 0;
    if (this.charState === 'moving' && this.currentId !== null && this.faucets[this.currentId]) {
      const t = this.faucets[this.currentId];
      eyeAngle = Math.atan2(t.y - cy, t.x - cx);
    }
    g.fillStyle(0x1C1917);
    g.fillCircle(cx + Math.cos(eyeAngle + 0.42) * 5, cy - 12 + Math.sin(eyeAngle + 0.42) * 5, 2);
    g.fillCircle(cx + Math.cos(eyeAngle - 0.42) * 5, cy - 12 + Math.sin(eyeAngle - 0.42) * 5, 2);
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(_t: number, delta: number) {
    if (this.done) return;
    const dt  = delta / 1000;
    const cfg = getLevelCfg(this.level);
    this.dropPhase += dt;
    this.waveOff   += dt * 1.8;

    // Auto-open faucets
    this.nextOpen -= dt;
    if (this.nextOpen <= 0) {
      this.tryAutoOpen(cfg.maxDripping);
      this.nextOpen = cfg.openInterval * (0.7 + Math.random() * 0.6);
    }

    // Drain river
    const dripping = this.faucets.filter(f => f.isDripping).length;
    this.waterPct  = Math.max(0, this.waterPct - dripping * cfg.drainPerFaucet * dt);

    this.drawRiverFill();
    if (Math.abs(this.waterPct - this.lastVitPct) >= 2) {
      this.updateVitality();
      this.lastVitPct = this.waterPct;
    }

    // Sink animations
    for (const f of this.faucets) {
      if (f.isDripping) this.animDrip(f);
      else f.dripsGfx.clear();
      if (f.dirtyBody) { this.drawSink(f, f.id === this.currentId); f.dirtyBody = false; }
    }

    this.tickCharacter(dt);

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
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 100, () => {
        const r = this.add.circle(f.x, f.y, 22 + i * 10, 0xEF4444, 0).setDepth(20);
        r.setStrokeStyle(2.5, 0xEF4444, 1);
        this.tweens.add({ targets: r, scale: 1.8, alpha: 0, duration: 420, onComplete: () => r.destroy() });
      });
    }
  }

  animDrip(f: Faucet) {
    const g  = f.dripsGfx;
    const ws = f.wallSide;
    const fY = f.y - SINK_H / 2 + 8;
    // Spout tip position (top-down)
    const spoutX = f.x + (ws < 0 ? 1 : -1) * 18;
    const spoutY = fY + 11;
    g.clear();

    // Ripple rings expanding from spout impact
    for (let i = 0; i < 3; i++) {
      const t = (this.dropPhase * 2.4 + i * 0.34) % 1;
      g.lineStyle(1.5, 0x38BDF8, (1 - t) * 0.6);
      g.strokeCircle(spoutX, spoutY, t * 13 + 2);
    }

    // Animated water drop from tip
    const td = (this.dropPhase * 3.5) % 1;
    const dropY = fY + 5 + td * 9;
    g.fillStyle(0x7DD3FC, 0.9 * (1 - td * 0.4));
    g.fillCircle(spoutX, dropY, 3 - td * 1.2);
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
        const dy   = target.y - this.charY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) {
          this.charX        = target.x;
          this.charY        = target.y;
          this.charState    = 'closing';
          this.closingTimer = CLOSE_SECS;
          this.toolTxt.setPosition(this.charX, this.charY - 36).setVisible(true);
          target.dirtyBody  = true;
        } else {
          const step = Math.min(CHAR_SPEED * dt, dist);
          this.charX    += (dx / dist) * step;
          this.charY    += (dy / dist) * step;
          this.walkPhase += dt;
        }
        break;
      }

      case 'closing':
        this.closingTimer -= dt;
        this.toolTxt.setPosition(this.charX, this.charY - 36);
        if (this.closingTimer <= 0) {
          this.toolTxt.setVisible(false);
          const f = this.faucets[this.currentId!];
          if (f) {
            f.isDripping = false;
            f.queued     = false;
            f.dripsGfx.clear();
            f.badge.setVisible(false);
            f.dirtyBody  = true;
          }
          this.queue.shift();
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
