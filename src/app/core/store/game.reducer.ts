import { createReducer, on } from '@ngrx/store';

import { ChatMessage } from '../models/chat-message.model';
import { ConnectionStatus } from '../models/connection-status.model';
import { MapTileChange } from '../models/map-tile-change.model';
import { Player } from '../models/player.model';
import { GameActions } from './game.actions';

export const gameFeatureKey = 'game';

export interface RealtimeGameState {
  readonly connectionStatus: ConnectionStatus;
  readonly connectionError: string | null;
  readonly localPlayerId: string | null;
  readonly players: readonly Player[];
  readonly chatMessages: readonly ChatMessage[];
  readonly lastPlayerMove: Player | null;
  readonly lastChatMessage: ChatMessage | null;
  readonly lastMapTileChange: MapTileChange | null;
}

export const initialRealtimeGameState: RealtimeGameState = {
  connectionStatus: 'disconnected',
  connectionError: null,
  localPlayerId: null,
  players: [],
  chatMessages: [],
  lastPlayerMove: null,
  lastChatMessage: null,
  lastMapTileChange: null,
};

export const gameReducer = createReducer(
  initialRealtimeGameState,
  on(GameActions.connectionStatusChanged, (state, { status }) => ({
    ...state,
    connectionStatus: status,
  })),
  on(GameActions.connectionErrorChanged, (state, { message }) => ({
    ...state,
    connectionError: message,
  })),
  on(GameActions.localPlayerIdentified, (state, { playerId }) => ({
    ...state,
    localPlayerId: playerId,
  })),
  on(GameActions.playersUpdated, (state, { players }) => ({
    ...state,
    players: [...players],
  })),
  on(GameActions.playerMoved, (state, { player }) => ({
    ...state,
    players: upsertPlayer(state.players, player),
    lastPlayerMove: player,
  })),
  on(GameActions.localPlayerMoved, (state, { position }) => {
    if (!state.localPlayerId) {
      return state;
    }

    const currentPlayer = state.players.find((player) => player.id === state.localPlayerId);
    if (!currentPlayer) {
      return state;
    }

    return {
      ...state,
      players: upsertPlayer(state.players, { ...currentPlayer, position }),
    };
  }),
  on(GameActions.chatHistoryReceived, (state, { messages }) => ({
    ...state,
    chatMessages: [...messages],
  })),
  on(GameActions.chatMessageReceived, (state, { message }) => ({
    ...state,
    chatMessages: appendUniqueMessage(state.chatMessages, message),
    lastChatMessage: message,
  })),
  on(GameActions.mapTileDestroyed, (state, { change }) => ({
    ...state,
    lastMapTileChange: change,
  })),
  on(GameActions.realtimeStateReset, () => initialRealtimeGameState),
);

function upsertPlayer(players: readonly Player[], updatedPlayer: Player): Player[] {
  const index = players.findIndex((player) => player.id === updatedPlayer.id);
  if (index < 0) {
    return [...players, updatedPlayer];
  }

  return players.map((player) => (player.id === updatedPlayer.id ? updatedPlayer : player));
}

function appendUniqueMessage(
  messages: readonly ChatMessage[],
  newMessage: ChatMessage,
): ChatMessage[] {
  const alreadyReceived = messages.some(
    (message) =>
      (newMessage.id && message.id === newMessage.id) ||
      (newMessage.eventId && message.eventId === newMessage.eventId),
  );
  return alreadyReceived ? [...messages] : [...messages, newMessage];
}
