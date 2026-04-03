import Phaser from 'phaser';
import { EventBus } from '../EventBus';

export class LightsOutScene extends Phaser.Scene {
  level = 1;
  scored = 0;
  timeLeft = 35;
  done = false;
  tutorialActive = false;
  timerEvent!: Phaser.Time.TimerEvent;

  windows: Phaser.GameObjects.Rectangle[] = [];
  occupants: Phaser.GameObjects.Image[] = [];
  
  constructor() {
    super('LightsOutScene');
  }

  init(data?: { level?: number }) {
    this.level = data?.level || 1;
    this.scored = 0;
    this.timeLeft = 35;
    this.done = false;
    this.tutorialActive = false;
  }

  create() {
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);
    EventBus.emit('game-scored-update', `${this.scored}/15`);

    const handleRestart = (data: { level: number }) => {
      setTimeout(() => this.scene.restart(data), 0);
    };
    EventBus.on('restart-scene', handleRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off('restart-scene', handleRestart));

    this.timerEvent = this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => {
        if (this.done || this.tutorialActive) return;
        this.timeLeft--;
        EventBus.emit('game-timer', this.timeLeft);
        if (this.timeLeft <= 0) {
          this.done = true;
          this.time.delayedCall(400, () => EventBus.emit('game-time-up', this.scored));
        }
      }
    });

    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Building facade
    this.add.rectangle(W/2, H/2 + 50, W - 40, H - 100, 0x1E293B).setStrokeStyle(4, 0x0F172A);
    this.add.rectangle(W/2, H - 20, 100, 60, 0x475569); // door

    // Better Person texture (White silhouette)
    const g = this.make.graphics({x:0,y:0});
    g.fillStyle(0x000000, 0.8);
    // draw head
    g.fillCircle(20, 15, 12);
    // draw shoulders/body
    g.beginPath(); gpMoveTo(g, 8, 45); gpLineTo(g, 10, 25); gpLineTo(g, 30, 25); gpLineTo(g, 32, 45); g.fillPath();
    g.generateTexture('person_sil', 40, 45);
    g.clear();
    g.destroy();

    this.windows = [];
    this.occupants = [];

    const cols = 4;
    const rows = 5;
    const wW = 50;
    const wH = 65;
    const gapX = (W - 80 - (cols * wW)) / (cols - 1);
    const gapY = (H - 200 - (rows * wH)) / (rows - 1);

    for (let r=0; r<rows; r++) {
        for (let c=0; c<cols; c++) {
            const x = 40 + (wW/2) + c * (wW + gapX);
            const y = 80 + (wH/2) + r * (wH + gapY);

            const win = this.add.rectangle(x, y, wW, wH, 0x0F172A);
            win.setInteractive();
            win.setData('state', 'OFF');

            const occ = this.add.image(x, y + 10, 'person_sil').setVisible(false).setDepth(2);

            win.on('pointerdown', () => this.hitWindow(win, occ));
            
            this.windows.push(win);
            this.occupants.push(occ);
        }
    }

    if (this.level === 1) {
        this.tutorialActive = true;
        this.showTutorial();
    } else {
        this.startSpawning();
    }
  }

  startSpawning() {
    this.time.addEvent({
        delay: Math.max(400, 1200 - (this.level * 40)),
        loop: true,
        callback: this.activateRandomWindow,
        callbackScope: this
    });
  }

  showTutorial() {
      const uig = this.add.group();
      const bg = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, 10000, 10000, 0x000, 0.8).setDepth(30);

      // We highlight two windows for tutorial
      const winEmpty = this.add.rectangle(this.cameras.main.centerX - 100, this.cameras.main.centerY - 50, 60, 80, 0xFEF08A).setDepth(31);
      const winPerson = this.add.rectangle(this.cameras.main.centerX + 100, this.cameras.main.centerY - 50, 60, 80, 0xFEF08A).setDepth(31);
      const person = this.add.image(this.cameras.main.centerX + 100, this.cameras.main.centerY - 35, 'person_sil').setDepth(31);

      const check = this.add.text(this.cameras.main.centerX - 100, this.cameras.main.centerY - 120, "✅", { fontSize: '40px' }).setOrigin(0.5).setDepth(31);
      const cross = this.add.text(this.cameras.main.centerX + 100, this.cameras.main.centerY - 120, "❌", { fontSize: '40px' }).setOrigin(0.5).setDepth(31);

      const text = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 50, "Turn off ONLY empty rooms!", { fontFamily: 'Fredoka One', fontSize: '24px', color: '#FFF' }).setOrigin(0.5).setDepth(31);
      
      const btnBG = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY + 130, 180, 60, 0x22C55E).setInteractive().setDepth(31);
      const btnTXT = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 130, "Got It!", { fontFamily: 'Fredoka One', fontSize: '26px', color: '#FFF' }).setOrigin(0.5).setDepth(31);
      
      uig.addMultiple([bg, winEmpty, winPerson, person, check, cross, text, btnBG, btnTXT]);

      btnBG.once('pointerdown', () => {
          uig.destroy(true);
          this.tutorialActive = false;
          this.startSpawning();
      });
  }

  activateRandomWindow() {
      if(this.done || this.tutorialActive) return;
      
      const spawns = Math.min(3, Math.ceil(this.level / 5));

      for (let i = 0; i < spawns; i++) {
        const offWindows = this.windows.filter(w => w.getData('state') === 'OFF');
        if (offWindows.length === 0) break;

        const win = Phaser.Utils.Array.GetRandom(offWindows);
        const idx = this.windows.indexOf(win);
        const occ = this.occupants[idx];

        const hasPerson = Math.random() < 0.25;

        win.setFillStyle(0xFEF08A); // Light is on
        win.setData('state', hasPerson ? 'OCCUPIED' : 'EMPTY');
        
        if (hasPerson) {
            occ.setVisible(true);
        }
        
        const limit = Math.max(1000, 3500 - (this.level * 70));
        this.time.delayedCall(limit, () => {
            if (win.getData('state') !== 'OFF') {
                this.turnOff(win, occ);
            }
        });
      }
  }

  turnOff(win: Phaser.GameObjects.Rectangle, occ: Phaser.GameObjects.Image) {
      win.setData('state', 'OFF');
      win.setFillStyle(0x0F172A);
      occ.setVisible(false);
  }

  hitWindow(win: Phaser.GameObjects.Rectangle, occ: Phaser.GameObjects.Image) {
      if (this.done || this.tutorialActive) return;
      
      const state = win.getData('state');
      if (state === 'OFF') return;

      if (state === 'OCCUPIED') {
          // Penalty!
          this.cameras.main.shake(100, 0.015);
          const flash = this.add.rectangle(win.x, win.y, 60, 80, 0xEF4444, 0.6).setDepth(10);
          this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });

          const txt = this.add.text(win.x, win.y, "🚫", { fontSize: '40px' }).setOrigin(0.5).setDepth(11);
          this.tweens.add({ targets: txt, scale: 2, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
          
          // -4s overlay logic
          this.timeLeft = Math.max(0, this.timeLeft - 4);
          EventBus.emit('game-timer', this.timeLeft);
          const timeUI = this.add.text(this.cameras.main.centerX + 50, 45, '-4s', {
            fontFamily: 'Fredoka One', fontSize: '28px', color: '#EF4444', stroke: '#FFF', strokeThickness: 4
          }).setOrigin(0.5).setDepth(30);
          this.tweens.add({ targets: timeUI, y: 15, alpha: 0, duration: 900, onComplete: () => timeUI.destroy() });

          this.turnOff(win, occ);
      } else if (state === 'EMPTY') {
          // Score!
          this.scored++;
          EventBus.emit('game-scored-update', `${this.scored}/15`);
          this.turnOff(win, occ);
          
          // pop effect
          const pop = this.add.circle(win.x, win.y, 10, 0xFEF08A).setDepth(10);
          this.tweens.add({ targets: pop, scale: 3, alpha: 0, duration: 300, onComplete: () => pop.destroy() });

          if (this.scored >= 15) {
              this.done = true;
              EventBus.emit('game-level-complete', this.level);
          }
      }
  }

}

function gpMoveTo(g: Phaser.GameObjects.Graphics, x: number, y: number) { g.moveTo(x,y); }
function gpLineTo(g: Phaser.GameObjects.Graphics, x: number, y: number) { g.lineTo(x,y); }
