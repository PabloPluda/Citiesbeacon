import Phaser from 'phaser';
import lottie from 'lottie-web';
import type { AnimationItem } from 'lottie-web';
import catwalkData from '../../assets/catwalk.json';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';

const MISSION_ID   = 2;
const LANE_OFFSETS = [-40, 0, 40];   // Y from H/2 for lanes 0 (top), 1 (mid), 2 (bot)
const BOOK_COLORS  = [0xE53E3E, 0x3182CE, 0xD69E2E, 0x805AD5, 0x2F855A];

// ─── Level config ──────────────────────────────────────────────────────────────
function getLevelCfg(level: number) {
  const crossings    = level === 1 ? 4 : Math.min(4 + Math.floor(level * 0.8), 18);
  const speed        = Math.round(127 + (level - 1) * 128 / 19); // px/s: 127 at lvl1 → 255 at lvl20
  const obstInterval = Math.max(155, 380 - level * 12); // px between obstacle spawns
  return { crossings, speed, obstInterval };
}

// ─── Car helpers ───────────────────────────────────────────────────────────────
type CarModel = 'sedan' | 'suv' | 'truck' | 'hatch';
const CAR_MODELS: CarModel[] = ['sedan', 'suv', 'truck', 'hatch'];
const CAR_COLORS = [0xE53E3E, 0x3182CE, 0xD69E2E, 0x805AD5, 0x0987A0, 0xD53F8C, 0x2F855A];

function dk(c: number, a: number) { return Phaser.Display.Color.ValueToColor(c).darken(a).color; }
function lt(c: number, a: number) { return Phaser.Display.Color.ValueToColor(c).lighten(a).color; }

function drawTopDownCar(g: Phaser.GameObjects.Graphics, model: CarModel, color: number) {
  g.clear();
  const W = 44, H = 88;
  const bx = 4, bw = W - 8;
  const glass = 0xADD8E6;
  const wW = 9, wH = 17, wR = 3;
  const wps = model === 'truck'
    ? [{ x: 0, y: 10 }, { x: W - wW, y: 10 }, { x: 0, y: 56 }, { x: W - wW, y: 56 }]
    : [{ x: 0, y: 8 }, { x: W - wW, y: 8 }, { x: 0, y: H - 8 - wH }, { x: W - wW, y: H - 8 - wH }];
  wps.forEach(({ x, y }) => {
    g.fillStyle(0x1a1a1a); g.fillRoundedRect(x, y, wW, wH, wR);
    g.fillStyle(0x666666); g.fillCircle(x + wW / 2, y + wH / 2, wW / 2 - 1);
    g.fillStyle(0x999999); g.fillCircle(x + wW / 2, y + wH / 2, wW / 2 - 3);
  });
  if (model === 'sedan') {
    g.fillStyle(color);        g.fillRoundedRect(bx, 4, bw, H - 8, 8);
    g.fillStyle(lt(color,18)); g.fillRoundedRect(bx+1, 5, bw-2, 20, 6);
    g.fillStyle(glass, 0.92);  g.fillRoundedRect(bx+3, 20, bw-6, 15, 4);
    g.fillStyle(dk(color,22)); g.fillRoundedRect(bx+2, 36, bw-4, 22, 5);
    g.fillStyle(glass, 0.78);  g.fillRoundedRect(bx+3, 59, bw-6, 13, 3);
    g.fillStyle(lt(color,10)); g.fillRoundedRect(bx+1, 73, bw-2, 10, 5);
    g.fillStyle(0xFFFDE7,.95); g.fillRoundedRect(bx+1, 4, 9, 6, 2); g.fillRoundedRect(bx+bw-10, 4, 9, 6, 2);
    g.fillStyle(0xFF1A1A,.95); g.fillRoundedRect(bx+1, H-10, 9, 6, 2); g.fillRoundedRect(bx+bw-10, H-10, 9, 6, 2);
    g.lineStyle(1,dk(color,30),.5); g.beginPath(); g.moveTo(bx,48); g.lineTo(bx+bw,48); g.strokePath();
  } else if (model === 'suv') {
    g.fillStyle(color);        g.fillRoundedRect(bx-1, 4, bw+2, H-8, 8);
    g.fillStyle(lt(color,15)); g.fillRoundedRect(bx, 5, bw, 18, 6);
    g.fillStyle(glass, 0.90);  g.fillRoundedRect(bx+2, 19, bw-4, 16, 4);
    g.fillStyle(dk(color,18)); g.fillRoundedRect(bx+1, 36, bw-2, 26, 5);
    g.lineStyle(2,dk(color,40),.6);
    [40,48,56].forEach(yy => { g.beginPath(); g.moveTo(bx+4,yy); g.lineTo(bx+bw-4,yy); g.strokePath(); });
    g.fillStyle(glass, 0.78);  g.fillRoundedRect(bx+2, 63, bw-4, 13, 3);
    g.fillStyle(lt(color,8));  g.fillRoundedRect(bx, 77, bw, 9, 5);
    g.fillStyle(0xFFFDE7,.95); g.fillRoundedRect(bx, 4, 10, 6, 2); g.fillRoundedRect(bx+bw-10, 4, 10, 6, 2);
    g.fillStyle(0xFF1A1A,.95); g.fillRoundedRect(bx, H-10, 10, 6, 2); g.fillRoundedRect(bx+bw-10, H-10, 10, 6, 2);
  } else if (model === 'truck') {
    const cabH = 30;
    g.fillStyle(color);         g.fillRoundedRect(bx, 4, bw, H-8, 5);
    g.fillStyle(lt(color,18));  g.fillRoundedRect(bx+1, 5, bw-2, 12, 5);
    g.fillStyle(glass, 0.88);   g.fillRoundedRect(bx+3, 15, bw-6, 13, 4);
    g.fillStyle(dk(color,20));  g.fillRoundedRect(bx+2, 22, bw-4, 10, 3);
    g.fillStyle(dk(color,40));  g.fillRect(bx, cabH+4, bw, 5);
    g.fillStyle(dk(color,15));  g.fillRoundedRect(bx, cabH+9, bw, H-cabH-13, 4);
    g.fillStyle(0x5D4037,.6);   g.fillRect(bx+4, cabH+13, bw-8, H-cabH-21);
    g.fillStyle(color);
    g.fillRect(bx, cabH+9, 5, H-cabH-13); g.fillRect(bx+bw-5, cabH+9, 5, H-cabH-13);
    g.fillRect(bx, H-9, bw, 5);
    g.fillStyle(0xFFFDE7,.95);  g.fillRoundedRect(bx+1, 4, 9, 5, 2); g.fillRoundedRect(bx+bw-10, 4, 9, 5, 2);
    g.fillStyle(0xFF1A1A,.95);  g.fillRoundedRect(bx+1, H-9, 9, 5, 2); g.fillRoundedRect(bx+bw-10, H-9, 9, 5, 2);
  } else {
    g.fillStyle(color);        g.fillRoundedRect(bx, 10, bw, H-20, 9);
    g.fillStyle(lt(color,20)); g.fillRoundedRect(bx+1, 11, bw-2, 14, 7);
    g.fillStyle(glass, 0.90);  g.fillRoundedRect(bx+3, 21, bw-6, 14, 4);
    g.fillStyle(dk(color,22)); g.fillRoundedRect(bx+2, 36, bw-4, 18, 5);
    g.fillStyle(glass, 0.85);  g.fillRoundedRect(bx+2, 55, bw-4, 18, 4);
    g.fillStyle(lt(color,8));  g.fillRoundedRect(bx+1, 74, bw-2, 6, 4);
    g.fillStyle(0xFFFDE7,.95); g.fillRoundedRect(bx+1, 10, 8, 6, 2); g.fillRoundedRect(bx+bw-9, 10, 8, 6, 2);
    g.fillStyle(0xFF1A1A,.95); g.fillRoundedRect(bx+1, H-16, 8, 6, 2); g.fillRoundedRect(bx+bw-9, H-16, 8, 6, 2);
    g.lineStyle(1,dk(color,28),.45); g.beginPath(); g.moveTo(bx,46); g.lineTo(bx+bw,46); g.strokePath();
  }
}

// ─── World chunks ─────────────────────────────────────────────────────────────
function buildWorldChunks(
  scene: Phaser.Scene, worldW: number, H: number,
  cfg: { crossings: number },
  firstCrossX: number, SPACING: number, schoolX: number,
) {
  const CHUNK = 2048;
  const numChunks = Math.ceil(worldW / CHUNK);
  const crossX = Array.from({ length: cfg.crossings }, (_, i) => firstCrossX + i * SPACING);

  for (let i = 0; i < 20; i++) {
    const k = `_world_chunk_${i}`;
    if (scene.textures.exists(k)) scene.textures.remove(k);
  }
  for (let i = 0; i < 10; i++) {
    const k = `_nbhd_chunk_${i}`;
    if (scene.textures.exists(k)) scene.textures.remove(k);
  }

  for (let ci = 0; ci < numChunks; ci++) {
    const cx0 = ci * CHUNK;
    const chunkW = Math.min(CHUNK, worldW - cx0);
    const key = `_world_chunk_${ci}`;
    const g = scene.add.graphics();

    // Grass — only below the bottom sidewalk
    g.fillStyle(0x48BB78); g.fillRect(0, H/2+300, chunkW, Math.max(0, H/2-300));

    // Bottom sidewalk (below horizontal road, same width 120px)
    g.fillStyle(0xCBD5E1); g.fillRect(0, H/2+180, chunkW, 120);
    g.fillStyle(0xA0AEC0); g.fillRect(0, H/2+182, chunkW, 3); g.fillRect(0, H/2+295, chunkW, 3);

    // Horizontal road (below main sidewalk, same width 120px, purely aesthetic)
    g.fillStyle(0x2D3748); g.fillRect(0, H/2+60, chunkW, 120);
    g.fillStyle(0xFFFFFF, 0.08); g.fillRect(0, H/2+60, chunkW, 2);
    g.fillStyle(0xFFFFFF, 0.08); g.fillRect(0, H/2+178, chunkW, 2);
    // Center dash on horizontal road
    g.lineStyle(2, 0xEAB308, 0.4);
    for (let lx2 = 0; lx2 < chunkW; lx2 += 22) {
      const absX = cx0 + lx2;
      if (!crossX.some(crX => Math.abs(absX - crX) < 100)) {
        g.lineBetween(lx2, H/2+120, lx2+12, H/2+120);
      }
    }

    // Sidewalk strips
    g.fillStyle(0xCBD5E1); g.fillRect(0, H/2-60, chunkW, 120);
    g.fillStyle(0xA0AEC0); g.fillRect(0, H/2-58, chunkW, 3); g.fillRect(0, H/2+55, chunkW, 3);

    // Lane dividers (dashed, subtle)
    g.lineStyle(1.5, 0x94A3B8, 0.4);
    for (let lx2 = 0; lx2 < chunkW; lx2 += 22) {
      const absX = cx0 + lx2;
      if (!crossX.some(crX => Math.abs(absX - crX) < 100)) {
        g.lineBetween(lx2, H/2-20, lx2+12, H/2-20);
        g.lineBetween(lx2, H/2+20, lx2+12, H/2+20);
      }
    }


    // School
    {
      const sx = schoolX;
      if (sx + 150 >= cx0 && sx - 150 <= cx0 + chunkW) {
        const lx = sx - cx0;
        const sw = 130, sh = 130, cy = H/2-100;
        g.lineStyle(2, 0xFFFFFF, 0.35); g.strokeCircle(lx, cy-30, 22);
        g.fillStyle(0x000000, 0.15); g.fillEllipse(lx+6, cy+sh/2+10, sw+20, 22);
        g.fillStyle(0xBEE3F8); g.fillRoundedRect(lx-sw/2, cy-sh/2, sw, sh, 5);
        g.fillStyle(0x4299E1); g.fillRoundedRect(lx-sw/2, cy-sh/2, sw, sh*0.38, 5);
        [-35, 0, 35].forEach(ox => {
          g.fillStyle(0xFFFDE7, 0.9); g.fillRoundedRect(lx+ox-12, cy-10, 24, 20, 3);
          g.lineStyle(2, 0x2B6CB0, 0.5); g.strokeRoundedRect(lx+ox-12, cy-10, 24, 20, 3);
          g.lineStyle(1.5, 0x2B6CB0, 0.4);
          g.beginPath(); g.moveTo(lx+ox, cy-10); g.lineTo(lx+ox, cy+10); g.strokePath();
          g.beginPath(); g.moveTo(lx+ox-12, cy); g.lineTo(lx+ox+12, cy); g.strokePath();
        });
        g.fillStyle(0x2D6A4F); g.fillRoundedRect(lx-16, cy+sh/2-28, 32, 28, 3);
        g.fillStyle(0xFFD700, 0.9); g.fillCircle(lx+10, cy+sh/2-14, 3);
        g.fillStyle(0xCBD5E1, 0.9); g.fillRect(lx-9, cy+sh/2, 18, H/2-(cy+sh/2)+5);
        g.fillStyle(0x888888); g.fillRect(lx-sw/2+10, cy-sh/2-30, 4, 40);
        g.fillStyle(0xFF0000); g.fillRect(lx-sw/2+14, cy-sh/2-30, 18, 12);
        g.fillStyle(0xF6E05E, 0.6); g.fillRect(lx-3, H/2-60, 6, 120);
      }
    }

    // Roads + markings + light housings
    for (let i = 0; i < cfg.crossings; i++) {
      const x = firstCrossX + i * SPACING;
      if (x + 90 < cx0 || x - 90 > cx0 + chunkW) continue;
      const lx = x - cx0;
      g.fillStyle(0x2D3748); g.fillRect(lx-90, 0, 180, H);
      // Horizontal pedestrian crossings on the road — one on each side of the vertical crossing
      g.fillStyle(0xFFFFFF, 0.72);
      for (let s = 0; s < 6; s++) {
        g.fillRect(lx - 140, H/2 + 62 + s * 20, 50, 12); // left side
        g.fillRect(lx +  90, H/2 + 62 + s * 20, 50, 12); // right side
      }
      g.fillStyle(0xEAB308);
      for (let k2 = 0; k2 < Math.ceil(H / 80) + 4; k2++) {
        const dashY = -160 + k2 * 80, mid = dashY + 20;
        if (mid > H/2-75 && mid < H/2+75) continue;
        g.fillRect(lx-4, dashY-20, 8, 40);
      }
      for (let j = 0; j < 4; j++) {
        g.fillStyle(0xFFFFFF, 0.88); g.fillRect(lx-70+j*40, H/2-50, 20, 100);
      }
      g.fillStyle(0xFFFFFF, 0.85);
      g.fillRect(lx-80, H/2-61, 160, 5); g.fillRect(lx-80, H/2+56, 160, 5);
      const poleX = lx-100, poleY = H/2-80;
      g.fillStyle(0x2D3748); g.fillRect(poleX-4, H/2-80, 8, 120);
      g.fillStyle(0x111827); g.fillRect(poleX-23, poleY-50, 46, 100);
      g.fillStyle(0x1F2937); g.fillRect(poleX-21, poleY-48, 42, 96);
    }

    g.generateTexture(key, chunkW, H);
    g.destroy();
    scene.add.image(cx0 + chunkW/2, H/2, key).setDepth(1);
  }

  scene.add.text(schoolX, H/2-100-65-50, '🏫', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorldObj {
  worldX: number;
  lane:   number;
  gfx:    Phaser.GameObjects.Image;
  type:   string;
  alive:  boolean;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export class CrossingScene extends Phaser.Scene {
  level           = 1;
  scored          = 0;
  done            = false;
  tutorialActive  = false;
  penaltyCooldown = false;
  livesLost       = 0;
  booksInCycle    = 0;   // books toward next extra life (resets every 4)

  tommyLane       = 1;
  swipeStartY     = 0;
  swipeStartX     = 0;
  swipeUsed = false;

  tommy!:       Phaser.Physics.Arcade.Image;
  tommyFrame    = 0;
  tommyTick     = 0;
  catAnim?:     AnimationItem;
  catDiv?:      HTMLDivElement;
  catCanvas?:   HTMLCanvasElement;
  catImage?:    Phaser.GameObjects.Image;
  catPlaying    = false;
  catFrame      = 0;
  crossroads: any[] = [];
  carGroup!: Phaser.Physics.Arcade.Group;
  carTextureKeys: Record<string, string> = {};

  worldObstacles:  WorldObj[] = [];
  worldBooks:      WorldObj[] = [];

  lifeIndicators: Phaser.GameObjects.Graphics[] = [];
  bookTxt!: Phaser.GameObjects.Text;

  crossCount = 4;
  schoolX    = 0;
  sceneH     = 0;

  constructor() { super('CrossingScene'); }

  preload() {
    for (let i = 1; i <= 4; i++) {
      this.load.image(`crossing_bg_${i}`, `/Crossing/back_${i}.png`);
    }
  }

  init(data?: { level?: number }) {
    if (data?.level !== undefined) {
      this.level = data.level;
    } else {
      const reg = this.registry?.get('startLevel') as number | undefined;
      if (reg != null) { this.registry.remove('startLevel'); this.level = reg; }
      else { this.level = Math.min((useProgressStore.getState().highestLevel[MISSION_ID] ?? 0) + 1, 20); }
    }
    this.scored          = 0;
    this.crossCount      = getLevelCfg(this.level).crossings;
    this.done            = false;
    this.tutorialActive  = true;
    this.penaltyCooldown = false;
    this.livesLost       = 0;
    this.booksInCycle    = 0;
    this.tommyFrame      = 0;
    this.tommyTick       = 0;
    this.catPlaying      = false;
    this.catFrame        = 0;
    this.tommyLane       = 1;
    this.lifeIndicators  = [];
    this.crossroads      = [];
    this.carTextureKeys  = {};
    this.worldObstacles  = [];
    this.worldBooks      = [];
    this.swipeUsed = false;
    this.schoolX   = 0;
  }

  create() {
    const cfg = getLevelCfg(this.level);
    this.sceneH = this.cameras.main.height;
    const H = this.sceneH;

    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-scored-update', `0/${cfg.crossings}`);

    const handleRestart = (data: { level: number }) => setTimeout(() => this.scene.restart(data), 0);
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', handleRestart));

    const SPACING     = 1490; // matches ~1310px image width + 180px road width
    const firstCrossX = 500;
    const lastCrossX  = firstCrossX + (cfg.crossings - 1) * SPACING;
    this.schoolX      = lastCrossX + 700;
    const worldW      = this.schoolX + 460;
    this.crossCount   = cfg.crossings;

    this.physics.world.gravity.y = 0;
    this.physics.world.setBounds(0, 0, worldW, H);
    this.cameras.main.setBounds(0, 0, worldW, H);

    // Bake car textures
    const carG = this.add.graphics();
    CAR_MODELS.forEach(model => {
      CAR_COLORS.slice(0, 5).forEach((color, ci) => {
        const key = `car2_${model}_${ci}`;
        if (!this.textures.exists(key)) {
          drawTopDownCar(carG, model, color);
          carG.generateTexture(key, 44, 88);
        }
        this.carTextureKeys[`${model}_${ci}`] = key;
      });
    });
    carG.destroy();

    buildWorldChunks(this, worldW, H, cfg, firstCrossX, SPACING, this.schoolX);

    // Background images in upper zone — one per segment between crossing roads
    const bgH = H / 2 - 60;
    let bgIdx = 0;
    const addBg = (x1: number, x2: number) => {
      const w = x2 - x1;
      if (w <= 0) return;
      this.add.image(x1 + w / 2, bgH / 2, `crossing_bg_${(bgIdx++ % 4) + 1}`)
        .setDisplaySize(w, bgH).setDepth(0);
    };
    addBg(0, firstCrossX - 90);
    for (let i = 0; i < cfg.crossings - 1; i++) {
      addBg(firstCrossX + i * SPACING + 90, firstCrossX + (i + 1) * SPACING - 90);
    }
    addBg(firstCrossX + (cfg.crossings - 1) * SPACING + 90, worldW);

    this.carGroup = this.physics.add.group();

    // Traffic light bulbs
    for (let i = 0; i < cfg.crossings; i++) {
      const x = firstCrossX + i * SPACING;
      const poleX = x - 100, poleY = H/2 - 80;
      const redCircle   = this.add.circle(poleX, poleY-28, 16, 0xFF0000).setDepth(11);
      const redIcon     = this.add.text(poleX, poleY-28, '🧍', { fontSize: '14px' }).setOrigin(0.5).setDepth(12);
      const greenCircle = this.add.circle(poleX, poleY+28, 16, 0x00CC44).setDepth(11);
      const greenIcon   = this.add.text(poleX, poleY+28, '🚶', { fontSize: '14px' }).setOrigin(0.5).setDepth(12);
      const isRed = i === 0 ? false : Math.random() > 0.5;
      redCircle.setAlpha(isRed ? 1 : 0.2);   redIcon.setAlpha(isRed ? 1 : 0.2);
      greenCircle.setAlpha(isRed ? 0.2 : 1); greenIcon.setAlpha(isRed ? 0.2 : 1);
      this.crossroads.push({
        x, lightRed: redCircle, lightRedIcon: redIcon,
        lightGreen: greenCircle, lightGreenIcon: greenIcon,
        state: isRed ? 'red' : 'green',
        timer: Phaser.Math.Between(0, 2000),
        passed: false, isCrossing: false,
      });
    }

    // Bake Tommy walk frames + portrait textures
    if (!this.textures.exists('tommy_f0')) {
      const tg = this.add.graphics();
      for (let frame = 0; frame < 2; frame++) {
        tg.clear();
        const a0y = frame === 0 ? 13 : 43;
        const a1y = frame === 0 ? 43 : 13;
        const l0y = frame === 0 ? 38 : 43;
        const l1y = frame === 0 ? 43 : 38;
        // shadow
        tg.fillStyle(0x000000, 0.15); tg.fillEllipse(28, 51, 42, 10);
        // legs (behind body)
        tg.fillStyle(0x1E40AF);  tg.fillEllipse(13, l0y, 13, 18); tg.fillEllipse(22, l1y, 13, 18);
        tg.fillStyle(0x111827);  tg.fillEllipse(13, l0y+9, 14, 10); tg.fillEllipse(22, l1y+9, 14, 10);
        // backpack
        tg.fillStyle(0xF97316);  tg.fillRoundedRect(2, 18, 13, 18, 4);
        tg.fillStyle(0xC05621);  tg.fillRoundedRect(4, 22, 9, 10, 2);
        // body
        tg.fillStyle(0x3B82F6);  tg.fillEllipse(27, 27, 30, 26);
        tg.fillStyle(0x60A5FA, 0.55); tg.fillEllipse(29, 22, 18, 14);
        // arms (on top of body)
        tg.fillStyle(0xFDBA74);  tg.fillEllipse(19, a0y, 13, 20); tg.fillEllipse(19, a1y, 13, 20);
        // head skin
        tg.fillStyle(0xFDBA74);  tg.fillCircle(42, 27, 13);
        // hair
        tg.fillStyle(0x7C3F10);  tg.fillCircle(42, 20, 12); tg.fillCircle(34, 22, 7);
        // ear + face patch
        tg.fillStyle(0xFDBA74);  tg.fillCircle(33, 31, 5); tg.fillEllipse(48, 31, 18, 14);
        // eyes
        tg.fillStyle(0x1C1917);  tg.fillCircle(51, 27, 2.5); tg.fillCircle(46, 27, 2.5);
        // smile
        tg.lineStyle(1.5, 0x7C2D12, 1);
        tg.beginPath(); tg.arc(47, 31, 4, Math.PI * 1.1, Math.PI * 1.9, false); tg.strokePath();
        tg.generateTexture(`tommy_f${frame}`, 56, 56);
      }
      // portraits
      tg.clear();
      tg.fillStyle(0x3B82F6); tg.fillCircle(30, 30, 30);
      tg.fillStyle(0xFCD34D); tg.fillCircle(30, 20, 20);
      tg.lineStyle(3, 0x000000); tg.beginPath(); tg.arc(30, 25, 8, 0, Math.PI, false); tg.strokePath();
      tg.generateTexture('portrait_smile', 60, 60);
      tg.clear();
      tg.fillStyle(0x3B82F6); tg.fillCircle(30, 30, 30);
      tg.fillStyle(0xFCD34D); tg.fillCircle(30, 20, 20);
      tg.fillStyle(0x000000); tg.fillCircle(30, 28, 5);
      tg.generateTexture('portrait_gasp', 60, 60);
      tg.destroy();
    }

    this.bakeObjectTextures();

    this.tommy = this.physics.add.image(220, H/2 + LANE_OFFSETS[1], 'tommy_f0')
      .setDepth(5).setAlpha(0);

    // ── Lottie cat rendered into Phaser texture ──────────────────────────────
    // Canvas renderer needs a <div> container — a bare canvas doesn't work
    const lottieDiv = document.createElement('div');
    lottieDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:200px;height:200px;';
    document.body.appendChild(lottieDiv);
    this.catDiv = lottieDiv;

    // Pin precomp position to center so the cat doesn't slide across the canvas
    const rawData    = catwalkData as any;
    const baseLayer  = rawData.layers[rawData.layers.length - 1];
    const staticLayer = { ...baseLayer, ks: { ...baseLayer.ks, p: { a: 0, k: [540, 828, 0] } } };
    const animData   = { ...rawData, op: 158, layers: [staticLayer] };

    this.catAnim = lottie.loadAnimation({
      container:     lottieDiv,
      renderer:      'canvas',
      loop:          true,
      autoplay:      false,
      animationData: animData,
    });

    // Lottie creates a <canvas> inside the div synchronously with animationData
    // Do NOT touch canvas.width/height — that clears it and breaks Lottie's context
    this.catCanvas = lottieDiv.querySelector('canvas') as HTMLCanvasElement ?? undefined;

    if (this.textures.exists('cat_lottie')) this.textures.remove('cat_lottie');
    this.textures.createCanvas('cat_lottie', 200, 200);
    this.catImage = this.add.image(220, H/2 + LANE_OFFSETS[1] - 10, 'cat_lottie')
      .setScale(0.675).setFlipX(true).setDepth(5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.catAnim?.destroy();
      this.catDiv?.remove();
      this.catAnim   = undefined;
      this.catDiv    = undefined;
      this.catCanvas = undefined;
      this.catImage  = undefined;
    });
    // ────────────────────────────────────────────────────────────────────────

    this.buildLifeIndicators();
    this.setupSwipeControls();
    this.buildBookDisplay();
    this.setupObjects(cfg.crossings, firstCrossX, SPACING);

    if (this.level === 1) {
      EventBus.emit('show-crossing-tutorial');
      const onTutDone = () => EventBus.emit('show-crossing-start', { level: this.level });
      EventBus.once('crossing-tutorial-done', onTutDone);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('crossing-tutorial-done', onTutDone));
    } else {
      this.time.delayedCall(300, () => EventBus.emit('show-crossing-start', { level: this.level }));
    }
    const onStartDone = () => { this.tutorialActive = false; };
    EventBus.once('crossing-start-done', onStartDone);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('crossing-start-done', onStartDone));
  }

  // ── Swipe controls ────────────────────────────────────────────────────────────

  setupSwipeControls() {
    const onDown = (p: Phaser.Input.Pointer) => {
      this.swipeStartY = p.y;
      this.swipeStartX = p.x;
      this.swipeUsed   = false;
    };
    const onMove = (p: Phaser.Input.Pointer) => {
      if (!p.isDown || this.swipeUsed) return;
      const dy = p.y - this.swipeStartY;
      const dx = Math.abs(p.x - this.swipeStartX);
      if (Math.abs(dy) > 32 && Math.abs(dy) > dx * 1.2) {
        this.swipeUsed = true;
        if (!this.done) this.changeLane(dy > 0 ? 1 : -1);
      }
    };
    const onUp = () => { this.swipeUsed = false; };

    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup',   onUp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', onDown);
      this.input.off('pointermove', onMove);
      this.input.off('pointerup',   onUp);
    });
  }

  // ── Pre-seed objects for entire level ─────────────────────────────────────────

  setupObjects(crossings: number, firstCrossX: number, SPACING: number) {
    const OBS_GAP  = 120;   // min px between obstacles
    const BOOK_GAP =  80;   // min px between books

    const placedObs:  number[] = [];
    const placedBook: number[] = [];

    const tryObstacleInLane = (ideal: number, lane: number, spread = 35) => {
      for (let t = 0; t < 10; t++) {
        const wx = ideal + Phaser.Math.Between(-spread, spread);
        if (placedObs.some(p => Math.abs(p - wx) < OBS_GAP)) continue;
        this.spawnObstacle(wx, lane);
        placedObs.push(wx);
        return true;
      }
      return false;
    };
    const tryBook = (ideal: number, spread = 50) => {
      for (let t = 0; t < 12; t++) {
        const wx = ideal + Phaser.Math.Between(-spread, spread);
        if (placedBook.some(p => Math.abs(p - wx) < BOOK_GAP)) continue;
        if (placedObs.some(p => Math.abs(p - wx) < 55)) continue;  // no overlap with obstacles
        this.spawnBook(wx);
        placedBook.push(wx);
        return;
      }
    };

    // Extra obstacles beyond the mandatory 3 (0 at level 1, up to 3 at level 9+)
    const extraPerSeg = Math.min(Math.floor(this.level / 3), 3);

    for (let i = 0; i <= crossings; i++) {
      const segStart = i === 0 ? 420 : firstCrossX + (i - 1) * SPACING + 160;
      const segEnd   = i === crossings ? this.schoolX - 160 : firstCrossX + i * SPACING - 160;
      const segLen   = segEnd - segStart;
      if (segLen < 300) continue;

      // Spread 5 guaranteed obstacles evenly, rotating through all 3 lanes
      const positions = [0.12, 0.30, 0.50, 0.70, 0.88];
      const baseLanes = [0, 1, 2, 0, 1].sort(() => Math.random() - 0.5);
      positions.forEach((pos, idx) => tryObstacleInLane(segStart + segLen * pos, baseLanes[idx]));

      // Extra obstacles (random lane, random position)
      for (let e = 0; e < extraPerSeg; e++) {
        const lane = Phaser.Math.Between(0, 2);
        tryObstacleInLane(segStart + segLen * (0.10 + Math.random() * 0.80), lane, 25);
      }

      // Guaranteed 1 book — placed in a zone that deliberately avoids the mid-obstacle
      // Use first or last quarter to stay clear of the obstacle cluster
      const bookZone = Math.random() < 0.5
        ? segStart + segLen * (0.05 + Math.random() * 0.15)   // early zone
        : segStart + segLen * (0.65 + Math.random() * 0.20);  // late zone
      tryBook(bookZone, 30);

      // Second book at higher levels
      if (this.level >= 7 && Math.random() < 0.6) {
        tryBook(segStart + segLen * (0.35 + Math.random() * 0.20), 35);
      }
    }
  }

  buildBookDisplay() {
    const W = this.cameras.main.width;
    this.bookTxt = this.add.text(W / 2, 18, '📚 0 / 4', {
      fontFamily: 'Fredoka One', fontSize: '18px',
      color: '#FFFFFF', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(25);
  }

  // ── Lane change ───────────────────────────────────────────────────────────────

  changeLane(dir: -1 | 1) {
    const newLane = Phaser.Math.Clamp(this.tommyLane + dir, 0, 2);
    if (newLane === this.tommyLane) return;
    this.tommyLane = newLane;
    this.tweens.add({
      targets: this.tommy,
      y: this.sceneH / 2 + LANE_OFFSETS[newLane],
      duration: 180, ease: 'Quad.easeOut',
    });
  }

  // ── Penalty ───────────────────────────────────────────────────────────────────

  penalize() {
    if (this.done || this.tutorialActive || this.penaltyCooldown) return;
    this.penaltyCooldown = true;
    this.livesLost++;
    this.tommy.x = Math.max(220, this.tommy.x - 140);
    this.tommy.setVelocityX(0);
    EventBus.emit('show-crossing-penalty');

    const W = this.cameras.main.width, H = this.sceneH;
    const lifeIdx = this.livesLost - 1;
    const icon = this.add.text(W/2, H/3, '💥', { fontSize: '72px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(30);
    this.tweens.add({
      targets: icon, x: 24 + lifeIdx * 48, y: 100,
      scaleX: 0.12, scaleY: 0.12, duration: 700, ease: 'Cubic.easeIn',
      onComplete: () => {
        icon.destroy();
        this.refreshLifeIndicators();
        if (this.livesLost >= 3) {
          this.done = true;
          this.tommy.setVelocityX(0);
          this.time.delayedCall(400, () => EventBus.emit('game-time-up', this.scored));
        }
      },
    });
    this.time.delayedCall(2000, () => { this.penaltyCooldown = false; });
  }

  // ── Collect book ──────────────────────────────────────────────────────────────

  collectBook(book: WorldObj) {
    book.alive = false;
    this.tweens.add({ targets: book.gfx, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 300,
      onComplete: () => book.gfx.destroy() });

    this.booksInCycle++;
    const inCycle = this.booksInCycle % 4;
    this.bookTxt.setText(`📚 ${inCycle === 0 ? 4 : inCycle} / 4`);

    // Float text
    const plusTxt = this.add.text(this.tommy.x, this.tommy.y - 30, '📚 +1', {
      fontFamily: 'Fredoka One', fontSize: '16px',
      color: '#FCD34D', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: plusTxt, y: plusTxt.y - 40, alpha: 0, duration: 700,
      onComplete: () => plusTxt.destroy() });

    // 4 books = recover 1 life
    if (inCycle === 0 && this.livesLost > 0) {
      this.livesLost--;
      this.refreshLifeIndicators();
      const bonusTxt = this.add.text(
        this.cameras.main.width / 2, this.sceneH / 2,
        '❤️ +1 VIDA!', {
          fontFamily: 'Fredoka One', fontSize: '28px',
          color: '#FF6B6B', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
      this.tweens.add({ targets: bonusTxt, y: bonusTxt.y - 60, alpha: 0, duration: 1400,
        onComplete: () => bonusTxt.destroy() });
    }
  }

  // ── Texture baking (2× render → 0.5 scale = crisp on HiDPI) ─────────────────

  private bakeObjectTextures() {
    if (this.textures.exists('obs_tree')) return;

    const bake = (key: string, fn: (g: Phaser.GameObjects.Graphics) => void, w = 128, h = 128) => {
      const g = this.make.graphics({ x: 0, y: 0 });
      fn(g);
      g.setScale(2, 2);
      const rt = this.add.renderTexture(0, 0, w, h);
      rt.draw(g, w / 2, h / 2);
      rt.saveTexture(key);
      rt.destroy();
      g.destroy();
    };

    bake('obs_tree', g => this.drawObstacleGfx(g, 'tree'));
    bake('obs_bike', g => this.drawObstacleGfx(g, 'bike'));
    bake('obs_sign', g => this.drawObstacleGfx(g, 'sign'));

    const pSkins  = [0xFDBA74, 0xF97316, 0xFCD34D, 0xD97706];
    const pShirts = [0xE53E3E, 0x3182CE, 0x805AD5, 0x38A169];
    for (let i = 0; i < 4; i++) {
      const sk = pSkins[i], sh = pShirts[i];
      bake(`obs_person_${i}`, g => {
        g.lineStyle(2.5, 0xEF4444, 0.85); g.strokeCircle(0, 0, 26);
        g.fillStyle(0x000000, 0.12); g.fillEllipse(0, 12, 20, 8);
        g.fillStyle(sh); g.fillEllipse(0, 4, 16, 20);
        g.fillStyle(sk); g.fillCircle(0, -9, 9);
        g.fillStyle(0x78350F); g.fillCircle(0, -13, 7);
      });
    }
    for (let i = 0; i < BOOK_COLORS.length; i++) {
      bake(`book_tex_${i}`, g => this.drawBookGfx(g, BOOK_COLORS[i]), 100, 100);
    }
  }

  // ── Obstacle spawning ─────────────────────────────────────────────────────────

  spawnObstacle(worldX: number, forceLane?: number) {
    const H = this.sceneH;
    if (worldX < 420) return;
    if (this.crossroads.some(cr => Math.abs(cr.x - worldX) < 155)) return;

    const lane      = forceLane !== undefined ? forceLane : Phaser.Math.Between(0, 2);
    const laneTypes = [['bike', 'person'], ['person', 'sign'], ['tree']] as const;
    const types     = laneTypes[lane];
    const type      = types[Phaser.Math.Between(0, types.length - 1)] as string;
    const y         = H / 2 + LANE_OFFSETS[lane];

    const texKey = type === 'person' ? `obs_person_${Phaser.Math.Between(0, 3)}` : `obs_${type}`;
    const img = this.add.image(worldX, y, texKey).setOrigin(0.5).setScale(0.5).setDepth(4);
    this.worldObstacles.push({ worldX, lane, gfx: img, type, alive: true });
  }

  spawnBook(worldX: number) {
    const H = this.sceneH;
    if (worldX < 370) return;
    if (this.crossroads.some(cr => Math.abs(cr.x - worldX) < 135)) return;

    const lane     = Phaser.Math.Between(0, 2);
    const colorIdx = Phaser.Math.Between(0, BOOK_COLORS.length - 1);
    const y        = H / 2 + LANE_OFFSETS[lane];

    const img = this.add.image(worldX, y, `book_tex_${colorIdx}`).setOrigin(0.5).setScale(0.5).setDepth(4);
    this.worldBooks.push({ worldX, lane, gfx: img, type: 'book', alive: true });
  }

  drawObstacleGfx(g: Phaser.GameObjects.Graphics, type: string) {
    g.clear();
    // Red warning ring (drawn first, behind the object)
    g.lineStyle(2.5, 0xEF4444, 0.85);
    g.strokeCircle(0, 0, 26);
    if (type === 'tree') {
      g.fillStyle(0x8B6543); g.fillRect(-3, -3, 6, 12);
      g.fillStyle(0x276749); g.fillCircle(0, -14, 17);
      g.fillStyle(0x38A169); g.fillCircle(0, -18, 12);
      g.fillStyle(0x68D391, 0.55); g.fillCircle(-4, -23, 7);
    } else if (type === 'bike') {
      g.fillStyle(0xE53E3E);
      g.fillRoundedRect(-16, -3, 32, 6, 2);   // frame bar
      g.fillRoundedRect(-20, -8, 10, 5, 2);   // handlebar
      g.fillRoundedRect(10, -8, 10, 5, 2);    // seat
      g.fillStyle(0x1A1A1A);
      g.fillEllipse(-13, 5, 10, 16); g.fillEllipse(13, 5, 10, 16);
      g.fillStyle(0x555555);
      g.fillEllipse(-13, 5, 6, 10);  g.fillEllipse(13, 5, 6, 10);
    } else if (type === 'person') {
      const skins   = [0xFDBA74, 0xFCD34D, 0xF97316, 0xD97706];
      const shirts  = [0xE53E3E, 0x3182CE, 0x805AD5, 0x0987A0, 0x38A169];
      const skin  = skins [Phaser.Math.Between(0, skins.length  - 1)];
      const shirt = shirts[Phaser.Math.Between(0, shirts.length - 1)];
      g.fillStyle(0x000000, 0.12); g.fillEllipse(0, 12, 20, 8);
      g.fillStyle(shirt); g.fillEllipse(0, 4, 16, 20);
      g.fillStyle(skin);  g.fillCircle(0, -9, 9);
      g.fillStyle(0x78350F); g.fillCircle(0, -13, 7);
    } else if (type === 'sign') {
      g.fillStyle(0xFBBF24); g.fillRoundedRect(-18, -18, 36, 36, 5);
      g.lineStyle(2, 0xD97706, 1); g.strokeRoundedRect(-18, -18, 36, 36, 5);
      g.fillStyle(0x1C1917);
      for (let i = 0; i < 3; i++) g.fillRect(-12, -11 + i*11, 24, 5);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillRect(-2.5, -8, 5, 14); g.fillCircle(0, 9, 3);
    }
  }

  drawBookGfx(g: Phaser.GameObjects.Graphics, color: number) {
    g.clear();
    // Green reward ring
    g.lineStyle(2.5, 0x22C55E, 0.85);
    g.strokeCircle(0, 0, 22);
    g.fillStyle(0xFCD34D, 0.28); g.fillCircle(0, 0, 22);
    g.fillStyle(color); g.fillRoundedRect(-12, -16, 24, 32, 3);
    g.fillStyle(Phaser.Display.Color.ValueToColor(color).darken(20).color);
    g.fillRoundedRect(-12, -16, 5, 32, 3);
    g.fillStyle(0xFFF8DC); g.fillRect(-6, -13, 16, 26);
    g.lineStyle(1, 0xD4C9A0, 0.7);
    for (let i = 0; i < 4; i++) g.lineBetween(-3, -8 + i*8, 8, -8 + i*8);
    g.fillStyle(0xFCD34D, 0.9);
    g.fillCircle(12, -14, 4); g.fillCircle(16, -8, 2.5); g.fillCircle(10, -20, 2);
  }

  // ── Life indicators ───────────────────────────────────────────────────────────

  private buildLifeIndicators() {
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics().setScrollFactor(0).setDepth(25).setPosition(24 + i * 48, 100);
      this.redrawIndicator(g, false);
      this.lifeIndicators.push(g);
    }
  }

  private redrawIndicator(g: Phaser.GameObjects.Graphics, lost: boolean) {
    g.clear();
    const w = 26, h = 48, r = 4;
    g.fillStyle(0x111827);          g.fillRoundedRect(-w/2, -h/2, w, h, r);
    g.fillStyle(lost ? 0xFF2222 : 0x3A1A1A); g.fillCircle(0, -h/4, 9);
    if (lost) { g.fillStyle(0xFF8888, 0.35); g.fillCircle(-3, -h/4-3, 4); }
    g.fillStyle(0x0A2A0A);          g.fillCircle(0, h/4, 9);
    g.lineStyle(1.5, 0x4B5563, 1);  g.strokeRoundedRect(-w/2, -h/2, w, h, r);
  }

  private refreshLifeIndicators() {
    for (let i = 0; i < 3; i++) {
      this.redrawIndicator(this.lifeIndicators[i], i < this.livesLost);
    }
  }

  // ── Tommy animated character ──────────────────────────────────────────────────

  private drawTommy() {
    // Keep catImage aligned with Tommy in world space
    this.catImage?.setPosition(this.tommy.x, this.tommy.y - 40);

    const vel = (this.tommy.body as Phaser.Physics.Arcade.Body)?.velocity.x ?? 0;
    if (vel > 0) {
      this.catFrame = (this.catFrame + 0.5) % 158;
      this.catAnim?.goToAndStop(Math.floor(this.catFrame), true);
    }

    // Copy current Lottie frame into the Phaser canvas texture
    if (this.catCanvas && this.textures.exists('cat_lottie')) {
      const ct  = this.textures.get('cat_lottie') as Phaser.Textures.CanvasTexture;
      const ctx = ct.getContext();
      ctx.clearRect(0, 0, 200, 200);
      ctx.drawImage(this.catCanvas, 0, 0, 200, 200);
      ct.refresh();
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    this.drawTommy();

    if (this.done || this.tutorialActive) {
      this.tommy.setVelocityX(0);
      return;
    }

    const W = this.cameras.main.width, H = this.sceneH;
    const tommyX = this.tommy.x;
    const { speed } = getLevelCfg(this.level);

    // Camera follow
    const targetScrollX = tommyX - W * 0.35;
    const lerpFactor    = 1 - Math.pow(0.92, delta * 60 / 1000);
    this.cameras.main.scrollX += (targetScrollX - this.cameras.main.scrollX) * lerpFactor;

    // Win
    if (tommyX >= this.schoolX - 30) {
      this.done = true;
      this.tommy.setVelocityX(0);
      this.time.delayedCall(500, () => EventBus.emit('game-level-complete', this.level));
      return;
    }

    // Stop only works when near a crossing (not yet passed)
    const nearCrossing = this.crossroads.some(
      cr => !cr.passed && tommyX > cr.x - 210 && tommyX < cr.x + 90,
    );
    const holding = this.input.activePointer.isDown && !this.swipeUsed && nearCrossing;
    this.tommy.setVelocityX(holding ? 0 : speed);

    // Cleanup
    this.worldObstacles = this.worldObstacles.filter(o => {
      if (!o.alive || o.worldX < tommyX - 350) { o.gfx.destroy(); return false; }
      return true;
    });
    this.worldBooks = this.worldBooks.filter(b => {
      if (!b.alive || b.worldX < tommyX - 350) {
        if (b.alive) b.gfx.destroy();
        return false;
      }
      return true;
    });

    // Obstacle collision
    if (!this.penaltyCooldown) {
      for (const obs of this.worldObstacles) {
        if (!obs.alive || obs.lane !== this.tommyLane) continue;
        if (Math.abs(tommyX - obs.worldX) < 22) {
          obs.alive = false;
          this.tweens.add({ targets: obs.gfx, alpha: 0, duration: 350,
            onComplete: () => obs.gfx.destroy() });
          this.penalize();
          break;
        }
      }
    }

    // Book collection
    for (const book of this.worldBooks) {
      if (!book.alive || book.lane !== this.tommyLane) continue;
      if (Math.abs(tommyX - book.worldX) < 28) {
        this.collectBook(book);
      }
    }

    // Crossroads
    this.crossroads.forEach(cr => {
      const isInside = tommyX > cr.x - 90 && tommyX < cr.x + 90;
      if (isInside && cr.state === 'green') cr.isCrossing = true;
      if (!isInside) cr.isCrossing = false;

      if (!cr.isCrossing) {
        cr.timer += delta;
        const cycle = cr.state === 'green' ? 1800 + this.level * 30 : 2600 + this.level * 40;
        if (cr.timer > cycle) {
          const next = cr.state === 'red' ? 'green' : 'red';
          if (next === 'red' && tommyX > cr.x - 100 && tommyX < cr.x) {
            cr.timer = cycle - 300;
          } else {
            cr.timer = 0; cr.state = next;
            if (cr.state === 'red') {
              cr.lightRed.setAlpha(1);   cr.lightRedIcon?.setAlpha(1);
              cr.lightGreen.setAlpha(0.2); cr.lightGreenIcon?.setAlpha(0.2);
            } else {
              cr.lightRed.setAlpha(0.2); cr.lightRedIcon?.setAlpha(0.2);
              cr.lightGreen.setAlpha(1);  cr.lightGreenIcon?.setAlpha(1);
            }
          }
        }
      }

      // Spawn cars — skip if another car on same crossing+direction is too close
      if (Math.abs(cr.x - tommyX) < 1200 && Math.random() < 0.012) {
        const isDown  = Math.random() > 0.5;
        const dir     = isDown ? 'down' : 'up';
        const spawnY  = isDown ? -110 : H + 110;
        const tooClose = this.carGroup.getChildren().some(child => {
          const c = child as Phaser.Physics.Arcade.Image & { cr: any; dir: string };
          return c.active && c.cr === cr && c.dir === dir && Math.abs(c.y - spawnY) < 130;
        });
        if (!tooClose) {
          const model    = CAR_MODELS[Phaser.Math.Between(0, CAR_MODELS.length - 1)];
          const colorIdx = Phaser.Math.Between(0, 4);
          const texKey   = this.carTextureKeys[`${model}_${colorIdx}`] || 'car2_sedan_0';
          const car = this.carGroup.create(
            cr.x + (isDown ? -25 : 25), spawnY, texKey,
          ) as Phaser.Physics.Arcade.Image & { cr: any; dir: string };
          car.cr = cr; car.dir = dir;
          car.setDepth(6).setVelocityY(isDown ? 170 : -170);
          if (isDown) car.setAngle(180);
          this.time.delayedCall(10000, () => { if (car.active) car.destroy(); });
        }
      }

      // Red-light penalty (only if Tommy isn't holding stop near crossing)
      if (isInside && cr.state === 'red' && !holding) this.penalize();

      // Score crossing
      if (!cr.passed && tommyX > cr.x + 100) {
        cr.passed = true;
        this.scored++;
        EventBus.emit('game-scored-update', `${this.scored}/${this.crossCount}`);
        EventBus.emit('show-crossing-praise');
      }
    });

    // Cars stop at red pedestrian lights
    this.carGroup.getChildren().forEach(child => {
      const c = child as Phaser.Physics.Arcade.Image & { cr: any; dir: string };
      if (!c.active || !c.body) return;
      const stopTop = H/2-60, stopBot = H/2+60, FRONT = 44;
      if (c.cr.state === 'green') {
        if (c.dir === 'down') {
          if (c.y >= stopTop - FRONT) return;
          let na = Infinity;
          this.carGroup.getChildren().forEach(o2 => {
            const oc = o2 as Phaser.Physics.Arcade.Image & { cr: any; dir: string };
            if (oc === c || !oc.active || oc.cr !== c.cr || oc.dir !== 'down') return;
            const ob = oc.body as Phaser.Physics.Arcade.Body;
            if (ob && Math.abs(ob.velocity.y) < 5 && oc.y > c.y) na = Math.min(na, oc.y);
          });
          const st = na < Infinity ? na - 100 : stopTop - FRONT;
          if (st > 0 && c.y > st - 30) c.setVelocityY(0);
        } else {
          if (c.y <= stopBot + FRONT) return;
          let na = -Infinity;
          this.carGroup.getChildren().forEach(o2 => {
            const oc = o2 as Phaser.Physics.Arcade.Image & { cr: any; dir: string };
            if (oc === c || !oc.active || oc.cr !== c.cr || oc.dir !== 'up') return;
            const ob = oc.body as Phaser.Physics.Arcade.Body;
            if (ob && Math.abs(ob.velocity.y) < 5 && oc.y < c.y) na = Math.max(na, oc.y);
          });
          const st = na > -Infinity ? na + 100 : stopBot + FRONT;
          if (st < H && c.y < st + 30) c.setVelocityY(0);
        }
      } else {
        if (c.dir === 'down' && c.body?.velocity.y === 0) c.setVelocityY(170);
        if (c.dir === 'up'   && c.body?.velocity.y === 0) c.setVelocityY(-170);
      }
    });
  }
}
