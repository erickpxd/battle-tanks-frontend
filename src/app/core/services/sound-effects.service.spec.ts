import { TestBed } from '@angular/core/testing';

import { GAME_CONFIG } from '../config/game.config';
import { SoundEffectsService } from './sound-effects.service';

describe('SoundEffectsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('should persist the mute preference', () => {
    const service = TestBed.inject(SoundEffectsService);

    expect(service.enabled()).toBe(true);
    expect(service.toggle()).toBe(false);
    expect(localStorage.getItem(GAME_CONFIG.soundEnabledStorageKey)).toBe('false');
    expect(service.toggle()).toBe(true);
    expect(localStorage.getItem(GAME_CONFIG.soundEnabledStorageKey)).toBe('true');
  });

  it('should safely ignore effects when Web Audio is unavailable', () => {
    const service = TestBed.inject(SoundEffectsService);

    expect(() => {
      service.playMove();
      service.playShot();
      service.playImpact(true);
      service.playPlayerHit(true);
      service.playPowerUp('shield');
      service.playGameOver();
    }).not.toThrow();
  });
});
