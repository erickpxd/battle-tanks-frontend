import { computed, Injectable, signal } from '@angular/core';

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

  destroyTile(column: number, row: number): boolean {
    if (!this.battleMap.damageExpandedTile(column, row)) {
      return false;
    }

    this.destroyedPartsState.update((count) => count + 1);
    this.revision.update((value) => value + 1);
    return true;
  }

  setOriginalCell(column: number, row: number, tile: TerrainType): boolean {
    if (!this.battleMap.setOriginalCellInExpandedMap(column, row, tile)) {
      return false;
    }

    this.revision.update((value) => value + 1);
    return true;
  }
}
