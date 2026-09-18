import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { ConnectionStatus, GameService } from '../../core/services/game.service';
import { SoundEffectsService } from '../../core/services/sound-effects.service';
import {
  GameEndedEventData,
  GameEventEnvelope,
  MqttConnectionStatus,
  PlayerHitEventData,
} from '../../core/models/mqtt-game-event.model';
import {
  selectGameEnded,
  selectLastGameEvent,
  selectLocalPlayerId,
  selectMqttConnectionStatus,
} from '../../core/store/game.selectors';
import { GameActions } from '../../core/store/game.actions';
import { GameCanvas } from './game-canvas/game-canvas';
import { getMapDefinition } from './map/map-catalog';

@Component({
  selector: 'app-game',
  imports: [GameCanvas],
  templateUrl: './game.html',
  styleUrl: './game.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Game implements OnInit, OnDestroy {
  playerName = '';
  connectionStatus: ConnectionStatus = 'disconnected';
  mqttConnectionStatus: MqttConnectionStatus = 'disconnected';
  latestGameEventLabel = '';
  gameEndedMessage = '';
  resultTitle = '';
  localPlayerId: string | null = null;
  isTutorial = false;
  mapName = '';
  readonly soundEnabled;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly gameService: GameService,
    private readonly soundEffects: SoundEffectsService,
    private readonly router: Router,
    private readonly store: Store,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {
    this.soundEnabled = this.soundEffects.enabled;
  }

  ngOnInit(): void {
    this.soundEffects.startMusic();
    this.isTutorial = this.router.url.startsWith('/tutorial');
    this.mapName = getMapDefinition(
      this.isTutorial ? 'battleground' : sessionStorage.getItem(GAME_CONFIG.mapStorageKey),
    ).name;
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
      this.store.select(selectLastGameEvent).subscribe((gameEvent) => {
        this.latestGameEventLabel = gameEvent ? describeGameEvent(gameEvent) : '';
        this.changeDetectorRef.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.store.select(selectLocalPlayerId).subscribe((playerId) => {
        this.localPlayerId = playerId;
      }),
    );
    this.subscriptions.add(
      this.store.select(selectGameEnded).subscribe((gameEvent) => {
        const data = gameEvent?.data;
        const won = !!data?.winnerPlayerId && data.winnerPlayerId === this.localPlayerId;
        this.resultTitle = data ? (won ? 'VITÓRIA' : 'DERROTA') : '';
        this.gameEndedMessage = data
          ? won
            ? `Você venceu${data.defeatedPlayerName ? ` contra ${data.defeatedPlayerName}` : ''}!`
            : `${data.winnerPlayerName ?? 'O adversário'} venceu a partida.`
          : '';
        if (gameEvent) {
          this.soundEffects.playGameOver();
        }
        this.changeDetectorRef.markForCheck();
      }),
    );
    if (this.connectionStatus !== 'connected') {
      this.gameService.connect();
      this.gameService.joinRoom(this.playerName);
    }
  }

  leaveMatch(): void {
    if (!this.isTutorial) {
      this.gameService.surrender();
      return;
    }
    this.goToMenu();
  }

  goToMenu(): void {
    if (!this.isTutorial) {
      this.gameService.disconnect();
    }
    sessionStorage.removeItem(GAME_CONFIG.roomCodeStorageKey);
    sessionStorage.removeItem(GAME_CONFIG.mapStorageKey);
    sessionStorage.removeItem(GAME_CONFIG.gameStartedStorageKey);
    this.store.dispatch(GameActions.connectionErrorChanged({ message: null }));
    void this.router.navigate(['/menu']);
  }

  toggleSound(): void {
    this.soundEffects.toggle();
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
    this.soundEffects.stopMusic();
    this.subscriptions.unsubscribe();
  }
}

function describeGameEvent(gameEvent: GameEventEnvelope): string {
  if (gameEvent.eventType === 'collision.player-hit') {
    const data = gameEvent.data as PlayerHitEventData;
    return `Colisão confirmada: ${data.damage} de dano, ${data.remainingHealth} de vida.`;
  }
  if (gameEvent.eventType === 'map.tile-destroyed') {
    return 'Destruição de mapa recebida via MQTT.';
  }
  const data = gameEvent.data as GameEndedEventData;
  return `Fim da partida: vencedor ${data.winnerPlayerId ?? 'não definido'}.`;
}
