import Phaser from 'phaser';
import { EventBus } from '../EventBus';

export class ThrowToBinScene extends Phaser.Scene {
  private bin!: Phaser.Physics.Arcade.Image;
  private trash!: Phaser.Physics.Arcade.Image;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;

  constructor() {
    super({ key: 'ThrowToBinScene' });
  }

  preload() {
    // Generate placeholder graphics since we are saving credits
    const graphics = this.make.graphics({ x: 0, y: 0 });
    
    // Trash (White circle for Paper)
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(20, 20, 20);
    graphics.generateTexture('trash', 40, 40);
    graphics.clear();

    // Bin (Blue rect for General Waste)
    graphics.fillStyle(0x4DA6FF, 1);
    graphics.fillRoundedRect(0, 0, 100, 120, 10);
    graphics.fillStyle(0x3B82C6, 1); // Darker rim
    graphics.fillRoundedRect(0, 0, 100, 20, 5);
    graphics.generateTexture('bin', 100, 120);
    graphics.clear();
  }

  create() {
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Add ground
    const groundHeight = 100;
    const ground = this.add.rectangle(
      this.cameras.main.centerX, 
      this.cameras.main.height - groundHeight / 2, 
      this.cameras.main.width, 
      groundHeight, 
      0x5CD85C // Secondary Green
    );
    this.physics.add.existing(ground, true);

    // Initial setup
    this.spawnBin();
    this.spawnTrash();

    // Setup input
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    // UI Feedback via Tommy (Text)
    this.add.text(20, 20, "👦 Hey buddy! Let's help out!\nDrag and toss the trash!", {
      fontFamily: 'Fredoka',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: { width: this.cameras.main.width - 40 }
    });

    // Notify React that scene is ready
    EventBus.emit('current-scene-ready', this);
  }

  spawnBin() {
    if (this.bin) this.bin.destroy();
    
    // Place bin in upper half
    const x = Phaser.Math.Between(100, this.cameras.main.width - 100);
    const y = this.cameras.main.height * 0.3; // 30% from top
    
    this.bin = this.physics.add.image(x, y, 'bin');
    this.bin.setImmovable(true);
    (this.bin.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  spawnTrash() {
    if (this.trash) this.trash.destroy();

    // Place trash at bottom center
    const x = this.cameras.main.centerX;
    const y = this.cameras.main.height - 150;

    this.trash = this.physics.add.image(x, y, 'trash');
    this.trash.setInteractive();
    this.trash.setCollideWorldBounds(true);
    // Give it high bounce
    this.trash.setBounce(0.5);
    // Disable gravity initially until tossed
    (this.trash.body as Phaser.Physics.Arcade.Body).allowGravity = false;

    // Add collision handler
    this.physics.add.overlap(this.trash, this.bin, this.handleScore, undefined, this);
  }

  onPointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.trash || !this.trash.active) return;
    
    // Check if clicking near the trash
    const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.trash.x, this.trash.y);
    if (dist < 60) {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      
      // Reset velocity/gravity if catching mid-air
      this.trash.setVelocity(0, 0);
      (this.trash.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }
  }

  onPointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.isDragging) return;
    this.isDragging = false;

    // Calculate drag vector
    const dx = this.dragStartX - pointer.x;
    const dy = this.dragStartY - pointer.y;

    // Apply velocity (multiplier adjusts throwing strength)
    const throwMultiplier = 5;
    this.trash.setVelocity(dx * throwMultiplier, dy * throwMultiplier);
    
    // Enable gravity
    (this.trash.body as Phaser.Physics.Arcade.Body).allowGravity = true;

    // Start a timer to check for miss (if it doesn't hit the bin in 3 seconds)
    this.time.delayedCall(3000, () => this.checkMiss());
  }

  checkMiss() {
    // If trash is still active and at the bottom, it's a miss
    if (this.trash && this.trash.active && this.trash.y > this.cameras.main.height - 200) {
      EventBus.emit('game-miss');
      this.spawnTrash(); // Respawn
    }
  }

  handleScore(trashObj: any, binObj: any) {
    // Basic hit, can be refined based on bounds later
    trashObj.destroy();
    EventBus.emit('game-score', 100);
    
    // Particles effect
    const particles = this.add.particles(binObj.x, binObj.y, 'trash', {
      speed: 100,
      scale: { start: 0.5, end: 0 },
      blendMode: 'ADD',
      lifespan: 600
    });
    this.time.delayedCall(600, () => particles.destroy());

    // Next turn
    this.time.delayedCall(1000, () => {
      this.spawnBin();
      this.spawnTrash();
    });
  }

  update() {
    // Update logic if needed
  }
}
