export const GAME_CONFIG = {
  apiUrl: 'http://localhost:5049',
  signalRHubUrl: 'http://localhost:5049/hubs/game',
  playerNameStorageKey: 'battle-city-player-name',
  roomCodeStorageKey: 'battle-city-room-code',
  tokenStorageKey: 'battle-tanks-auth-token',
  playerIdStorageKey: 'battle-tanks-player-id',
} as const;
