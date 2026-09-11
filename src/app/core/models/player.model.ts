import { Position } from './position.model';
import { TankStatus } from './tank.model';

export interface Player {
  id: string;
  name: string;
  position: Position;
  health?: number;
  maxHealth?: number;
  status?: TankStatus;
  eventId?: string;
  clientSentAtUnixMs?: number;
  serverReceivedAt?: string;
}
