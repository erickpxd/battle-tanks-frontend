import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { GameRoomEventsService } from './game-room-events.service';
import { PlayerPosition, PlayerRoomEvent } from './player/player.model';
import { PlayerStatusSignalStore } from './player/player-status.store';
import { WaitingRoomDisplayDemoService } from './temp-waiting-room-demo/waiting-room-display-demo.service';

@Component({
  selector: 'app-game-room',
  templateUrl: './game-room.component.html',
  styleUrl: './game-room.component.scss',
})
export class GameRoomComponent {
  private readonly events = inject(GameRoomEventsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly waitingRoomDisplayDemo = inject(WaitingRoomDisplayDemoService);
  protected readonly playerStore = inject(PlayerStatusSignalStore);

  protected readonly players = this.playerStore.players;
  protected readonly playerCount = this.playerStore.playerCount;
  protected readonly hasPlayers = this.playerStore.hasPlayers;
  protected readonly waitingRoomCapacity = this.waitingRoomDisplayDemo.maxPlayers;

  constructor() {
    this.events.events$
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.handleRoomEvent(event));

    this.waitingRoomDisplayDemo.start();
    this.destroyRef.onDestroy(() => this.waitingRoomDisplayDemo.stop());
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
