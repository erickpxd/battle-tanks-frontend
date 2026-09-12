import { inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Store } from '@ngrx/store';
import mqtt from 'mqtt';
import type { IClientOptions } from 'mqtt';
import { Subscription } from 'rxjs';

import { GAME_CONFIG } from '../config/game.config';
import { GameEventEnvelope, isGameEventEnvelope } from '../models/mqtt-game-event.model';
import { GameActions } from '../store/game.actions';
import { AuthService } from './auth.service';
import { RealtimeBenchmarkService } from './realtime-benchmark.service';

interface MqttClientLike {
  readonly connected: boolean;
  on(event: 'connect' | 'reconnect' | 'offline' | 'close', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'message', listener: (topic: string, payload: Uint8Array) => void): this;
  subscribe(
    topic: string,
    options: { qos: 0 | 1 },
    callback?: (error?: Error | null) => void,
  ): this;
  unsubscribe(topic: string, callback?: (error?: Error | null) => void): this;
  end(force?: boolean): this;
}

export type MqttClientFactory = (url: string, options: IClientOptions) => MqttClientLike;

export const MQTT_CLIENT_FACTORY = new InjectionToken<MqttClientFactory>('MQTT_CLIENT_FACTORY', {
  providedIn: 'root',
  factory: () => (url, options) => mqtt.connect(url, options) as unknown as MqttClientLike,
});

interface MqttBrowserConfig {
  readonly webSocketUrl: string;
  readonly username: string;
  readonly password: string;
}

@Injectable({ providedIn: 'root' })
export class MqttGameService implements OnDestroy {
  private readonly store = inject(Store);
  private readonly benchmark = inject(RealtimeBenchmarkService);
  private readonly createClient = inject(MQTT_CLIENT_FACTORY);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly decoder = new TextDecoder();

  private client?: MqttClientLike;
  private roomId: string | null = null;
  private subscribedTopic: string | null = null;
  private configRequest?: Subscription;

  joinRoom(roomId: string): void {
    const normalizedRoomId = normalizeRoomId(roomId);
    if (!normalizedRoomId) {
      this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'error' }));
      return;
    }

    if (this.roomId !== normalizedRoomId && this.subscribedTopic) {
      this.client?.unsubscribe(this.subscribedTopic);
      this.subscribedTopic = null;
    }
    this.roomId = normalizedRoomId;

    if (!this.client) {
      this.connect();
    } else if (this.client.connected) {
      this.subscribeToCurrentRoom();
    }
  }

  leaveRoom(): void {
    if (this.subscribedTopic) {
      this.client?.unsubscribe(this.subscribedTopic);
    }
    this.subscribedTopic = null;
    this.roomId = null;
    this.client?.end(true);
    this.client = undefined;
    this.configRequest?.unsubscribe();
    this.configRequest = undefined;
    this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'disconnected' }));
  }

  ngOnDestroy(): void {
    this.leaveRoom();
  }

  private connect(): void {
    this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'connecting' }));
    const token = this.auth.getToken();
    if (!token) {
      this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'error' }));
      return;
    }

    this.configRequest?.unsubscribe();
    this.configRequest = this.http
      .get<MqttBrowserConfig>(`${GAME_CONFIG.apiUrl}/api/mqtt/config`, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      })
      .subscribe({
        next: (config) => this.createBrokerClient(config),
        error: () => {
          this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'error' }));
        },
      });
  }

  private createBrokerClient(config: MqttBrowserConfig): void {
    if (!this.roomId) {
      return;
    }

    const client = this.createClient(config.webSocketUrl, {
      clientId: `battle-tanks-web-${randomId()}`,
      username: config.username,
      password: config.password,
      clean: true,
      connectTimeout: 5_000,
      reconnectPeriod: 2_000,
      keepalive: 20,
    });

    client.on('connect', () => {
      // EVIDÊNCIA LAB 06: tirar screenshot deste estado e do cliente no dashboard EMQX.
      this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'connected' }));
      this.subscribeToCurrentRoom();
    });
    client.on('reconnect', () => {
      this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'connecting' }));
    });
    client.on('offline', () => {
      this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'disconnected' }));
    });
    client.on('close', () => {
      this.subscribedTopic = null;
      if (this.roomId) {
        this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'connecting' }));
      }
    });
    client.on('error', () => {
      this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'error' }));
    });
    client.on('message', (topic, payload) => this.handleMessage(topic, payload));
    this.client = client;
  }

  private subscribeToCurrentRoom(): void {
    if (!this.client?.connected || !this.roomId) {
      return;
    }

    const topic = roomSubscription(this.roomId);
    if (this.subscribedTopic === topic) {
      return;
    }

    this.client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        this.store.dispatch(GameActions.mqttConnectionStatusChanged({ status: 'error' }));
        return;
      }
      this.subscribedTopic = topic;
    });
  }

  private handleMessage(topic: string, payload: Uint8Array): void {
    const roomId = this.roomId;
    if (!roomId || !topic.startsWith(`battle-tanks/${roomId}/events/`)) {
      return;
    }

    const gameEvent = parseGameEvent(this.decoder.decode(payload));
    if (!gameEvent || normalizeRoomId(gameEvent.roomId) !== roomId) {
      return;
    }

    this.benchmark.recordProtocolReceived(
      'MQTT',
      gameEvent.eventType,
      gameEvent.eventId,
      gameEvent.sentAtUnixMs,
      gameEvent.roomId,
    );
    // EVIDÊNCIA LAB 06: NgRx DevTools deve mostrar esta action e o estado deduplicado.
    this.store.dispatch(GameActions.mqttGameEventReceived({ gameEvent }));
  }
}

export function parseGameEvent(serialized: string): GameEventEnvelope | null {
  try {
    const value: unknown = JSON.parse(serialized);
    return isGameEventEnvelope(value) ? value : null;
  } catch {
    return null;
  }
}

export function roomSubscription(roomId: string): string {
  const normalized = normalizeRoomId(roomId);
  if (!normalized) {
    throw new Error('Identificador de sala inválido para MQTT.');
  }
  return `battle-tanks/${normalized}/events/#`;
}

function normalizeRoomId(roomId: string): string | null {
  const normalized = roomId.trim().toUpperCase();
  return normalized.length >= 3 && normalized.length <= 32 && /^[A-Z0-9-]+$/.test(normalized)
    ? normalized
    : null;
}

function randomId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
