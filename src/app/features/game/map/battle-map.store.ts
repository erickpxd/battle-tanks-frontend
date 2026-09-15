import { computed, Injectable, signal } from '@angular/core';

import { MapTileChange } from '../../../core/models/map-tile-change.model';
import defaultMapSource from './default-map.json';
import { BattleMap } from './battle-map';
import { TerrainType } from './terrain-type';

@Injectable({
  providedIn: 'root',
})
export class BattleMapSignalStore {
  readonly battleMap = new BattleMap(defaultMapSource.tiles);

  private readonly revision = signal(0);

  readonly tiles = computed<ReadonlyArray<ReadonlyArray<TerrainType>>>(() => {
    this.revision();
    return this.battleMap.expandedMatrix.map((row) => [...row]);
  });

  private readonly destroyedPartsState = signal(0);

  readonly destroyedParts = this.destroyedPartsState.asReadonly();
  readonly hasDestroyedParts = computed(() => this.destroyedPartsState() > 0);
  readonly mapRevision = computed(() => this.revision());
  readonly tileCount = computed(() => {
    const matrix = this.tiles();
    return matrix.reduce((sum, row) => sum + row.length, 0);
  });

  destroyTile(column: number, row: number): boolean {
    return this.destroyTiles([{ column, row }]).length === 1;
  }

  destroyTiles(changes: ReadonlyArray<MapTileChange>): MapTileChange[] {
    const destroyed = changes.filter(({ column, row }) =>
      this.battleMap.damageExpandedTile(column, row),
    );
    if (destroyed.length === 0) {
      return [];
    }

    this.destroyedPartsState.update((count) => count + destroyed.length);
    this.revision.update((value) => value + 1);
    return destroyed;
  }

  setOriginalCell(column: number, row: number, tile: TerrainType): boolean {
    if (!this.battleMap.setOriginalCellInExpandedMap(column, row, tile)) {
      return false;
    }

    this.revision.update((value) => value + 1);
    return true;
  }
}
