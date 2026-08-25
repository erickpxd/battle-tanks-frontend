import { Injectable } from '@angular/core';

import { GameRoomEventsService } from '../game-room-events.service';
import { NewPlayer } from '../player/player.model';

export const WAITING_ROOM_DISPLAY_PLAYERS: readonly NewPlayer[] = [
  {
    id: 'player-1',
    name: 'Ana',
    position: {
      x: 18,
      y: 24,
      rotation: 45,
    },
    health: 100,
    maxHealth: 100,
    score: 0,
    team: 'blue',
  },
  {
    id: 'player-2',
    name: 'Bruno',
    position: {
      x: 72,
      y: 28,
      rotation: 135,
    },
    health: 100,
    maxHealth: 100,
    score: 0,
    team: 'red',
  },
  {
    id: 'player-3',
    name: 'Carla',
    position: {
      x: 32,
      y: 76,
      rotation: 315,
    },
    health: 100,
    maxHealth: 100,
    score: 0,
    team: 'blue',
  },
  {
    id: 'player-4',
    name: 'Diego',
    position: {
      x: 78,
      y: 72,
      rotation: 225,
    },
    health: 100,
    maxHealth: 100,
    score: 0,
    team: 'red',
  },
];

@Injectable({
  providedIn: 'root',
})
export class WaitingRoomDisplayDemoService {
  readonly maxPlayers = WAITING_ROOM_DISPLAY_PLAYERS.length;

  private intervalId: ReturnType<typeof setInterval> | undefined;
  private nextPlayerIndex = 0;

  constructor(private readonly events: GameRoomEventsService) {}

  start(): void {
    if (this.intervalId || this.nextPlayerIndex >= WAITING_ROOM_DISPLAY_PLAYERS.length) {
      return;
    }

    this.intervalId = setInterval(() => {
      const player = WAITING_ROOM_DISPLAY_PLAYERS[this.nextPlayerIndex];

      if (!player) {
        this.stop();
        return;
      }

      this.events.emit({
        type: 'playerJoined',
        player,
      });

      this.nextPlayerIndex += 1;

      if (this.nextPlayerIndex >= WAITING_ROOM_DISPLAY_PLAYERS.length) {
        this.stop();
      }
    }, 5000);
  }

  stop(): void {
    if (!this.intervalId) {
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = undefined;
  }

  reset(): void {
    this.stop();
    this.nextPlayerIndex = 0;
  }
}
