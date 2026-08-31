export enum TerrainType {
  Ground = 0,
  IndestructibleWall = 1,
  DestructibleWall = 2,
  Water = 3,
  Trees = 4,
  Ice = 5,
}

export interface TerrainDefinition {
  readonly blocksMovement: boolean;
  readonly color: string | null;
  readonly destructible: boolean;
}

const TERRAIN_DEFINITIONS: Readonly<Record<TerrainType, TerrainDefinition>> = {
  [TerrainType.Ground]: {
    blocksMovement: false,
    color: null,
    destructible: false,
  },
  [TerrainType.IndestructibleWall]: {
    blocksMovement: true,
    color: '#aab2b5',
    destructible: false,
  },
  [TerrainType.DestructibleWall]: {
    blocksMovement: true,
    color: '#b85c38',
    destructible: true,
  },
  [TerrainType.Water]: {
    blocksMovement: true,
    color: '#286b8f',
    destructible: false,
  },
  [TerrainType.Trees]: {
    blocksMovement: false,
    color: '#355f2d',
    destructible: false,
  },
  [TerrainType.Ice]: {
    blocksMovement: false,
    color: '#a8d8df',
    destructible: false,
  },
};

const UNKNOWN_TERRAIN: TerrainDefinition = {
  blocksMovement: true,
  color: '#d946ef',
  destructible: false,
};

export function terrainDefinition(type: TerrainType): TerrainDefinition {
  return TERRAIN_DEFINITIONS[type] ?? UNKNOWN_TERRAIN;
}
