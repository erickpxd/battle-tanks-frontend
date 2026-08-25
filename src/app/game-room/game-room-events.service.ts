import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { PlayerRoomEvent } from './player/player.model';

@Injectable({
  providedIn: 'root',
})
export class GameRoomEventsService {
  private readonly eventsSubject = new Subject<PlayerRoomEvent>();

  readonly events$ = this.eventsSubject.asObservable();

  emit(event: PlayerRoomEvent): void {
    this.eventsSubject.next(event);
  }
}
