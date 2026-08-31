import { TerrainType, terrainDefinition } from './terrain-type';

export class BattleMap {
  readonly subdivision = 3;
  readonly originalColumns: number;
  readonly originalRows: number;
  readonly expandedColumns: number;
  readonly expandedRows: number;
  readonly originalMatrix: ReadonlyArray<ReadonlyArray<TerrainType>>;
  readonly expandedMatrix: ReadonlyArray<TerrainType[]>;

  constructor(source: ReadonlyArray<ReadonlyArray<number>>) {
    validateSource(source);

    this.originalRows = source.length;
    this.originalColumns = source[0].length;
    this.expandedRows = this.originalRows * this.subdivision;
    this.expandedColumns = this.originalColumns * this.subdivision;
    this.originalMatrix = Object.freeze(
      source.map((row) => Object.freeze(row.map((tile) => tile as TerrainType))),
    );
    this.expandedMatrix = this.expandOnce();
  }

  getExpandedTile(column: number, row: number): TerrainType | undefined {
    if (!this.isInsideExpandedMap(column, row)) {
      return undefined;
    }
    return this.expandedMatrix[row]?.[column];
  }

  setExpandedTile(column: number, row: number, tile: TerrainType): boolean {
    if (!this.isInsideExpandedMap(column, row)) {
      return false;
    }

    this.expandedMatrix[row][column] = tile;
    return true;
  }

  damageExpandedTile(column: number, row: number): boolean {
    const tile = this.getExpandedTile(column, row);
    if (tile === undefined || !terrainDefinition(tile).destructible) {
      return false;
    }

    return this.setExpandedTile(column, row, TerrainType.Ground);
  }

  setOriginalCellInExpandedMap(column: number, row: number, tile: TerrainType): boolean {
    if (!this.isInsideOriginalMap(column, row)) {
      return false;
    }

    const startColumn = column * this.subdivision;
    const startRow = row * this.subdivision;
    for (let expandedRow = startRow; expandedRow < startRow + this.subdivision; expandedRow += 1) {
      for (
        let expandedColumn = startColumn;
        expandedColumn < startColumn + this.subdivision;
        expandedColumn += 1
      ) {
        this.expandedMatrix[expandedRow][expandedColumn] = tile;
      }
    }
    return true;
  }

  isOriginalCellBlocked(column: number, row: number): boolean {
    if (!this.isInsideOriginalMap(column, row)) {
      return true;
    }

    const startColumn = column * this.subdivision;
    const startRow = row * this.subdivision;
    for (let expandedRow = startRow; expandedRow < startRow + this.subdivision; expandedRow += 1) {
      for (
        let expandedColumn = startColumn;
        expandedColumn < startColumn + this.subdivision;
        expandedColumn += 1
      ) {
        const tile = this.expandedMatrix[expandedRow][expandedColumn];
        if (terrainDefinition(tile).blocksMovement) {
          return true;
        }
      }
    }
    return false;
  }

  private isInsideOriginalMap(column: number, row: number): boolean {
    return (
      Number.isInteger(column) &&
      Number.isInteger(row) &&
      column >= 0 &&
      column < this.originalColumns &&
      row >= 0 &&
      row < this.originalRows
    );
  }

  private isInsideExpandedMap(column: number, row: number): boolean {
    return (
      Number.isInteger(column) &&
      Number.isInteger(row) &&
      column >= 0 &&
      column < this.expandedColumns &&
      row >= 0 &&
      row < this.expandedRows
    );
  }

  private expandOnce(): TerrainType[][] {
    const expanded = Array.from({ length: this.expandedRows }, () =>
      Array<TerrainType>(this.expandedColumns).fill(TerrainType.Ground),
    );

    for (let row = 0; row < this.originalRows; row += 1) {
      for (let column = 0; column < this.originalColumns; column += 1) {
        const tile = this.originalMatrix[row][column];
        const startColumn = column * this.subdivision;
        const startRow = row * this.subdivision;
        for (
          let expandedRow = startRow;
          expandedRow < startRow + this.subdivision;
          expandedRow += 1
        ) {
          expanded[expandedRow].fill(tile, startColumn, startColumn + this.subdivision);
        }
      }
    }

    return expanded;
  }
}

function validateSource(source: ReadonlyArray<ReadonlyArray<number>>): void {
  if (source.length === 0 || source[0].length === 0) {
    throw new Error('O mapa precisa ter pelo menos uma linha e uma coluna.');
  }

  const columns = source[0].length;
  for (const row of source) {
    if (row.length !== columns) {
      throw new Error('Todas as linhas do mapa precisam ter o mesmo tamanho.');
    }
    if (
      row.some(
        (tile) => !Number.isInteger(tile) || tile < TerrainType.Ground || tile > TerrainType.Ice,
      )
    ) {
      throw new Error('O mapa contém um tipo de terreno inválido.');
    }
  }
}
