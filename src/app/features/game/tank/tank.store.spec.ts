import { TankSignalStore } from './tank.store';

describe('TankSignalStore', () => {
  let store: TankSignalStore;

  beforeEach(() => {
    store = new TankSignalStore();
  });

  it('should expose the four configured spawn points', () => {
    expect(store.spawns).toEqual([
      { player: 1, x: 1, y: 1, direction: 'right' },
      { player: 2, x: 18, y: 1, direction: 'left' },
      { player: 3, x: 1, y: 13, direction: 'right' },
      { player: 4, x: 18, y: 13, direction: 'left' },
    ]);
  });

  it('should select a spawn and update movement through signals', () => {
    expect(store.selectSpawn(4)).toBe(true);
    store.turn('up');
    store.moveTo(18, 12);

    expect(store.tank().position).toEqual({ x: 18, y: 12, direction: 'up' });
    expect(store.tank().player).toBe(4);
  });

  it('should darken through health state and become destroyed at zero health', () => {
    store.damage(40);

    expect(store.healthPercentage()).toBe(0.6);
    expect(store.tank().status).toBe('active');

    store.damage(60);

    expect(store.healthPercentage()).toBe(0);
    expect(store.tank().status).toBe('destroyed');
    expect(store.isActive()).toBe(false);
  });

  it('should not move a destroyed tank', () => {
    store.damage(100);

    expect(store.moveTo(2, 1)).toBe(false);
    expect(store.tank().position).toEqual({ x: 1, y: 1, direction: 'right' });
  });

  it('should apply an authoritative health value from the server', () => {
    store.setHealth(35);

    expect(store.tank().health).toBe(35);
    expect(store.tank().status).toBe('active');

    store.setHealth(0);

    expect(store.tank().status).toBe('destroyed');
  });
});
