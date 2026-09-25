import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { GAME_CONFIG } from '../../core/config/game.config';
import { Menu } from './menu';

describe('Menu', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Menu],
      providers: [provideRouter([])],
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

  it('should create a room for a normalized player name', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Menu);
    fixture.detectChanges();
    fixture.componentInstance.playerName = '  Erick   Silva ';

    fixture.componentInstance.createRoom();

    expect(sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey)).toBe('Erick Silva');
    expect(sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey)).toMatch(/^[A-Z2-9]{6}$/);
    expect(navigate).toHaveBeenCalledWith(['/waiting-room']);
  });

  it('should normalize the room code before joining', () => {
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
