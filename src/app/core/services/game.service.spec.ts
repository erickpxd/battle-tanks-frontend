import { TestBed } from '@angular/core/testing';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';
import { provideStore } from '@ngrx/store';

import { GAME_CONFIG } from '../config/game.config';
import { Player } from '../models/player.model';
import { gameFeatureKey, gameReducer } from '../store/game.reducer';
import {
  GameService,
  REALTIME_HUB_CONNECTION_FACTORY,
  RealtimeHubConnectionFactory,
} from './game.service';

class FakeHubConnection {
  state = HubConnectionState.Disconnected;
  readonly invocations: Array<{ methodName: string; args: unknown[] }> = [];
  private readonly handlers = new Map<string, Array<(...args: any[]) => void>>();
  private closeHandler?: (error?: Error) => void;
  private reconnectingHandler?: (error?: Error) => void;
  private reconnectedHandler?: (connectionId?: string) => void;

  async start(): Promise<void> {
    this.state = HubConnectionState.Connected;
  }

  async stop(): Promise<void> {
    this.state = HubConnectionState.Disconnected;
    this.closeHandler?.();
  }

  async invoke<T>(methodName: string, ...args: unknown[]): Promise<T> {
    this.invocations.push({ methodName, args });
    const request = args[0] as { eventId?: string; clientSentAtUnixMs?: number } | undefined;
    return {
      eventId: request?.eventId ?? '',
      clientSentAtUnixMs: request?.clientSentAtUnixMs ?? 0,
      serverReceivedAt: new Date().toISOString(),
    } as T;
  }

  on(methodName: string, callback: (...args: any[]) => void): void {
    const callbacks = this.handlers.get(methodName) ?? [];
    callbacks.push(callback);
    this.handlers.set(methodName, callbacks);
  }

  onclose(callback: (error?: Error) => void): void {
    this.closeHandler = callback;
  }

  onreconnecting(callback: (error?: Error) => void): void {
    this.reconnectingHandler = callback;
  }

  onreconnected(callback: (connectionId?: string) => void): void {
    this.reconnectedHandler = callback;
  }

  emit(methodName: string, payload: unknown): void {
    for (const callback of this.handlers.get(methodName) ?? []) {
      callback(payload);
    }
  }

  handlerCount(methodName: string): number {
    return this.handlers.get(methodName)?.length ?? 0;
  }

  reconnect(): void {
    this.reconnectingHandler?.();
    this.state = HubConnectionState.Connected;
    this.reconnectedHandler?.('connection-2');
  }
}

describe('GameService', () => {
  let service: GameService;
  let connection: FakeHubConnection;

  beforeEach(() => {
    sessionStorage.clear();
    connection = new FakeHubConnection();
    const connectionFactory: RealtimeHubConnectionFactory = () =>
      connection as unknown as HubConnection;

    TestBed.configureTestingModule({
      providers: [
        provideStore({ [gameFeatureKey]: gameReducer }),
        { provide: REALTIME_HUB_CONNECTION_FACTORY, useValue: connectionFactory },
      ],
    });
    service = TestBed.inject(GameService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should connect once and join the saved room', async () => {
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'tank-1234');
    service.joinRoom('Erick');

    service.connect();
    service.connect();
    await vi.waitFor(() => {
      expect(connection.invocations).toContainEqual({
        methodName: 'JoinRoom',
        args: ['TANK-1234'],
      });
    });

    expect(connection.state).toBe(HubConnectionState.Connected);
  });

  it('should send movement and chat through hub invocations', async () => {
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'TANK-1234');
    service.joinRoom('Erick');
    service.connect();
    await vi.waitFor(() =>
      expect(connection.invocations.some(({ methodName }) => methodName === 'JoinRoom')).toBe(true),
    );

    service.sendPlayerMove({ x: 8, y: 6, direction: 'right' });
    service.sendPlayerHit('target-player', 25);
    service.sendChatMessage('  Olá, tanque!  ');

    expect(
      connection.invocations.find(({ methodName }) => methodName === 'MovePlayer')?.args[0],
    ).toEqual(expect.objectContaining({ x: 8, y: 6, direction: 'right' }));
    expect(
      connection.invocations.find(({ methodName }) => methodName === 'HitPlayer')?.args[0],
    ).toEqual(expect.objectContaining({ targetPlayerId: 'target-player', damage: 25 }));
    expect(
      connection.invocations.find(({ methodName }) => methodName === 'SendChatMessage')?.args[0],
    ).toEqual(expect.objectContaining({ message: 'Olá, tanque!' }));
  });

  it('should expose received movements only after the SignalR handler dispatches them', () => {
    const received: Player[] = [];
    service.onPlayerMove((player) => received.push(player));
    service.connect();
    const player: Player = {
      id: 'remote-player',
      name: 'Ana',
      position: { x: 4, y: 3, direction: 'left' },
    };

    connection.emit('ReceivePlayerMove', player);

    expect(received).toEqual([player]);
  });

  it('should not duplicate event handlers during automatic reconnection', async () => {
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'TANK-1234');
    service.joinRoom('Erick');
    service.connect();
    await vi.waitFor(() => {
      const joins = connection.invocations.filter(({ methodName }) => methodName === 'JoinRoom');
      expect(joins).toHaveLength(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    connection.reconnect();
    await vi.waitFor(() => {
      const joins = connection.invocations.filter(({ methodName }) => methodName === 'JoinRoom');
      expect(joins).toHaveLength(2);
    });

    expect(connection.handlerCount('ReceivePlayerMove')).toBe(1);
    expect(connection.handlerCount('ReceivePlayerHit')).toBe(1);
    expect(connection.handlerCount('ReceiveChatMessage')).toBe(1);
  });
});
