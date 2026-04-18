import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID = 3;

// ─── Constants ────────────────────────────────────────────────────────────────
const WIN_W      = 52;
const WIN_H      = 44;
const WIN_GAP_X  = 14;
const WIN_GAP_Y  = 16;
const WALL_PAD   = 22;
const FLOOR_H    = WIN_H + WIN_GAP_Y;
const ROOF_H     = 34;
const BASE_H     = 44;
const BLDG_GAP   = 14;
const GROUND_H   = 50;
const ACCEL_TIME = 50;   // seconds to reach max scroll speed

// Score deltas
const SCORE_CORRECT = 1;
const SCORE_MISS    = -2;  // empty window scrolls away
const SCORE_WRONG   = -3;  // tap occupied window

// Meter bar layout — left gap leaves room for the back button
const BAR_LEFT   = 72;   // x start (right of back button)
const BAR_RIGHT  = 20;   // x margin from right edge
const BAR_Y      = 80;   // y position
const BAR_H      = 18;

const WALL_COLORS = [0x2D3561, 0x1A2744, 0x2D3748, 0x3B3054, 0x1E3A2F, 0x3D2B1F, 0x2A2A4A];
const ROOF_COLORS = [0x3B4A6B, 0x2D3A5C, 0x3A3054, 0x4A3020, 0x1E3B28];

// ─── Level helpers ────────────────────────────────────────────────────────────
function getLevelCfg(level: number) {
  const floors   = level <= 2 ? 2 : level <= 5 ? 4 : level <= 10 ? 6 : 8;
  const winCols  = level <= 2 ? 2 : level <= 5 ? 3 : 4;
  const minSpeed = 58;
  const maxSpeed = Math.min(66 + level * 4, 110);
  const litRate  = 0.18 + level * 0.010;
  return { floors, winCols, minSpeed, maxSpeed, litRate };
}

function getThresholds(level: number): { win: number; lose: number } {
  if (level <= 3)  return { win: 20, lose: 20 };
  if (level <= 7)  return { win: 40, lose: 40 };
  if (level <= 15) return { win: 60, lose: 60 };
  return { win: 80, lose: 80 };
}

function bldgDims(floors: number, winCols: number) {
  const width  = 2 * WALL_PAD + winCols * WIN_W + (winCols - 1) * WIN_GAP_X;
  const height = ROOF_H + floors * FLOOR_H + BASE_H;
  return { width, height };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type WinState = 'OFF' | 'EMPTY' | 'OCCUPIED';

interface WinInfo {
  state:     WinState;
  lx:        number;
  ly:        number;
  lightGfx:  Phaser.GameObjects.Graphics;
  personTxt: Phaser.GameObjects.Text;
}

interface Building {
  container: Phaser.GameObjects.Container;
  width:     number;
  windows:   WinInfo[];
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export class LightsOutScene extends Phaser.Scene {
  level       = 1;
  score       = 0;
  streak      = 0;
  done        = false;

  scrollSpeed  = 80;
  worldRight   = 0;
  W            = 0;
  sceneStartMs = 0;

  buildings: Building[] = [];
  meterGfx!: Phaser.GameObjects.Graphics;
  barW       = 0;
  groundY    = 0;

  constructor() { super('LightsOutScene'); }

  init(data?: { level?: number }) {
    this.level       = data?.level ?? Math.min((useProgressStore.getState().highestLevel[MISSION_ID] ?? 0) + 1, 20);
    this.score       = 0;
    this.streak      = 0;
    this.done        = false;
    this.buildings   = [];
    this.worldRight  = 0;
    this.scrollSpeed = getLevelCfg(this.level).minSpeed;
  }

  create() {
    this.W            = this.cameras.main.width;
    this.sceneStartMs = this.time.now;
    const W = this.W;
    const H = this.cameras.main.height;
    this.groundY = H - GROUND_H;
    this.barW    = W - BAR_LEFT - BAR_RIGHT;

    EventBus.emit('current-scene-ready', this);
    // No timer or score shown in the React HUD for this scene

    const handleRestart = (d: { level: number }) => {
      setTimeout(() => this.scene.restart(d), 0);
    };
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('restart-scene', handleRestart);
    });

    // ── Sky
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x0A1020, 0x0A1020, 0x1A3060, 0x1A3060, 1);
    sky.fillRect(0, 0, W, this.groundY);

    // Stars
    for (let i = 0; i < 55; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, this.groundY - 80);
      const r  = Phaser.Math.FloatBetween(0.6, 2.2);
      const a  = Phaser.Math.FloatBetween(0.3, 1.0);
      const st = this.add.circle(sx, sy, r, 0xFFFFFF, a).setDepth(1);
      this.tweens.add({
        targets: st, alpha: { from: a, to: 0.05 },
        duration: Phaser.Math.Between(900, 3200),
        yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000),
      });
    }

    // Moon
    this.add.circle(W - 55, 55, 26, 0xFFF8DC, 0.9).setDepth(1);
    this.add.circle(W - 43, 50, 24, 0x1A3060, 0.95).setDepth(1);

    // Ground + continuous sidewalk base
    this.add.rectangle(W / 2, this.groundY + GROUND_H / 2, W, GROUND_H, 0x1C1C2E).setDepth(2);
    this.add.rectangle(W / 2, this.groundY - BASE_H / 2, W, BASE_H + 4, 0x1E1E30).setDepth(4);
    this.add.rectangle(W / 2, this.groundY, W, 6, 0x4A4A7A).setDepth(5);

    // ── Meter bar (Phaser canvas layer, fixed to screen)
    this.meterGfx = this.add.graphics().setDepth(58).setScrollFactor(0);
    this.drawMeter();

    // ── Global tap handler
    const onTap = (pointer: Phaser.Input.Pointer) => {
      if (this.done) return;
      const px = pointer.x;
      const py = pointer.y;
      for (const bldg of this.buildings) {
        const bx = bldg.container.x;
        const by = bldg.container.y;
        for (let i = 0; i < bldg.windows.length; i++) {
          const w = bldg.windows[i];
          if (w.state === 'OFF') continue;
          if (px >= bx + w.lx && px <= bx + w.lx + WIN_W &&
              py >= by + w.ly && py <= by + w.ly + WIN_H) {
            this.handleTap(bldg, i);
            return;
          }
        }
      }
    };
    this.input.on('pointerdown', onTap);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', onTap));

    // Pre-fill screen
    while (this.worldRight < W + 200) {
      this.spawnBuilding(true);
    }

    if (this.level === 1) this.showTutorial();
  }

  // ── Meter bar ────────────────────────────────────────────────────────────────

  drawMeter() {
    const g   = this.meterGfx;
    const bw  = this.barW;
    const cx  = BAR_LEFT + bw / 2;
    const { win, lose } = getThresholds(this.level);
    g.clear();

    // Outer shadow
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(BAR_LEFT - 1, BAR_Y + 2, bw + 2, BAR_H, 9);

    // ── Background halves
    // Left = red zone
    g.fillStyle(0xAA1111);
    g.fillRect(BAR_LEFT, BAR_Y, bw / 2, BAR_H);
    // Right = green zone
    g.fillStyle(0x0F7A2A);
    g.fillRect(cx, BAR_Y, bw / 2, BAR_H);
    // Round left edge
    g.fillStyle(0xAA1111);
    g.fillCircle(BAR_LEFT + 4, BAR_Y + BAR_H / 2, BAR_H / 2);
    // Round right edge
    g.fillStyle(0x0F7A2A);
    g.fillCircle(BAR_LEFT + bw - 4, BAR_Y + BAR_H / 2, BAR_H / 2);

    // ── Bright fill showing score progress
    const innerH = BAR_H - 6;
    const innerY = BAR_Y + 3;
    const maxFill = bw / 2 - 6;

    if (this.score > 0) {
      const fw = Math.min((this.score / win) * maxFill, maxFill);
      g.fillStyle(0x22C55E);   // bright green
      g.fillRect(cx + 2, innerY, fw, innerH);
      // Glow tip
      g.fillStyle(0x86EFAC, 0.7);
      g.fillRect(cx + 2 + fw - 3, innerY, 3, innerH);
    } else if (this.score < 0) {
      const fw = Math.min((Math.abs(this.score) / lose) * maxFill, maxFill);
      g.fillStyle(0xEF4444);   // bright red
      g.fillRect(cx - 2 - fw, innerY, fw, innerH);
      // Glow tip
      g.fillStyle(0xFCA5A5, 0.7);
      g.fillRect(cx - 2 - fw, innerY, 3, innerH);
    }

    // ── Centre divider (white)
    g.fillStyle(0xFFFFFF);
    g.fillRect(cx - 1, BAR_Y - 2, 3, BAR_H + 4);

    // ── Outer rounded border
    g.lineStyle(2.5, 0xFFFFFF, 0.25);
    g.strokeRoundedRect(BAR_LEFT, BAR_Y, bw, BAR_H, 9);

    // ── End icons (drawn as tiny emoji-like shapes)
    // Red skull on left end
    g.fillStyle(0xFF6666);
    g.fillCircle(BAR_LEFT + 8, BAR_Y + BAR_H / 2, 5);
    // Green star on right end
    g.fillStyle(0x4ADE80);
    g.fillCircle(BAR_LEFT + bw - 8, BAR_Y + BAR_H / 2, 5);
  }

  changeScore(delta: number) {
    const { win, lose } = getThresholds(this.level);
    this.score += delta;
    this.drawMeter();
    if (this.done) return;
    if (this.score >= win) {
      this.done = true;
      EventBus.emit('game-level-complete', this.level);
    } else if (this.score <= -lose) {
      this.done = true;
      this.time.delayedCall(300, () => EventBus.emit('game-time-up', this.score));
    }
  }

  // ── Streak messages ───────────────────────────────────────────────────────────

  showStreakMessage(n: number) {
    const msgs: Record<number, string> = {
      5:  'Good Job! ⭐',
      10: 'Awesome! 🔥',
      15: 'On Fire! 🌟',
      20: 'AMAZING! 💥',
    };
    const text = msgs[n] ?? `${n}x Combo! ✨`;
    const W = this.W;
    const msg = this.add.text(W / 2, BAR_Y + BAR_H + 20, text, {
      fontFamily: 'Fredoka One', fontSize: '22px', color: '#FCD34D',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(60).setScrollFactor(0).setAlpha(0);

    this.tweens.add({
      targets: msg, alpha: 1, y: BAR_Y + BAR_H + 14,
      duration: 180, ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1100, () => {
          this.tweens.add({ targets: msg, alpha: 0, duration: 280, onComplete: () => msg.destroy() });
        });
      },
    });
  }

  // ── Buildings ─────────────────────────────────────────────────────────────────

  spawnBuilding(prefill = false) {
    const cfg = getLevelCfg(this.level);
    const { floors, winCols } = cfg;
    const { width, height }   = bldgDims(floors, winCols);
    const startX = this.worldRight + BLDG_GAP;
    const topY   = this.groundY - height;

    const wallColor = WALL_COLORS[Phaser.Math.Between(0, WALL_COLORS.length - 1)];
    const roofColor = ROOF_COLORS[Phaser.Math.Between(0, ROOF_COLORS.length - 1)];

    const container = this.add.container(startX, topY).setDepth(10);

    // Facade
    const facade = this.add.graphics();
    facade.fillStyle(wallColor);
    facade.fillRect(0, ROOF_H, width, height - ROOF_H);
    facade.lineStyle(2, Phaser.Display.Color.ValueToColor(wallColor).darken(20).color, 0.8);
    for (let f = 1; f < floors; f++) {
      facade.lineBetween(4, ROOF_H + f * FLOOR_H, width - 4, ROOF_H + f * FLOOR_H);
    }
    facade.fillStyle(Phaser.Display.Color.ValueToColor(wallColor).darken(25).color);
    facade.fillRect(0, height - BASE_H, width, BASE_H);
    facade.fillStyle(0x080812);
    facade.fillRoundedRect(width / 2 - 12, height - BASE_H + 8, 24, BASE_H - 8, 3);
    facade.fillStyle(roofColor);
    facade.fillRect(0, 0, width, ROOF_H);
    facade.fillStyle(Phaser.Display.Color.ValueToColor(roofColor).lighten(12).color);
    facade.fillRect(0, ROOF_H - 4, width, 4);
    if (Math.random() > 0.5) {
      const cx = Phaser.Math.Between(width / 4, (3 * width) / 4);
      facade.fillStyle(Phaser.Display.Color.ValueToColor(roofColor).darken(10).color);
      facade.fillRect(cx - 6, -12, 12, 16);
    }
    container.add(facade);

    // Windows — all OFF; prefill can pre-light windows in the right half
    const windows: WinInfo[] = [];
    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < winCols; c++) {
        const lx = WALL_PAD + c * (WIN_W + WIN_GAP_X);
        const floorTop = ROOF_H + r * FLOOR_H;
        const ly = floorTop + (FLOOR_H - WIN_H) / 2;

        let state: WinState = 'OFF';
        if (prefill) {
          const winCX = startX + lx + WIN_W / 2;
          if (winCX > this.W / 2 && winCX < this.W + 50 && Math.random() < 0.18) {
            state = Math.random() < 0.50 ? 'OCCUPIED' : 'EMPTY';
          }
        }

        const lightGfx = this.add.graphics();
        this.drawWindow(lightGfx, lx, ly, state);
        container.add(lightGfx);

        const personTxt = this.add.text(lx + WIN_W / 2, ly + WIN_H * 0.58, '👤', {
          fontSize: '22px',
        }).setOrigin(0.5, 0.5).setVisible(state === 'OCCUPIED');
        container.add(personTxt);

        windows.push({ state, lx, ly, lightGfx, personTxt });
      }
    }

    this.buildings.push({ container, width, windows });
    this.worldRight = startX + width;
  }

  drawWindow(g: Phaser.GameObjects.Graphics, lx: number, ly: number, state: WinState) {
    g.clear();
    if (state !== 'OFF') {
      g.fillStyle(0xFEF08A, 0.18);
      g.fillRoundedRect(lx - 6, ly - 6, WIN_W + 12, WIN_H + 12, 4);
      g.fillStyle(state === 'OCCUPIED' ? 0xFED7AA : 0xFEF08A);
      g.fillRoundedRect(lx, ly, WIN_W, WIN_H, 3);
      g.fillStyle(0xFFFDE7, 0.6);
      g.fillRoundedRect(lx + 4, ly + 4, WIN_W - 8, WIN_H / 2, 2);
    } else {
      g.fillStyle(0x0D1117);
      g.fillRoundedRect(lx, ly, WIN_W, WIN_H, 3);
    }
    g.lineStyle(2, 0x556080, 0.9);
    g.strokeRoundedRect(lx, ly, WIN_W, WIN_H, 3);
    g.lineStyle(1, 0x556080, 0.5);
    g.lineBetween(lx + WIN_W / 2, ly + 2, lx + WIN_W / 2, ly + WIN_H - 2);
    g.lineBetween(lx + 2, ly + WIN_H / 2, lx + WIN_W - 2, ly + WIN_H / 2);
  }

  turnOffWindow(bldg: Building, idx: number) {
    const w = bldg.windows[idx];
    w.state = 'OFF';
    this.drawWindow(w.lightGfx, w.lx, w.ly, 'OFF');
    w.personTxt.setVisible(false);
  }

  handleTap(bldg: Building, idx: number) {
    const w = bldg.windows[idx];
    if (w.state === 'OFF') return;

    const wx = bldg.container.x + w.lx + WIN_W / 2;
    const wy = bldg.container.y + w.ly + WIN_H / 2;

    if (w.state === 'OCCUPIED') {
      // Wrong tap — no shake, just a floating penalty number
      const penalty = this.add.text(wx, wy - 10, `${SCORE_WRONG}`, {
        fontFamily: 'Fredoka One', fontSize: '28px', color: '#FF4444',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(62).setScrollFactor(0);
      // Convert world position to screen position for scrollFactor(0) text
      penalty.setPosition(wx, wy - 10);
      this.tweens.add({ targets: penalty, y: wy - 55, alpha: 0, duration: 750, onComplete: () => penalty.destroy() });

      this.streak = 0;
      this.turnOffWindow(bldg, idx);
      this.changeScore(SCORE_WRONG);

    } else {
      // Correct tap
      this.streak++;
      const pop = this.add.circle(wx, wy, 10, 0xFEF08A, 0.9).setDepth(60);
      this.tweens.add({ targets: pop, scale: 3.5, alpha: 0, duration: 300, onComplete: () => pop.destroy() });
      const star = this.add.text(wx, wy - 10, `+${SCORE_CORRECT}`, {
        fontFamily: 'Fredoka One', fontSize: '22px', color: '#FCD34D',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(62);
      this.tweens.add({ targets: star, y: wy - 50, alpha: 0, duration: 600, onComplete: () => star.destroy() });

      if (this.streak === 5 || this.streak === 10 || this.streak === 15 || this.streak === 20) {
        this.showStreakMessage(this.streak);
      }

      this.turnOffWindow(bldg, idx);
      this.changeScore(SCORE_CORRECT);
    }
  }

  // ── Tutorial ──────────────────────────────────────────────────────────────────

  showTutorial() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const cx = W / 2, cy = H / 2;
    const objs: Phaser.GameObjects.GameObject[] = [];

    objs.push(this.add.rectangle(cx, cy, W, H, 0x000000, 0.78).setDepth(80));
    objs.push(this.add.text(cx, cy - 165, '🌙 Turn Off Empty Lights!', {
      fontFamily: 'Fredoka One', fontSize: '24px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(81));

    const y0 = cy - 100;
    const g1 = this.add.graphics().setDepth(81);
    g1.fillStyle(0xFEF08A); g1.fillRoundedRect(cx - 125, y0, WIN_W + 16, WIN_H + 16, 4);
    g1.lineStyle(2, 0x556080); g1.strokeRoundedRect(cx - 125, y0, WIN_W + 16, WIN_H + 16, 4);
    objs.push(g1, this.add.text(cx - 117 + WIN_W / 2, y0 + WIN_H + 22, '✅ Tap! (+1)', {
      fontFamily: 'Fredoka One', fontSize: '17px', color: '#4ADE80',
    }).setOrigin(0.5).setDepth(81));

    const g2 = this.add.graphics().setDepth(81);
    g2.fillStyle(0xFED7AA); g2.fillRoundedRect(cx + 52, y0, WIN_W + 16, WIN_H + 16, 4);
    g2.lineStyle(2, 0x556080); g2.strokeRoundedRect(cx + 52, y0, WIN_W + 16, WIN_H + 16, 4);
    objs.push(g2);
    objs.push(this.add.text(cx + 60 + WIN_W / 2, y0 + (WIN_H + 16) * 0.56, '👤', {
      fontSize: '22px' }).setOrigin(0.5).setDepth(82));
    objs.push(this.add.text(cx + 60 + WIN_W / 2, y0 + WIN_H + 22, '❌ Leave! (-3)', {
      fontFamily: 'Fredoka One', fontSize: '17px', color: '#F87171',
    }).setOrigin(0.5).setDepth(81));

    objs.push(this.add.text(cx, cy + 32, '🟢 Turn off lights → bar goes green\n🔴 Miss or tap people → bar goes red', {
      fontFamily: 'Fredoka One', fontSize: '15px', color: '#CBD5E1', align: 'center',
    }).setOrigin(0.5).setDepth(81));

    const btnBg = this.add.rectangle(cx, cy + 108, 190, 50, 0x22C55E).setDepth(81);
    btnBg.setStrokeStyle(3, 0x15803D);
    btnBg.setInteractive();
    objs.push(btnBg, this.add.text(cx, cy + 108, '🌙 Got It!', {
      fontFamily: 'Fredoka One', fontSize: '22px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(82));

    btnBg.once('pointerdown', () => objs.forEach(o => o.destroy()));
  }

  // ── Update loop ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.done) return;

    const W = this.W;
    const dt = delta / 1000;
    const cfg = getLevelCfg(this.level);

    // Accelerate toward maxSpeed using elapsed scene time
    const elapsed = (this.time.now - this.sceneStartMs) / 1000;
    const t = Math.min(elapsed / ACCEL_TIME, 1);
    this.scrollSpeed = cfg.minSpeed + (cfg.maxSpeed - cfg.minSpeed) * t;

    const dx = this.scrollSpeed * dt;

    for (const b of this.buildings) {
      b.container.x -= dx;
    }
    this.worldRight -= dx;

    // Per-window: dynamic lighting + missed-window detection
    for (const b of this.buildings) {
      const bx = b.container.x;
      for (const w of b.windows) {
        const winCX = bx + w.lx + WIN_W / 2;

        // Light up OFF windows only while in the right half of screen
        if (w.state === 'OFF' && winCX > W / 2 && winCX < W + 100) {
          if (Math.random() < cfg.litRate * dt) {
            const ns: WinState = Math.random() < 0.50 ? 'OCCUPIED' : 'EMPTY';
            w.state = ns;
            this.drawWindow(w.lightGfx, w.lx, w.ly, ns);
            w.personTxt.setVisible(ns === 'OCCUPIED');
          }
        }

        // EMPTY window scrolled off → penalty + reset streak
        if (w.state === 'EMPTY' && bx + w.lx + WIN_W < 0) {
          w.state = 'OFF';
          this.streak = 0;
          this.changeScore(SCORE_MISS);
        }
      }
    }

    while (this.worldRight < W + 320) {
      this.spawnBuilding(false);
    }

    this.buildings = this.buildings.filter(b => {
      if (b.container.x + b.width < -60) {
        b.container.destroy(true);
        return false;
      }
      return true;
    });
  }
}
