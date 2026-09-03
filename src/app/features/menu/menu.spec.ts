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

  it('should save a normalized name before opening the waiting room', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Menu);
    fixture.detectChanges();
    fixture.componentInstance.playerName = '  Erick   Silva ';

    fixture.componentInstance.enterWaitingRoom();

    expect(sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey)).toBe('Erick Silva');
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
