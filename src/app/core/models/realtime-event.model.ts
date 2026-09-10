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

export interface RealtimeAck extends RealtimeMetadata {
  serverReceivedAt: string;
}
