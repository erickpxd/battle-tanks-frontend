import { MAP_CATALOG, getMapDefinition } from './map-catalog';

const POWER_UP_POINTS = [
  [4, 3],
  [10, 2],
  [15, 3],
  [4, 7],
  [10, 7],
  [15, 7],
  [4, 11],
  [10, 12],
  [15, 11],
] as const;

describe('map catalog', () => {
  it('should expose the four proposed maps with distinct layouts', () => {
    expect(MAP_CATALOG.map((map) => map.id)).toEqual([
      'battleground',
      'fortress',
      'swamp',
      'ruins',
    ]);
    expect(new Set(MAP_CATALOG.map((map) => JSON.stringify(map.source.tiles))).size).toBe(4);
  });

  it.each(MAP_CATALOG)('$name should have a valid arena and safe spawn areas', (map) => {
    expect(map.source.tiles).toHaveLength(15);
    expect(map.source.tiles.every((row) => row.length === 20)).toBe(true);

    for (const spawn of map.source.spawns) {
      expect(map.source.tiles[spawn.y][spawn.x]).toBe(0);
      const escapeRoutes = [
        [spawn.x - 1, spawn.y],
        [spawn.x + 1, spawn.y],
        [spawn.x, spawn.y - 1],
        [spawn.x, spawn.y + 1],
      ].filter(([x, y]) => map.source.tiles[y]?.[x] === 0);
      expect(escapeRoutes.length).toBeGreaterThan(0);
    }

    for (const [x, y] of POWER_UP_POINTS) {
      expect(map.source.tiles[y][x]).toBe(0);
    }
  });

  it('should keep compatibility with rooms that stored the old default name', () => {
    expect(getMapDefinition('default').id).toBe('battleground');
    expect(getMapDefinition('unknown').id).toBe('battleground');
  });
});
