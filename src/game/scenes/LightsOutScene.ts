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
const BLDG_GAP   = 28;
const GROUND_H   = 50;
const ACCEL_TIME = 50;   // seconds to reach max speed

const WALL_COLORS = [0x2D3561, 0x1A2744, 0x2D3748, 0x3B3054, 0x1E3A2F, 0x3D2B1F, 0x2A2A4A];
const ROOF_COLORS = [0x3B4A6B, 0x2D3A5C, 0x3A3054, 0x4A3020, 0x1E3B28];

// ─── Level config ─────────────────────────────────────────────────────────────
function getLevelCfg(level: number) {
  const floors   = level <= 2 ? 2 : level <= 5 ? 4 : level <= 10 ? 6 : 8;
  const winCols  = level <= 2 ? 2 : level <= 5 ? 3 : 4;
  const target   = 20 + (level - 1) * 5;
  const minSpeed = 80;
  const maxSpeed = Math.min(100 + level * 18, 340);
  return { floors, winCols, target, minSpeed, maxSpeed };
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
  lx:        number;   // local x (left edge) within container
  ly:        number;   // local y (top edge) within container
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
  lives       = 3;
  timeLeft    = 120;
  done        = false;

  scrollSpeed = 80;
  worldRight  = 0;
  buildings:  Building[] = [];
  lifeObjs:   Phaser.GameObjects.Text[] = [];
  groundY     = 0;

  timerEvent!: Phaser.Time.TimerEvent;

  constructor() { super('LightsOutScene'); }

  init(data?: { level?: number }) {
    this.level       = data?.level ?? 1;
    this.scored      = 0;
    this.lives       = 3;
    this.timeLeft    = 120;
    this.done        = false;
    this.buildings   = [];
    this.worldRight  = 0;
    this.scrollSpeed = getLevelCfg(this.level).minSpeed;
  }

  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    this.groundY = H - GROUND_H;

    EventBus.emit('current-scene-ready', this);
    const cfg = getLevelCfg(this.level);
    EventBus.emit('game-scored-update', `0/${cfg.target}`);
    EventBus.emit('game-timer', this.timeLeft);

    const handleRestart = (d: { level: number }) => {
      setTimeout(() => this.scene.restart(d), 0);
    };
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('restart-scene', handleRestart);
    });

    // ── Sky background
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x0A1020, 0x0A1020, 0x1A3060, 0x1A3060, 1);
    sky.fillRect(0, 0, W, this.groundY);

    // Stars (static decorations)
    for (let i = 0; i < 55; i++) {
      const sx = Phaser.Math.Between(0, W);
      const sy = Phaser.Math.Between(0, this.groundY - 80);
      const r  = Phaser.Math.FloatBetween(0.6, 2.2);
      const a  = Phaser.Math.FloatBetween(0.3, 1.0);
      const st = this.add.circle(sx, sy, r, 0xFFFFFF, a).setDepth(1);
      this.tweens.add({
        targets: st, alpha: { from: a, to: 0.05 },
        duration: Phaser.Math.Between(900, 3200),
        yoyo: true, repeat: -1,
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    // Moon
    this.add.circle(W - 55, 55, 26, 0xFFF8DC, 0.9).setDepth(1);
    this.add.circle(W - 43, 50, 24, 0x1A3060, 0.95).setDepth(1);

    // Ground strip
    this.add.rectangle(W / 2, this.groundY + GROUND_H / 2, W, GROUND_H, 0x1C1C2E).setDepth(0);
    // Sidewalk kerb line
    this.add.rectangle(W / 2, this.groundY, W, 5, 0x4A4A7A).setDepth(2);

    // Street lamp posts that scroll with buildings
    // (added in spawnBuilding between buildings)

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

    // ── Lives HUD
    this.refreshLivesHUD();

    // ── Global tap handler — checks window bounds manually (avoids container input issues)
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

    // ── Pre-fill visible screen
    while (this.worldRight < W + 200) {
      this.spawnBuilding();
    }

    // ── Tutorial for level 1
    if (this.level === 1) this.showTutorial();
  }

  // ── Buildings ────────────────────────────────────────────────────────────────

  spawnBuilding() {
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
    // Main wall
    facade.fillStyle(wallColor);
    facade.fillRect(0, ROOF_H, width, height - ROOF_H);
    // Floor separation lines
    facade.lineStyle(2, Phaser.Display.Color.ValueToColor(wallColor).darken(20).color, 0.8);
    for (let f = 1; f < floors; f++) {
      const lineY = ROOF_H + f * FLOOR_H;
      facade.lineBetween(4, lineY, width - 4, lineY);
    }
    // Entrance base
    facade.fillStyle(Phaser.Display.Color.ValueToColor(wallColor).darken(25).color);
    facade.fillRect(0, height - BASE_H, width, BASE_H);
    // Door
    facade.fillStyle(0x080812);
    const dw = 24, dh = BASE_H - 8;
    facade.fillRoundedRect(width / 2 - dw / 2, height - BASE_H + 8, dw, dh, 3);
    // Roof
    facade.fillStyle(roofColor);
    facade.fillRect(0, 0, width, ROOF_H);
    // Roof edge trim
    facade.fillStyle(Phaser.Display.Color.ValueToColor(roofColor).lighten(12).color);
    facade.fillRect(0, ROOF_H - 4, width, 4);
    // Chimney (50% chance)
    if (Math.random() > 0.5) {
      const cx = Phaser.Math.Between(width / 4, (3 * width) / 4);
      facade.fillStyle(Phaser.Display.Color.ValueToColor(roofColor).darken(10).color);
      facade.fillRect(cx - 6, -12, 12, 16);
    }
    container.add(facade);

    // ── Windows
    const windows: WinInfo[] = [];

    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < winCols; c++) {
        const lx = WALL_PAD + c * (WIN_W + WIN_GAP_X);
        // floors from top: row 0 = topmost floor
        const floorTop = ROOF_H + r * FLOOR_H;
        const ly = floorTop + (FLOOR_H - WIN_H) / 2;

        const roll = Math.random();
        let state: WinState = 'OFF';
        if (roll < 0.40) {
          state = Math.random() < 0.30 ? 'OCCUPIED' : 'EMPTY';
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
      // Outer glow
      g.fillStyle(0xFEF08A, 0.18);
      g.fillRoundedRect(lx - 6, ly - 6, WIN_W + 12, WIN_H + 12, 4);
      // Lit window
      g.fillStyle(state === 'OCCUPIED' ? 0xFED7AA : 0xFEF08A);
      g.fillRoundedRect(lx, ly, WIN_W, WIN_H, 3);
      // Inner warm center
      g.fillStyle(0xFFFDE7, 0.6);
      g.fillRoundedRect(lx + 4, ly + 4, WIN_W - 8, WIN_H / 2, 2);
    } else {
      // Dark window
      g.fillStyle(0x0D1117);
      g.fillRoundedRect(lx, ly, WIN_W, WIN_H, 3);
    }

    // Window frame
    g.lineStyle(2, 0x556080, 0.9);
    g.strokeRoundedRect(lx, ly, WIN_W, WIN_H, 3);
    // Divider cross
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
      // Wrong! Lose a life
      this.lives = Math.max(0, this.lives - 1);
      this.refreshLivesHUD();

      this.cameras.main.shake(120, 0.016);
      const flash = this.add.rectangle(wx, wy, WIN_W + 12, WIN_H + 12, 0xEF4444, 0.7).setDepth(60);
      this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });

      const noTxt = this.add.text(wx, wy - 28, '🚫', { fontSize: '32px' }).setOrigin(0.5, 0.5).setDepth(61);
      this.tweens.add({ targets: noTxt, y: wy - 55, alpha: 0, duration: 700, onComplete: () => noTxt.destroy() });

      this.turnOffWindow(bldg, idx);

      if (this.lives <= 0 && !this.done) {
        this.done = true;
        this.time.delayedCall(500, () => EventBus.emit('game-time-up', this.scored));
      }
    } else {
      // Correct!
      this.scored++;
      const cfg = getLevelCfg(this.level);
      EventBus.emit('game-scored-update', `${this.scored}/${cfg.target}`);
      this.turnOffWindow(bldg, idx);

      // Sparkle pop
      const pop = this.add.circle(wx, wy, 10, 0xFEF08A, 0.9).setDepth(60);
      this.tweens.add({ targets: pop, scale: 3.5, alpha: 0, duration: 320, onComplete: () => pop.destroy() });
      const star = this.add.text(wx, wy - 22, '⭐', { fontSize: '26px' }).setOrigin(0.5, 0.5).setDepth(61);
      this.tweens.add({ targets: star, y: wy - 55, alpha: 0, duration: 650, onComplete: () => star.destroy() });

      if (this.scored >= cfg.target && !this.done) {
        this.done = true;
        EventBus.emit('game-level-complete', this.level);
      }
    }
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────

  refreshLivesHUD() {
    this.lifeObjs.forEach(o => o.destroy());
    this.lifeObjs = [];
    const W = this.cameras.main.width;
    for (let i = 0; i < 3; i++) {
      const h = this.add.text(
        W - 18 - i * 36, 14,
        i < this.lives ? '❤️' : '🖤',
        { fontSize: '26px' },
      ).setOrigin(1, 0).setDepth(55).setScrollFactor(0);
      this.lifeObjs.push(h);
    }
  }

  // ── Tutorial ─────────────────────────────────────────────────────────────────

  showTutorial() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const cx = W / 2, cy = H / 2;

    const objs: Phaser.GameObjects.GameObject[] = [];
    const bg = this.add.rectangle(cx, cy, W, H, 0x000000, 0.78).setDepth(80);
    objs.push(bg);

    // Title
    const title = this.add.text(cx, cy - 170, 'Turn Off Empty Lights!', {
      fontFamily: 'Fredoka One', fontSize: '26px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(81);
    objs.push(title);

    // Show two example windows side by side
    const y0 = cy - 90;
    // Empty window (TAP THIS)
    const g1 = this.add.graphics().setDepth(81);
    g1.fillStyle(0xFEF08A); g1.fillRoundedRect(cx - 130, y0, WIN_W + 16, WIN_H + 16, 4);
    g1.lineStyle(2, 0x556080); g1.strokeRoundedRect(cx - 130, y0, WIN_W + 16, WIN_H + 16, 4);
    objs.push(g1);
    const lbl1 = this.add.text(cx - 122 + WIN_W / 2, y0 + WIN_H + 26, '✅ Tap!', {
      fontFamily: 'Fredoka One', fontSize: '20px', color: '#4ADE80',
    }).setOrigin(0.5).setDepth(81);
    objs.push(lbl1);

    // Occupied window (DON'T tap)
    const g2 = this.add.graphics().setDepth(81);
    g2.fillStyle(0xFED7AA); g2.fillRoundedRect(cx + 56, y0, WIN_W + 16, WIN_H + 16, 4);
    g2.lineStyle(2, 0x556080); g2.strokeRoundedRect(cx + 56, y0, WIN_W + 16, WIN_H + 16, 4);
    objs.push(g2);
    const personTut = this.add.text(cx + 64 + WIN_W / 2, y0 + (WIN_H + 16) * 0.56, '👤', {
      fontSize: '24px',
    }).setOrigin(0.5, 0.5).setDepth(82);
    objs.push(personTut);
    const lbl2 = this.add.text(cx + 64 + WIN_W / 2, y0 + WIN_H + 26, '❌ Leave!', {
      fontFamily: 'Fredoka One', fontSize: '20px', color: '#F87171',
    }).setOrigin(0.5).setDepth(81);
    objs.push(lbl2);

    const sub = this.add.text(cx, cy + 40, 'Don\'t turn off lights\nwhen someone is inside!', {
      fontFamily: 'Fredoka One', fontSize: '18px', color: '#CBD5E1', align: 'center',
    }).setOrigin(0.5).setDepth(81);
    objs.push(sub);

    // Lives reminder
    const lives = this.add.text(cx, cy + 100, '❤️❤️❤️  You have 3 lives', {
      fontFamily: 'Fredoka One', fontSize: '17px', color: '#FCA5A5',
    }).setOrigin(0.5).setDepth(81);
    objs.push(lives);

    // Start button
    const btnBg = this.add.rectangle(cx, cy + 160, 200, 54, 0x22C55E).setDepth(81);
    btnBg.setStrokeStyle(3, 0x15803D);
    btnBg.setInteractive();
    const btnTxt = this.add.text(cx, cy + 160, '🌙 Got It!', {
      fontFamily: 'Fredoka One', fontSize: '24px', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(82);
    objs.push(btnBg, btnTxt);

    btnBg.once('pointerdown', () => {
      objs.forEach(o => o.destroy());
    });
  }

  // ── Update loop ──────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.done) return;

    const W = this.cameras.main.width;
    const dt = delta / 1000;

    // Accelerate towards maxSpeed over ACCEL_TIME seconds
    const cfg = getLevelCfg(this.level);
    const elapsed = 120 - this.timeLeft;
    const t = Math.min(elapsed / ACCEL_TIME, 1);
    this.scrollSpeed = cfg.minSpeed + (cfg.maxSpeed - cfg.minSpeed) * t;

    const dx = this.scrollSpeed * dt;

    // Move all buildings
    for (const b of this.buildings) {
      b.container.x -= dx;
    }
    this.worldRight -= dx;

    // Spawn new buildings ahead
    while (this.worldRight < W + 300) {
      this.spawnBuilding();
    }

    // Destroy off-screen buildings
    this.buildings = this.buildings.filter(b => {
      if (b.container.x + b.width < -60) {
        b.container.destroy(true);
        return false;
      }
      return true;
    });
  }
}
