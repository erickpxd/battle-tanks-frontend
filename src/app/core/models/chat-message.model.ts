export interface ChatMessage {
  id?: string;
  playerId?: string;
  playerName: string;
  message: string;
  timestamp: string;
  eventId?: string;
  clientSentAtUnixMs?: number;
  serverReceivedAt?: string;
}
