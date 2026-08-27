import { Subscription } from 'rxjs';

import { GameRoomEventsService } from '../game-room-events.service';
import {
  WAITING_ROOM_DISPLAY_PLAYERS,
  WaitingRoomDisplayDemoService,
} from './waiting-room-display-demo.service';

describe('WaitingRoomDisplayDemoService', () => {
  let events: GameRoomEventsService;
  let service: WaitingRoomDisplayDemoService;
  let subscription: Subscription;
  const joinedPlayerIds: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    joinedPlayerIds.length = 0;
    events = new GameRoomEventsService();
    service = new WaitingRoomDisplayDemoService(events);
    subscription = events.events$.subscribe((event) => {
      if (event.type === 'playerJoined') {
        joinedPlayerIds.push(event.player.id);
      }
    });
  });

  afterEach(() => {
    subscription.unsubscribe();
    service.reset();
    vi.useRealTimers();
  });

  it('should add one waiting room player every 5 seconds until all 4 players are visible', () => {
    service.start();

    expect(joinedPlayerIds).toEqual([]);

    vi.advanceTimersByTime(5000);
    expect(joinedPlayerIds).toEqual(['player-1']);

    vi.advanceTimersByTime(5000);
    expect(joinedPlayerIds).toEqual(['player-1', 'player-2']);

    vi.advanceTimersByTime(5000);
    expect(joinedPlayerIds).toEqual(['player-1', 'player-2', 'player-3']);

    vi.advanceTimersByTime(5000);
    expect(joinedPlayerIds).toEqual(WAITING_ROOM_DISPLAY_PLAYERS.map((player) => player.id));

    vi.advanceTimersByTime(10000);
    expect(joinedPlayerIds).toEqual(WAITING_ROOM_DISPLAY_PLAYERS.map((player) => player.id));
  });
});
