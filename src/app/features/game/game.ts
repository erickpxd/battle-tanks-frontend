import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { ConnectionStatus, GameService } from '../../core/services/game.service';
import { GameCanvas } from './game-canvas/game-canvas';

@Component({
  selector: 'app-game',
  imports: [GameCanvas],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class Game implements OnInit, OnDestroy {
  playerName = '';
  connectionStatus: ConnectionStatus = 'disconnected';
  isTutorial = false;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly gameService: GameService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.isTutorial = this.router.url.startsWith('/tutorial');
    if (this.isTutorial) {
      this.playerName = 'Treinamento';
      return;
    }

    this.playerName = (sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ?? '').trim();
    if (!this.playerName) {
      void this.router.navigate(['/menu']);
      return;
    }

    this.subscriptions.add(
      this.gameService.connectionStatus$.subscribe((status) => {
        this.connectionStatus = status;
      }),
    );
    if (this.connectionStatus !== 'connected') {
      this.gameService.connect();
      this.gameService.joinRoom(this.playerName);
    }
  }

  backToWaitingRoom(): void {
    void this.router.navigate([this.isTutorial ? '/menu' : '/waiting-room']);
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
    this.subscriptions.unsubscribe();
  }
}
