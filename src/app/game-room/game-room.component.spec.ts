import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoomComponent } from './game-room.component';
import { GameRoomEventsService } from './game-room-events.service';
import { PlayerStatusSignalStore } from './player/player-status.store';
import { WaitingRoomDisplayDemoService } from './temp-waiting-room-demo/waiting-room-display-demo.service';

describe('GameRoomComponent', () => {
  let fixture: ComponentFixture<GameRoomComponent> | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameRoomComponent],
      providers: [GameRoomEventsService, PlayerStatusSignalStore, WaitingRoomDisplayDemoService],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    vi.useRealTimers();
  });

  it('should display one waiting room player every 5 seconds until all 4 players are visible', () => {
    vi.useFakeTimers();
    fixture = TestBed.createComponent(GameRoomComponent);
    const compiled = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual([]);

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana']);

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno']);

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno', 'Carla']);

    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno', 'Carla', 'Diego']);

    vi.advanceTimersByTime(10000);
    fixture.detectChanges();
    expect(getVisiblePlayerNames(compiled)).toEqual(['Ana', 'Bruno', 'Carla', 'Diego']);
  });
});

function getVisiblePlayerNames(compiled: HTMLElement): string[] {
  return Array.from(compiled.querySelectorAll('.player__identity strong')).map(
    (playerName) => playerName.textContent?.trim() ?? '',
  );
}
