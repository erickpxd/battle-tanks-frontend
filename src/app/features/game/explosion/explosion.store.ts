import { Injectable, computed, signal } from '@angular/core';

export const EXPLOSION_DURATION_MS = 320;

export interface ExplosionState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly destructive: boolean;
  readonly startedAt: number;
  readonly progress: number;
}

export interface NewExplosion {
  readonly x: number;
  readonly y: number;
  readonly destructive: boolean;
  readonly startedAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class ExplosionSignalStore {
  private readonly explosionState = signal<ReadonlyArray<ExplosionState>>([]);
  private nextExplosionId = 1;

  readonly explosions = this.explosionState.asReadonly();
  /** Avoids templates/consumers re-deriving length on every read. */
  readonly explosionCount = computed(() => this.explosionState().length);
  readonly hasExplosions = computed(() => this.explosionCount() > 0);
  readonly destructiveExplosionCount = computed(
    () => this.explosionState().filter((explosion) => explosion.destructive).length,
  );

  start(explosion: NewExplosion): string {
    const id = `explosion-${this.nextExplosionId++}`;
    this.explosionState.update((explosions) => [
      ...explosions,
      Object.freeze({
        ...explosion,
        id,
        progress: 0,
      }),
    ]);
    return id;
  }

  advance(timestamp: number): void {
    if (this.explosionState().length === 0) {
      return;
    }

    this.explosionState.update((explosions) =>
      explosions
        .map((explosion) => ({
          ...explosion,
          progress: clamp((timestamp - explosion.startedAt) / EXPLOSION_DURATION_MS, 0, 1),
        }))
        .filter((explosion) => explosion.progress < 1),
    );
  }

  clear(): void {
    this.explosionState.set([]);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
