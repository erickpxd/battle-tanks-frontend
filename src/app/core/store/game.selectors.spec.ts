import { ChatMessage } from '../models/chat-message.model';
import { Player } from '../models/player.model';
import { initialRealtimeGameState, RealtimeGameState } from './game.reducer';
import { selectChatMessages, selectPlayers } from './game.selectors';

describe('game selectors', () => {
  it('should return the updated players and chat history', () => {
    const player: Player = {
      id: 'player-1',
      name: 'Ana',
      position: { x: 2, y: 3, direction: 'down' },
    };
    const message: ChatMessage = {
      id: 'message-1',
      playerName: 'Ana',
      message: 'Pronta!',
      timestamp: new Date().toISOString(),
    };
    const state: RealtimeGameState = {
      ...initialRealtimeGameState,
      players: [player],
      chatMessages: [message],
    };

    expect(selectPlayers.projector(state)).toEqual([player]);
    expect(selectChatMessages.projector(state)).toEqual([message]);
  });
});
