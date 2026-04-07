import Phaser from 'phaser';
import { EventBus } from '../EventBus';

// ΓöÇΓöÇΓöÇ Level config table ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// movement: 'static' | 'jump' (reposition after each throw) | 'continuous' (moving)
const LEVELS = Array.from({ length: 20 }, (_, i) => {
  const lvl = i + 1;
  let scale = 1.0;
  let movement = 'static';
  let speed = 0;

  if (lvl <= 5) {
    // 1-5: scale drops 5% each level, static
    scale = 1.0 - ((lvl - 1) * 0.05); // 1.0 down to 0.8
    movement = 'static';
  } 
  else if (lvl <= 10) {
    // 6-10: scale stays at lvl 5 (0.8), movement smooth
    scale = 0.8;
    movement = 'continuous';
    speed = 30 + ((lvl - 6) * 10); // 30 to 70 speed
  }
  else if (lvl <= 15) {
    // 11-15: scale drops another 5% each level, speed stays at 70
    scale = 0.8 - ((lvl - 10) * 0.05); // 0.75 down to 0.55
    movement = 'continuous';
    speed = 70;
  }
  else {
    // 16-20: scale stays at 0.55, speed increases slightly
    scale = 0.55;
    movement = 'continuous';
    speed = 70 + ((lvl - 15) * 12); // 82 to 130
  }

  return { scale, movement, speed };
});

const SCORE_MSGS = [
  ["Nice shot! ≡ƒÄ»", "Right in! ≡ƒÆ¬", "Great throw! Γ¡É", "Bullseye! ≡ƒÄ»", "Awesome! ≡ƒîƒ"],
  ["Combo x2! ≡ƒöÑ", "Keep it up! ≡ƒöÑ", "Double! ≡ƒÆÑ"],
  ["INCREDIBLE! ≡ƒîƒ", "You're on fire! ≡ƒÜÇ", "UNSTOPPABLE! ΓÜí", "LEGEND! ≡ƒææ"],
];
const MISS_MSGS = ["Almost! ≡ƒÿà", "Try again! ≡ƒæè", "You got this! ≡ƒÆ¬", "So close! ≡ƒÿ¼", "Next one! ≡ƒÄ»"];
const TRASH_TEXTURES = ['t_paper', 't_can', 't_box', 't_cup', 't_apple'];

// ΓöÇΓöÇΓöÇ Scene ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export class ThrowToBinScene extends Phaser.Scene {
  private bin!: Phaser.Physics.Arcade.Image;
  private trashGroup!: Phaser.Physics.Arcade.Group;
  private selectedTrash: Phaser.Physics.Arcade.Image | null = null;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private powerUI!: Phaser.GameObjects.Graphics;
  private aimUI!: Phaser.GameObjects.Graphics;
  private slingshotUI!: Phaser.GameObjects.Graphics;
  private tommy!: Phaser.GameObjects.Image;
  private inFlight = false;

  private level = 1;
  private scored = 0;
  private streak = 0;
  private timeLeft = 30;
  private timerEvent!: Phaser.Time.TimerEvent;
  private done = false;
  private tutorialActive = false;

  constructor() {
    super({ key: 'ThrowToBinScene' });
  }

  init(data: { level?: number }) {
    this.level = Math.max(1, Math.min(20, data?.level ?? 1));
    this.scored = 0;
    this.streak = 0;
    this.timeLeft = 35;
    this.isDragging = false;
    this.inFlight = false;
    this.done = false;
    this.tutorialActive = false;
    this.selectedTrash = null;
  }

  // ΓöÇΓöÇ Preload: generate textures programmatically ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  preload() {
    const g = this.make.graphics({ x: 0, y: 0 });

    // Paper ball
    g.fillStyle(0xF5F5F5); g.lineStyle(2, 0xBBBBBB);
    g.fillCircle(22, 22, 22); g.strokeCircle(22, 22, 22);
    g.generateTexture('t_paper', 44, 44); g.clear();

    // Can
    g.fillStyle(0x60A5FA); g.fillRoundedRect(0, 4, 32, 40, 6);
    g.fillStyle(0x93C5FD); g.fillRoundedRect(2, 4, 28, 12, 4);
    g.generateTexture('t_can', 32, 44); g.clear();

    // Box
    g.fillStyle(0xD97706); g.fillRoundedRect(0, 0, 40, 36, 4);
    g.fillStyle(0xFCD34D); g.fillRect(0, 16, 40, 3); g.fillRect(18, 0, 4, 36);
    g.generateTexture('t_box', 40, 36); g.clear();

    // Cup (red trapezoid approximated with rects)
    g.fillStyle(0xEF4444);
    g.fillRect(6, 0, 28, 6);   // rim
    g.fillRect(8, 6, 24, 38);  // body
    g.generateTexture('t_cup', 40, 44); g.clear();


    // Apple core
    g.fillStyle(0x86EFAC); g.fillCircle(20, 22, 18);
    g.fillStyle(0x22C55E); g.fillCircle(14, 14, 8);
    g.generateTexture('t_apple', 40, 44); g.clear();

    // Bin ΓÇö blue body + dark rim
    g.fillStyle(0x3B82F6); g.fillRoundedRect(5, 20, 100, 120, 10);
    g.fillStyle(0x1D4ED8); g.fillRoundedRect(0, 8, 110, 22, 8);
    g.fillStyle(0x60A5FA); g.fillRoundedRect(12, 26, 86, 8, 4);
    g.generateTexture('bin', 110, 142); g.clear();

    // Tommy Neutral
    g.fillStyle(0xFFDAB9); g.fillCircle(30, 30, 25);
    g.fillStyle(0x000000); g.fillCircle(20, 25, 3); g.fillCircle(40, 25, 3);
    g.lineStyle(3, 0x000000); g.beginPath(); g.moveTo(22, 40); g.lineTo(38, 40); g.strokePath();
    g.generateTexture('tommy_neutral', 60, 60); g.clear();

    // Tommy Smile
    g.fillStyle(0xFFDAB9); g.fillCircle(30, 30, 25);
    g.fillStyle(0x000000); g.fillCircle(20, 25, 3); g.fillCircle(40, 25, 3);
    g.lineStyle(3, 0x000000); g.beginPath(); g.arc(30, 35, 10, 0, Math.PI, false); g.strokePath();
    g.generateTexture('tommy_smile', 60, 60); g.clear();

    // Tommy Expectant (Astounded, no enojado!)
    g.fillStyle(0xFFDAB9); g.fillCircle(30, 30, 25);
    // Sin cejas para no parecer enojado
    g.fillStyle(0x000000); g.fillCircle(20, 25, 5); g.fillCircle(40, 25, 5);
    // "O" mouth grande (Sorpresa positiva)
    g.beginPath(); g.arc(30, 40, 7, 0, Math.PI * 2, false); g.strokePath();
    g.generateTexture('tommy_tense', 60, 60); g.clear();

    g.destroy();
  }

  // ΓöÇΓöÇ Create ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  create() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Sky
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Park (Grass horizon)
    this.add.rectangle(W / 2, H * 0.25, W, H * 0.3, 0x4ADE80);
    
    // Sidewalk (Grey pavement for trash)
    this.add.rectangle(W / 2, H * 0.70, W, H * 0.6, 0xCBD5E1);
    this.add.rectangle(W / 2, H * 0.40, W, 8, 0x94A3B8); // Curb line

    // Tommy Graphic - Movido m├ís abajo a la izquierda para no tapar ni el boton Back de React ni el nivel
    this.tommy = this.add.image(60, 140, 'tommy_neutral').setDepth(20);
    
    // UI layers
    this.slingshotUI = this.add.graphics().setDepth(4);
    this.aimUI = this.add.graphics().setDepth(5);
    this.powerUI = this.add.graphics().setDepth(5);

    // Bin
    this.spawnBin();

    // Trash group
    this.trashGroup = this.physics.add.group();
    for (let i = 0; i < Phaser.Math.Between(5, 6); i++) {
      this.spawnOneTrash();
    }

    // Input
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    if (this.level === 1) {
      this.tutorialActive = true;
      this.time.delayedCall(500, () => this.showTutorial());
    }

    // 35-second countdown - use loop instead of repeat so we can freely add time
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.onTick,
      callbackScope: this,
      loop: true,
    });

    // Tell React the scene + initial state
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', 35);
    EventBus.emit('game-scored-update', 0);

    // React can restart this scene via EventBus
    const handleRestart = (data: { level: number }) => {
      // Use setTimeout to decouple the restart from the React synchronous render loop that fired it
      setTimeout(() => {
        this.scene.restart(data);
      }, 0);
    };

    EventBus.on('restart-scene', handleRestart);

    // Clean up our event bus listeners when this scene shuts down or restarts
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off('restart-scene', handleRestart);
    });
  }

  // ΓöÇΓöÇ Bin helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  spawnBin() {
    if (this.bin) this.bin.destroy();
    const W = this.cameras.main.width;
    const cfg = LEVELS[this.level - 1];

    const x = Phaser.Math.Between(70, W - 70);
    const y = this.cameras.main.height * 0.22;

    this.bin = this.physics.add.image(x, y, 'bin')
      .setScale(cfg.scale)
      .setImmovable(true);
    (this.bin.body as Phaser.Physics.Arcade.Body).allowGravity = false;

    if (cfg.movement === 'continuous') {
      const dir = Math.random() > 0.5 ? 1 : -1;
      this.bin.setVelocity(cfg.speed * dir, 0)
        .setCollideWorldBounds(true)
        .setBounce(1, 0);
    }
  }

  jumpBin() {
    const W = this.cameras.main.width;
    const cfg = LEVELS[this.level - 1];
    const newX = Phaser.Math.Between(70, W - 70);
    this.tweens.add({
      targets: this.bin,
      x: newX,
      scaleX: cfg.scale * 1.15,
      scaleY: cfg.scale * 1.15,
      duration: 220,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.bin?.body) {
          this.bin.setScale(cfg.scale);
          (this.bin.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
        }
      },
    });
  }

  // ΓöÇΓöÇ Trash helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  spawnOneTrash(retries = 0): Phaser.Physics.Arcade.Image | undefined {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Require enough space below the trash so user can drag their finger backwards
    // (max drag is 150px, so leave at least that much space from the bottom)
    let zoneTop  = H * 0.40;
    let zoneBot  = H - 160;
    
    // Nivel 15-20: Basura aparece mucho mas abajo para forzar al jugador a disparar con m├ís potencia
    // Pero siempre dejando los 150px de margen inferior para arrastrar la resortera holgadamente.
    if (this.level >= 15) {
      zoneTop = H * 0.65;
    }

    const x = Phaser.Math.Between(40, W - 40);
    const y = Phaser.Math.Between(zoneTop, zoneBot);

    // Avoid overlapping existing items
    const existing = this.trashGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    if (retries < 8 && existing.some(t => t.active && Phaser.Math.Distance.Between(t.x, t.y, x, y) < 60)) {
      return this.spawnOneTrash(retries + 1);
    }

    const tex = Phaser.Utils.Array.GetRandom(TRASH_TEXTURES);

    // Use group.create() so physics body is managed by the group
    const trash = this.trashGroup.create(x, y, tex) as Phaser.Physics.Arcade.Image;
    trash.setInteractive();
    trash.setData('inFlight', false);

    const body = trash.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.setVelocity(0, 0);

    // Entrance pop animation (starts visible, just scales in)
    trash.setAlpha(1).setScale(0);
    this.tweens.add({
      targets: trash,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    return trash;
  }


  showTutorial() {
    const trashItems = this.trashGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    if (trashItems.length === 0) return;
    
    // Elige la basura mas cercana al centro para el tutorial
    const trash = trashItems.sort((a,b) => Math.abs(a.x - this.cameras.main.centerX) - Math.abs(b.x - this.cameras.main.centerX))[0];
    
    const startX = trash.x;
    const startY = trash.y;

    const uiGroup = this.add.group();
    const g = this.add.graphics().setDepth(30);
    const text = this.add.text(startX, startY - 50, "Drag & Release! ≡ƒæå", { fontFamily: 'Fredoka One', fontSize: '28px', color: '#FFF', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(30);
    
    // Virtual "Finger"
    const finger = this.add.circle(startX, startY, 22, 0xFFFFFF, 0.85).setDepth(31);
    finger.setStrokeStyle(3, 0x000000, 0.6);

    const btnBG = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.height - 100, 200, 60, 0x22C55E, 1).setInteractive().setDepth(31).setStrokeStyle(4, 0xFFFFFF);
    const btnTXT = this.add.text(this.cameras.main.centerX, this.cameras.main.height - 100, "Got It!", { fontFamily: 'Fredoka One', fontSize: '28px', color: '#FFF' }).setOrigin(0.5).setDepth(31);

    uiGroup.addMultiple([g, text, finger, btnBG, btnTXT]);

    // Animate Drag -> Hold -> Snap back
    const dragTween = this.tweens.add({
      targets: finger,
      y: startY + 120, // arrastra hacia abajo
      duration: 1000,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
         g.clear();
         g.lineStyle(6, 0xFFFFFF, 0.6);
         g.beginPath();
         g.moveTo(startX, startY);
         g.lineTo(finger.x, finger.y);
         g.strokePath();
      },
      onComplete: () => {
         g.clear(); // suelta
         finger.setAlpha(0);
         this.time.delayedCall(600, () => {
             if (!finger.active) return;
             finger.setAlpha(0.85);
             finger.y = startY;
         });
      },
      repeatDelay: 600,
      repeat: -1
    });

    // Remove text and animation on interaction
    btnBG.once('pointerdown', () => {
       dragTween.remove();
       uiGroup.destroy(true);
       this.tutorialActive = false;
    });
  }

  ensureMinTrash() {
    const grounded = (this.trashGroup.getChildren() as Phaser.Physics.Arcade.Image[])
      .filter(t => t.active && !t.getData('inFlight')).length;
    // Always keep around 5 options visible to throw
    if (grounded < 5) {
      this.time.delayedCall(350, () => this.spawnOneTrash());
    }
  }

  setTommyEmotion(emotion: 'neutral'|'smile'|'tense') {
    if (this.tommy) this.tommy.setTexture('tommy_' + emotion);
  }

  // ΓöÇΓöÇ Callbacks ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  handleScore(trashObj: any, binObj: any) {
    if (this.done) return;
    trashObj.setData('inFlight', false);
    trashObj.destroy();
    this.inFlight = false;
    this.scored++;
    this.streak++;

    // Add +2 seconds
    this.timeLeft += 2;
    EventBus.emit('game-timer', this.timeLeft);
    const timeUI = this.add.text(this.cameras.main.centerX + 50, 45, '+2s', {
      fontFamily: 'Fredoka One', fontSize: '24px', color: '#4ADE80', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: timeUI, y: 15, alpha: 0, duration: 800, onComplete: () => timeUI.destroy() });

    // Tommy Reaction
    this.setTommyEmotion('smile');
    this.tweens.add({ targets: this.tommy, y: 35, yoyo: true, duration: 150, repeat: 1 });
    this.time.delayedCall(1500, () => {
      if (!this.isDragging) this.setTommyEmotion('neutral');
    });

    // Pick personality message
    const tier = this.streak >= 3 ? 2 : this.streak >= 2 ? 1 : 0;
    this.showMsg(Phaser.Utils.Array.GetRandom(SCORE_MSGS[tier]), binObj.x, binObj.y - 50, '#FFD700');

    // Confetti burst
    const prt = this.add.particles(binObj.x, binObj.y, 't_paper', {
      speed: { min: 80, max: 160 },
      scale: { start: 0.6, end: 0 },
      lifespan: 700,
      quantity: 10,
      blendMode: 'ADD',
    });
    this.time.delayedCall(800, () => prt.destroy());

    if (LEVELS[this.level - 1].movement === 'jump') this.jumpBin();

    EventBus.emit('game-scored-update', this.scored);

    if (this.scored >= 7) {
      this.done = true;
      this.timerEvent.remove();
      this.showMsg('LEVEL CLEAR! ≡ƒÄë', this.cameras.main.centerX, this.cameras.main.centerY - 60, '#22C55E');
      this.time.delayedCall(900, () => EventBus.emit('game-level-complete', this.level));
      return;
    }
    this.ensureMinTrash();
  }

  // ΓöÇΓöÇ Timer ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  onTick() {
    if (this.done || this.tutorialActive) return;
    this.timeLeft--;
    EventBus.emit('game-timer', this.timeLeft);

    if (this.timeLeft === 5) this.showMsg('HURRY UP! ΓÅ░', this.cameras.main.centerX, 160, '#FF4444');
    if (this.timeLeft <= 0) {
      this.done = true;
      this.timerEvent.remove();
      EventBus.emit('game-time-up', this.scored);
    }
  }

  // ΓöÇΓöÇ Input ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.inFlight || this.done || this.tutorialActive) return;
    const all = this.trashGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    const grounded = all.filter(t => !t.getData('inFlight'));

    let closest: Phaser.Physics.Arcade.Image | null = null;
    let minD = 110;
    for (const t of grounded) {
      const d = Phaser.Math.Distance.Between(pointer.x, pointer.y, t.x, t.y);
      if (d < minD) { minD = d; closest = t; }
    }
    if (!closest) return;

    this.selectedTrash = closest;
    this.isDragging = true;
    this.setTommyEmotion('tense'); // Tommy gets tense while aiming
    
    this.dragStartX = closest.x; // Set anchor at object position
    this.dragStartY = closest.y;
    this.tweens.add({ targets: closest, scaleX: 1.25, scaleY: 1.25, duration: 100 });
  }

  onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging || !this.selectedTrash) return;
    
    const dx = pointer.x - this.dragStartX;
    const dy = pointer.y - this.dragStartY;
    const pull = Math.min(150, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    
    // Position trash dragged by pointer
    const px = this.dragStartX + Math.cos(angle) * pull;
    const py = this.dragStartY + Math.sin(angle) * pull;
    this.selectedTrash.setPosition(px, py);

    // Launch vector is opposite of pull
    const launchDx = this.dragStartX - px;
    const launchDy = this.dragStartY - py;

    const pct = pull / 150;

    // Draw slingshot
    this.slingshotUI.clear();
    // Fork frame
    this.slingshotUI.lineStyle(10, 0x8B4513, 1);
    this.slingshotUI.beginPath();
    this.slingshotUI.moveTo(this.dragStartX, this.dragStartY + 40);
    this.slingshotUI.lineTo(this.dragStartX, this.dragStartY + 10);
    this.slingshotUI.strokePath();
    this.slingshotUI.beginPath();
    this.slingshotUI.moveTo(this.dragStartX, this.dragStartY + 10);
    this.slingshotUI.lineTo(this.dragStartX - 25, this.dragStartY - 10);
    this.slingshotUI.strokePath();
    this.slingshotUI.beginPath();
    this.slingshotUI.moveTo(this.dragStartX, this.dragStartY + 10);
    this.slingshotUI.lineTo(this.dragStartX + 25, this.dragStartY - 10);
    this.slingshotUI.strokePath();

    // Elastic bands
    this.slingshotUI.lineStyle(6, 0x111111, 1);
    this.slingshotUI.beginPath();
    this.slingshotUI.moveTo(this.dragStartX - 25, this.dragStartY - 10);
    this.slingshotUI.lineTo(px, py);
    this.slingshotUI.lineTo(this.dragStartX + 25, this.dragStartY - 10);
    this.slingshotUI.strokePath();

    // Aim arc (dotted)
    this.aimUI.clear();
    this.aimUI.lineStyle(2, 0xFFFFFF, 0.55);
    for (let i = 1; i <= 9; i += 2) {
      const t = i / 10;
      const ax = px + launchDx * 5.0 * t;
      const ay = py + launchDy * 7.5 * t + 100 * t * t;
      this.aimUI.fillStyle(0xFFFFFF, 0.55 - t * 0.4);
      this.aimUI.fillCircle(ax, ay, 4);
    }

    // Power bar
    this.powerUI.clear();
    const bx = this.selectedTrash.x - 50;
    const by = this.selectedTrash.y + 45;
    this.powerUI.fillStyle(0x000000, 0.4);
    this.powerUI.fillRoundedRect(bx, by, 100, 10, 5);
    if (pct > 0.05) {
      const r = pct > 0.5 ? 255 : Math.floor(pct * 2 * 255);
      const g2 = pct < 0.5 ? 255 : Math.floor((1 - (pct - 0.5) * 2) * 255);
      this.powerUI.fillStyle(Phaser.Display.Color.GetColor(r, g2, 40), 1);
      this.powerUI.fillRoundedRect(bx, by, 100 * pct, 10, 5);
    }
  }

  onPointerUp(_pointer: Phaser.Input.Pointer) {
    if (!this.isDragging || !this.selectedTrash) return;
    this.isDragging = false;
    this.setTommyEmotion('neutral');
    this.aimUI.clear();
    this.powerUI.clear();
    this.slingshotUI.clear();

    const trash = this.selectedTrash;
    this.selectedTrash = null;

    const launchDx = this.dragStartX - trash.x;
    const launchDy = this.dragStartY - trash.y;

    if (Math.hypot(launchDx, launchDy) < 10) {
      this.tweens.add({ targets: trash, x: this.dragStartX, y: this.dragStartY, duration: 150, ease: 'Back.easeOut' });
      this.tweens.add({ targets: trash, scaleX: 1, scaleY: 1, duration: 100 });
      return;
    }

    this.inFlight = true;
    trash.setData('inFlight', true).setScale(1);
    trash.setVelocity(launchDx * 5.0, launchDy * 7.5);
    (trash.body as Phaser.Physics.Arcade.Body).allowGravity = true;
    (trash.body as Phaser.Physics.Arcade.Body).setGravityY(80);

    // Scale illusion (goes big then small ΓåÆ feels like a real throw arc)
    this.tweens.add({ targets: trash, scaleX: 1.6, scaleY: 1.6, yoyo: true, duration: 420, ease: 'Sine.easeInOut' });

    this.time.delayedCall(250, () => this.ensureMinTrash());
  }

  // ΓöÇΓöÇ Floating message ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  showMsg(text: string, x: number, y: number, color: string) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Fredoka One',
      fontSize: '34px',
      color,
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: t,
      y: y - 90,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 1300,
      ease: 'Sine.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ΓöÇΓöÇ Update loop ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  update() {
    if (this.done) return;

    const all = this.trashGroup.getChildren() as Phaser.Physics.Arcade.Image[];
    
    // Bin hit area made extremely permissive (easy for kids)
    const binW = 110 * this.bin.scaleX * 1.1; // 110% of graphic width - grazing the side works, but not excessive
    const binH = 142 * this.bin.scaleY;
    const binLeft = this.bin.x - binW / 2;
    const binRight = this.bin.x + binW / 2;
    const binTop = this.bin.y - binH * 0.9; // Catch it even if it's slightly above
    const binBottom = this.bin.y + binH * 0.0; // Solo entra en la MITAD SUPERIOR del tacho (y = centro hacia arriba)

    for (const trash of all) {
      if (trash.active && trash.getData('inFlight')) {
        const H = this.cameras.main.height;
        const W = this.cameras.main.width;
        
        // Custom Hit Detection - completely bypasses Phaser's physics body scaling bugs
        const vel = (trash.body as Phaser.Physics.Arcade.Body).velocity;
        if (vel.y > 0) { // falling down
          if (trash.x > binLeft && trash.x < binRight && trash.y > binTop && trash.y < binBottom) {
            this.handleScore(trash, this.bin);
            continue;
          }
        }

        // Detect misses immediately when they fall out of bounds
        if (trash.y > H + 50 || trash.x < -100 || trash.x > W + 100) {
          this.streak = 0;
          this.setTommyEmotion('tense'); // Ouch reaction
          this.tweens.add({ targets: this.tommy, y: 135, yoyo: true, duration: 200 });
          this.time.delayedCall(1200, () => {
            if (!this.isDragging) this.setTommyEmotion('neutral');
          });

          this.showMsg(Phaser.Utils.Array.GetRandom(MISS_MSGS), this.cameras.main.centerX, this.cameras.main.centerY - 40, '#FF6B6B');
          trash.destroy();
          this.inFlight = false;
          this.ensureMinTrash();
        }
      }
    }
  }
}
