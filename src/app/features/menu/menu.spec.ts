import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { AuthService } from '../../core/services/auth.service';
import { RoomApiService } from '../../core/services/room-api.service';
import { Menu } from './menu';

describe('Menu', () => {
  let authServiceMock: Partial<AuthService>;
  let roomApiServiceMock: Partial<RoomApiService>;

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();

    authServiceMock = {
      isAuthenticated: () => true,
      getUsername: () => null,
      logout: () => {},
    };

    roomApiServiceMock = {
      createRoom: () =>
        of({
          id: '123',
          roomCode: 'TANK-4X9Z',
          mapSelected: 'default',
          status: 'Waiting',
          playerCount: 1,
          players: ['Erick Silva'],
        }),
      joinRoomByCode: (code: string) =>
        of({
          id: '123',
          roomCode: code.toUpperCase(),
          mapSelected: 'default',
          status: 'Waiting',
          playerCount: 2,
          players: ['Erick', 'Friend'],
        }),
    };

    await TestBed.configureTestingModule({
      imports: [Menu],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        { provide: RoomApiService, useValue: roomApiServiceMock },
      ],
    }).compileComponents();
  });

  it('should only enable room commands after the required fields are filled', () => {
    const emptyFixture = TestBed.createComponent(Menu);
    emptyFixture.detectChanges();
    const emptyButtons = emptyFixture.nativeElement.querySelectorAll(
      'form button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(emptyButtons[0].disabled).toBe(true);
    expect(emptyButtons[1].disabled).toBe(true);
    emptyFixture.destroy();

    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    const namedFixture = TestBed.createComponent(Menu);
    namedFixture.detectChanges();
    const namedButtons = namedFixture.nativeElement.querySelectorAll(
      'form button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(namedButtons[0].disabled).toBe(false);
    expect(namedButtons[1].disabled).toBe(true);
    namedFixture.destroy();

    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, 'ABC123');
    const completeFixture = TestBed.createComponent(Menu);
    completeFixture.detectChanges();
    const completeButtons = completeFixture.nativeElement.querySelectorAll(
      'form button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(completeButtons[0].disabled).toBe(false);
    expect(completeButtons[1].disabled).toBe(false);
  });

  it('should create a room for a normalized player name via REST API', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Menu);
    fixture.detectChanges();
    fixture.componentInstance.playerName = '  Erick   Silva ';

    fixture.componentInstance.createRoom();

    expect(sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey)).toBe('Erick Silva');
    expect(sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey)).toBe('TANK-4X9Z');
    expect(navigate).toHaveBeenCalledWith(['/waiting-room']);
  });

  it('should normalize the room code before joining via REST API', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Menu);
    fixture.detectChanges();
    fixture.componentInstance.playerName = 'Erick';
    fixture.componentInstance.roomCode = ' ab 12cd ';

    fixture.componentInstance.joinRoom();

    expect(sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey)).toBe('AB12CD');
    expect(navigate).toHaveBeenCalledWith(['/waiting-room']);
  });

  it('should open the local tutorial without requiring a name', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Menu);
    fixture.detectChanges();

    fixture.componentInstance.openTutorial();

    expect(navigate).toHaveBeenCalledWith(['/tutorial']);
  });
});
