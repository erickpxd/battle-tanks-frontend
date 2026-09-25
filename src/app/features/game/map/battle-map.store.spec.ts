import { BattleMapSignalStore } from './battle-map.store';
import { TerrainType } from './terrain-type';

describe('BattleMapSignalStore', () => {
  it('should publish a new map state after destroying a destructible part', () => {
    const store = new BattleMapSignalStore();
    store.setOriginalCell(0, 0, TerrainType.DestructibleWall);
    const previousTiles = store.tiles();

    expect(store.destroyTile(1, 1)).toBe(true);

    expect(store.tiles()).not.toBe(previousTiles);
    expect(store.tiles()[1][1]).toBe(TerrainType.Ground);
    expect(store.destroyedParts()).toBe(1);
  });

  it('should preserve indestructible walls when hit', () => {
    const store = new BattleMapSignalStore();
    store.setOriginalCell(0, 0, TerrainType.IndestructibleWall);

    expect(store.destroyTile(1, 1)).toBe(false);
    expect(store.tiles()[1][1]).toBe(TerrainType.IndestructibleWall);
  });

  it('should destroy multiple valid parts in one state update', () => {
    const store = new BattleMapSignalStore();
    store.setOriginalCell(0, 0, TerrainType.DestructibleWall);

    const destroyed = store.destroyTiles([
      { column: 1, row: 0 },
      { column: 1, row: 1 },
      { column: 1, row: 2 },
    ]);

    expect(destroyed).toHaveLength(3);
    expect(store.tiles()[0][1]).toBe(TerrainType.Ground);
    expect(store.tiles()[1][1]).toBe(TerrainType.Ground);
    expect(store.tiles()[2][1]).toBe(TerrainType.Ground);
    expect(store.destroyedParts()).toBe(3);
  });
});
