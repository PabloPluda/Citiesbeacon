import Phaser from 'phaser';
import { EventBus } from '../EventBus';

export class CrossingScene extends Phaser.Scene {
  level = 1;
  scored = 0;
  timeLeft = 40;
  done = false;
  tutorialActive = false;
  timerEvent!: Phaser.Time.TimerEvent;

  tommy!: Phaser.Physics.Arcade.Image;
  tommyPortrait!: Phaser.GameObjects.Image;
  crossroads: any[] = [];
  carGroup!: Phaser.Physics.Arcade.Group;

  constructor() {
    super('CrossingScene');
  }

  init(data?: { level?: number }) {
    this.level = data?.level || 1;
    this.scored = 0;
    this.timeLeft = 40;
    this.done = false;
    this.tutorialActive = false;
  }

  create() {
    EventBus.emit('current-scene-ready', this);
    EventBus.emit('game-timer', this.timeLeft);
    EventBus.emit('game-scored-update', this.scored);

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

    // Shut down gravity for this scene
    this.physics.world.gravity.y = 0;

    this.physics.world.setBounds(0, 0, 10000, H);
    this.cameras.main.setBounds(0, 0, 10000, H);

    // Background grass
    this.add.rectangle(5000, H/2, 10000, H, 0x4ADE80);
    // Sidewalk (horizontal path for Tommy)
    this.add.rectangle(5000, H/2, 10000, 120, 0xCBD5E1);

    this.carGroup = this.physics.add.group();

    this.crossroads = [];
    for (let i = 1; i <= 10; i++) {
       const x = 300 + (i * 600);
       
       // Vertical Road
       this.add.rectangle(x, H/2, 180, H, 0x374151); 
       
       // Yellow dashed line in the middle of the vertical road
       for(let k=0; k<20; k++) {
           this.add.rectangle(x, -200 + k*80, 8, 40, 0xEAB308);
       }
       
       // Crosswalk stripes (white zebra lines horizontal along Tommy's path)
       for(let j=0; j<4; j++) {
           this.add.rectangle(x - 60 + j*40, H/2, 20, 100, 0xFFFFFF);
       }
       
       // Traffic light housing
       this.add.rectangle(x - 100, H/2 - 120, 50, 90, 0x111827).setDepth(10);
       const lightRed = this.add.text(x - 100, H/2 - 142, "🧍", { fontSize: '32px', color: '#EF4444' }).setOrigin(0.5).setDepth(11);
       const lightGreen = this.add.text(x - 100, H/2 - 97, "🚶", { fontSize: '32px', color: '#22C55E' }).setOrigin(0.5).setDepth(11);
       
       const isRed = Math.random() > 0.5;
       if (isRed) { lightRed.setAlpha(1); lightGreen.setAlpha(0.2); }
       else { lightRed.setAlpha(0.2); lightGreen.setAlpha(1); }

       this.crossroads.push({ 
           x, width: 180,
           lightRed, lightGreen, 
           state: isRed ? 'red' : 'green', 
           timer: Phaser.Math.Between(0, 2000),
           passed: false
       });
    }

    // Generate tommy texture
    const g = this.make.graphics({x:0,y:0});
    g.fillStyle(0x3B82F6);
    g.fillCircle(20, 20, 20); // body
    g.fillStyle(0xFCD34D);
    g.fillCircle(20, 10, 12); // head
    g.generateTexture('tommy_top', 40, 40);
    g.clear();
    
    // Generate car texture
    g.fillStyle(0xEF4444);
    g.fillRoundedRect(0, 0, 40, 80, 8);
    g.fillStyle(0x000);
    g.fillRect(5, 15, 30, 20);
    g.fillRect(5, 55, 30, 20);
    g.generateTexture('car_top', 40, 80);
    g.clear();
    g.destroy();

    // Portrait textures
    const gp = this.make.graphics({x:0,y:0});
    gp.fillStyle(0x3B82F6); gp.fillCircle(30, 30, 30);
    gp.fillStyle(0xFCD34D); gp.fillCircle(30, 20, 20);
    // smile
    gp.lineStyle(3, 0x000); gp.beginPath(); gp.arc(30, 25, 8, 0, Math.PI, false); gp.strokePath();
    gp.generateTexture('portrait_smile', 60, 60);
    gp.clear();
    
    gp.fillStyle(0x3B82F6); gp.fillCircle(30, 30, 30);
    gp.fillStyle(0xFCD34D); gp.fillCircle(30, 20, 20);
    // gasp
    gp.fillStyle(0x000); gp.fillCircle(30, 28, 5);
    gp.generateTexture('portrait_gasp', 60, 60);
    gp.clear();
    gp.destroy();

    this.tommy = this.physics.add.image(100, H/2, 'tommy_top').setDepth(5);
    this.cameras.main.startFollow(this.tommy, true, 0.1, 0.1, -W/4, 0); 
    
    // UI Portrait in top right (scroll factor 0 so it stays on screen)
    this.add.rectangle(W - 60, 60, 80, 80, 0xFFFFFF).setDepth(20).setScrollFactor(0);
    this.tommyPortrait = this.add.image(W - 60, 60, 'portrait_smile').setDepth(21).setScrollFactor(0);

    // Collision with cars
    this.physics.add.overlap(this.tommy, this.carGroup, () => {
        this.penalize();
    });

    if (this.level === 1) {
        this.tutorialActive = true;
        this.showTutorial();
    }
  }

  showTutorial() {
      const uig = this.add.group();
      const bg = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, 10000, 10000, 0x000, 0.7).setDepth(30);

      const panel = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, 400, 300, 0xFFFFFF).setDepth(31).setScrollFactor(0);
      const text = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, "Hold screen to STOP\nat red lights 🧍!\n\nRelease to WALK\nat green lights 🚶!", { fontFamily: 'Fredoka', fontSize: '24px', color: '#000', align: 'center' }).setOrigin(0.5).setDepth(31).setScrollFactor(0);
      
      const btnBG = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY + 90, 180, 60, 0x22C55E).setInteractive().setDepth(31).setScrollFactor(0);
      const btnTXT = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 90, "Got It!", { fontFamily: 'Fredoka One', fontSize: '26px', color: '#FFF' }).setOrigin(0.5).setDepth(31).setScrollFactor(0);
      
      uig.addMultiple([bg, panel, text, btnBG, btnTXT]);

      btnBG.once('pointerdown', () => {
          uig.destroy(true);
          this.tutorialActive = false;
      });
  }

  penalize() {
      if (this.done || this.tutorialActive) return;
      this.cameras.main.shake(200, 0.015);
      
      // Jump back safely
      this.tommy.x = Math.max(100, this.tommy.x - 200);
      
      // Flash red
      const flash = this.add.rectangle(this.tommy.x, this.cameras.main.centerY, 1000, 1000, 0xEF4444, 0.4).setDepth(40);
      this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });

      // Buzz text
      const txt = this.add.text(this.tommy.x, this.tommy.y - 40, "-3s!", { fontFamily: 'Fredoka One', fontSize: '32px', color: '#EF4444', stroke: '#FFF', strokeThickness: 5 }).setOrigin(0.5).setDepth(40);
      this.tweens.add({ targets: txt, y: txt.y - 40, alpha: 0, duration: 800, onComplete: () => txt.destroy() });

      this.timeLeft = Math.max(0, this.timeLeft - 3);
  }

  update(_time: number, delta: number) {
    if (this.done || this.tutorialActive) {
        this.tommy.setVelocityX(0);
        return;
    }

    let upcomingRed = false;
    const H = this.cameras.main.height;

    this.crossroads.forEach(cr => {
        cr.timer += delta;
        // Traffic light cycle
        if (cr.timer > 3000 + (Math.random() * 1000)) {
            cr.timer = 0;
            cr.state = cr.state === 'red' ? 'green' : 'red';
            if (cr.state === 'red') {
                cr.lightRed.setAlpha(1);
                cr.lightGreen.setAlpha(0.2);
            } else {
                cr.lightRed.setAlpha(0.2);
                cr.lightGreen.setAlpha(1);
            }
        }

        // Spawn cars 
        if (Math.random() < 0.015) { 
            const isDown = Math.random() > 0.5;
            // Place in the correct lane
            const carX = cr.x + (isDown ? -30 : 30);
            const carY = isDown ? -100 : H + 100;
            
            const car = this.carGroup.create(carX, carY, 'car_top') as Phaser.Physics.Arcade.Image & { cr: any, dir: string };
            car.cr = cr;
            car.dir = isDown ? 'down' : 'up';
            car.setTint(Phaser.Math.Between(0x888888, 0xFFFFFF)); 
            car.setVelocityY(isDown ? 300 : -300);
            if (!isDown) car.setAngle(180); // flip visually
            
            this.time.delayedCall(8000, () => { if(car.active) car.destroy() });
        }

        // Logic check: if Tommy is inside the crosswalk AND it's red -> PENALTY
        const isInsideCrosswalk = this.tommy.x > (cr.x - 90) && this.tommy.x < (cr.x + 90);
        if (isInsideCrosswalk && cr.state === 'red') {
            this.penalize();
        }

        // Portrait check: If this is the next upcoming crossroad (slightly ahead)
        if (cr.x > this.tommy.x && cr.x < this.tommy.x + 400) {
            upcomingRed = cr.state === 'red';
        }

        // Score logic
        if (!cr.passed && this.tommy.x > cr.x + 100) {
            cr.passed = true;
            this.scored++;
            EventBus.emit('game-scored-update', this.scored);
            if (this.scored >= 10) {
                this.done = true;
                EventBus.emit('game-level-complete', this.level);
            }
        }
    });

    // Control cars stopping at the crosswalk
    this.carGroup.getChildren().forEach((child) => {
        const c = child as Phaser.Physics.Arcade.Image & { cr: any, dir: string };
        const brakeLineTop = H/2 - 70;
        const brakeLineBot = H/2 + 70;
        
        // If pedestrian light is Green, cars must stop.
        if (c.cr.state === 'green') {
            if (c.dir === 'down' && c.y > brakeLineTop - 80 && c.y < brakeLineTop) {
                c.setVelocityY(0);
            }
            if (c.dir === 'up' && c.y < brakeLineBot + 80 && c.y > brakeLineBot) {
                c.setVelocityY(0);
            }
        } else {
            // Restore speed
            if (c.dir === 'down' && c.body?.velocity.y === 0) c.setVelocityY(300);
            if (c.dir === 'up' && c.body?.velocity.y === 0) c.setVelocityY(-300);
        }
    });

    this.tommyPortrait.setTexture(upcomingRed ? 'portrait_gasp' : 'portrait_smile');

    const isStopping = this.input.activePointer.isDown;
    const speed = 150 + (this.level * 8);
    this.tommy.setVelocityX(isStopping ? 0 : speed);
  }
}
