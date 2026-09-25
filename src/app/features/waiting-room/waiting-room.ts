import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { ChatMessage } from '../../core/models/chat-message.model';
import { Player } from '../../core/models/player.model';
import { ConnectionStatus, GameService } from '../../core/services/game.service';

@Component({
  selector: 'app-waiting-room',
  imports: [CommonModule, FormsModule],
  templateUrl: './waiting-room.html',
  styleUrl: './waiting-room.scss',
})
export class WaitingRoom implements OnInit, OnDestroy {
  @ViewChild('chatHistory') private chatHistory?: ElementRef<HTMLElement>;

  chatText = '';
  connectionError: string | null = null;
  connectionStatus: ConnectionStatus = 'disconnected';
  players: Player[] = [];
  messages: ChatMessage[] = [];
  savedPlayerName = '';
  savedRoomCode = '';

  private readonly subscriptions = new Subscription();
  private destroyed = false;

  constructor(
    private readonly gameService: GameService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.savedPlayerName = sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ?? '';
    this.savedRoomCode = sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey) ?? '';
    if (!normalizeName(this.savedPlayerName) || !this.savedRoomCode.trim()) {
      void this.router.navigate(['/menu']);
      return;
    }

    this.subscriptions.add(
      this.gameService.connectionStatus$.subscribe((status) => {
        this.connectionStatus = status;
      }),
    );
    this.subscriptions.add(
      this.gameService.errorMessage$.subscribe((message) => {
        this.connectionError = message;
      }),
    );
    this.subscriptions.add(
      this.gameService.onPlayersUpdated((players) => {
        this.players = players;
      }),
    );
    this.subscriptions.add(
      this.gameService.onChatMessage((message) => {
        this.messages = [...this.messages, message];
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
