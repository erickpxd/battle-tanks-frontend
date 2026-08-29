export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
  direction: PlayerDirection;
}
