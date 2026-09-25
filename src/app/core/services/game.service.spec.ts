import { Observable, Subject } from 'rxjs';
import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';

import { GameSocketEvent } from '../models/game-event.model';
import { Position } from '../models/position.model';
import { ConnectionStatus, GameService } from './game.service';

class MockSocket extends Observable<unknown> {
  readonly sent: unknown[] = [];
  completed = false;
  private readonly incoming = new Subject<unknown>();

  constructor() {
    super((subscriber) => this.incoming.subscribe(subscriber));
  }

  next(value: unknown): void {
    this.sent.push(value);
  }

  complete(): void {
    this.completed = true;
    this.incoming.complete();
  }
}

class TestGameService extends GameService {
  readonly mockSocket = new MockSocket();
  socketConfig?: WebSocketSubjectConfig<unknown>;

  openConnection(): void {
    this.socketConfig?.openObserver?.next(new Event('open'));
  }

  protected override createSocket(
    config: WebSocketSubjectConfig<unknown>,
  ): WebSocketSubject<unknown> {
    this.socketConfig = config;
    return this.mockSocket as unknown as WebSocketSubject<unknown>;
  }
}

describe('GameService', () => {
  let service: TestGameService;
  let statuses: ConnectionStatus[];

  beforeEach(() => {
    service = new TestGameService();
    statuses = [];
    service.connectionStatus$.subscribe((status) => statuses.push(status));
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should start disconnected and not send without a connection', () => {
    service.sendChatMessage('Olá');
    service.sendPlayerMove({ x: 10, y: 20, direction: 'right' });

    expect(statuses[0]).toBe('disconnected');
    expect(service.mockSocket.sent).toEqual([]);
  });

  it('should create one connection and update its status when opened', () => {
    service.connect();
    service.connect();

    expect(statuses).toEqual(['disconnected', 'connecting']);
    service.openConnection();
    expect(statuses.at(-1)).toBe('connected');
  });

  it('should create a trimmed player join event after the socket opens', () => {
    service.connect();
    service.joinRoom('  Erick   Silva  ');
    expect(service.mockSocket.sent).toEqual([]);

    service.openConnection();

    expect(service.mockSocket.sent).toContainEqual({
      type: 'player:join',
      payload: { name: 'Erick Silva' },
    } satisfies GameSocketEvent);
  });

  it('should create movement and trimmed chat events', () => {
    const position: Position = { x: 100, y: 80, direction: 'right' };
    service.connect();
    service.openConnection();

    service.sendPlayerMove(position);
    service.sendChatMessage('  Olá, tanque!  ');

    expect(service.mockSocket.sent).toContainEqual({ type: 'player:move', payload: position });
    expect(service.mockSocket.sent).toContainEqual({
      type: 'chat:send',
      payload: { message: 'Olá, tanque!' },
    });
  });

  it('should create a map destruction event', () => {
    service.connect();
    service.openConnection();

    service.sendMapTileDestroyed({ column: 12, row: 7 });

    expect(service.mockSocket.sent).toContainEqual({
      type: 'map:tile-destroyed',
      payload: { column: 12, row: 7 },
    });
  });

  it('should close the shared socket when disconnected', () => {
    service.connect();
    service.openConnection();

    service.disconnect();

    expect(service.mockSocket.completed).toBe(true);
    expect(statuses.at(-1)).toBe('disconnected');
  });
});
