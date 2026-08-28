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

  playerName = '';
  chatText = '';
  nameError = '';
  connectionError: string | null = null;
  connectionStatus: ConnectionStatus = 'disconnected';
  players: Player[] = [];
  messages: ChatMessage[] = [];
  savedPlayerName = '';

  private readonly subscriptions = new Subscription();
  private destroyed = false;

  constructor(
    private readonly gameService: GameService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.savedPlayerName = sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ?? '';
    this.playerName = this.savedPlayerName;

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

    this.gameService.connect();
  }

  submitPlayer(): void {
    const name = normalizeName(this.playerName);
    if (!name) {
      this.nameError = 'Informe um nome para entrar na sala.';
      return;
    }

    this.nameError = '';
    this.playerName = name;
    this.savedPlayerName = name;
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, name);
    this.gameService.connect();
    this.gameService.joinRoom(name);
  }

  retryConnection(): void {
    this.gameService.connect();
    if (this.savedPlayerName) {
      this.gameService.joinRoom(this.savedPlayerName);
    }
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
    if (!normalizeName(this.savedPlayerName)) {
      this.nameError = 'Salve um nome antes de abrir o jogo.';
      return;
    }
    void this.router.navigate(['/game']);
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
