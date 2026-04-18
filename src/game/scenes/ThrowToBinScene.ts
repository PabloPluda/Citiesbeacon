import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { useProgressStore } from '../../store/progressStore';
const MISSION_ID = 1;

const LEVELS = [
  { trashGoal:10, spawnRate:2400, time:180 }, // L1
  { trashGoal:11, spawnRate:2200, time:160 }, // L2
  { trashGoal:12, spawnRate:2000, time:160 }, // L3
  { trashGoal:13, spawnRate:1900, time:160 }, // L4
  { trashGoal:14, spawnRate:1800, time:160 }, // L5
  { trashGoal:14, spawnRate:1700, time:160 }, // L6
  { trashGoal:14, spawnRate:1600, time:160 }, // L7
  { trashGoal:14, spawnRate:1500, time:160 }, // L8
  { trashGoal:14, spawnRate:1400, time:160 }, // L9
  { trashGoal:14, spawnRate:1300, time:160 }, // L10
  { trashGoal:14, spawnRate:1200, time:160 }, // L11
  { trashGoal:14, spawnRate:1100, time:160 }, // L12
];

const TRASH_EMOJIS = ['🥤','🍌','🍾','🥫','📦','🗞️'];
const MAX_PULL  = 140;
const MAX_SPEED = 1500;
const GRAVITY   = 1000;

interface ThrownItem {
  container: Phaser.GameObjects.Container;
  vx: number; vy: number; rotDir: number; done: boolean;
}

export class ThrowToBinScene extends Phaser.Scene {
  level = 1; scored = 0; timeLeft = 40;
  done = false; tutorialActive = false;

  binCX   = 0; binRimY  = 0;
  binHalfW = 62; binBodyH = 130;
  binContainer: Phaser.GameObjects.Container | null = null;

  trashItems:  Phaser.GameObjects.Container[] = [];
  thrownItems: ThrownItem[] = [];
  selectedTrash: Phaser.GameObjects.Container | null = null;
  isDragging = false;
  dragOriginX = 0; dragOriginY = 0;

  slingshotGfx!: Phaser.GameObjects.Graphics;
  tommyPortrait!: Phaser.GameObjects.Container;
  spawnEvent!: Phaser.Time.TimerEvent;

  constructor() { super('ThrowToBinScene'); }

  init(data?: { level?: number }) {
    if (data?.level !== undefined) {
      this.level = data.level;
    } else {
      const reg = this.registry?.get('startLevel') as number | undefined;
      if (reg != null) { this.registry.remove('startLevel'); this.level = reg; }
      else { this.level = Math.min((useProgressStore.getState().highestLevel[MISSION_ID] ?? 0) + 1, 20); }
    }
    this.scored = 0; this.timeLeft = this.cfg.time;
    this.done = false; this.tutorialActive = false;
    this.isDragging = false; this.selectedTrash = null;
    this.trashItems = []; this.thrownItems = [];
    this.binContainer = null;
  }

  get cfg() { return LEVELS[Math.min(this.level - 1, LEVELS.length - 1)]; }

  preload() { this.load.image('back_trash', '/back_trash.jpg'); }

  create() {
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);
    EventBus.emit('game-scored-update', `0/${this.cfg.trashGoal}`);

    const handleRestart = (d: {level:number}) => { setTimeout(() => this.scene.restart(d), 0); };
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', handleRestart));

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Background
    if (this.textures.exists('back_trash')) {
      const bg = this.add.image(W/2, H/2, 'back_trash');
      bg.setScale(Math.max(W / bg.width, H / bg.height)).setDepth(-10);
    }
    this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.25).setDepth(-9);

    // Slingshot draw layer
    this.slingshotGfx = this.add.graphics().setDepth(20);

    // Build bin at TOP — 3% smaller per level
    const binScale = Math.pow(0.97, this.level - 1);
    this.buildBin(W, binScale);

    // Level 7+: bin moves side to side
    if (this.level >= 7 && this.binContainer) {
      const moveRange = Math.min(W * 0.20, 80);
      this.binContainer.x = W / 2 - moveRange;
      this.tweens.add({
        targets: this.binContainer, x: W / 2 + moveRange,
        duration: 5000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: 600
      });
    }


    // Timer
    this.time.addEvent({ delay:1000, loop:true, callback:() => {
      if (this.done || this.tutorialActive) return;
      this.timeLeft--;
      EventBus.emit('game-timer', this.timeLeft);
      if (this.timeLeft <= 0) { this.done = true; this.time.delayedCall(400, () => EventBus.emit('game-time-up', this.scored)); }
    }});

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup',   this.onUp,   this);

    if (this.level === 1) { this.tutorialActive = true; this.showTutorial(); }
    else { this.tutorialActive = true; this.showPreLevelMessage(); }
  }

  buildBin(W: number, scale = 1) {
    this.binCX    = W / 2;
    this.binRimY  = 100;
    this.binHalfW = Math.round(62 * scale);
    this.binBodyH = Math.round(130 * scale);

    // Draw relative to cx=0 (container handles world x)
    const cx = 0;
    const ry = this.binRimY;
    const hw = this.binHalfW;
    const bh = this.binBodyH;
    const bw = hw * 2;
    const s  = scale;

    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.15);
    g.fillEllipse(cx, ry + bh + 10*s, bw + 16*s, 16*s);

    g.fillStyle(0x16A34A);
    g.fillRoundedRect(cx - hw, ry + 10*s, bw, bh, { tl:4*s, tr:4*s, bl:14*s, br:14*s });

    g.fillStyle(0xFFFFFF, 0.1);
    g.fillRoundedRect(cx - hw + 8*s, ry + 18*s, 22*s, bh - 24*s, 6*s);

    g.lineStyle(1.5, 0x000000, 0.1);
    for (let rx = cx - hw + 32*s; rx < cx + hw - 10*s; rx += 26*s) {
      g.beginPath(); g.moveTo(rx, ry + 14*s); g.lineTo(rx, ry + bh - 6*s); g.strokePath();
    }

    g.fillStyle(0xFFFFFF, 0.88);
    g.fillCircle(cx, ry + bh * 0.52, 26*s);
    g.fillStyle(0x16A34A);
    for (let i = 0; i < 3; i++) {
      const a = (i * 120 * Math.PI) / 180 - Math.PI / 2;
      g.fillTriangle(
        cx + Math.cos(a)*18*s, ry + bh*0.52 + Math.sin(a)*18*s,
        cx + Math.cos(a+0.9)*10*s, ry + bh*0.52 + Math.sin(a+0.9)*10*s,
        cx + Math.cos(a-0.9)*10*s, ry + bh*0.52 + Math.sin(a-0.9)*10*s
      );
    }

    g.fillStyle(0x22C55E);
    g.fillEllipse(cx, ry + 8*s, bw + 10*s, 30*s);
    g.fillStyle(0x16A34A);
    g.fillEllipse(cx, ry + 6*s, bw, 19*s);
    g.fillStyle(0x052E16);
    g.fillEllipse(cx, ry + 4*s, bw - 20*s, 12*s);

    g.fillStyle(0x15803D);
    g.fillRoundedRect(cx - 22*s, ry - 14*s, 44*s, 18*s, 7*s);
    g.fillStyle(0x22C55E);
    g.fillRoundedRect(cx - 18*s, ry - 11*s, 36*s, 11*s, 5*s);

    g.fillStyle(0xFFFFFF, 0.35);
    g.fillTriangle(cx, ry + 38*s, cx - 10*s, ry + 25*s, cx + 10*s, ry + 25*s);

    this.binContainer = this.add.container(W / 2, 0, [g]);
    this.binContainer.setDepth(10);
  }

  makePortrait(mood: number): Phaser.GameObjects.Container {
    const g = this.make.graphics({x:0,y:0} as any);
    g.fillStyle(0xFFFFFF, 0.95); g.fillCircle(26,26,26);
    g.lineStyle(3,0x374151); g.strokeCircle(26,26,26);
    g.fillStyle(0xFCD34D); g.fillCircle(26,20,16);
    g.fillStyle(0x000000); g.fillCircle(20,17,2.5); g.fillCircle(32,17,2.5);
    g.lineStyle(2.5, 0x000000);
    if (mood===0) { g.beginPath(); g.arc(26,22,6,0.2,Math.PI-0.2,false); g.strokePath(); }
    else if (mood===1) { g.fillStyle(0xFF3333); g.fillEllipse(26,24,10,9); }
    else { g.beginPath(); g.arc(26,28,6,Math.PI+0.2,2*Math.PI-0.2,false); g.strokePath(); }
    const key = `port_${mood}_${Date.now()}`;
    g.generateTexture(key,52,52); g.destroy();
    return this.add.container(0,0,[this.add.image(0,0,key).setOrigin(0.5)]);
  }

  setMood(mood: number) {
    if (!this.tommyPortrait?.active) return;
    const g = this.make.graphics({x:0,y:0} as any);
    g.fillStyle(0xFFFFFF,0.95); g.fillCircle(26,26,26);
    g.lineStyle(3,0x374151); g.strokeCircle(26,26,26);
    g.fillStyle(0xFCD34D); g.fillCircle(26,20,16);
    g.fillStyle(0x000000); g.fillCircle(20,17,2.5); g.fillCircle(32,17,2.5);
    g.lineStyle(2.5, 0x000000);
    if (mood===0) { g.beginPath(); g.arc(26,22,6,0.2,Math.PI-0.2,false); g.strokePath(); }
    else if (mood===1) { g.fillStyle(0xFF3333); g.fillEllipse(26,24,10,9); }
    else { g.beginPath(); g.arc(26,28,6,Math.PI+0.2,2*Math.PI-0.2,false); g.strokePath(); }
    const key = `pm_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    g.generateTexture(key,52,52); g.destroy();
    this.tommyPortrait.removeAll(true);
    this.tommyPortrait.add(this.add.image(0,0,key).setOrigin(0.5));
  }

  startSpawning() {
    for (let i = 0; i < 3; i++) this.spawnTrash();
    this.spawnEvent = this.time.addEvent({ delay: this.cfg.spawnRate, loop:true, callback: this.ensureMinTrash, callbackScope: this });
  }

  spawnTrash() {
    if (this.done) return;
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;
    const emoji = Phaser.Utils.Array.GetRandom(TRASH_EMOJIS);
    const emojiGO = this.add.text(0, 0, emoji, { fontSize: '54px' }).setOrigin(0.5);
    const shadow  = this.add.ellipse(0, 32, 54, 14, 0x000000, 0.2);

    const x = Phaser.Math.Between(65, W - 65);
    const y = Phaser.Math.Between(Math.floor(H * 0.52), Math.floor(H * 0.82));

    const c = this.add.container(x, y, [shadow, emojiGO]);
    c.setSize(64, 64).setInteractive().setDepth(8);
    c.setData('ox', x); c.setData('oy', y);

    this.tweens.add({ targets: c, y: y - 14, duration: 900 + Phaser.Math.Between(0,300), yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
    this.tweens.add({ targets: shadow, scaleX:0.7, alpha:0.12, duration:900, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });

    this.trashItems.push(c);
  }

  ensureMinTrash() {
    if (this.done || this.tutorialActive) return;
    if (this.trashItems.filter(t => t.active).length < 3) this.spawnTrash();
  }

  onDown(pointer: Phaser.Input.Pointer) {
    if (this.done || this.tutorialActive) return;
    let best: Phaser.GameObjects.Container | null = null;
    let bestD = 85;
    for (const item of this.trashItems) {
      if (!item.active) continue;
      const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, item.x, item.y);
      if (d < bestD) { bestD = d; best = item; }
    }
    if (best) {
      this.selectedTrash = best;
      this.isDragging = true;
      this.dragOriginX = best.x;
      this.dragOriginY = best.y;
      this.tweens.killTweensOf(best);
      best.setDepth(22);
      this.tweens.add({ targets: best, scaleX:1.1, scaleY:1.1, duration:80 });
    }
  }

  onMove(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging || !this.selectedTrash) return;

    const ox = this.dragOriginX, oy = this.dragOriginY;
    const rawDx = pointer.x - ox, rawDy = pointer.y - oy;
    const rawDist = Math.sqrt(rawDx*rawDx + rawDy*rawDy) || 1;
    const clampD  = Math.min(rawDist, MAX_PULL);
    const nx = rawDx / rawDist, ny = rawDy / rawDist;

    // Clamp item to max pull radius
    this.selectedTrash.x = ox + nx * clampD;
    this.selectedTrash.y = oy + ny * clampD;

    const power = clampD / MAX_PULL;

    this.slingshotGfx.clear();

    // Fork points (perpendicular to pull)
    const px = -ny, py = nx;
    const fd = 20;
    const f1x = ox + px*fd, f1y = oy + py*fd;
    const f2x = ox - px*fd, f2y = oy - py*fd;
    const cx  = ox + nx*clampD, cy = oy + ny*clampD;

    // Rubber bands
    this.slingshotGfx.lineStyle(5, 0xFFAA00, 0.9);
    this.slingshotGfx.beginPath(); this.slingshotGfx.moveTo(f1x,f1y); this.slingshotGfx.lineTo(cx,cy); this.slingshotGfx.strokePath();
    this.slingshotGfx.beginPath(); this.slingshotGfx.moveTo(f2x,f2y); this.slingshotGfx.lineTo(cx,cy); this.slingshotGfx.strokePath();
    this.slingshotGfx.fillStyle(0xFFAA00); this.slingshotGfx.fillCircle(f1x,f1y,7); this.slingshotGfx.fillCircle(f2x,f2y,7);

    // Trajectory prediction
    const lvx = -nx * power * MAX_SPEED, lvy = -ny * power * MAX_SPEED;
    let sx=ox, sy=oy, svx=lvx, svy=lvy;
    const dt = 0.06;
    for (let s=1; s<=10; s++) {
      svy += GRAVITY*dt; sx += svx*dt; sy += svy*dt;
      this.slingshotGfx.fillStyle(0xFFFFFF, Math.max(0,0.8-s*0.07));
      this.slingshotGfx.fillCircle(sx, sy, Math.max(2, 5.5-s*0.35));
    }

    // Power bar (right of origin)
    const bx = ox + 55, barH = 100, by = oy;
    this.slingshotGfx.fillStyle(0x333333, 0.8);
    this.slingshotGfx.fillRoundedRect(bx-9, by-barH/2, 18, barH, 9);
    const fillH = power * barH;
    const fillCol = power < 0.4 ? 0x22C55E : power < 0.75 ? 0xFFBB00 : 0xFF4444;
    this.slingshotGfx.fillStyle(fillCol, 0.95);
    this.slingshotGfx.fillRoundedRect(bx-7, by+barH/2-fillH, 14, fillH, 7);
  }

  onUp(pointer: Phaser.Input.Pointer) {
    this.slingshotGfx.clear();
    if (!this.isDragging || !this.selectedTrash) return;
    this.isDragging = false;
    const trash = this.selectedTrash;
    this.selectedTrash = null;

    const ox = this.dragOriginX, oy = this.dragOriginY;
    const dx = pointer.x - ox, dy = pointer.y - oy;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    // Too weak = snap back
    if (dist < 18) {
      this.tweens.add({ targets: trash, x:ox, y:oy, scaleX:1, scaleY:1, duration:200, ease:'Back.easeOut',
        onComplete: () => this.tweens.add({ targets:trash, y:oy-14, duration:900, yoyo:true, repeat:-1, ease:'Sine.easeInOut' })
      });
      return;
    }

    const power = Math.min(dist / MAX_PULL, 1.0);
    const nx = dx/dist, ny = dy/dist;
    // Launch opposite of pull
    const vx = -nx * power * MAX_SPEED;
    const vy = -ny * power * MAX_SPEED;
    const rotDir = dx > 0 ? 1 : -1;

    this.trashItems = this.trashItems.filter(t => t !== trash);
    trash.setDepth(22);

    this.thrownItems.push({ container: trash, vx, vy, rotDir, done: false });
  }

  onScored(trash: Phaser.GameObjects.Container) {
    this.scored++;
    EventBus.emit('game-scored-update', `${this.scored}/${this.cfg.trashGoal}`);
    this.tweens.add({ targets:trash, scaleX:0, scaleY:0, alpha:0, y:this.binRimY+40, duration:200, ease:'Quad.easeIn', onComplete:()=>trash.destroy() });
    this.showGreat(trash.x, trash.y - 20);
    this.ensureMinTrash();
    if (this.scored >= this.cfg.trashGoal) {
      this.done = true;
      this.time.delayedCall(600, () => EventBus.emit('game-level-complete', this.level));
    }
  }

  onMissed(trash: Phaser.GameObjects.Container) {
    this.tweens.add({ targets:trash, y:trash.y+200, alpha:0, duration:350, ease:'Quad.easeIn', onComplete:()=>trash.destroy() });
    const t = this.add.text(trash.x, trash.y-10, 'Miss!', { fontFamily:'Fredoka One, sans-serif', fontSize:'24px', color:'#FF6B6B', stroke:'#000', strokeThickness:4 }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets:t, y:t.y-60, alpha:0, duration:800, ease:'Quad.easeOut', onComplete:()=>t.destroy() });
    this.ensureMinTrash();
  }

  showGreat(x: number, y: number) {
    const words = ['Great!','Nice!','Perfect!','Awesome!'];
    const t = this.add.text(x, y, Phaser.Utils.Array.GetRandom(words), {
      fontFamily:'Fredoka One, sans-serif', fontSize:'32px', color:'#22C55E', stroke:'#000', strokeThickness:5
    }).setOrigin(0.5).setDepth(26).setScale(0.3);
    this.tweens.add({ targets:t, scale:1.1, duration:180, ease:'Back.easeOut', onComplete:() =>
      this.tweens.add({ targets:t, y:y-70, alpha:0, duration:700, onComplete:()=>t.destroy() })
    });
  }

  showTutorial() {
    const W = this.cameras.main.width, H = this.cameras.main.height;

    // Soft dark overlay (behind animation)
    const ov = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.60).setDepth(40);

    // Demo positions
    const originX = W / 2;
    const originY = H * 0.62;
    const pullX = originX;
    const pullY = originY + 90;
    const targetBinX = W / 2;
    const targetBinY = this.binRimY + 48;

    const demoTrash = this.add.text(originX, originY, '🥤', { fontSize: '52px' })
      .setOrigin(0.5).setDepth(42);
    const bandGfx = this.add.graphics().setDepth(41);
    const fingerGfx = this.add.graphics().setDepth(43);

    const drawFinger = (x: number, y: number, alpha: number) => {
      if (!fingerGfx.active) return;
      fingerGfx.clear();
      if (alpha <= 0) return;
      fingerGfx.fillStyle(0xFFFFFF, alpha * 0.92);
      fingerGfx.fillCircle(x, y, 22);
      fingerGfx.lineStyle(3, 0x222222, alpha);
      fingerGfx.strokeCircle(x, y, 22);
      fingerGfx.fillStyle(0x444444, alpha * 0.35);
      fingerGfx.fillCircle(x, y, 9);
    };

    const drawBands = (cx: number, cy: number) => {
      if (!bandGfx.active) return;
      bandGfx.clear();
      const fd = 18;
      bandGfx.lineStyle(4.5, 0xFFAA00, 0.92);
      bandGfx.beginPath(); bandGfx.moveTo(originX - fd, originY); bandGfx.lineTo(cx, cy); bandGfx.strokePath();
      bandGfx.beginPath(); bandGfx.moveTo(originX + fd, originY); bandGfx.lineTo(cx, cy); bandGfx.strokePath();
      bandGfx.fillStyle(0xFFAA00, 1);
      bandGfx.fillCircle(originX - fd, originY, 7);
      bandGfx.fillCircle(originX + fd, originY, 7);
    };

    let animating = true;

    const runAnim = () => {
      if (!animating) return;
      demoTrash.setPosition(originX, originY).setAlpha(1).setScale(1).setAngle(0);
      bandGfx.clear(); fingerGfx.clear();

      // Phase 1: finger appears
      const p1 = { a: 0 };
      this.tweens.add({
        targets: p1, a: 1, duration: 450, ease: 'Sine.easeOut',
        onUpdate: () => drawFinger(originX, originY, p1.a),
        onComplete: () => {
          if (!animating) return;
          // Phase 2: pull straight DOWN
          const p2 = { x: originX, y: originY };
          this.tweens.add({
            targets: p2, x: pullX, y: pullY,
            duration: 900, ease: 'Sine.easeInOut',
            onUpdate: () => {
              if (!animating) return;
              demoTrash.setPosition(p2.x, p2.y);
              drawFinger(p2.x, p2.y, 1);
              drawBands(p2.x, p2.y);
            },
            onComplete: () => {
              if (!animating) return;
              this.time.delayedCall(300, () => {
                if (!animating) return;
                // Phase 3: finger lifts
                const p3 = { a: 1 };
                this.tweens.add({
                  targets: p3, a: 0, duration: 180,
                  onUpdate: () => drawFinger(pullX, pullY, p3.a),
                  onComplete: () => {
                    if (!animating) return;
                    bandGfx.clear(); fingerGfx.clear();
                    // Phase 4: SINGLE smooth flight to bin
                    this.tweens.add({
                      targets: demoTrash,
                      x: targetBinX, y: targetBinY,
                      duration: 1000, ease: 'Quad.easeIn',
                      onUpdate: () => { demoTrash.angle += 4; },
                      onComplete: () => {
                        if (!animating) return;
                        this.tweens.add({
                          targets: demoTrash, scaleX: 0, scaleY: 0, alpha: 0,
                          duration: 200, ease: 'Quad.easeIn',
                          onComplete: () => {
                            if (!animating) return;
                            this.time.delayedCall(900, runAnim);
                          }
                        });
                      }
                    });
                  }
                });
              });
            }
          });
        }
      });
    };

    this.time.delayedCall(500, runAnim);

    // Emit event so React can show the HTML overlay (crisp text, native emoji)
    EventBus.emit('show-tutorial');

    const onDone = () => {
      animating = false;
      [ov, demoTrash, bandGfx, fingerGfx].forEach(o => { if (o && o.active) { this.tweens.killTweensOf(o); o.destroy(); } });
      this.tutorialActive = false;
      this.startSpawning();
    };
    EventBus.once('tutorial-done', onDone);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('tutorial-done', onDone));
  }

  showPreLevelMessage() {
    // Emit to React — HTML overlay handles UI so text is crisp (no Phaser canvas pixelation)
    EventBus.emit('show-pre-level');
    const onDone = () => {
      this.tutorialActive = false;
      this.startSpawning();
    };
    EventBus.once('pre-level-done', onDone);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('pre-level-done', onDone));
  }

  update(_time: number, delta: number) {
    if (this.binContainer) this.binCX = this.binContainer.x;
    const dt = delta / 1000;
    const H  = this.cameras.main.height;

    for (let i = this.thrownItems.length - 1; i >= 0; i--) {
      const ti = this.thrownItems[i];
      if (ti.done) { this.thrownItems.splice(i,1); continue; }

      // Physics step
      ti.vy += GRAVITY * dt;
      ti.container.x += ti.vx * dt;
      ti.container.y += ti.vy * dt;
      ti.container.angle += ti.rotDir * 4;

      // Hit detection: must be DESCENDING (vy>0) and inside bin mouth
      if (ti.vy > 0) {
        const dx = Math.abs(ti.container.x - this.binCX);
        const dy = ti.container.y - this.binRimY;
        if (dx < this.binHalfW - 4 && dy >= -8 && dy < 65) {
          ti.done = true;
          this.onScored(ti.container);
          this.thrownItems.splice(i,1);
          continue;
        }
      }

      // Out of screen = missed
      if (ti.container.y > H + 120 || ti.container.x < -150 || ti.container.x > this.cameras.main.width + 150) {
        ti.done = true;
        this.onMissed(ti.container);
        this.thrownItems.splice(i,1);
      }
    }
  }
}
