import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, distinctUntilChanged } from 'rxjs';
import { webSocket, WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';

import { GAME_CONFIG } from '../config/game.config';
import { ChatMessage } from '../models/chat-message.model';
import {
  ChatSendEvent,
  GameEventType,
  GameSocketEvent,
  PlayerJoinEvent,
} from '../models/game-event.model';
import { GameState } from '../models/game-state.model';
import { MapTileChange } from '../models/map-tile-change.model';
import { Player } from '../models/player.model';
import { PlayerDirection, Position } from '../models/position.model';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const GAME_EVENT_TYPES: ReadonlySet<GameEventType> = new Set([
  'connection:success',
  'player:join',
  'player:joined',
  'player:left',
  'player:list',
  'player:move',
  'map:tile-destroyed',
  'chat:send',
  'chat:message',
  'game:state',
  'error',
]);

const PLAYER_DIRECTIONS: ReadonlySet<PlayerDirection> = new Set(['up', 'down', 'left', 'right']);

@Injectable({
  providedIn: 'root',
})
export class GameService implements OnDestroy {
  private socket?: WebSocketSubject<unknown>;
  private socketSubscription?: Subscription;
  private pendingPlayerName: string | null = null;
  private joinedPlayerName: string | null = null;

  private readonly connectionStatusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
  private readonly errorMessageSubject = new BehaviorSubject<string | null>(null);
  private readonly playersSubject = new BehaviorSubject<Player[]>([]);
  private readonly playerMoveSubject = new Subject<Player>();
  private readonly mapTileDestroyedSubject = new Subject<MapTileChange>();
  private readonly chatMessageSubject = new Subject<ChatMessage>();
  private readonly gameStateSubject = new Subject<GameState>();
  private readonly localPlayerIdSubject = new BehaviorSubject<string | null>(null);

  readonly connectionStatus$: Observable<ConnectionStatus> = this.connectionStatusSubject
    .asObservable()
    .pipe(distinctUntilChanged());
  readonly errorMessage$ = this.errorMessageSubject.asObservable();
  readonly localPlayerId$ = this.localPlayerIdSubject.asObservable().pipe(distinctUntilChanged());

  connect(): void {
    const status = this.connectionStatusSubject.value;
    if (this.socket && (status === 'connecting' || status === 'connected')) {
      return;
    }

    this.errorMessageSubject.next(null);
    this.connectionStatusSubject.next('connecting');

    let socket: WebSocketSubject<unknown>;
    const config: WebSocketSubjectConfig<unknown> = {
      url: GAME_CONFIG.websocketUrl,
      openObserver: {
        next: () => {
          if (this.socket !== socket) {
            return;
          }
          this.connectionStatusSubject.next('connected');
          this.sendPendingPlayerJoin();
        },
      },
      closeObserver: {
        next: () => {
          if (this.socket === socket && this.connectionStatusSubject.value !== 'error') {
            this.connectionStatusSubject.next('disconnected');
          }
        },
      },
    };

    try {
      socket = this.createSocket(config);
      this.socket = socket;
      this.socketSubscription = socket.subscribe({
        next: (message) => this.handleIncomingMessage(message),
        error: () => {
          if (this.socket !== socket) {
            return;
          }
          this.errorMessageSubject.next(
            'Não foi possível conectar ao servidor do jogo. Verifique se o WebSocket está disponível.',
          );
          this.connectionStatusSubject.next('error');
          this.releaseSocket(socket);
        },
        complete: () => {
          if (this.socket !== socket) {
            return;
          }
          if (this.connectionStatusSubject.value !== 'error') {
            this.connectionStatusSubject.next('disconnected');
          }
          this.releaseSocket(socket);
        },
      });
    } catch {
      this.socket = undefined;
      this.socketSubscription = undefined;
      this.errorMessageSubject.next('Não foi possível iniciar a conexão com o servidor do jogo.');
      this.connectionStatusSubject.next('error');
    }
  }

  disconnect(): void {
    const socket = this.socket;
    const subscription = this.socketSubscription;
    this.socket = undefined;
    this.socketSubscription = undefined;
    this.pendingPlayerName = null;
    this.joinedPlayerName = null;

    if (socket) {
      socket.complete();
    }
    subscription?.unsubscribe();
    this.connectionStatusSubject.next('disconnected');
    this.errorMessageSubject.next(null);
  }

  onPlayerMove(callback: (player: Player) => void): Subscription {
    return this.playerMoveSubject.subscribe(callback);
  }

  sendPlayerMove(position: Position): void {
    if (!isPosition(position)) {
      return;
    }
    this.send({ type: 'player:move', payload: { ...position } });
  }

  sendMapTileDestroyed(change: MapTileChange): void {
    if (!isMapTileChange(change)) {
      return;
    }
    this.send({ type: 'map:tile-destroyed', payload: { ...change } });
  }

  onMapTileDestroyed(callback: (change: MapTileChange) => void): Subscription {
    return this.mapTileDestroyedSubject.subscribe(callback);
  }

  joinRoom(playerName: string): void {
    const name = normalizeText(playerName);
    if (!name || (name === this.joinedPlayerName && this.connectionStatusSubject.value === 'connected')) {
      return;
    }

    this.pendingPlayerName = name;
    this.sendPendingPlayerJoin();
  }

  onPlayersUpdated(callback: (players: Player[]) => void): Subscription {
    return this.playersSubject.subscribe(callback);
  }

  sendChatMessage(message: string): void {
    const normalizedMessage = message.trim().slice(0, 250);
    if (!normalizedMessage) {
      return;
    }

    const event: ChatSendEvent = {
      type: 'chat:send',
      payload: { message: normalizedMessage },
    };
    this.send(event);
  }

  onChatMessage(callback: (message: ChatMessage) => void): Subscription {
    return this.chatMessageSubject.subscribe(callback);
  }

  onGameState(callback: (state: GameState) => void): Subscription {
    return this.gameStateSubject.subscribe(callback);
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.connectionStatusSubject.complete();
    this.errorMessageSubject.complete();
    this.playersSubject.complete();
    this.playerMoveSubject.complete();
    this.mapTileDestroyedSubject.complete();
    this.chatMessageSubject.complete();
    this.gameStateSubject.complete();
    this.localPlayerIdSubject.complete();
  }

  protected createSocket(config: WebSocketSubjectConfig<unknown>): WebSocketSubject<unknown> {
    return webSocket(config);
  }

  private sendPendingPlayerJoin(): void {
    if (!this.pendingPlayerName || this.connectionStatusSubject.value !== 'connected') {
      return;
    }

    const event: PlayerJoinEvent = {
      type: 'player:join',
      payload: { name: this.pendingPlayerName },
    };
    if (this.send(event)) {
      this.joinedPlayerName = this.pendingPlayerName;
      this.pendingPlayerName = null;
    }
  }

  private send(event: GameSocketEvent): boolean {
    if (!this.socket || this.connectionStatusSubject.value !== 'connected') {
      return false;
    }

    try {
      this.socket.next(event);
      return true;
    } catch {
      this.errorMessageSubject.next('Não foi possível enviar a mensagem ao servidor.');
      this.connectionStatusSubject.next('error');
      return false;
    }
  }

  private handleIncomingMessage(message: unknown): void {
    if (!isGameSocketEvent(message)) {
      return;
    }

    switch (message.type) {
      case 'connection:success':
        this.updateLocalPlayerId(message.payload);
        break;
      case 'player:joined': {
        if (!isPlayer(message.payload)) {
          return;
        }
        const joinedPlayer = message.payload;
        const players = this.playersSubject.value.filter((player) => player.id !== joinedPlayer.id);
        this.playersSubject.next([...players, joinedPlayer]);
        break;
      }
      case 'player:left': {
        const playerId = readPlayerId(message.payload);
        if (playerId) {
          this.playersSubject.next(
            this.playersSubject.value.filter((player) => player.id !== playerId),
          );
        }
        break;
      }
      case 'player:list': {
        const players = readPlayerList(message.payload);
        if (players) {
          this.playersSubject.next(players);
        }
        break;
      }
      case 'player:move':
        if (isPlayer(message.payload)) {
          this.playerMoveSubject.next(message.payload);
          this.upsertPlayer(message.payload);
        }
        break;
      case 'map:tile-destroyed':
        if (isMapTileChange(message.payload)) {
          this.mapTileDestroyedSubject.next(message.payload);
        }
        break;
      case 'chat:message':
        if (isChatMessage(message.payload)) {
          this.chatMessageSubject.next(message.payload);
        }
        break;
      case 'game:state':
        if (isGameState(message.payload)) {
          this.playersSubject.next(message.payload.players);
          this.gameStateSubject.next(message.payload);
        }
        break;
      case 'error':
        this.errorMessageSubject.next(readErrorMessage(message.payload));
        break;
      default:
        break;
    }
  }

  private updateLocalPlayerId(payload: unknown): void {
    const playerId = readPlayerId(payload);
    if (playerId) {
      this.localPlayerIdSubject.next(playerId);
    }
  }

  private upsertPlayer(updatedPlayer: Player): void {
    const players = this.playersSubject.value;
    const playerIndex = players.findIndex((player) => player.id === updatedPlayer.id);
    if (playerIndex < 0) {
      this.playersSubject.next([...players, updatedPlayer]);
      return;
    }

    const nextPlayers = [...players];
    nextPlayers[playerIndex] = updatedPlayer;
    this.playersSubject.next(nextPlayers);
  }

  private releaseSocket(socket: WebSocketSubject<unknown>): void {
    if (this.socket !== socket) {
      return;
    }
    this.socket = undefined;
    this.socketSubscription = undefined;
    this.joinedPlayerName = null;
  }
}

function isGameSocketEvent(value: unknown): value is GameSocketEvent {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'payload')) {
    return false;
  }
  return typeof value['type'] === 'string' && GAME_EVENT_TYPES.has(value['type'] as GameEventType);
}

function isPosition(value: unknown): value is Position {
  return (
    isRecord(value) &&
    typeof value['x'] === 'number' &&
    Number.isFinite(value['x']) &&
    typeof value['y'] === 'number' &&
    Number.isFinite(value['y']) &&
    typeof value['direction'] === 'string' &&
    PLAYER_DIRECTIONS.has(value['direction'] as PlayerDirection)
  );
}

function isMapTileChange(value: unknown): value is MapTileChange {
  return (
    isRecord(value) &&
    Number.isInteger(value['column']) &&
    (value['column'] as number) >= 0 &&
    Number.isInteger(value['row']) &&
    (value['row'] as number) >= 0
  );
}

function isPlayer(value: unknown): value is Player {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    value['id'].length > 0 &&
    typeof value['name'] === 'string' &&
    value['name'].length > 0 &&
    isPosition(value['position'])
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value['playerName'] === 'string' &&
    typeof value['message'] === 'string' &&
    typeof value['timestamp'] === 'string' &&
    (value['id'] === undefined || typeof value['id'] === 'string') &&
    (value['playerId'] === undefined || typeof value['playerId'] === 'string')
  );
}

function isGameState(value: unknown): value is GameState {
  return isRecord(value) && Array.isArray(value['players']) && value['players'].every(isPlayer);
}

function readPlayerList(payload: unknown): Player[] | null {
  if (Array.isArray(payload) && payload.every(isPlayer)) {
    return payload;
  }
  if (isGameState(payload)) {
    return payload.players;
  }
  return null;
}

function readPlayerId(payload: unknown): string | null {
  if (isRecord(payload) && typeof payload['id'] === 'string' && payload['id']) {
    return payload['id'];
  }
  if (isRecord(payload) && typeof payload['playerId'] === 'string' && payload['playerId']) {
    return payload['playerId'];
  }
  return null;
}

function readErrorMessage(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }
  if (isRecord(payload) && typeof payload['message'] === 'string' && payload['message'].trim()) {
    return payload['message'].trim();
  }
  return 'O servidor informou um erro não detalhado.';
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
