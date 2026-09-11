import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Store, provideStore } from '@ngrx/store';
import { of } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { GameService } from '../../core/services/game.service';
import { RoomApiService } from '../../core/services/room-api.service';
import { GameActions } from '../../core/store/game.actions';
import { gameFeatureKey, gameReducer } from '../../core/store/game.reducer';
import { WaitingRoom } from './waiting-room';

describe('WaitingRoom', () => {
  let store: Store;
  const gameService = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinRoom: vi.fn(),
    sendChatMessage: vi.fn(),
  };

  const roomApiService = {
    getRooms: vi.fn(() => of([])),
  };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [WaitingRoom],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore({ [gameFeatureKey]: gameReducer }),
        { provide: GameService, useValue: gameService },
        { provide: RoomApiService, useValue: roomApiService },
      ],
    }).compileComponents();
    store = TestBed.inject(Store);
  });

  it('should redirect to the menu when no player was identified', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(WaitingRoom);

    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/menu']);
    expect(gameService.connect).not.toHaveBeenCalled();
  });

  it('should join and connect the identified player', () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const fixture = TestBed.createComponent(WaitingRoom);

    fixture.detectChanges();

    expect(gameService.joinRoom).toHaveBeenCalledWith('Erick');
    expect(gameService.connect).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('#player-name')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chat-panel')).not.toBeNull();
  });

  it('should only open the game after connecting', () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    fixture.componentInstance.openGame();
    expect(navigate).not.toHaveBeenCalledWith(['/game']);

    store.dispatch(GameActions.connectionStatusChanged({ status: 'connected' }));
    fixture.componentInstance.openGame();
    expect(navigate).toHaveBeenCalledWith(['/game']);
  });

  it('should clear the identity when leaving the room', () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    fixture.componentInstance.leaveRoom();

    expect(gameService.disconnect).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey)).toBeNull();
    expect(sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/menu']);
  });

  it('should render chat messages received asynchronously without another click', async () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    store.dispatch(
      GameActions.chatMessageReceived({
        message: {
          id: 'message-1',
          playerName: 'Ana',
          message: 'Olá!',
          timestamp: new Date().toISOString(),
        },
      }),
    );
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.chat-message p')?.textContent).toContain('Olá!');
  });

  it('should render players received asynchronously without a manual refresh', async () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const fixture = TestBed.createComponent(WaitingRoom);
    fixture.detectChanges();

    store.dispatch(
      GameActions.playersUpdated({
        players: [
          {
            id: 'player-1',
            name: 'Ana',
            position: { x: 1, y: 1, direction: 'right' },
          },
        ],
      }),
    );
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.player-list li')?.textContent).toContain('Ana');
  });
});
