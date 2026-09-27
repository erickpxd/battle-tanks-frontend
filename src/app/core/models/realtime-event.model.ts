import { MapTileChange } from './map-tile-change.model';
import { Position } from './position.model';

export interface RealtimeMetadata {
  eventId: string;
  clientSentAtUnixMs: number;
}

export interface PlayerMoveRequest extends Position, RealtimeMetadata {}

export interface RealtimeChatRequest extends RealtimeMetadata {
  message: string;
}

export interface RealtimeMapTileChange extends MapTileChange, RealtimeMetadata {}

export interface PlayerHitRequest extends RealtimeMetadata {
  targetPlayerId: string;
  damage: number;
}

export interface CollectPowerUpRequest extends RealtimeMetadata {
  powerUpId: string;
}

export interface PlayerReadyRequest extends RealtimeMetadata {
  ready: boolean;
}

export interface FireShotRequest extends RealtimeMetadata {
  direction: string;
}

export interface SurrenderRequest extends RealtimeMetadata {}

export interface RealtimeShot extends RealtimeMetadata {
  playerId: string;
  position: Position;
  serverReceivedAt: string;
}

export interface RealtimeAck extends RealtimeMetadata {
  serverReceivedAt: string;
}
