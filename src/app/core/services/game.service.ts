import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, distinctUntilChanged } from 'rxjs';

import { GAME_CONFIG } from '../config/game.config';
import { ChatMessage } from '../models/chat-message.model';
import { GameState } from '../models/game-state.model';
import { MapTileChange } from '../models/map-tile-change.model';
import { Player } from '../models/player.model';
import { PlayerDirection, Position } from '../models/position.model';
import { AuthService } from './auth.service';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable({
  providedIn: 'root',
})
export class GameService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private pendingPlayerName: string | null = null;
  private joinedPlayerName: string | null = null;
  private pollingIntervalId?: any;

  private readonly connectionStatusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
  private readonly errorMessageSubject = new BehaviorSubject<string | null>(null);
  private readonly playersSubject = new BehaviorSubject<Player[]>([]);
  private readonly playerMoveSubject = new Subject<Player>();
  private readonly mapTileDestroyedSubject = new Subject<MapTileChange>();
  private readonly chatMessageSubject = new Subject<ChatMessage>();
  private readonly chatMessagesListSubject = new BehaviorSubject<ChatMessage[]>([]);
  private readonly gameStateSubject = new Subject<GameState>();
  private readonly localPlayerIdSubject = new BehaviorSubject<string | null>(null);

  readonly connectionStatus$: Observable<ConnectionStatus> = this.connectionStatusSubject
    .asObservable()
    .pipe(distinctUntilChanged());
  readonly errorMessage$ = this.errorMessageSubject.asObservable();
  readonly localPlayerId$ = this.localPlayerIdSubject.asObservable().pipe(distinctUntilChanged());

  connect(): void {
    const status = this.connectionStatusSubject.value;
    if (status === 'connecting' || status === 'connected') {
      return;
    }

    this.errorMessageSubject.next(null);
    this.connectionStatusSubject.next('connecting');

    // Simulação: Sem WebSocket, forçamos 'connected'
    setTimeout(() => {
      this.connectionStatusSubject.next('connected');
      this.sendPendingPlayerJoin();
      this.startChatPolling();
    }, 500);
  }

  disconnect(): void {
    this.stopChatPolling();
    this.pendingPlayerName = null;
    this.joinedPlayerName = null;

    this.connectionStatusSubject.next('disconnected');
    this.errorMessageSubject.next(null);
  }

  onPlayerMove(callback: (player: Player) => void): Subscription {
    return this.playerMoveSubject.subscribe(callback);
  }

  sendPlayerMove(position: Position): void {}

  sendMapTileDestroyed(change: MapTileChange): void {}

  onMapTileDestroyed(callback: (change: MapTileChange) => void): Subscription {
    return this.mapTileDestroyedSubject.subscribe(callback);
  }

  joinRoom(playerName: string): void {
    const name = this.normalizeText(playerName);
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
    if (!normalizedMessage) return;

    const roomCode = sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey);
    if (!roomCode) return;

    this.http.post<ChatMessage>(
      `${GAME_CONFIG.apiUrl}/api/chat/${roomCode}`, 
      { message: normalizedMessage }, 
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: () => this.pollChat(),
      error: () => console.error('Failed to send chat')
    });
  }

  onChatMessage(callback: (message: ChatMessage) => void): Subscription {
    return this.chatMessageSubject.subscribe(callback);
  }

  onChatMessagesUpdated(callback: (messages: ChatMessage[]) => void): Subscription {
    return this.chatMessagesListSubject.subscribe(callback);
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
    this.chatMessagesListSubject.complete();
    this.gameStateSubject.complete();
    this.localPlayerIdSubject.complete();
  }

  private sendPendingPlayerJoin(): void {
    if (!this.pendingPlayerName || this.connectionStatusSubject.value !== 'connected') {
      return;
    }
    // Para a simulação, apenas assumimos que o join deu certo no frontend localmente
    this.joinedPlayerName = this.pendingPlayerName;
    this.pendingPlayerName = null;
    
    // Podemos também adicionar o próprio jogador à lista local para ele aparecer no lobby
    const localPlayer: Player = {
      id: 'local-mock-id',
      name: this.joinedPlayerName,
      position: { x: 0, y: 0, direction: 'up' }
    };
    this.playersSubject.next([localPlayer]);
  }

  private startChatPolling(): void {
    this.stopChatPolling();
    this.pollingIntervalId = setInterval(() => {
      this.pollChat();
    }, 2000);
    this.pollChat(); // call immediately
  }

  private stopChatPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = undefined;
    }
  }

  private pollChat(): void {
    const roomCode = sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey);
    if (!roomCode) return;

    this.http.get<ChatMessage[]>(`${GAME_CONFIG.apiUrl}/api/chat/${roomCode}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (messages) => {
        this.chatMessagesListSubject.next(messages);
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}
