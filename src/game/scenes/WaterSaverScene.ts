import Phaser from 'phaser';
import { EventBus } from '../EventBus';

export class WaterSaverScene extends Phaser.Scene {
  level = 1;
  scored = 0; // Water % remaining
  waterLeft = 100;
  timeLeft = 45;
  done = false;
  tutorialActive = false;
  timerEvent!: Phaser.Time.TimerEvent;

  tankWater!: Phaser.GameObjects.Rectangle;
  tankText!: Phaser.GameObjects.Text;
  faucets: any[] = [];
  drops: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('WaterSaverScene');
  }

  init(data?: { level?: number }) {
    this.level = data?.level || 1;
    this.waterLeft = 100;
    this.timeLeft = 45;
    this.done = false;
    this.tutorialActive = false;
  }

  create() {
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);
    EventBus.emit('game-scored-update', `${Math.floor(this.waterLeft)}%`);

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
          // Win! Survied the 45 seconds with > 0% water
          EventBus.emit('game-level-complete', this.level);
        }
      }
    });

    const W = this.cameras.main.width;
    // height not needed here

    // Background
    this.cameras.main.setBackgroundColor('#E2E8F0');

    // Huge Water Tank (Glass cylinder)
    this.add.rectangle(W/2, 160, 200, 240, 0x94A3B8).setAlpha(0.3).setStrokeStyle(4, 0x64748B);
    
    // The actual water inside the tank
    this.tankWater = this.add.rectangle(W/2, 280, 200, 240, 0x3B82F6).setOrigin(0.5, 1);
    this.tankText = this.add.text(W/2, 160, "100%", { fontFamily: 'Fredoka One', fontSize: '48px', color: '#FFF', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);

    // Main Pipe under tank
    this.add.rectangle(W/2, 320, 20, 100, 0x475569);
    // Horizontal connecting pipe
    this.add.rectangle(W/2, 370, 260, 20, 0x475569);

    // Droplet texture
    const gd = this.make.graphics({x:0,y:0});
    gd.fillStyle(0x3B82F6);
    gd.fillCircle(10, 15, 10);
    gd.beginPath(); gd.moveTo(0, 15); gd.lineTo(10, 0); gd.lineTo(20, 15); gd.fillPath();
    gd.generateTexture('drop', 20, 25);
    gd.clear();
    gd.destroy();

    // Prepare 6 faucets in a 2x3 grid
    this.faucets = [];
    const rows = 2;
    const cols = 3;
    const fW = 100; // width spacing
    const fH = 80;  // height spacing

    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
            const fx = (W/2 - 100) + (c * fW);
            const fy = 380 + (r * fH);
            
            // vertical connection pipe
            this.add.rectangle(fx, fy + 15, 16, 30, 0x475569);
            // faucet body - larger for easier tapping
            const fBody = this.add.rectangle(fx, fy + 40, 50, 30, 0x94A3B8).setInteractive();
            this.add.rectangle(fx, fy + 55, 14, 14, 0x64748B);
            // handle
            const fHandle = this.add.rectangle(fx, fy + 20, 30, 8, 0xEF4444);

            const faucet = { x: fx, y: fy+40, container: fBody, handle: fHandle, leaking: false, dropTimer: 0 };
            
            fBody.on('pointerdown', () => this.closeFaucet(faucet));
            this.faucets.push(faucet);
        }
    }

    if (this.level === 1) {
        this.tutorialActive = true;
        this.showTutorial();
    }
  }

  showTutorial() {
      const uig = this.add.group();
      const bg = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, 10000, 10000, 0x000, 0.7).setDepth(30);

      const panel = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, 340, 220, 0xFFFFFF).setDepth(31);
      const text = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 40, "Tap the faucets\nto close them\nand save water!", { fontFamily: 'Fredoka One', fontSize: '26px', color: '#000', align: 'center' }).setOrigin(0.5).setDepth(31);
      
      const btnBG = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY + 60, 160, 50, 0x22C55E).setInteractive().setDepth(31);
      const btnTXT = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 60, "Got It!", { fontFamily: 'Fredoka One', fontSize: '24px', color: '#FFF' }).setOrigin(0.5).setDepth(31);
      
      uig.addMultiple([bg, panel, text, btnBG, btnTXT]);

      btnBG.once('pointerdown', () => {
          uig.destroy(true);
          this.tutorialActive = false;
      });
  }

  closeFaucet(f: any) {
      if (this.done || this.tutorialActive) return;
      if (f.leaking) {
          f.leaking = false;
          // Rotate handle visually to show closed
          this.tweens.add({ targets: f.handle, angle: -90, duration: 150 });
      }
  }

  update(_time: number, delta: number) {
      if (this.done || this.tutorialActive) return;

      // Randomly break faucets
      if (Math.random() < 0.01 + (this.level * 0.002)) {
          const closed = this.faucets.filter(f => !f.leaking);
          if (closed.length > 0) {
              const broke = Phaser.Utils.Array.GetRandom(closed);
              broke.leaking = true;
              // Revert handle visually
              this.tweens.add({ targets: broke.handle, angle: 0, duration: 150 });
          }
      }

      // Check leaking state
      let activeLeaks = 0;
      this.faucets.forEach(f => {
          if (f.leaking) {
              activeLeaks++;
              f.dropTimer += delta;
              if (f.dropTimer > 400) { // spawn visual drop
                  f.dropTimer = 0;
                  const drop = this.add.image(f.x, f.y + 10, 'drop').setScale(0.5);
                  this.tweens.add({ targets: drop, y: f.y + 100, alpha: 0, duration: 500, onComplete: () => drop.destroy() });
              }
          }
      });

      // Drain tank
      if (activeLeaks > 0) {
          // Drops waterLeft. Example: 1 leak drains 0.5% per second (45s = 22.5% lost). 
          // 5 leaks = 2.5% per second (45s = empty!)
          const drainRate = 0.5 + (this.level * 0.05);
          this.waterLeft -= (activeLeaks * drainRate * delta) / 1000;
          this.waterLeft = Math.max(0, this.waterLeft);
          
          this.tankWater.scaleY = this.waterLeft / 100;
          this.tankText.setText(`${Math.floor(this.waterLeft)}%`);
          
          EventBus.emit('game-scored-update', `${Math.floor(this.waterLeft)}%`);

          if (this.waterLeft <= 0) {
              this.done = true;
              EventBus.emit('game-time-up', 0); // FAILED! Ran out of water
          }
      }
  }

}
