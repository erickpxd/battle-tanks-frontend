export const GAME_CONFIG = {
  // Em produção, quando a aplicação usar HTTPS, o servidor também deverá usar wss://.
  websocketUrl: 'ws://localhost:8080/ws',
  playerNameStorageKey: 'battle-city-player-name',
  roomCodeStorageKey: 'battle-city-room-code',
} as const;
