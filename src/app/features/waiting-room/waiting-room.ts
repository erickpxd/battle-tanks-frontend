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
import { RoomModel } from '../../core/models/room.model';
import { ConnectionStatus, GameService } from '../../core/services/game.service';
import { RoomApiService } from '../../core/services/room-api.service';
import { getMapDefinition } from '../game/map/map-catalog';
import {
  selectChatMessages,
  selectConnectionError,
  selectConnectionStatus,
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
  availableRooms: RoomModel[] = [];
  savedPlayerName = '';
  savedRoomCode = '';
  selectedMap = '';

  private readonly subscriptions = new Subscription();
  private destroyed = false;
  private roomsIntervalId?: any;

  constructor(
    private readonly gameService: GameService,
    private readonly roomApiService: RoomApiService,
    private readonly router: Router,
    private readonly store: Store,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.savedPlayerName = sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ?? '';
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
        this.fetchRoomsFromApi();
      }),
    );
    this.subscriptions.add(
      this.store.select(selectChatMessages).subscribe((messages) => {
        this.messages = [...messages];
        this.changeDetectorRef.markForCheck();
        queueMicrotask(() => this.scrollChatToEnd());
      }),
    );

    this.roomsIntervalId = setInterval(() => this.fetchRoomsFromApi(), 3000);

    this.gameService.joinRoom(this.savedPlayerName);
    this.gameService.connect();
  }

  fetchRoomsFromApi(): void {
    this.roomApiService.getRooms().subscribe({
      next: (rooms) => {
        this.availableRooms = rooms;
        const currentRoom = rooms.find((room) => room.roomCode === this.savedRoomCode);
        if (currentRoom) {
          this.selectedMap = getMapDefinition(currentRoom.mapSelected).name;
          sessionStorage.setItem(
            GAME_CONFIG.mapStorageKey,
            getMapDefinition(currentRoom.mapSelected).id,
          );
        }
        this.changeDetectorRef.markForCheck();
      },
      error: () => {
        // Non-blocking for room display
      },
    });
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

  openGame(): void {
    if (this.connectionStatus !== 'connected') {
      return;
    }
    void this.router.navigate(['/game']);
  }

  leaveRoom(): void {
    this.gameService.disconnect();
    sessionStorage.removeItem(GAME_CONFIG.playerNameStorageKey);
    sessionStorage.removeItem(GAME_CONFIG.roomCodeStorageKey);
    sessionStorage.removeItem(GAME_CONFIG.mapStorageKey);
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
    if (this.roomsIntervalId) {
      clearInterval(this.roomsIntervalId);
    }
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
