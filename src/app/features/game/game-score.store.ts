import { computed, Injectable, signal } from '@angular/core';

const INITIAL_AMMO = 40;

@Injectable()
export class GameScoreSignalStore {
  private readonly scoreState = signal(0);
  private readonly ammoState = signal(INITIAL_AMMO);

  readonly score = this.scoreState.asReadonly();
  readonly ammo = this.ammoState.asReadonly();
  readonly hasAmmo = computed(() => this.ammo() > 0);
  readonly maxAmmo = INITIAL_AMMO;

  consumeAmmo(): boolean {
    if (!this.hasAmmo()) return false;
    this.ammoState.update((ammo) => ammo - 1);
    return true;
  }

  registerObstacleDestroyed(parts = 1): void {
    if (parts > 0) this.scoreState.update((score) => score + parts * 100);
  }

  registerEnemyDestroyed(): void {
    this.scoreState.update((score) => score + 500);
  }
}
