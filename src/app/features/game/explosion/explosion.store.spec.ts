import { EXPLOSION_DURATION_MS, ExplosionSignalStore } from './explosion.store';

describe('ExplosionSignalStore', () => {
  let store: ExplosionSignalStore;

  beforeEach(() => {
    store = new ExplosionSignalStore();
  });

  it('should add an explosion with its initial animation state', () => {
    const id = store.start({ x: 40, y: 80, destructive: true, startedAt: 100 });

    expect(id).toBe('explosion-1');
    expect(store.explosions()).toEqual([
      {
        id: 'explosion-1',
        x: 40,
        y: 80,
        destructive: true,
        startedAt: 100,
        progress: 0,
      },
    ]);
  });

  it('should advance progress from requestAnimationFrame timestamps', () => {
    store.start({ x: 40, y: 80, destructive: true, startedAt: 100 });

    store.advance(100 + EXPLOSION_DURATION_MS / 2);

    expect(store.explosions()[0]?.progress).toBe(0.5);
  });

  it('should remove an explosion after its animation finishes', () => {
    store.start({ x: 40, y: 80, destructive: true, startedAt: 100 });

    store.advance(100 + EXPLOSION_DURATION_MS);

    expect(store.explosions()).toEqual([]);
  });
});
