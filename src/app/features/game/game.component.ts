import { Component, computed, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { ConnectionStatus, GameService } from '../../core/services/game.service';
import { ExplosionSignalStore } from './explosion/explosion.store';
import { GameCanvas } from './game-canvas/game-canvas';
import { GameScoreSignalStore } from './game-score.store';
import { BattleMapSignalStore } from './map/battle-map.store';
import { TankSignalStore } from './tank/tank.store';

type PlayerVisualStatus = 'alive' | 'injured' | 'dead';
interface PlayerPanelState { readonly name: string; readonly status: PlayerVisualStatus; }

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [GameCanvas],
  providers: [BattleMapSignalStore, TankSignalStore, ExplosionSignalStore, GameScoreSignalStore],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild(GameCanvas) private gameCanvas?: GameCanvas;

  playerName = '';
  connectionStatus: ConnectionStatus = 'disconnected';
  isTutorial = false;
  readonly scoreStore = inject(GameScoreSignalStore);
  private readonly tankStore = inject(TankSignalStore);
  readonly hearts = computed(() =>
    Array.from({ length: Math.ceil((this.tankStore.tank().health / this.tankStore.tank().maxHealth) * 4) }),
  );
  readonly players = computed<ReadonlyArray<PlayerPanelState>>(() => [{
    name: this.playerName || 'Jogador', status: this.playerVisualStatus(),
  }]);
  private readonly subscriptions = new Subscription();

  constructor(private readonly gameService: GameService, private readonly router: Router) {}

  ngOnInit(): void {
    this.isTutorial = this.router.url.startsWith('/tutorial');
    if (this.isTutorial) { this.playerName = 'Treinamento'; return; }
    this.playerName = (sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ?? '').trim();
    if (!this.playerName) { void this.router.navigate(['/menu']); return; }
    this.subscriptions.add(this.gameService.connectionStatus$.subscribe((status) => this.connectionStatus = status));
    if (this.connectionStatus !== 'connected') {
      this.gameService.connect();
      this.gameService.joinRoom(this.playerName);
    }
  }

  backToWaitingRoom(): void { void this.router.navigate([this.isTutorial ? '/menu' : '/waiting-room']); }
  simulateEnemyDestroyed(): void { this.gameCanvas?.simulateEnemyDestroyed(); }

  connectionLabel(): string {
    return { disconnected: 'Desconectado', connecting: 'Conectando…', connected: 'Conectado', error: 'Erro de conexão' }[this.connectionStatus];
  }

  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }

  private playerVisualStatus(): PlayerVisualStatus {
    const tank = this.tankStore.tank();
    return tank.status === 'destroyed' ? 'dead' : tank.health < tank.maxHealth ? 'injured' : 'alive';
  }
}
