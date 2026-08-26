import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { GameRoomComponent } from './game-room.component';
import { GameRoomEventsService } from './game-room-events.service';
import { PlayerStatusSignalStore } from './player/player-status.store';
import { WaitingRoomDisplayDemoService } from './temp-waiting-room-demo/waiting-room-display-demo.service';

describe('GameRoomComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameRoomComponent],
      providers: [GameRoomEventsService, PlayerStatusSignalStore, WaitingRoomDisplayDemoService],
    }).compileComponents();
  });

  it('should display one waiting room player every 5 seconds until all 4 players are visible', fakeAsync(() => {
    const fixture = TestBed.createComponent(GameRoomComponent);
    const compiled = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual([]);

    tick(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana']);

    tick(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno']);

    tick(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno', 'Carla']);

    tick(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno', 'Carla', 'Diego']);

    tick(10000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno', 'Carla', 'Diego']);

    fixture.destroy();
  }));
});

function getVisiblePlayerNames(compiled: HTMLElement): string[] {
  return Array.from(compiled.querySelectorAll('.player__identity strong')).map(
    (playerName) => playerName.textContent?.trim() ?? '',
  );
}
