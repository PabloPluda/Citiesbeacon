import Phaser from 'phaser';
import { ThrowToBinScene } from './scenes/ThrowToBinScene';

export function createGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: parent,
    backgroundColor: '#87CEEB', // Sky blue default
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%'
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 800, x: 0 },
        debug: false
      }
    },
    scene: [ThrowToBinScene]
  };
}
