export type MqttConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type CriticalGameEventType =
  | 'collision.player-hit'
  | 'map.tile-destroyed'
  | 'game.ended';

export interface GameEventEnvelope<TData = unknown> {
  readonly eventId: string;
  readonly eventType: CriticalGameEventType;
  readonly roomId: string;
  readonly playerId: string | null;
  readonly sentAtUnixMs: number;
  readonly publishedAtUnixMs: number;
  readonly data: TData;
}

export interface PlayerHitEventData {
  readonly targetPlayerId: string;
  readonly damage: number;
  readonly remainingHealth: number;
  readonly status: 'active' | 'destroyed';
}

export interface MapTileDestroyedEventData {
  readonly column: number;
  readonly row: number;
}

export interface GameEndedEventData {
  readonly defeatedPlayerId: string;
  readonly winnerPlayerId: string | null;
  readonly triggerEventId: string;
  readonly defeatedPlayerName?: string;
  readonly winnerPlayerName?: string | null;
  readonly winnerPointsAwarded?: number;
  readonly winnerTotalScore?: number | null;
}

export function isGameEventEnvelope(value: unknown): value is GameEventEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<GameEventEnvelope>;
  return (
    typeof event.eventId === 'string' &&
    event.eventId.trim().length > 0 &&
    isCriticalGameEventType(event.eventType) &&
    typeof event.roomId === 'string' &&
    event.roomId.trim().length >= 3 &&
    typeof event.sentAtUnixMs === 'number' &&
    Number.isFinite(event.sentAtUnixMs) &&
    typeof event.publishedAtUnixMs === 'number' &&
    Number.isFinite(event.publishedAtUnixMs) &&
    'data' in event
  );
}

function isCriticalGameEventType(value: unknown): value is CriticalGameEventType {
  return (
    value === 'collision.player-hit' ||
    value === 'map.tile-destroyed' ||
    value === 'game.ended'
  );
}
