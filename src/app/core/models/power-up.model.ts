export type PowerUpType = 'machine-gun' | 'double-damage' | 'shield' | 'speed-boost' | 'repair-kit';

export interface PowerUp {
  readonly id: string;
  readonly type: PowerUpType;
  readonly x: number;
  readonly y: number;
  readonly expiresAt: string;
}

export const POWER_UP_LABELS: Readonly<Record<PowerUpType, string>> = {
  'machine-gun': 'Metralhadora',
  'double-damage': 'Dano duplo',
  shield: 'Escudo',
  'speed-boost': 'Velocidade',
  'repair-kit': 'Reparo',
};
