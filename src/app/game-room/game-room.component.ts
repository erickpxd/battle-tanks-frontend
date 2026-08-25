import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameRoomEventsService } from './game-room-events.service';
import { PlayerPosition, PlayerRoomEvent } from './player/player.model';
import { PlayerStatusSignalStore } from './player/player-status.store';

@Component({
  selector: 'app-game-room',
  templateUrl: './game-room.component.html',
  styleUrl: './game-room.component.scss',
})
export class GameRoomComponent {
  private readonly events = inject(GameRoomEventsService);
  protected readonly playerStore = inject(PlayerStatusSignalStore);

  protected readonly players = this.playerStore.players;
  protected readonly playerCount = this.playerStore.playerCount;
  protected readonly hasPlayers = this.playerStore.hasPlayers;

  constructor() {
    this.events.events$
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.handleRoomEvent(event));
  }

  handleRoomEvent(event: PlayerRoomEvent): void {
    this.playerStore.applyRoomEvent(event);
  }

  protected arenaCoordinate(value: number): number {
    return Math.min(Math.max(value, 0), 100);
  }

  protected positionLabel(position: PlayerPosition): string {
    return `X ${position.x}, Y ${position.y}`;
  }
}
