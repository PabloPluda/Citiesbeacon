import Phaser from 'phaser';
import { EventBus } from '../EventBus';

// ─── Constants ────────────────────────────────────────────────────────────────
const WIN_W      = 52;
const WIN_H      = 44;
const WIN_GAP_X  = 14;
const WIN_GAP_Y  = 16;
const WALL_PAD   = 22;
const FLOOR_H    = WIN_H + WIN_GAP_Y;   // 60
const ROOF_H     = 34;
const BASE_H     = 44;
const BLDG_GAP   = 14;
const GROUND_H   = 50;
const ACCEL_TIME = 50;

// Meter balance
const DANGER_START  = 0.5;
const WIN_THRESH    = 0.04;    // danger <= this → win
const LOSE_THRESH   = 0.96;   // danger >= this → lose
const TAP_REWARD    = 0.05;   // correct tap → danger decreases
const MISS_PENALTY  = 0.035;  // empty window scrolls off → danger increases
const WRONG_PENALTY = 0.07;   // tapping occupied window → danger increases

// Meter bar layout (Phaser canvas coords, below React HUD)
const BAR_X = 48;
const BAR_Y = 52;
const BAR_H = 14;

const WALL_COLORS = [0x2D3561, 0x1A2744, 0x2D3748, 0x3B3054, 0x1E3A2F, 0x3D2B1F, 0x2A2A4A];
const ROOF_COLORS = [0x3B4A6B, 0x2D3A5C, 0x3A3054, 0x4A3020, 0x1E3B28];

// ─── Level config ─────────────────────────────────────────────────────────────
function getLevelCfg(level: number) {
  const floors   = level <= 2 ? 2 : level <= 5 ? 4 : level <= 10 ? 6 : 8;
  const winCols  = level <= 2 ? 2 : level <= 5 ? 3 : 4;
  const minSpeed = 80;
  const maxSpeed = Math.min(88 + level * 9, 200);  // slower ceiling
  // Probability per second that an OFF window turns on (scales with level)
  const litRate  = 0.38 + level * 0.018;
  return { floors, winCols, minSpeed, maxSpeed, litRate };
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
  scored      = 0;
  danger      = DANGER_START;  // 0 = all green (win), 1 = all red (lose)
  timeLeft    = 120;
  done        = false;

  scrollSpeed = 80;
  worldRight  = 0;
  W           = 0;
  buildings:  Building[] = [];
  meterGfx!:  Phaser.GameObjects.Graphics;
  barW        = 0;
  groundY     = 0;

  timerEvent!: Phaser.Time.TimerEvent;

  constructor() { super('LightsOutScene'); }

  init(data?: { level?: number }) {
    this.level       = data?.level ?? 1;
    this.scored      = 0;
    this.danger      = DANGER_START;
    this.timeLeft    = 120;
    this.done        = false;
    this.buildings   = [];
    this.worldRight  = 0;
    this.scrollSpeed = getLevelCfg(this.level).minSpeed;
  }

  create() {
    this.W = this.cameras.main.width;
    const W = this.W;
    const H = this.cameras.main.height;
    this.groundY = H - GROUND_H;
    this.barW    = W - BAR_X * 2;

    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-scored-update', '💡 0');
    EventBus.emit('game-timer', this.timeLeft);

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

    // ── Continuous sidewalk base — full width, visible in gaps between buildings
    this.add.rectangle(W / 2, this.groundY + GROUND_H / 2, W, GROUND_H, 0x1C1C2E).setDepth(2);
    this.add.rectangle(W / 2, this.groundY - BASE_H / 2, W, BASE_H + 4, 0x1E1E30).setDepth(4);
    this.add.rectangle(W / 2, this.groundY, W, 6, 0x4A4A7A).setDepth(5);

    // ── Meter bar
    this.meterGfx = this.add.graphics().setDepth(58).setScrollFactor(0);
    this.drawMeter();

    // ── Timer
    this.timerEvent = this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        if (this.done) return;
        this.timeLeft--;
        EventBus.emit('game-timer', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.done = true;
          this.time.delayedCall(400, () => EventBus.emit('game-time-up', this.scored));
        }
      },
    });

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

    // ── Pre-fill screen (some windows already lit for buildings in right half)
    while (this.worldRight < W + 200) {
      this.spawnBuilding(true);
    }

    if (this.level === 1) this.showTutorial();
  }

  // ── Meter ─────────────────────────────────────────────────────────────────────

  drawMeter() {
    const g = this.meterGfx;
    g.clear();

    // Dark frame background
    g.fillStyle(0x0F172A);
    g.fillRoundedRect(BAR_X - 2, BAR_Y - 2, this.barW + 4, BAR_H + 4, 6);

    // Full green background (represents the best possible state)
    g.fillStyle(0x22C55E);
    g.fillRoundedRect(BAR_X, BAR_Y, this.barW, BAR_H, 5);

    // Danger fill from the left — grows as danger increases
    if (this.danger > 0.01) {
      const fillW = this.danger * this.barW;
      // Color interpolates: green → yellow → red based on danger
      const rr = Math.min(255, Math.round(0x22 + (0xEF - 0x22) * this.danger));
      const gg = Math.min(255, Math.round(0xC5 - (0xC5 - 0x44) * this.danger));
      const bb = Math.round(0x5E * (1 - this.danger));
      g.fillStyle(Phaser.Display.Color.GetColor(rr, gg, bb));
      g.fillRoundedRect(BAR_X, BAR_Y, Math.max(fillW, 6), BAR_H, 5);
    }

    // Centre divider marker
    g.lineStyle(2, 0xFFFFFF, 0.5);
    g.lineBetween(BAR_X + this.barW / 2, BAR_Y - 3, BAR_X + this.barW / 2, BAR_Y + BAR_H + 3);

    // Outer frame
    g.lineStyle(2, 0x475569, 0.8);
    g.strokeRoundedRect(BAR_X, BAR_Y, this.barW, BAR_H, 5);
  }

  changeDanger(delta: number) {
    this.danger = Math.max(0, Math.min(1, this.danger + delta));
    this.drawMeter();
    if (this.done) return;
    if (this.danger >= LOSE_THRESH) {
      this.done = true;
      this.time.delayedCall(300, () => EventBus.emit('game-time-up', this.scored));
    } else if (this.danger <= WIN_THRESH) {
      this.done = true;
      EventBus.emit('game-level-complete', this.level);
    }
  }

  // ── Buildings ─────────────────────────────────────────────────────────────────

  // prefill=true: buildings already on-screen at game start — windows in the
  // right half can be pre-lit so the screen isn't totally dark from the start.
  spawnBuilding(prefill = false) {
    const cfg = getLevelCfg(this.level);
    const { floors, winCols } = cfg;
    const { width, height }   = bldgDims(floors, winCols);
    const startX = this.worldRight + BLDG_GAP;
    const topY   = this.groundY - height;

    const wallColor = WALL_COLORS[Phaser.Math.Between(0, WALL_COLORS.length - 1)];
    const roofColor = ROOF_COLORS[Phaser.Math.Between(0, ROOF_COLORS.length - 1)];

    const container = this.add.container(startX, topY).setDepth(10);

    // ── Facade
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

    // ── Windows — all start OFF; pre-fill can light some in the right half
    const windows: WinInfo[] = [];
    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < winCols; c++) {
        const lx = WALL_PAD + c * (WIN_W + WIN_GAP_X);
        const floorTop = ROOF_H + r * FLOOR_H;
        const ly = floorTop + (FLOOR_H - WIN_H) / 2;

        // Pre-fill: allow a window to start lit only if it's in the right half
        let state: WinState = 'OFF';
        if (prefill) {
          const winCenterX = startX + lx + WIN_W / 2;
          if (winCenterX > this.W / 2 && winCenterX < this.W + 50 && Math.random() < 0.3) {
            state = Math.random() < 0.30 ? 'OCCUPIED' : 'EMPTY';
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

    const building: Building = { container, width, windows };
    this.buildings.push(building);
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
      this.cameras.main.shake(100, 0.014);
      const flash = this.add.rectangle(wx, wy, WIN_W + 12, WIN_H + 12, 0xEF4444, 0.7).setDepth(60);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
      const noTxt = this.add.text(wx, wy - 28, '🚫', { fontSize: '30px' }).setOrigin(0.5).setDepth(61);
      this.tweens.add({ targets: noTxt, y: wy - 52, alpha: 0, duration: 700, onComplete: () => noTxt.destroy() });
      this.turnOffWindow(bldg, idx);
      this.changeDanger(WRONG_PENALTY);
    } else {
      // Correct tap
      this.scored++;
      EventBus.emit('game-scored-update', `💡 ${this.scored}`);
      this.turnOffWindow(bldg, idx);

      const pop = this.add.circle(wx, wy, 10, 0xFEF08A, 0.9).setDepth(60);
      this.tweens.add({ targets: pop, scale: 3.5, alpha: 0, duration: 300, onComplete: () => pop.destroy() });
      const star = this.add.text(wx, wy - 22, '⭐', { fontSize: '24px' }).setOrigin(0.5).setDepth(61);
      this.tweens.add({ targets: star, y: wy - 50, alpha: 0, duration: 600, onComplete: () => star.destroy() });

      this.changeDanger(-TAP_REWARD);
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
    objs.push(g1, this.add.text(cx - 117 + WIN_W / 2, y0 + WIN_H + 22, '✅ Tap!', {
      fontFamily: 'Fredoka One', fontSize: '18px', color: '#4ADE80',
    }).setOrigin(0.5).setDepth(81));

    const g2 = this.add.graphics().setDepth(81);
    g2.fillStyle(0xFED7AA); g2.fillRoundedRect(cx + 52, y0, WIN_W + 16, WIN_H + 16, 4);
    g2.lineStyle(2, 0x556080); g2.strokeRoundedRect(cx + 52, y0, WIN_W + 16, WIN_H + 16, 4);
    objs.push(g2);
    objs.push(this.add.text(cx + 60 + WIN_W / 2, y0 + (WIN_H + 16) * 0.56, '👤', {
      fontSize: '22px' }).setOrigin(0.5).setDepth(82));
    objs.push(this.add.text(cx + 60 + WIN_W / 2, y0 + WIN_H + 22, '❌ Leave!', {
      fontFamily: 'Fredoka One', fontSize: '18px', color: '#F87171',
    }).setOrigin(0.5).setDepth(81));

    objs.push(this.add.text(cx, cy + 32, '🟢 Turn off lights → bar goes green\n🔴 Miss lights → bar goes red', {
      fontFamily: 'Fredoka One', fontSize: '16px', color: '#CBD5E1', align: 'center',
    }).setOrigin(0.5).setDepth(81));

    const btnBg = this.add.rectangle(cx, cy + 115, 190, 50, 0x22C55E).setDepth(81);
    btnBg.setStrokeStyle(3, 0x15803D);
    btnBg.setInteractive();
    objs.push(btnBg, this.add.text(cx, cy + 115, '🌙 Got It!', {
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

    // Accelerate toward maxSpeed
    const elapsed = 120 - this.timeLeft;
    const t = Math.min(elapsed / ACCEL_TIME, 1);
    this.scrollSpeed = cfg.minSpeed + (cfg.maxSpeed - cfg.minSpeed) * t;

    const dx = this.scrollSpeed * dt;

    // Move all buildings
    for (const b of this.buildings) {
      b.container.x -= dx;
    }
    this.worldRight -= dx;

    // Per-window logic: dynamic lighting + missed-window detection
    for (const b of this.buildings) {
      const bx = b.container.x;
      for (const w of b.windows) {
        const winCenterX = bx + w.lx + WIN_W / 2;

        // Randomly light up OFF windows — only while in the RIGHT half of screen
        // (player still has the full left half to react and tap)
        if (w.state === 'OFF' && winCenterX > W / 2 && winCenterX < W + 100) {
          if (Math.random() < cfg.litRate * dt) {
            const newState: WinState = Math.random() < 0.30 ? 'OCCUPIED' : 'EMPTY';
            w.state = newState;
            this.drawWindow(w.lightGfx, w.lx, w.ly, newState);
            w.personTxt.setVisible(newState === 'OCCUPIED');
          }
        }

        // EMPTY window scrolled off without being tapped → penalty
        if (w.state === 'EMPTY' && bx + w.lx + WIN_W < 0) {
          w.state = 'OFF';  // prevent double-counting
          this.changeDanger(MISS_PENALTY);
        }
      }
    }

    // Spawn new buildings ahead of the right edge
    while (this.worldRight < W + 320) {
      this.spawnBuilding(false);
    }

    // Destroy buildings fully off the left edge
    this.buildings = this.buildings.filter(b => {
      if (b.container.x + b.width < -60) {
        b.container.destroy(true);
        return false;
      }
      return true;
    });
  }
}
