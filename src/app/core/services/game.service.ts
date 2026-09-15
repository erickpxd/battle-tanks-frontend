import { inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { Store } from '@ngrx/store';
import { filter, map, Observable, Subscription } from 'rxjs';

import { GAME_CONFIG } from '../config/game.config';
import { ChatMessage } from '../models/chat-message.model';
import { ConnectionStatus } from '../models/connection-status.model';
import { GameState } from '../models/game-state.model';
import { MapTileChange } from '../models/map-tile-change.model';
import { GameEventEnvelope } from '../models/mqtt-game-event.model';
import { Player } from '../models/player.model';
import { Position } from '../models/position.model';
import {
  PlayerMoveRequest,
  PlayerHitRequest,
  RealtimeAck,
  RealtimeChatRequest,
  RealtimeMapTileChange,
} from '../models/realtime-event.model';
import { GameActions } from '../store/game.actions';
import {
  selectChatMessages,
  selectConnectionError,
  selectConnectionStatus,
  selectLastChatMessage,
  selectLastMapTileChange,
  selectLastPlayerHit,
  selectLastPlayerMove,
  selectLocalPlayerId,
  selectPlayers,
} from '../store/game.selectors';
import { AuthService } from './auth.service';
import { MqttGameService } from './mqtt-game.service';
import { RealtimeBenchmarkReport, RealtimeBenchmarkService } from './realtime-benchmark.service';

export type { ConnectionStatus } from '../models/connection-status.model';

export type RealtimeHubConnectionFactory = () => HubConnection;

export const REALTIME_HUB_CONNECTION_FACTORY = new InjectionToken<RealtimeHubConnectionFactory>(
  'REALTIME_HUB_CONNECTION_FACTORY',
  {
    providedIn: 'root',
    factory: () => {
      const authService = inject(AuthService);
      return () =>
        new HubConnectionBuilder()
          .withUrl(GAME_CONFIG.signalRHubUrl, {
            accessTokenFactory: () => authService.getToken() ?? '',
          })
          .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
          .configureLogging(LogLevel.Information)
          .build();
    },
  },
);

@Injectable({ providedIn: 'root' })
export class GameService implements OnDestroy {
  private readonly store = inject(Store);
  private readonly createConnection = inject(REALTIME_HUB_CONNECTION_FACTORY);
  private readonly benchmark = inject(RealtimeBenchmarkService);
  private readonly mqtt = inject(MqttGameService);

  private connection?: HubConnection;
  private pendingRoomCode: string | null = null;
  private joinedRoomCode: string | null = null;
  private joinPromise?: Promise<void>;

  readonly connectionStatus$: Observable<ConnectionStatus> =
    this.store.select(selectConnectionStatus);
  readonly errorMessage$ = this.store.select(selectConnectionError);
  readonly localPlayerId$ = this.store.select(selectLocalPlayerId);

  connect(): void {
    const connection = this.getOrCreateConnection();
    if (connection.state !== HubConnectionState.Disconnected) {
      return;
    }

    this.store.dispatch(GameActions.connectionErrorChanged({ message: null }));
    this.store.dispatch(GameActions.connectionStatusChanged({ status: 'connecting' }));
    void connection
      .start()
      .then(async () => {
        this.store.dispatch(GameActions.connectionStatusChanged({ status: 'connected' }));
        await this.joinPendingRoom();
      })
      .catch((error: unknown) => this.handleConnectionError(error));
  }

  disconnect(): void {
    this.pendingRoomCode = null;
    this.joinedRoomCode = null;
    this.joinPromise = undefined;
    this.mqtt.leaveRoom();
    const stop =
      this.connection?.state === HubConnectionState.Disconnected
        ? Promise.resolve()
        : this.connection?.stop();
    if (!stop) {
      this.store.dispatch(GameActions.realtimeStateReset());
      return;
    }
    void stop?.finally(() => {
      this.store.dispatch(GameActions.realtimeStateReset());
    });
  }

  joinRoom(_playerName: string): void {
    const roomCode = sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey)?.trim().toUpperCase();
    if (!roomCode) {
      this.store.dispatch(
        GameActions.connectionErrorChanged({ message: 'Nenhum código de sala foi informado.' }),
      );
      return;
    }

    this.pendingRoomCode = roomCode;
    void this.joinPendingRoom();
  }

  sendPlayerMove(position: Position): void {
    const request: PlayerMoveRequest = {
      ...position,
      ...createRealtimeMetadata(),
    };
    this.store.dispatch(GameActions.localPlayerMoved({ position }));
    this.invokeWithBenchmark('MovePlayer', request);
  }

  sendMapTileDestroyed(change: MapTileChange): void {
    // Expanded map is 20x15 * subdivision 3 = 60x45 (must match GameHub).
    if (
      !Number.isInteger(change.column) ||
      !Number.isInteger(change.row) ||
      change.column < 0 ||
      change.column >= 60 ||
      change.row < 0 ||
      change.row >= 45
    ) {
      return;
    }

    const request: RealtimeMapTileChange = {
      ...change,
      ...createRealtimeMetadata(),
    };
    this.invokeWithBenchmark('DestroyMapTile', request);
  }

  sendPlayerHit(targetPlayerId: string, damage: number): void {
    if (!targetPlayerId || !Number.isInteger(damage) || damage <= 0) {
      return;
    }

    const request: PlayerHitRequest = {
      targetPlayerId,
      damage,
      ...createRealtimeMetadata(),
    };
    this.invokeWithBenchmark('HitPlayer', request);
  }

  sendChatMessage(message: string): void {
    const normalizedMessage = message.trim().slice(0, 250);
    if (!normalizedMessage) {
      return;
    }

    const request: RealtimeChatRequest = {
      message: normalizedMessage,
      ...createRealtimeMetadata(),
    };
    this.invokeWithBenchmark('SendChatMessage', request);
  }

  onPlayerMove(callback: (player: Player) => void): Subscription {
    return this.store
      .select(selectLastPlayerMove)
      .pipe(filter((player): player is Player => player !== null))
      .subscribe(callback);
  }

  onPlayerHit(callback: (player: Player) => void): Subscription {
    return this.store
      .select(selectLastPlayerHit)
      .pipe(filter((player): player is Player => player !== null))
      .subscribe(callback);
  }

  onPlayersUpdated(callback: (players: Player[]) => void): Subscription {
    return this.store.select(selectPlayers).subscribe((players) => callback([...players]));
  }

  onChatMessage(callback: (message: ChatMessage) => void): Subscription {
    return this.store
      .select(selectLastChatMessage)
      .pipe(filter((message): message is ChatMessage => message !== null))
      .subscribe(callback);
  }

  onChatMessagesUpdated(callback: (messages: ChatMessage[]) => void): Subscription {
    return this.store.select(selectChatMessages).subscribe((messages) => callback([...messages]));
  }

  onMapTileDestroyed(callback: (change: MapTileChange) => void): Subscription {
    return this.store
      .select(selectLastMapTileChange)
      .pipe(filter((change): change is MapTileChange => change !== null))
      .subscribe(callback);
  }

  onGameState(callback: (state: GameState) => void): Subscription {
    return this.store
      .select(selectPlayers)
      .pipe(map((players) => ({ players: [...players] })))
      .subscribe(callback);
  }

  getBenchmarkReport(): RealtimeBenchmarkReport {
    return this.benchmark.report();
  }

  resetBenchmark(): void {
    this.benchmark.reset();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private getOrCreateConnection(): HubConnection {
    if (this.connection) {
      return this.connection;
    }

    const connection = this.createConnection();
    connection.on('ReceiveLocalPlayerId', (playerId: string) => {
      this.store.dispatch(GameActions.localPlayerIdentified({ playerId }));
    });
    connection.on('ReceivePlayersUpdated', (players: Player[]) => {
      this.benchmark.recordReceived();
      this.store.dispatch(GameActions.playersUpdated({ players }));
    });
    connection.on('ReceivePlayerMove', (player: Player) => {
      this.benchmark.recordReceived();
      this.store.dispatch(GameActions.playerMoved({ player }));
    });
    connection.on('ReceivePlayerHit', (player: Player) => {
      this.benchmark.recordProtocolReceived(
        'SignalR',
        'collision.player-hit',
        player.eventId,
        player.clientSentAtUnixMs,
        this.joinedRoomCode ?? this.pendingRoomCode ?? '',
      );
      this.store.dispatch(GameActions.playerHit({ player }));
    });
    connection.on('ReceiveChatHistory', (messages: ChatMessage[]) => {
      this.store.dispatch(GameActions.chatHistoryReceived({ messages }));
    });
    connection.on('ReceiveChatMessage', (message: ChatMessage) => {
      this.benchmark.recordReceived();
      this.store.dispatch(GameActions.chatMessageReceived({ message }));
    });
    connection.on('ReceiveMapTileDestroyed', (change: RealtimeMapTileChange) => {
      this.benchmark.recordProtocolReceived(
        'SignalR',
        'map.tile-destroyed',
        change.eventId,
        change.clientSentAtUnixMs,
        this.joinedRoomCode ?? this.pendingRoomCode ?? '',
      );
      this.store.dispatch(GameActions.mapTileDestroyed({ change }));
    });
    connection.on('ReceiveGameEventHistory', (gameEvents: GameEventEnvelope[]) => {
      this.store.dispatch(GameActions.gameEventHistoryReceived({ gameEvents }));
    });
    connection.onreconnecting(() => {
      this.store.dispatch(GameActions.connectionStatusChanged({ status: 'connecting' }));
    });
    connection.onreconnected(() => {
      this.joinedRoomCode = null;
      this.store.dispatch(GameActions.connectionStatusChanged({ status: 'connected' }));
      void this.joinPendingRoom();
    });
    connection.onclose((error) => {
      this.joinedRoomCode = null;
      this.store.dispatch(GameActions.connectionStatusChanged({ status: 'disconnected' }));
      if (error) {
        this.store.dispatch(GameActions.connectionErrorChanged({ message: readableError(error) }));
      }
    });

    this.connection = connection;
    return connection;
  }

  private async joinPendingRoom(): Promise<void> {
    const connection = this.connection;
    const roomCode = this.pendingRoomCode;
    if (
      !connection ||
      connection.state !== HubConnectionState.Connected ||
      !roomCode ||
      roomCode === this.joinedRoomCode
    ) {
      return;
    }

    if (!this.joinPromise) {
      this.joinPromise = connection
        .invoke<void>('JoinRoom', roomCode)
        .then(() => {
          this.joinedRoomCode = roomCode;
          this.mqtt.joinRoom(roomCode);
        })
        .catch((error: unknown) => this.handleConnectionError(error))
        .finally(() => {
          this.joinPromise = undefined;
        });
    }
    await this.joinPromise;
  }

  private invokeWithBenchmark(
    methodName: 'MovePlayer' | 'HitPlayer' | 'SendChatMessage' | 'DestroyMapTile',
    request: PlayerMoveRequest | PlayerHitRequest | RealtimeChatRequest | RealtimeMapTileChange,
  ): void {
    if (this.connection?.state !== HubConnectionState.Connected || !this.joinedRoomCode) {
      return;
    }

    this.benchmark.recordSent(request.eventId);
    void this.connection
      .invoke<RealtimeAck>(methodName, request)
      .then((ack) => this.benchmark.recordAcknowledged(ack.eventId))
      .catch((error: unknown) => {
        // Gameplay validation errors should not look like a dropped connection.
        if (methodName === 'DestroyMapTile') {
          console.warn(`DestroyMapTile rejected: ${readableError(error)}`);
          return;
        }
        this.store.dispatch(GameActions.connectionErrorChanged({ message: readableError(error) }));
      });
  }

  private handleConnectionError(error: unknown): void {
    this.store.dispatch(GameActions.connectionStatusChanged({ status: 'error' }));
    this.store.dispatch(GameActions.connectionErrorChanged({ message: readableError(error) }));
  }
}

function createRealtimeMetadata(): { eventId: string; clientSentAtUnixMs: number } {
  return {
    eventId:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    clientSentAtUnixMs: Date.now(),
  };
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Não foi possível comunicar com o servidor multiplayer.';
}
