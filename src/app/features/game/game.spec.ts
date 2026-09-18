import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';

import { GAME_CONFIG } from '../../core/config/game.config';
import { ConnectionStatus, GameService } from '../../core/services/game.service';
import { SoundEffectsService } from '../../core/services/sound-effects.service';
import { gameFeatureKey, gameReducer } from '../../core/store/game.reducer';
import { Game } from './game';

describe('Game', () => {
  const status = new BehaviorSubject<ConnectionStatus>('disconnected');
  const gameService = {
    connectionStatus$: status.asObservable(),
    connect: vi.fn(),
    joinRoom: vi.fn(),
  };
  const soundEffects = {
    enabled: signal(true).asReadonly(),
    toggle: vi.fn(),
    playGameOver: vi.fn(),
  };

  beforeEach(async () => {
    sessionStorage.clear();
    status.next('disconnected');
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [Game],
      providers: [
        provideRouter([]),
        provideStore({ [gameFeatureKey]: gameReducer }),
        { provide: GameService, useValue: gameService },
        { provide: SoundEffectsService, useValue: soundEffects },
      ],
    })
      .overrideComponent(Game, {
        set: {
          imports: [],
          template: '<p>{{ playerName }}</p>',
        },
      })
      .compileComponents();
  });

  it('should create with a saved player and reuse the shared connection', () => {
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, 'Erick');
    const fixture = TestBed.createComponent(Game);
    fixture.detectChanges();

    expect(fixture.componentInstance.playerName).toBe('Erick');
    expect(gameService.connect).toHaveBeenCalledOnce();
    expect(gameService.joinRoom).toHaveBeenCalledWith('Erick');
  });

  it('should redirect to the menu without a saved player', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Game);

    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/menu']);
    expect(gameService.connect).not.toHaveBeenCalled();
  });

  it('should open the tutorial locally without a saved player', () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/tutorial');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Game);

    fixture.detectChanges();

    expect(fixture.componentInstance.isTutorial).toBe(true);
    expect(fixture.componentInstance.playerName).toBe('Treinamento');
    expect(gameService.connect).not.toHaveBeenCalled();
    expect(gameService.joinRoom).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
