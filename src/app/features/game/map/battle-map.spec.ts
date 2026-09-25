import { BattleMap } from './battle-map';
import { TerrainType } from './terrain-type';

describe('BattleMap', () => {
  it('should expand every original tile into a 3 by 3 block', () => {
    const map = new BattleMap([
      [1, 0],
      [0, 1],
    ]);

    expect(map.expandedMatrix).toEqual([
      [1, 1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1],
      [0, 0, 0, 1, 1, 1],
      [0, 0, 0, 1, 1, 1],
    ]);
  });

  it('should destroy one wall part without changing the original matrix', () => {
    const source = [[TerrainType.DestructibleWall]];
    const map = new BattleMap(source);

    expect(map.damageExpandedTile(1, 1)).toBe(true);

    expect(map.expandedMatrix).toEqual([
      [2, 2, 2],
      [2, 0, 2],
      [2, 2, 2],
    ]);
    expect(map.originalMatrix).toEqual([[TerrainType.DestructibleWall]]);
    expect(source).toEqual([[TerrainType.DestructibleWall]]);
  });

  it('should calculate collisions from the expanded matrix', () => {
    const map = new BattleMap([[TerrainType.DestructibleWall]]);

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        map.damageExpandedTile(column, row);
      }
    }

    expect(map.isOriginalCellBlocked(0, 0)).toBe(false);
    expect(map.originalMatrix[0][0]).toBe(TerrainType.DestructibleWall);
  });

  it('should reject a non-rectangular source map', () => {
    expect(() => new BattleMap([[0, 1], [0]])).toThrowError('Todas as linhas');
  });
});
