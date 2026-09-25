import { PlayerDirection, Position } from './position.model';

export type TankStatus = 'active' | 'destroyed';

export interface TankSpawn {
  readonly player: number;
  readonly x: number;
  readonly y: number;
  readonly direction: PlayerDirection;
}

export interface Tank {
  readonly id: string;
  readonly player: number;
  readonly position: Readonly<Position>;
  readonly health: number;
  readonly maxHealth: number;
  readonly status: TankStatus;
}
