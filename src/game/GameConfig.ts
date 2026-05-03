import Phaser from 'phaser';

export function createGameConfig(parent: string | HTMLElement, InitialSceneClass: any): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: parent,
    backgroundColor: '#87CEEB',
    pixelArt: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 800, x: 0 },
        debug: false
      }
    },
    scene: [InitialSceneClass]
  };
}
