import { ChatMessage } from '../models/chat-message.model';
import { Player } from '../models/player.model';
import { GameEventEnvelope } from '../models/mqtt-game-event.model';
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

  it('should update the target player after a confirmed hit', () => {
    const initialState = { ...initialRealtimeGameState, players: [originalPlayer] };
    const hitPlayer: Player = {
      ...originalPlayer,
      health: 75,
      maxHealth: 100,
      status: 'active',
    };

    const state = gameReducer(initialState, GameActions.playerHit({ player: hitPlayer }));

    expect(state.players).toEqual([hitPlayer]);
    expect(state.lastPlayerHit).toEqual(hitPlayer);
  });

  it('should restore history and ignore a duplicate live MQTT delivery', () => {
    const gameEvent: GameEventEnvelope = {
      eventId: 'mqtt-event-1',
      eventType: 'collision.player-hit',
      roomId: 'ROOM-ONE',
      playerId: 'player-1',
      sentAtUnixMs: 1000,
      publishedAtUnixMs: 1010,
      data: { targetPlayerId: 'player-2', damage: 25, remainingHealth: 75, status: 'active' },
    };

    const restored = gameReducer(
      initialRealtimeGameState,
      GameActions.gameEventHistoryReceived({ gameEvents: [gameEvent] }),
    );
    const duplicate = gameReducer(restored, GameActions.mqttGameEventReceived({ gameEvent }));

    expect(duplicate.gameEvents).toEqual([gameEvent]);
    expect(duplicate.processedGameEventIds).toEqual(['mqtt-event-1']);
    expect(duplicate.lastGameEvent).toEqual(gameEvent);
  });

  it('should expose a game-ended MQTT event in state', () => {
    const gameEvent: GameEventEnvelope = {
      eventId: 'game-ended-1',
      eventType: 'game.ended',
      roomId: 'ROOM-ONE',
      playerId: 'player-1',
      sentAtUnixMs: 1000,
      publishedAtUnixMs: 1010,
      data: {
        defeatedPlayerId: 'player-2',
        winnerPlayerId: 'player-1',
        triggerEventId: 'hit-1',
      },
    };

    const state = gameReducer(
      initialRealtimeGameState,
      GameActions.mqttGameEventReceived({ gameEvent }),
    );

    expect(state.gameEnded).toEqual(gameEvent);
  });

  it('should replace the synchronized power-ups', () => {
    const powerUps = [
      {
        id: 'power-up-1',
        type: 'shield' as const,
        x: 10,
        y: 7,
        expiresAt: new Date().toISOString(),
      },
    ];

    const state = gameReducer(initialRealtimeGameState, GameActions.powerUpsUpdated({ powerUps }));

    expect(state.powerUps).toEqual(powerUps);
  });
});
