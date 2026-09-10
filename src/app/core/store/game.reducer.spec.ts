import { ChatMessage } from '../models/chat-message.model';
import { Player } from '../models/player.model';
import { GameActions } from './game.actions';
import { gameReducer, initialRealtimeGameState } from './game.reducer';

describe('gameReducer', () => {
  const originalPlayer: Player = {
    id: 'player-1',
    name: 'Ana',
    position: { x: 1, y: 1, direction: 'down' },
  };

  it('should update a player after a realtime movement event', () => {
    const initialState = { ...initialRealtimeGameState, players: [originalPlayer] };
    const movedPlayer: Player = {
      ...originalPlayer,
      position: { x: 2, y: 1, direction: 'right' },
    };

    const state = gameReducer(initialState, GameActions.playerMoved({ player: movedPlayer }));

    expect(state.players).toEqual([movedPlayer]);
    expect(state.lastPlayerMove).toEqual(movedPlayer);
  });

  it('should append a server-confirmed chat message once', () => {
    const message: ChatMessage = {
      id: 'message-1',
      playerId: 'player-1',
      playerName: 'Ana',
      message: 'Olá!',
      timestamp: new Date().toISOString(),
    };

    const firstState = gameReducer(
      initialRealtimeGameState,
      GameActions.chatMessageReceived({ message }),
    );
    const duplicateState = gameReducer(firstState, GameActions.chatMessageReceived({ message }));

    expect(duplicateState.chatMessages).toEqual([message]);
  });
});
