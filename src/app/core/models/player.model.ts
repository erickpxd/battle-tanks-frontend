import { Position } from './position.model';

export interface Player {
  id: string;
  name: string;
  position: Position;
  eventId?: string;
  clientSentAtUnixMs?: number;
  serverReceivedAt?: string;
}
