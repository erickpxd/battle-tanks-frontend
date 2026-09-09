export const GAME_CONFIG = {
  apiUrl: 'http://localhost:5049',
  // Em produção, quando a aplicação usar HTTPS, o servidor também deverá usar wss://.
  websocketUrl: 'ws://localhost:8080/ws',
  playerNameStorageKey: 'battle-city-player-name',
  roomCodeStorageKey: 'battle-city-room-code',
  tokenStorageKey: 'battle-tanks-auth-token',
  playerIdStorageKey: 'battle-tanks-player-id',
} as const;
