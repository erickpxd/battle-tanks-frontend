import { createFeatureSelector, createSelector } from '@ngrx/store';

import { gameFeatureKey, RealtimeGameState } from './game.reducer';

export const selectRealtimeGameState = createFeatureSelector<RealtimeGameState>(gameFeatureKey);

export const selectConnectionStatus = createSelector(
  selectRealtimeGameState,
  (state) => state.connectionStatus,
);
export const selectConnectionError = createSelector(
  selectRealtimeGameState,
  (state) => state.connectionError,
);
export const selectLocalPlayerId = createSelector(
  selectRealtimeGameState,
  (state) => state.localPlayerId,
);
export const selectPlayers = createSelector(selectRealtimeGameState, (state) => state.players);
export const selectChatMessages = createSelector(
  selectRealtimeGameState,
  (state) => state.chatMessages,
);
export const selectLastPlayerMove = createSelector(
  selectRealtimeGameState,
  (state) => state.lastPlayerMove,
);
export const selectLastPlayerHit = createSelector(
  selectRealtimeGameState,
  (state) => state.lastPlayerHit,
);
export const selectPowerUps = createSelector(selectRealtimeGameState, (state) => state.powerUps);
export const selectLastPowerUpPlayer = createSelector(
  selectRealtimeGameState,
  (state) => state.lastPowerUpPlayer,
);
export const selectLastChatMessage = createSelector(
  selectRealtimeGameState,
  (state) => state.lastChatMessage,
);
export const selectLastMapTileChange = createSelector(
  selectRealtimeGameState,
  (state) => state.lastMapTileChange,
);
export const selectMqttConnectionStatus = createSelector(
  selectRealtimeGameState,
  (state) => state.mqttConnectionStatus,
);
export const selectGameEvents = createSelector(
  selectRealtimeGameState,
  (state) => state.gameEvents,
);
export const selectLastGameEvent = createSelector(
  selectRealtimeGameState,
  (state) => state.lastGameEvent,
);
export const selectGameEnded = createSelector(selectRealtimeGameState, (state) => state.gameEnded);
export const selectGameStarted = createSelector(
  selectRealtimeGameState,
  (state) => state.gameStarted,
);
export const selectLastPlayerShot = createSelector(
  selectRealtimeGameState,
  (state) => state.lastPlayerShot,
);
