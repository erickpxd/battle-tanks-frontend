import { Position } from './position.model';
import { TankStatus } from './tank.model';

export interface Player {
  id: string;
  name: string;
  position: Position;
  health?: number;
  maxHealth?: number;
  status?: TankStatus;
  shieldHealth?: number;
  shieldExpiresAt?: string | null;
  speedBoostExpiresAt?: string | null;
  doubleDamageExpiresAt?: string | null;
  machineGunExpiresAt?: string | null;
  eventId?: string;
  clientSentAtUnixMs?: number;
  serverReceivedAt?: string;
  ready?: boolean;
}
