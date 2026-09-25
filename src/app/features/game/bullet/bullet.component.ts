import { Component } from '@angular/core';

import { PlayerDirection } from '../../../core/models/position.model';

export interface BulletState {
  x: number;
  y: number;
  direction: PlayerDirection;
}

@Component({
  selector: 'app-bullet',
  template: '',
  host: {
    'aria-hidden': 'true',
    style: 'display: none',
  },
})
export class BulletComponent {
  draw(context: CanvasRenderingContext2D, bullet: BulletState): void {
    context.fillStyle = '#fff4b0';
    context.fillRect(bullet.x - 3, bullet.y - 3, 6, 6);
    context.fillStyle = '#f06436';
    context.fillRect(bullet.x - 1, bullet.y - 1, 2, 2);
  }
}
