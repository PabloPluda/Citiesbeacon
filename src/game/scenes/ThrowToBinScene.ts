import Phaser from 'phaser';
import { EventBus } from '../EventBus';

export class ThrowToBinScene extends Phaser.Scene {
  private bin!: Phaser.Physics.Arcade.Image;
  private trash!: Phaser.Physics.Arcade.Image;
  private powerUI!: Phaser.GameObjects.Graphics;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private localScore = 0;

  constructor() {
    super({ key: 'ThrowToBinScene' });
  }

  preload() {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Trash (White circle for Paper)
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(20, 20, 20);
    graphics.generateTexture('trash', 40, 40);
    graphics.clear();

    // Bin (Blue rect)
    graphics.fillStyle(0x4DA6FF, 1);
    graphics.fillRoundedRect(0, 0, 100, 120, 10);
    graphics.fillStyle(0x3B82C6, 1);
    graphics.fillRoundedRect(0, 0, 100, 20, 5);
    graphics.generateTexture('bin', 100, 120);
    graphics.clear();
  }

  create() {
    this.cameras.main.setBackgroundColor('#87CEEB');
    this.localScore = 0;

    const groundHeight = 100;
    const ground = this.add.rectangle(
      this.cameras.main.centerX, 
      this.cameras.main.height - groundHeight / 2, 
      this.cameras.main.width, 
      groundHeight, 
      0x5CD85C
    );
    this.physics.add.existing(ground, true);
    
    this.powerUI = this.add.graphics();

    this.spawnBin();
    this.spawnTrash();

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    this.add.text(20, 20, "👦 Pull back to add power and toss!", {
      fontFamily: 'Fredoka',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: { width: this.cameras.main.width - 40 }
    });

    EventBus.emit('current-scene-ready', this);
  }

  spawnBin() {
    if (this.bin) this.bin.destroy();
    
    const widthPadding = 50;
    const x = Phaser.Math.Between(widthPadding, this.cameras.main.width - widthPadding);
    const y = this.cameras.main.height * 0.25;
    
    this.bin = this.physics.add.image(x, y, 'bin');
    this.bin.setImmovable(true);
    (this.bin.body as Phaser.Physics.Arcade.Body).allowGravity = false;

    // Difficulty scaling: shrink by 5% every 100 points AFTER 300 points
    let shrinkFactor = 0;
    if (this.localScore >= 300) {
        shrinkFactor = Math.floor((this.localScore - 300) / 100) * 0.05;
    }
    let targetScale = Math.max(0.5, 1.0 - shrinkFactor);
    
    // Obvious visual pop for scaling
    this.bin.setScale(targetScale * 1.5); 
    this.tweens.add({
      targets: this.bin,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: 500,
      ease: 'Bounce.easeOut',
      onUpdate: () => {
        if (this.bin && this.bin.body) {
           (this.bin.body as Phaser.Physics.Arcade.Body).updateFromGameObject();
        }
      }
    });

    // Move slightly left/right if difficulty is extreme (Score >= 1300)
    if (this.localScore >= 1300) {
        const randomDir = Math.random() > 0.5 ? 1 : -1;
        
        // Start extremely slow (30-50) and increase progressively per 100 points
        const bonusSpeed = Math.floor((this.localScore - 1300) / 100) * 15; 
        let velX = Phaser.Math.Between(30, 50) + bonusSpeed;
        
        // Cap the maximum speed so it doesn't become impossible
        velX = Math.min(200, velX);
        
        this.bin.setVelocity(velX * randomDir, 0);
        this.bin.setCollideWorldBounds(true);
        this.bin.setBounce(1);
    } else {
        this.bin.setVelocity(0, 0);
    }
  }

  spawnTrash() {
    if (this.trash) this.trash.destroy();

    const x = this.cameras.main.centerX;
    const y = this.cameras.main.height - 250;

    this.trash = this.physics.add.image(x, y, 'trash');
    this.trash.setInteractive();
    
    // Instead of completely rigid bounds, let it occasionally fly off screen for a miss
    this.trash.setCollideWorldBounds(false); 
    this.trash.setBounce(0.5);
    (this.trash.body as Phaser.Physics.Arcade.Body).allowGravity = false;

    // Overlap now includes a check callback to enforce falling from above
    this.physics.add.overlap(this.trash, this.bin, this.handleScore, this.checkValidHit, this);
  }

  checkValidHit(trashObj: any, binObj: any) {
    const tBody = trashObj.body as Phaser.Physics.Arcade.Body;
    // Must be falling downwards into the bin
    if (tBody.velocity.y <= 0) return false;
    
    // Must be hitting the top opening area of the bin, not sweeping it from the deep bottom
    // The bin center is binObj.y, so we ensure the trash is at least above the bottom part of the bin
    if (trashObj.y > binObj.y + 20) return false;

    return true;
  }

  onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.trash || !this.trash.active || (this.trash.body as Phaser.Physics.Arcade.Body).allowGravity) return;
    
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.trash.x, this.trash.y);
    if (dist < 100) {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    }
  }

  onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging || !this.trash || !this.trash.active) return;
    
    const dx = this.dragStartX - pointer.x;
    const dy = this.dragStartY - pointer.y;
    
    const maxPull = 150; // max px to pull back
    const pullDistance = Math.min(maxPull, Math.sqrt(dx * dx + dy * dy));
    const energyPercentage = pullDistance / maxPull; // 0 to 1
    
    this.powerUI.clear();
    
    const barWidth = 120;
    const barHeight = 12;
    const startX = this.trash.x - barWidth / 2;
    const startY = this.trash.y + 40;
    
    this.powerUI.fillStyle(0x000000, 0.4);
    this.powerUI.fillRoundedRect(startX, startY, barWidth, barHeight, 6);
    
    if (energyPercentage > 0.05) {
      const r = energyPercentage > 0.5 ? 255 : Math.floor(255 * (energyPercentage * 2));
      const g = energyPercentage < 0.5 ? 255 : Math.floor(255 * (1 - (energyPercentage - 0.5) * 2));
      const color = Phaser.Display.Color.GetColor(r, g, 50);
      
      this.powerUI.fillStyle(color, 1);
      this.powerUI.fillRoundedRect(startX, startY, barWidth * energyPercentage, barHeight, 6);
    }
  }

  onPointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.powerUI.clear();

    if (!this.trash || !this.trash.active) return;

    const dx = this.dragStartX - pointer.x;
    const dy = this.dragStartY - pointer.y;

    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

    // Apply more strict arc logic: higher Y multiplier ensures arc, X is steady
    const throwMultiplierX = 6.0; // Much faster horizontally
    const throwMultiplierY = 9.0; // Pushes it higher effortlessly
    
    this.trash.setVelocity(dx * throwMultiplierX, dy * throwMultiplierY);
    
    const tBody = this.trash.body as Phaser.Physics.Arcade.Body;
    tBody.allowGravity = true;
    tBody.setGravityY(150); // Extremely light gravity, super floaty parabola

    // Parabola Z-axis illusion (grows towards camera, then shrinks as it falls)
    this.tweens.add({
      targets: this.trash,
      scaleX: 1.6,
      scaleY: 1.6,
      yoyo: true,
      duration: 500, // Roughly the time it takes to reach the peak and fall
      ease: 'Sine.easeInOut'
    });

    this.time.delayedCall(3000, () => this.checkMiss());
  }

  checkMiss() {
    // Also consider it missed if it flew completely out of lateral bounds
    if (this.trash && this.trash.active) {
       const outOfBoundsY = this.trash.y > this.cameras.main.height - 200;
       const outOfBoundsX = this.trash.x < -100 || this.trash.x > this.cameras.main.width + 100;
       
       if (outOfBoundsY || outOfBoundsX) {
          EventBus.emit('game-miss');
          this.spawnBin();
          this.spawnTrash(); 
       }
    }
  }

  handleScore(trashObj: any, binObj: any) {
    trashObj.destroy();
    EventBus.emit('game-score', 100);
    this.localScore += 100;
    
    const particles = this.add.particles(binObj.x, binObj.y, 'trash', {
      speed: 100,
      scale: { start: 0.8, end: 0 },
      blendMode: 'ADD',
      lifespan: 800
    });
    this.time.delayedCall(800, () => particles.destroy());

    this.time.delayedCall(800, () => {
      this.spawnBin();
      this.spawnTrash();
    });
  }
}
