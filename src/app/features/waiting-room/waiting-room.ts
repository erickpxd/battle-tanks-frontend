import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { ChatMessage } from '../../core/models/chat-message.model';
import { MqttConnectionStatus } from '../../core/models/mqtt-game-event.model';
import { Player } from '../../core/models/player.model';
import { ConnectionStatus, GameService } from '../../core/services/game.service';
import { SoundEffectsService } from '../../core/services/sound-effects.service';
import { getMapDefinition } from '../game/map/map-catalog';
import {
  selectChatMessages,
  selectConnectionError,
  selectConnectionStatus,
  selectGameStarted,
  selectLocalPlayerId,
  selectMqttConnectionStatus,
  selectPlayers,
} from '../../core/store/game.selectors';

@Component({
  selector: 'app-waiting-room',
  imports: [CommonModule, FormsModule],
  templateUrl: './waiting-room.html',
  styleUrl: './waiting-room.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingRoom implements OnInit, OnDestroy {
  @ViewChild('chatHistory') private chatHistory?: ElementRef<HTMLElement>;

  chatText = '';
  connectionError: string | null = null;
  connectionStatus: ConnectionStatus = 'disconnected';
  mqttConnectionStatus: MqttConnectionStatus = 'disconnected';
  players: Player[] = [];
  messages: ChatMessage[] = [];
  savedPlayerName = '';
  savedRoomCode = '';
  selectedMap = '';
  localPlayerId: string | null = null;

  private readonly subscriptions = new Subscription();
  private destroyed = false;

  constructor(
    private readonly gameService: GameService,
    private readonly soundEffects: SoundEffectsService,
    private readonly router: Router,
    private readonly store: Store,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.savedPlayerName =
      localStorage.getItem(GAME_CONFIG.accountNameStorageKey) ??
      sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ??
      '';
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, this.savedPlayerName);
    this.savedRoomCode = sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey) ?? '';
    this.selectedMap = getMapDefinition(sessionStorage.getItem(GAME_CONFIG.mapStorageKey)).name;
    if (!normalizeName(this.savedPlayerName) || !this.savedRoomCode.trim()) {
      void this.router.navigate(['/menu']);
      return;
    }

    this.subscriptions.add(
      this.store.select(selectConnectionStatus).subscribe((status) => {
        this.connectionStatus = status;
        this.changeDetectorRef.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.store.select(selectMqttConnectionStatus).subscribe((status) => {
        this.mqttConnectionStatus = status;
        this.changeDetectorRef.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.store.select(selectConnectionError).subscribe((message) => {
        this.connectionError = message;
        this.changeDetectorRef.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.store.select(selectPlayers).subscribe((players) => {
        this.players = [...players];
        this.changeDetectorRef.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.store.select(selectLocalPlayerId).subscribe((playerId) => {
        this.localPlayerId = playerId;
        this.changeDetectorRef.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.store.select(selectGameStarted).subscribe((started) => {
        if (started) {
          void this.router.navigate(['/game']);
        }
      }),
    );
    this.subscriptions.add(
      this.store.select(selectChatMessages).subscribe((messages) => {
        this.messages = [...messages];
        this.changeDetectorRef.markForCheck();
        queueMicrotask(() => this.scrollChatToEnd());
      }),
    );

    this.gameService.joinRoom(this.savedPlayerName);
    this.gameService.connect();
  }

  retryConnection(): void {
    if (this.savedPlayerName) {
      this.gameService.joinRoom(this.savedPlayerName);
    }
    this.gameService.connect();
  }

  sendChat(): void {
    const message = this.chatText.trim().slice(0, 250);
    if (!message || this.connectionStatus !== 'connected') {
      return;
    }

    this.gameService.sendChatMessage(message);
    this.chatText = '';
  }

  toggleReady(): void {
    if (this.connectionStatus !== 'connected') {
      return;
    }
    this.soundEffects.unlock();
    this.gameService.setPlayerReady(!this.isLocalPlayerReady());
  }

  isLocalPlayerReady(): boolean {
    return this.players.find((player) => player.id === this.localPlayerId)?.ready ?? false;
  }

  leaveRoom(): void {
    this.gameService.disconnect();
    sessionStorage.removeItem(GAME_CONFIG.roomCodeStorageKey);
    sessionStorage.removeItem(GAME_CONFIG.mapStorageKey);
    sessionStorage.removeItem(GAME_CONFIG.gameStartedStorageKey);
    void this.router.navigate(['/menu']);
  }

  connectionLabel(): string {
    const labels: Record<ConnectionStatus, string> = {
      disconnected: 'Desconectado',
      connecting: 'Conectando…',
      connected: 'Conectado',
      error: 'Erro de conexão',
    };
    return labels[this.connectionStatus];
  }

  mqttConnectionLabel(): string {
    const labels: Record<MqttConnectionStatus, string> = {
      disconnected: 'MQTT desconectado',
      connecting: 'MQTT conectando…',
      connected: 'MQTT conectado',
      error: 'Erro MQTT',
    };
    return labels[this.mqttConnectionStatus];
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscriptions.unsubscribe();
  }

  private scrollChatToEnd(): void {
    if (this.destroyed || !this.chatHistory) {
      return;
    }
    const element = this.chatHistory.nativeElement;
    element.scrollTop = element.scrollHeight;
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
