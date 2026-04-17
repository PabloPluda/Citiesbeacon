import Phaser from 'phaser';
import { EventBus } from '../EventBus';

// ─── Level config ──────────────────────────────────────────────────────────────
function getLevelCfg(level: number) {
  // L1: 10 crossings.  L2+: 10+level (12, 13, 14, 15 …), capped at 30.
  const crossings = level === 1 ? 10 : Math.min(10 + level, 30);
  // Speed starts gentle (135 px/s at L1) and climbs ~7 px/s per level.
  const speed = Math.round(135 + (level - 1) * 7);
  return { crossings, speed };
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
  // Wheels
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

  } else { // hatch
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

// ─── Neighbourhood helpers ─────────────────────────────────────────────────────
const HOUSE_PALETTE = [
  { wall: 0xFFF9E6, roof: 0x9B3B1F },
  { wall: 0xE8F5E9, roof: 0x1B5E20 },
  { wall: 0xE3F2FD, roof: 0x0D47A1 },
  { wall: 0xFCE4EC, roof: 0x880E4F },
  { wall: 0xF3E5F5, roof: 0x4A148C },
  { wall: 0xFFF3E0, roof: 0x4E342E },
];

/** Small roadside house drawn top-down. doorFacesDown=true → door at bottom, roof at top. */
function drawSmallHouse(g: Phaser.GameObjects.Graphics, x: number, cy: number,
  wallC: number, roofC: number, doorFacesDown: boolean) {
  const hw = 27, hh = 33;
  g.fillStyle(0x000000, 0.07); g.fillEllipse(x+2, cy+hh+4, hw*2+4, 8);
  // Wall
  g.fillStyle(wallC); g.fillRoundedRect(x-hw, cy-hh, hw*2, hh*2, 3);
  // Roof (opposite side from door)
  if (doorFacesDown) {
    g.fillStyle(roofC); g.fillRoundedRect(x-hw, cy-hh, hw*2, hh*1.1, 3);
  } else {
    g.fillStyle(roofC); g.fillRoundedRect(x-hw, cy-hh*0.08, hw*2, hh*1.1, 3);
  }
  // Windows
  g.fillStyle(0xADD8E6, 0.8);
  g.fillRoundedRect(x-hw+5, cy-5, 11, 11, 2);
  g.fillRoundedRect(x+hw-16, cy-5, 11, 11, 2);
  // Door
  g.fillStyle(0x6B3A1F, 0.85);
  if (doorFacesDown) {
    g.fillRoundedRect(x-5, cy+hh-13, 10, 13, 1);
  } else {
    g.fillRoundedRect(x-5, cy-hh, 10, 13, 1);
  }
}

function drawTree(g: Phaser.GameObjects.Graphics, x: number, cy: number) {
  g.fillStyle(0x8B6543); g.fillRect(x-3, cy-3, 6, 12);
  g.fillStyle(0x276749); g.fillCircle(x, cy-14, 17);
  g.fillStyle(0x38A169); g.fillCircle(x, cy-18, 12);
  g.fillStyle(0x68D391, 0.55); g.fillCircle(x-4, cy-23, 7);
}

function buildNeighbourhood(scene: Phaser.Scene, worldW: number, H: number, crossX: number[]) {
  const g = scene.add.graphics().setDepth(1);
  const GAP = 190;
  const topHouseY = H / 2 - 120;
  const botHouseY = H / 2 + 120;
  const topTreeY  = Math.max(H / 2 - 210, 30);
  const botTreeY  = Math.min(H / 2 + 210, H - 30);

  // Trees first (behind houses)
  for (let x = 90; x < worldW - 60; x += GAP) {
    if (crossX.some(cx => Math.abs(x - cx) < 130)) continue;
    drawTree(g, x - 36, topTreeY);
    drawTree(g, x + 28, topTreeY - 18);
    if (topTreeY > 50) drawTree(g, x + 70, topTreeY);
    drawTree(g, x - 32, botTreeY);
    drawTree(g, x + 30, botTreeY + 18);
    if (botTreeY < H - 50) drawTree(g, x + 65, botTreeY);
  }
  // Houses on top of trees
  for (let x = 90; x < worldW - 60; x += GAP) {
    if (crossX.some(cx => Math.abs(x - cx) < 130)) continue;
    const ci = Math.floor(x / GAP) % HOUSE_PALETTE.length;
    const { wall, roof } = HOUSE_PALETTE[ci];
    drawSmallHouse(g, x, topHouseY, wall, roof, true);   // door faces sidewalk (down)
    drawSmallHouse(g, x, botHouseY, wall, roof, false);  // door faces sidewalk (up)
  }
}

// ─── Main house (start) ────────────────────────────────────────────────────────
function drawStartHouse(scene: Phaser.Scene, x: number, sidewalkY: number) {
  const g = scene.add.graphics().setDepth(2);
  const hw = 90, hh = 110, cy = sidewalkY - 100;
  g.fillStyle(0x52D482, 0.5); g.fillRect(x-hw/2-20, sidewalkY-240, hw+40, 240);
  g.fillStyle(0x000000, 0.12); g.fillEllipse(x+5, cy+hh/2+8, hw+10, 18);
  g.fillStyle(0xFFF8E7); g.fillRoundedRect(x-hw/2, cy-hh/2, hw, hh, 4);
  g.fillStyle(0xC05621); g.fillRoundedRect(x-hw/2, cy-hh/2, hw, hh*0.55, 4);
  g.fillStyle(0x9C4221); g.fillRect(x-5, cy-hh/2+4, 10, hh*0.5);
  g.fillStyle(0x8D5524); g.fillRect(x+18, cy-hh/2+8, 14, 16);
  g.fillStyle(0x6B3A1F); g.fillRect(x+17, cy-hh/2+6, 16, 4);
  g.fillStyle(0xADD8E6, 0.85); g.fillRoundedRect(x-hw/2+8, cy+6, 20, 18, 2); g.fillRoundedRect(x+hw/2-28, cy+6, 20, 18, 2);
  g.fillStyle(0x8B4513); g.fillRoundedRect(x-10, cy+hh/2-22, 20, 22, 3);
  g.fillStyle(0xFFD700, 0.9); g.fillCircle(x+6, cy+hh/2-11, 2.5);
  g.fillStyle(0xCBD5E1, 0.9); g.fillRect(x-7, cy+hh/2, 14, sidewalkY-(cy+hh/2)+5);
  scene.add.text(x, cy-hh/2-16, '🏠', { fontSize: '22px' }).setOrigin(0.5).setDepth(3);
}

// ─── School (end) ─────────────────────────────────────────────────────────────
function drawSchool(scene: Phaser.Scene, x: number, sidewalkY: number) {
  const g = scene.add.graphics().setDepth(2);
  const sw = 130, sh = 130, cy = sidewalkY - 100;
  g.fillStyle(0x90CDF4, 0.25); g.fillRoundedRect(x-sw/2-30, sidewalkY-240, sw+60, 240, 6);
  g.lineStyle(2, 0xFFFFFF, 0.35); g.strokeCircle(x, cy-30, 22);
  g.fillStyle(0x000000, 0.15); g.fillEllipse(x+6, cy+sh/2+10, sw+20, 22);
  g.fillStyle(0xBEE3F8); g.fillRoundedRect(x-sw/2, cy-sh/2, sw, sh, 5);
  g.fillStyle(0x4299E1); g.fillRoundedRect(x-sw/2, cy-sh/2, sw, sh*0.38, 5);
  [-35, 0, 35].forEach(ox => {
    g.fillStyle(0xFFFDE7, 0.9); g.fillRoundedRect(x+ox-12, cy-10, 24, 20, 3);
    g.lineStyle(2, 0x2B6CB0, 0.5); g.strokeRoundedRect(x+ox-12, cy-10, 24, 20, 3);
    g.lineStyle(1.5, 0x2B6CB0, 0.4);
    g.beginPath(); g.moveTo(x+ox, cy-10); g.lineTo(x+ox, cy+10); g.strokePath();
    g.beginPath(); g.moveTo(x+ox-12, cy); g.lineTo(x+ox+12, cy); g.strokePath();
  });
  g.fillStyle(0x2D6A4F); g.fillRoundedRect(x-16, cy+sh/2-28, 32, 28, 3);
  g.fillStyle(0xFFD700, 0.9); g.fillCircle(x+10, cy+sh/2-14, 3);
  g.fillStyle(0xCBD5E1, 0.9); g.fillRect(x-9, cy+sh/2, 18, sidewalkY-(cy+sh/2)+5);
  g.fillStyle(0x888888); g.fillRect(x-sw/2+10, cy-sh/2-30, 4, 40);
  g.fillStyle(0xFF0000); g.fillRect(x-sw/2+14, cy-sh/2-30, 18, 12);
  scene.add.text(x, cy-sh/2-50, '🏫', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
}

// ─── Scene ────────────────────────────────────────────────────────────────────
export class CrossingScene extends Phaser.Scene {
  level = 1;
  scored = 0;
  done = false;
  tutorialActive = false;
  penaltyCooldown = false;

  // Lives system
  livesLost = 0;
  private lifeIndicators: Phaser.GameObjects.Graphics[] = [];

  tommy!: Phaser.Physics.Arcade.Image;
  tommyPortrait!: Phaser.GameObjects.Image;
  crossroads: any[] = [];
  carGroup!: Phaser.Physics.Arcade.Group;
  carTextureKeys: Record<string, string> = {};
  crossCount = 10;
  schoolX = 0;

  constructor() { super('CrossingScene'); }

  init(data?: { level?: number }) {
    this.level = data?.level || 1;
    this.scored = 0;
    this.crossCount = getLevelCfg(this.level).crossings;
    this.done = false;
    this.tutorialActive = true;
    this.penaltyCooldown = false;
    this.livesLost = 0;
    this.lifeIndicators = [];
    this.crossroads = [];
    this.carTextureKeys = {};
    this.schoolX = 0;
  }

  create() {
    const cfg = getLevelCfg(this.level);
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-scored-update', `0/${cfg.crossings}`);

    const handleRestart = (data: { level: number }) => {
      setTimeout(() => this.scene.restart(data), 0);
    };
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', handleRestart));

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const SPACING = 490;
    const firstCrossX = 500;
    const lastCrossX = firstCrossX + (cfg.crossings - 1) * SPACING;
    this.schoolX = lastCrossX + 700;
    const worldW = this.schoolX + 460;

    this.physics.world.gravity.y = 0;
    this.physics.world.setBounds(0, 0, worldW, H);
    this.cameras.main.setBounds(0, 0, worldW, H);

    // Car textures
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

    // Grass
    this.add.rectangle(worldW / 2, H / 2, worldW, H, 0x48BB78);
    // Sidewalk
    this.add.rectangle(worldW / 2, H / 2, worldW, 120, 0xCBD5E1);
    this.add.rectangle(worldW / 2, H / 2 - 58, worldW, 3, 0xA0AEC0);
    this.add.rectangle(worldW / 2, H / 2 + 58, worldW, 3, 0xA0AEC0);

    // Neighbourhood decoration (houses + trees both sides)
    buildNeighbourhood(this, worldW, H, Array.from({ length: cfg.crossings }, (_, i) => firstCrossX + i * SPACING));

    // Start house
    drawStartHouse(this, 160, H / 2);

    this.carGroup = this.physics.add.group();
    this.crossroads = [];

    // Crossroads
    for (let i = 0; i < cfg.crossings; i++) {
      const x = firstCrossX + i * SPACING;
      this.add.rectangle(x, H / 2, 180, H, 0x2D3748).setDepth(2);
      // Yellow dashes (skip crosswalk zone)
      for (let k = 0; k < Math.ceil(H / 80) + 4; k++) {
        const dashY = -160 + k * 80, mid = dashY + 20;
        if (mid > H / 2 - 75 && mid < H / 2 + 75) continue;
        this.add.rectangle(x, dashY, 8, 40, 0xEAB308).setDepth(3);
      }
      // Zebra stripes
      for (let j = 0; j < 4; j++) {
        this.add.rectangle(x - 60 + j * 40, H / 2, 20, 100, 0xFFFFFF).setAlpha(0.88).setDepth(3);
      }
      // Stop lines
      this.add.rectangle(x, H / 2 - 58, 160, 5, 0xFFFFFF).setAlpha(0.85).setDepth(3);
      this.add.rectangle(x, H / 2 + 58, 160, 5, 0xFFFFFF).setAlpha(0.85).setDepth(3);
      // Traffic light
      const poleX = x - 100, poleY = H / 2 - 80;
      this.add.rectangle(poleX, H / 2 - 20, 8, 120, 0x2D3748).setDepth(10);
      this.add.rectangle(poleX, poleY, 46, 100, 0x111827).setDepth(10);
      this.add.rectangle(poleX, poleY, 42, 96, 0x1F2937).setDepth(10);
      const redCircle   = this.add.circle(poleX, poleY - 28, 16, 0xFF0000).setDepth(11);
      const redIcon     = this.add.text(poleX, poleY - 28, '🧍', { fontSize: '14px' }).setOrigin(0.5).setDepth(12);
      const greenCircle = this.add.circle(poleX, poleY + 28, 16, 0x00CC44).setDepth(11);
      const greenIcon   = this.add.text(poleX, poleY + 28, '🚶', { fontSize: '14px' }).setOrigin(0.5).setDepth(12);
      const isRed = i === 0 ? false : Math.random() > 0.5;
      redCircle.setAlpha(isRed ? 1 : 0.2); redIcon.setAlpha(isRed ? 1 : 0.2);
      greenCircle.setAlpha(isRed ? 0.2 : 1); greenIcon.setAlpha(isRed ? 0.2 : 1);
      this.crossroads.push({
        x, width: 180,
        lightRed: redCircle, lightRedIcon: redIcon,
        lightGreen: greenCircle, lightGreenIcon: greenIcon,
        state: isRed ? 'red' : 'green',
        timer: Phaser.Math.Between(0, 2500),
        passed: false, isCrossing: false,
      });
    }

    // School
    drawSchool(this, this.schoolX, H / 2);
    this.add.rectangle(this.schoolX, H / 2, 6, 120, 0xF6E05E).setAlpha(0.6).setDepth(4);

    // Tommy textures
    if (!this.textures.exists('tommy_top')) {
      const tg = this.make.graphics({ x: 0, y: 0 });
      tg.fillStyle(0x3B82F6); tg.fillCircle(20, 20, 20);
      tg.fillStyle(0xFCD34D); tg.fillCircle(20, 10, 12);
      tg.generateTexture('tommy_top', 40, 40);
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

    this.tommy = this.physics.add.image(220, H / 2, 'tommy_top').setDepth(5);
    this.cameras.main.startFollow(this.tommy, true, 0.08, 0.08, -W / 4, 0);

    this.add.rectangle(W - 60, 60, 80, 80, 0xFFFFFF).setDepth(20).setScrollFactor(0);
    this.tommyPortrait = this.add.image(W - 60, 60, 'portrait_smile').setDepth(21).setScrollFactor(0);

    // Lives: 3 small traffic-light indicators, top-left, fixed to screen
    this.buildLifeIndicators();

    this.physics.add.overlap(this.tommy, this.carGroup, () => this.penalize());

    // ── Tutorial (level 1) then START button; or just START button ────────────
    if (this.level === 1) {
      EventBus.emit('show-crossing-tutorial');
      const onTutDone = () => EventBus.emit('show-crossing-start', { level: this.level });
      EventBus.once('crossing-tutorial-done', onTutDone);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('crossing-tutorial-done', onTutDone));
    } else {
      // Small delay so player can see the house
      this.time.delayedCall(300, () => EventBus.emit('show-crossing-start', { level: this.level }));
    }

    const onStartDone = () => { this.tutorialActive = false; };
    EventBus.once('crossing-start-done', onStartDone);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('crossing-start-done', onStartDone));
  }

  penalize() {
    if (this.done || this.tutorialActive || this.penaltyCooldown) return;
    this.penaltyCooldown = true;
    this.livesLost++;

    // Push Tommy back
    this.tommy.x = Math.max(220, this.tommy.x - 160);
    this.tommy.setVelocityX(0);
    EventBus.emit('show-crossing-penalty');

    // Big red traffic-light flies from centre → corresponding life indicator
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const lifeIdx = this.livesLost - 1;
    const bigLight = this.add.text(W / 2, H / 3, '🚦', { fontSize: '72px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(30);
    const targetX = 24 + lifeIdx * 48;
    const targetY = 100;
    this.tweens.add({
      targets: bigLight,
      x: targetX, y: targetY,
      scaleX: 0.12, scaleY: 0.12,
      duration: 700, ease: 'Cubic.easeIn',
      onComplete: () => {
        bigLight.destroy();
        this.markLifeLost(lifeIdx);
        if (this.livesLost >= 3) {
          this.done = true;
          this.tommy.setVelocityX(0);
          this.time.delayedCall(400, () => EventBus.emit('game-time-up', this.scored));
        }
      }
    });

    this.time.delayedCall(2200, () => { this.penaltyCooldown = false; });
  }

  private buildLifeIndicators() {
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics()
        .setScrollFactor(0).setDepth(25)
        .setPosition(24 + i * 48, 100);
      this.redrawIndicator(g, false);
      this.lifeIndicators.push(g);
    }
  }

  private redrawIndicator(g: Phaser.GameObjects.Graphics, lost: boolean) {
    g.clear();
    const w = 26, h = 48, r = 4;
    g.fillStyle(0x111827);          g.fillRoundedRect(-w/2, -h/2, w, h, r);
    g.fillStyle(lost ? 0xFF2222 : 0x3A1A1A); g.fillCircle(0, -h/4, 9);
    if (lost) { g.fillStyle(0xFF8888, 0.35); g.fillCircle(-3, -h/4 - 3, 4); }
    g.fillStyle(0x0A2A0A);          g.fillCircle(0, h/4, 9);
    g.lineStyle(1.5, 0x4B5563, 1);  g.strokeRoundedRect(-w/2, -h/2, w, h, r);
  }

  private markLifeLost(index: number) {
    if (index >= 0 && index < this.lifeIndicators.length)
      this.redrawIndicator(this.lifeIndicators[index], true);
  }

  update(_time: number, delta: number) {
    if (this.done || this.tutorialActive) {
      this.tommy.setVelocityX(0);
      return;
    }

    let upcomingRed = false;
    const H = this.cameras.main.height;
    const tommyX = this.tommy.x;

    if (tommyX >= this.schoolX - 30) {
      this.done = true;
      this.tommy.setVelocityX(0);
      this.time.delayedCall(500, () => EventBus.emit('game-level-complete', this.level));
      return;
    }

    this.crossroads.forEach(cr => {
      const isInside = tommyX > cr.x - 90 && tommyX < cr.x + 90;
      if (isInside && cr.state === 'green') cr.isCrossing = true;
      if (!isInside) cr.isCrossing = false;

      if (!cr.isCrossing) {
        cr.timer += delta;
        const cycle = 3500 + this.level * 80;
        if (cr.timer > cycle) {
          cr.timer = 0;
          cr.state = cr.state === 'red' ? 'green' : 'red';
          if (cr.state === 'red') {
            cr.lightRed.setAlpha(1); cr.lightRedIcon?.setAlpha(1);
            cr.lightGreen.setAlpha(0.2); cr.lightGreenIcon?.setAlpha(0.2);
          } else {
            cr.lightRed.setAlpha(0.2); cr.lightRedIcon?.setAlpha(0.2);
            cr.lightGreen.setAlpha(1); cr.lightGreenIcon?.setAlpha(1);
          }
        }
      }

      // Spawn cars
      if (Math.abs(cr.x - tommyX) < 1200 && Math.random() < 0.012) {
        const isDown = Math.random() > 0.5;
        const model = CAR_MODELS[Phaser.Math.Between(0, CAR_MODELS.length - 1)];
        const colorIdx = Phaser.Math.Between(0, 4);
        const texKey = this.carTextureKeys[`${model}_${colorIdx}`] || 'car2_sedan_0';
        const car = this.carGroup.create(
          cr.x + (isDown ? -25 : 25),
          isDown ? -110 : H + 110,
          texKey
        ) as Phaser.Physics.Arcade.Image & { cr: any; dir: string };
        car.cr = cr;
        car.dir = isDown ? 'down' : 'up';
        car.setDepth(6); // above neighbourhood (1), roads (2-3), Tommy (5)
        car.setVelocityY(isDown ? 170 : -170);
        // DOWN-going cars rotate 180° so headlights face direction of travel
        if (isDown) car.setAngle(180);
        this.time.delayedCall(10000, () => { if (car.active) car.destroy(); });
      }

      if (isInside && cr.state === 'red') this.penalize();
      if (cr.x > tommyX && cr.x < tommyX + 450) upcomingRed = cr.state === 'red';

      if (!cr.passed && tommyX > cr.x + 100) {
        cr.passed = true;
        this.scored++;
        EventBus.emit('game-scored-update', `${this.scored}/${this.crossCount}`);
        EventBus.emit('show-crossing-praise');
      }
    });

    // Cars stop at stop lines
    this.carGroup.getChildren().forEach(child => {
      const c = child as Phaser.Physics.Arcade.Image & { cr: any; dir: string };
      const stopTop = H / 2 - 60, stopBot = H / 2 + 60;
      if (c.cr.state === 'green') {
        if (c.dir === 'down' && c.y > stopTop - 85 && c.y < stopTop) c.setVelocityY(0);
        if (c.dir === 'up'   && c.y < stopBot + 85 && c.y > stopBot) c.setVelocityY(0);
      } else {
        if (c.dir === 'down' && c.body?.velocity.y === 0) c.setVelocityY(170);
        if (c.dir === 'up'   && c.body?.velocity.y === 0) c.setVelocityY(-170);
      }
    });

    this.tommyPortrait.setTexture(upcomingRed ? 'portrait_gasp' : 'portrait_smile');
    const isStopping = this.input.activePointer.isDown;
    this.tommy.setVelocityX(isStopping ? 0 : getLevelCfg(this.level).speed);
  }
}
