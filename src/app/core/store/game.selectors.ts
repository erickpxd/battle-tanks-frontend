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
export const selectLastChatMessage = createSelector(
  selectRealtimeGameState,
  (state) => state.lastChatMessage,
);
export const selectLastMapTileChange = createSelector(
  selectRealtimeGameState,
  (state) => state.lastMapTileChange,
);
