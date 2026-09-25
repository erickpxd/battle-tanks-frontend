export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

export interface Position {
  /** Coluna da grade do campo de batalha. */
  x: number;
  /** Linha da grade do campo de batalha. */
  y: number;
  direction: PlayerDirection;
}
