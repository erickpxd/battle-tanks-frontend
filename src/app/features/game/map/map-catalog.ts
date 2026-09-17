import { GAME_CONFIG } from '../../../core/config/game.config';
import battlegroundSource from './default-map.json';
import fortressSource from './fortress-map.json';
import ruinsSource from './ruins-map.json';
import swampSource from './swamp-map.json';

export type MapId = 'battleground' | 'fortress' | 'swamp' | 'ruins';

export interface MapVisualTheme {
  readonly background: string;
  readonly grid: string;
  readonly groundAccent: string;
  readonly brick: string;
  readonly brickLight: string;
  readonly brickDark: string;
  readonly steel: string;
  readonly steelLight: string;
  readonly steelDark: string;
  readonly water: string;
  readonly waterAccent: string;
  readonly trees: string;
  readonly treesAccent: string;
  readonly ice: string;
  readonly iceAccent: string;
}

interface MapSource {
  readonly tiles: ReadonlyArray<ReadonlyArray<number>>;
  readonly spawns: ReadonlyArray<{
    readonly player: number;
    readonly x: number;
    readonly y: number;
    readonly direction: string;
  }>;
}

export interface MapDefinition {
  readonly id: MapId;
  readonly name: string;
  readonly description: string;
  readonly source: MapSource;
  readonly theme: MapVisualTheme;
}

export const MAP_CATALOG: readonly MapDefinition[] = [
  {
    id: 'battleground',
    name: 'Battleground',
    description: 'Corredores simétricos, paredes de tijolos e centro aberto.',
    source: battlegroundSource,
    theme: {
      background: '#11150f',
      grid: '#252d21',
      groundAccent: '#182016',
      brick: '#b85c38',
      brickLight: '#e09055',
      brickDark: '#71341f',
      steel: '#aab2b5',
      steelLight: '#e4e9e8',
      steelDark: '#596266',
      water: '#286b8f',
      waterAccent: '#55a7c7',
      trees: '#355f2d',
      treesAccent: '#5f914e',
      ice: '#a8d8df',
      iceAccent: '#e0f6f7',
    },
  },
  {
    id: 'fortress',
    name: 'Fortress',
    description: 'Paredes de aço e caminhos estreitos que favorecem a defesa.',
    source: fortressSource,
    theme: {
      background: '#151719',
      grid: '#30353a',
      groundAccent: '#1d2226',
      brick: '#875849',
      brickLight: '#bd7a63',
      brickDark: '#4c3029',
      steel: '#7e8992',
      steelLight: '#d5dde2',
      steelDark: '#3d474f',
      water: '#294d63',
      waterAccent: '#50809a',
      trees: '#3c5140',
      treesAccent: '#637a67',
      ice: '#93b4bd',
      iceAccent: '#d4e8ec',
    },
  },
  {
    id: 'swamp',
    name: 'Swamp',
    description: 'Água e vegetação criam emboscadas e controlam as passagens.',
    source: swampSource,
    theme: {
      background: '#172017',
      grid: '#2b3829',
      groundAccent: '#202c1f',
      brick: '#73533a',
      brickLight: '#9f7752',
      brickDark: '#45301f',
      steel: '#77817b',
      steelLight: '#b9c2bb',
      steelDark: '#414942',
      water: '#285b57',
      waterAccent: '#4b8980',
      trees: '#294f2b',
      treesAccent: '#4d7945',
      ice: '#8db8b0',
      iceAccent: '#cce0db',
    },
  },
  {
    id: 'ruins',
    name: 'Ruins',
    description: 'Muitas paredes destrutíveis transformam o campo rapidamente.',
    source: ruinsSource,
    theme: {
      background: '#1d1815',
      grid: '#382d27',
      groundAccent: '#28201c',
      brick: '#9b5038',
      brickLight: '#d17a58',
      brickDark: '#552b20',
      steel: '#8a817b',
      steelLight: '#c7beb7',
      steelDark: '#4d4642',
      water: '#365b68',
      waterAccent: '#5e8791',
      trees: '#46543a',
      treesAccent: '#71815d',
      ice: '#9ab4b2',
      iceAccent: '#d5e2df',
    },
  },
] as const;

export function getMapDefinition(value: string | null | undefined): MapDefinition {
  const normalized =
    value?.trim().toLowerCase() === 'default' ? 'battleground' : value?.trim().toLowerCase();
  return MAP_CATALOG.find((map) => map.id === normalized) ?? MAP_CATALOG[0];
}

export function getSelectedMapDefinition(): MapDefinition {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/tutorial')) {
    return MAP_CATALOG[0];
  }
  const selected =
    typeof sessionStorage === 'undefined'
      ? null
      : sessionStorage.getItem(GAME_CONFIG.mapStorageKey);
  return getMapDefinition(selected);
}
