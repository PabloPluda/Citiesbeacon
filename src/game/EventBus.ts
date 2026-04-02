import { Events } from 'phaser';

// Singleton EventBus to bridge React and Phaser
export const EventBus = new Events.EventEmitter();
