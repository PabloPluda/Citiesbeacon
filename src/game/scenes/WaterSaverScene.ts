import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID   = 4;
const HUD_H        = 58;
const PAD          = 10;
const BTN_W        = 106;
const BTN_H        = 58;
const TANK_PASSIVE = 0.18; // %/sec base drain when all closed

// ─── Types ────────────────────────────────────────────────────────────────────
interface FaucetDef {
  floor: 0 | 1 | 2 | 3; // 0=garden, 1=kitchen, 2=bath, 3=top-bath
  xr:    number;
  label: string;
  icon:  string;
  drain: number; // extra %/sec when open
}

const DEFS: FaucetDef[] = [
  { floor: 3, xr: 0.20, label: 'Bañadera',   icon: '🛁',  drain: 3.0 },
  { floor: 3, xr: 0.68, label: 'Lavabo',      icon: '🚰',  drain: 0.9 },
  { floor: 2, xr: 0.20, label: 'Ducha',       icon: '🚿',  drain: 2.2 },
  { floor: 2, xr: 0.68, label: 'Lavabo',      icon: '🪥',  drain: 0.9 },
  { floor: 1, xr: 0.20, label: 'Bacha',       icon: '🍳',  drain: 1.5 },
  { floor: 1, xr: 0.68, label: 'Lavaplatos',  icon: '🍽️', drain: 1.3 },
  { floor: 0, xr: 0.22, label: 'Aspersor',    icon: '🌿',  drain: 2.5 },
  { floor: 0, xr: 0.70, label: 'Manguera',    icon: '💦',  drain: 2.0 },
];

function getLevelCfg(level: number) {
  const time         = Math.min(40 + level * 4, 100);
  const openInterval = Math.max(1.0, 4.8 - level * 0.17);
  const maxOpen      = Math.min(6, 1 + Math.floor(level / 3));
  const overflowTime = Math.max(3.0, 8.5 - level * 0.25);
  const drainMult    = 1 + level * 0.06;
  return { time, openInterval, maxOpen, overflowTime, drainMult };
}

interface Faucet {
  def:        FaucetDef;
  isOpen:     boolean;
  openTimer:  number;
  overflowing:boolean;
  btnGfx:     Phaser.GameObjects.Graphics;
  waterGfx:   Phaser.GameObjects.Graphics;
  ofGfx:      Phaser.GameObjects.Graphics;
  statusTxt:  Phaser.GameObjects.Text;
  bx: number; by: number;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export class WaterSaverScene extends Phaser.Scene {
  level     = 1;
  timeLeft  = 45;
  done      = false;
  tankPct   = 100;

  faucets:  Faucet[] = [];
  tankGfx!: Phaser.GameObjects.Graphics;
  pctTxt!:  Phaser.GameObjects.Text;
  nextOpen  = 3.0;
  dropPhase = 0;

  W = 0; H = 0;
  roofY = 0; roofH = 0; floorH = 0; gardenH = 0;
  bldX  = 0; bldW  = 0;

  constructor() { super('WaterSaverScene'); }

  init(data?: { level?: number }) {
    if (data?.level !== undefined) {
      this.level = data.level;
    } else {
      const reg = this.registry?.get('startLevel') as number | undefined;
      if (reg != null) { this.registry.remove('startLevel'); this.level = reg; }
      else { this.level = Math.min((useProgressStore.getState().highestLevel[MISSION_ID] ?? 0) + 1, 20); }
    }
    this.tankPct   = 100;
    this.done      = false;
    this.faucets   = [];
    this.nextOpen  = Math.max(1.5, 4.0 - this.level * 0.1);
    this.dropPhase = 0;
  }

  create() {
    this.W = this.cameras.main.width;
    this.H = this.cameras.main.height;
    const W = this.W, H = this.H;
    const cfg = getLevelCfg(this.level);
    this.timeLeft = cfg.time;

    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);
    EventBus.emit('game-scored-update', '💧100%');

    const onRestart = (d: { level: number }) => setTimeout(() => this.scene.restart(d), 0);
    EventBus.on('restart-scene', onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', onRestart));

    // Layout
    this.bldX    = PAD;
    this.bldW    = W - PAD * 2;
    const bldH   = H - HUD_H;
    this.roofH   = Math.round(bldH * 0.13);
    this.gardenH = Math.round(bldH * 0.20);
    this.floorH  = Math.round((bldH - this.roofH - this.gardenH) / 3);
    this.roofY   = HUD_H;

    this.drawBuilding();
    this.createFaucets();
    this.buildTankHUD();

    if (this.level === 1) this.showHint();

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

  // ── Layout helpers ────────────────────────────────────────────────────────────

  secTop(floor: 0 | 1 | 2 | 3): number {
    // floor 3 = top-bath (just below roof), 2 = bath, 1 = kitchen, 0 = garden (bottom)
    return this.roofY + this.roofH + (3 - floor) * this.floorH;
  }

  secH(floor: 0 | 1 | 2 | 3): number {
    return floor === 0 ? this.gardenH : this.floorH;
  }

  // ── Building visuals ──────────────────────────────────────────────────────────

  drawBuilding() {
    const W = this.W, H = this.H;
    const bx = this.bldX, bw = this.bldW;

    // Sky backdrop
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0B1426, 0x0B1426, 0x1A2744, 0x1A2744, 1);
    bg.fillRect(0, 0, W, H);

    // Floor sections
    type Sec = { y: number; h: number; fill: number; border: number; lbl: string };
    const secs: Sec[] = [
      { y: this.roofY,    h: this.roofH,   fill: 0x1B2845, border: 0x60A5FA, lbl: 'Azotea 🏗️' },
      { y: this.secTop(3), h: this.floorH,  fill: 0x16293F, border: 0x7DD3FC, lbl: 'Piso 3 · Baño' },
      { y: this.secTop(2), h: this.floorH,  fill: 0x16293F, border: 0x7DD3FC, lbl: 'Piso 2 · Baño' },
      { y: this.secTop(1), h: this.floorH,  fill: 0x2A1F18, border: 0xFBBF24, lbl: 'Piso 1 · Cocina' },
      { y: this.secTop(0), h: this.gardenH, fill: 0x142B16, border: 0x4ADE80, lbl: 'Jardín 🌿' },
    ];

    for (const s of secs) {
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(s.fill);
      g.fillRect(bx, s.y, bw, s.h);
      g.lineStyle(1.5, s.border, 0.3);
      g.strokeRect(bx, s.y, bw, s.h);
      this.add.text(bx + 10, s.y + 5, s.lbl, {
        fontFamily: 'Fredoka One', fontSize: '11px',
        color: '#' + s.border.toString(16).padStart(6, '0'),
      }).setAlpha(0.75).setDepth(4);
    }

    // Building frame
    const frame = this.add.graphics().setDepth(5);
    frame.lineStyle(3, 0x4A5568, 0.7);
    frame.strokeRect(bx, this.roofY, bw, H - this.roofY);

    this.drawTankVisual();
    this.drawRoomDecor();
  }

  drawTankVisual() {
    const bx = this.bldX, bw = this.bldW;
    const rY = this.roofY, rH = this.roofH;
    const cx = bx + bw / 2;
    const cy = rY + rH * 0.55;
    const tw = 66, th = rH * 0.50;

    const g = this.add.graphics().setDepth(3);
    g.lineStyle(3, 0x60A5FA, 0.85);
    g.strokeRect(cx - tw / 2, cy - th / 2, tw, th);
    g.lineStyle(2, 0x60A5FA, 0.55);
    g.lineBetween(cx - tw / 2 - 5, cy - th / 2, cx + tw / 2 + 5, cy - th / 2);
    g.lineStyle(3, 0x60A5FA, 0.45);
    g.lineBetween(cx, cy + th / 2, cx, rY + rH + 2);
    g.lineStyle(2, 0x60A5FA, 0.25);
    g.lineBetween(bx + 18, rY + rH, cx, rY + rH);
    g.lineBetween(cx, rY + rH, bx + bw - 18, rY + rH);
    this.add.text(cx, cy + 2, '🏗️', { fontSize: '20px' }).setOrigin(0.5).setDepth(4);
  }

  drawRoomDecor() {
    const bx = this.bldX, bw = this.bldW;
    const fh  = this.floorH;
    const gh  = this.gardenH;

    // Piso 3 — bathtub outline left, sink circle right
    const y3 = this.secTop(3);
    const d3 = this.add.graphics().setDepth(2);
    d3.lineStyle(1.5, 0x7DD3FC, 0.2);
    d3.strokeRoundedRect(bx + bw * 0.06, y3 + fh * 0.38, bw * 0.32, fh * 0.48, 6);
    d3.fillStyle(0x7DD3FC, 0.05);
    d3.fillRoundedRect(bx + bw * 0.06, y3 + fh * 0.38, bw * 0.32, fh * 0.48, 6);
    d3.strokeCircle(bx + bw * 0.75, y3 + fh * 0.60, 14);

    // Piso 2 — shower tray left, sink right
    const y2 = this.secTop(2);
    const d2 = this.add.graphics().setDepth(2);
    d2.lineStyle(1.5, 0x7DD3FC, 0.2);
    d2.strokeRect(bx + bw * 0.08, y2 + fh * 0.30, bw * 0.28, fh * 0.56);
    d2.strokeCircle(bx + bw * 0.75, y2 + fh * 0.57, 14);

    // Piso 1 — counter + double sink circles
    const y1 = this.secTop(1);
    const d1 = this.add.graphics().setDepth(2);
    d1.lineStyle(1.5, 0xFBBF24, 0.18);
    d1.strokeRect(bx + bw * 0.04, y1 + fh * 0.52, bw * 0.92, fh * 0.10);
    d1.strokeCircle(bx + bw * 0.26, y1 + fh * 0.68, 12);
    d1.strokeCircle(bx + bw * 0.75, y1 + fh * 0.68, 12);

    // Jardín — ground strip + plant silhouettes
    const y0 = this.secTop(0);
    const d0 = this.add.graphics().setDepth(2);
    d0.fillStyle(0x166534, 0.30);
    d0.fillRect(bx, y0 + gh - 18, bw, 18);
    d0.lineStyle(1.5, 0x4ADE80, 0.25);
    for (let i = 0; i < 6; i++) {
      const px = bx + bw * (0.08 + i * 0.16);
      d0.lineBetween(px, y0 + gh - 18, px - 5, y0 + gh - 30);
      d0.lineBetween(px, y0 + gh - 18, px,      y0 + gh - 32);
      d0.lineBetween(px, y0 + gh - 18, px + 5,  y0 + gh - 30);
    }
  }

  // ── Faucets ───────────────────────────────────────────────────────────────────

  createFaucets() {
    const bx = this.bldX, bw = this.bldW;

    for (const def of DEFS) {
      const fy   = this.secTop(def.floor);
      const fh   = this.secH(def.floor);
      const fx   = bx + PAD + (bw - PAD * 2) * def.xr - BTN_W / 2;
      const fy2  = fy + fh * 0.5 - BTN_H / 2 + 6;

      const btnGfx  = this.add.graphics().setDepth(10);
      const waterGfx = this.add.graphics().setDepth(11);
      const ofGfx   = this.add.graphics().setDepth(8);

      this.add.text(fx + BTN_W * 0.25, fy2 + BTN_H * 0.50, def.icon, {
        fontSize: '26px',
      }).setOrigin(0.5).setDepth(12);

      this.add.text(fx + BTN_W * 0.65, fy2 + BTN_H * 0.22, def.label, {
        fontFamily: 'Fredoka One', fontSize: '11px', color: '#CBD5E1',
        wordWrap: { width: BTN_W * 0.6 },
      }).setOrigin(0.5, 0).setDepth(12);

      const statusTxt = this.add.text(fx + BTN_W * 0.65, fy2 + BTN_H * 0.60, '✅', {
        fontFamily: 'Fredoka One', fontSize: '14px', color: '#4ADE80',
      }).setOrigin(0.5, 0).setDepth(12);

      const faucet: Faucet = {
        def, isOpen: false, openTimer: 0, overflowing: false,
        btnGfx, waterGfx, ofGfx, statusTxt,
        bx: fx, by: fy2,
      };
      this.drawBtn(faucet);
      this.faucets.push(faucet);

      const zone = this.add.zone(fx + BTN_W / 2, fy2 + BTN_H / 2, BTN_W + 8, BTN_H + 8)
        .setInteractive().setDepth(15);
      zone.on('pointerdown', () => {
        if (!this.done && faucet.isOpen) this.closeFaucet(faucet);
      });
    }
  }

  drawBtn(f: Faucet) {
    const g = f.btnGfx;
    g.clear();
    if (f.isOpen) {
      g.fillStyle(0x7F1D1D, 0.92);
      g.fillRoundedRect(f.bx, f.by, BTN_W, BTN_H, 10);
      g.lineStyle(2.5, 0xEF4444, 1.0);
      g.strokeRoundedRect(f.bx, f.by, BTN_W, BTN_H, 10);
    } else {
      g.fillStyle(0x14532D, 0.75);
      g.fillRoundedRect(f.bx, f.by, BTN_W, BTN_H, 10);
      g.lineStyle(2, 0x22C55E, 0.55);
      g.strokeRoundedRect(f.bx, f.by, BTN_W, BTN_H, 10);
    }
  }

  openFaucet(f: Faucet) {
    f.isOpen    = true;
    f.openTimer = 0;
    f.overflowing = false;
    this.drawBtn(f);
    f.statusTxt.setText('💧 CERRAR!').setStyle({ color: '#FCA5A5' });

    // Ripple rings to attract attention
    const cx = f.bx + BTN_W / 2, cy = f.by + BTN_H / 2;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 110, () => {
        const r = this.add.circle(cx, cy, 18 + i * 12, 0xFBBF24, 0).setDepth(20);
        r.setStrokeStyle(2, 0xFBBF24, 1);
        this.tweens.add({ targets: r, scale: 1.8, alpha: 0, duration: 420, onComplete: () => r.destroy() });
      });
    }
  }

  closeFaucet(f: Faucet) {
    f.isOpen      = false;
    f.openTimer   = 0;
    f.overflowing = false;
    f.waterGfx.clear();
    f.ofGfx.clear();
    this.drawBtn(f);
    f.statusTxt.setText('✅').setStyle({ color: '#4ADE80' });

    const burst = this.add.circle(f.bx + BTN_W / 2, f.by + BTN_H / 2, 10, 0x4ADE80, 0.9).setDepth(20);
    this.tweens.add({ targets: burst, scale: 3.2, alpha: 0, duration: 280, onComplete: () => burst.destroy() });
  }

  // ── Tank bar (in-canvas HUD strip) ────────────────────────────────────────────

  buildTankHUD() {
    this.tankGfx = this.add.graphics().setDepth(30).setScrollFactor(0);
    this.pctTxt  = this.add.text(0, 0, '', {
      fontFamily: 'Fredoka One', fontSize: '13px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0);
    this.redrawTank();
  }

  redrawTank() {
    const g  = this.tankGfx;
    g.clear();
    const W  = this.W;
    const bx = 56, by = 14, bw = W - 56 - 14, bh = 18;

    g.fillStyle(0x0F172A, 0.6);
    g.fillRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 6);
    g.fillStyle(0x7F1D1D);
    g.fillRoundedRect(bx, by, bw, bh, 5);

    const fw  = Math.max(0, (this.tankPct / 100) * bw);
    const col = this.tankPct > 55 ? 0x3B82F6 : this.tankPct > 25 ? 0xF59E0B : 0xEF4444;
    if (fw > 2) {
      g.fillStyle(col);
      g.fillRoundedRect(bx, by, fw, bh, 5);
      g.fillStyle(0xFFFFFF, 0.12);
      g.fillRoundedRect(bx, by, fw, bh / 2, 5);
    }
    g.lineStyle(1.5, 0x60A5FA, 0.5);
    g.strokeRoundedRect(bx, by, bw, bh, 5);

    const pct = Math.ceil(this.tankPct);
    this.pctTxt.setText(`💧 ${pct}%`).setPosition(bx + Math.max(fw / 2, 30), by + bh / 2);
    EventBus.emit('game-scored-update', `${pct}%`);
  }

  // ── Tutorial hint ─────────────────────────────────────────────────────────────

  showHint() {
    const W = this.W, H = this.H;
    const cx = W / 2, cy = H * 0.44;
    const objs: Phaser.GameObjects.GameObject[] = [];

    objs.push(this.add.rectangle(cx, cy, W * 0.80, 110, 0x000000, 0.75).setDepth(80));
    objs.push(this.add.text(cx, cy - 30, '💧 ¡Cerrá las canillas!', {
      fontFamily: 'Fredoka One', fontSize: '20px', color: '#60A5FA',
    }).setOrigin(0.5).setDepth(81));
    objs.push(this.add.text(cx, cy + 2, 'Cuando una canilla se pone roja → tocala\npara cerrarla antes de que el tanque se vacíe.', {
      fontFamily: 'Fredoka One', fontSize: '13px', color: '#CBD5E1', align: 'center',
    }).setOrigin(0.5).setDepth(81));

    this.time.delayedCall(2800, () => {
      this.tweens.add({ targets: objs, alpha: 0, duration: 400, onComplete: () => objs.forEach(o => o.destroy()) });
    });
  }

  // ── Update loop ───────────────────────────────────────────────────────────────

  update(_t: number, delta: number) {
    if (this.done) return;
    const dt  = delta / 1000;
    const cfg = getLevelCfg(this.level);
    this.dropPhase += dt;

    // Auto-open faucets
    this.nextOpen -= dt;
    if (this.nextOpen <= 0) {
      this.tryAutoOpen(cfg.maxOpen);
      this.nextOpen = cfg.openInterval * (0.75 + Math.random() * 0.5);
    }

    // Drain tank
    let drain = TANK_PASSIVE;
    for (const f of this.faucets) {
      if (!f.isOpen) continue;
      f.openTimer += dt;
      drain += f.def.drain * cfg.drainMult;
      if (!f.overflowing && f.openTimer >= cfg.overflowTime) f.overflowing = true;
      this.animWater(f);
      if (f.overflowing) this.animOverflow(f, cfg.overflowTime);
    }

    this.tankPct = Math.max(0, this.tankPct - drain * dt);
    this.redrawTank();

    if (this.tankPct <= 0) {
      this.done = true;
      this.time.delayedCall(350, () => EventBus.emit('game-time-up', '0'));
    }
  }

  tryAutoOpen(maxOpen: number) {
    if (this.faucets.filter(f => f.isOpen).length >= maxOpen) return;
    const closed = this.faucets.filter(f => !f.isOpen);
    if (!closed.length) return;
    this.openFaucet(closed[Phaser.Math.Between(0, closed.length - 1)]);
  }

  animWater(f: Faucet) {
    const g  = f.waterGfx;
    g.clear();
    const cx = f.bx + BTN_W * 0.66;
    const by = f.by + BTN_H - 2;
    for (let i = 0; i < 4; i++) {
      const t = (this.dropPhase * 2.5 + i * 0.7) % 1;
      const alpha = 1 - t;
      g.fillStyle(0x60A5FA, alpha * 0.9);
      g.fillCircle(cx + Math.sin(t * 5) * 2, by + t * 38, 3.5 - t * 1.5);
    }
  }

  animOverflow(f: Faucet, overflowTime: number) {
    const g  = f.ofGfx;
    g.clear();
    const fy  = this.secTop(f.def.floor);
    const fh  = this.secH(f.def.floor);
    const pw  = Math.min((f.openTimer - overflowTime) * 14 + 22, this.bldW * 0.44);
    const pcx = f.bx + BTN_W / 2;
    const py  = fy + fh - 8;
    g.fillStyle(0x3B82F6, 0.38);
    g.fillEllipse(pcx, py, pw, 13);
    g.fillStyle(0x93C5FD, 0.20);
    g.fillEllipse(pcx, py - 3, pw * 0.55, 7);
  }
}
