import { computed, Injectable, signal } from '@angular/core';

import { Tank, TankSpawn } from '../../../core/models/tank.model';
import { PlayerDirection } from '../../../core/models/position.model';
import defaultMapSource from '../map/default-map.json';

interface TankState {
  readonly tank: Tank;
}

const MAX_HEALTH = 100;
const DIRECTIONS: ReadonlySet<string> = new Set(['up', 'right', 'down', 'left']);

@Injectable({
  providedIn: 'root',
})
export class TankSignalStore {
  readonly spawns: ReadonlyArray<TankSpawn> = Object.freeze(defaultMapSource.spawns.map(readSpawn));

  private readonly state = signal<TankState>({
    tank: createTank(this.spawns[0]),
  });

  readonly tank = computed(() => this.state().tank);
  readonly isActive = computed(() => this.tank().status === 'active');
  readonly healthPercentage = computed(() => this.tank().health / this.tank().maxHealth);

  selectSpawn(player: number): boolean {
    const spawn = this.spawns.find((candidate) => candidate.player === player);
    if (!spawn) {
      return false;
    }

    this.state.set({ tank: createTank(spawn) });
    return true;
  }

  turn(direction: PlayerDirection): void {
    if (!this.isActive()) {
      return;
    }

    this.updateTank((tank) => ({
      ...tank,
      position: freezePosition({ ...tank.position, direction }),
    }));
  }

  moveTo(x: number, y: number): boolean {
    if (!this.isActive() || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
      return false;
    }

    this.updateTank((tank) => ({
      ...tank,
      position: freezePosition({ ...tank.position, x, y }),
    }));
    return true;
  }

  damage(amount: number): void {
    if (!this.isActive() || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    this.setHealth(this.tank().health - amount);
  }

  setHealth(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    this.updateTank((tank) => {
      const health = clamp(Math.round(value), 0, tank.maxHealth);
      return {
        ...tank,
        health,
        status: health === 0 ? 'destroyed' : 'active',
      };
    });
  }

  private updateTank(update: (tank: Tank) => Tank): void {
    this.state.update(({ tank }) => ({
      tank: Object.freeze(update(tank)),
    }));
  }
}

function createTank(spawn: TankSpawn): Tank {
  return Object.freeze({
    id: `tank-${spawn.player}`,
    player: spawn.player,
    position: freezePosition({
      x: spawn.x,
      y: spawn.y,
      direction: spawn.direction,
    }),
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    status: 'active',
  });
}

function readSpawn(value: { player: number; x: number; y: number; direction: string }): TankSpawn {
  if (
    !Number.isInteger(value.player) ||
    !Number.isInteger(value.x) ||
    !Number.isInteger(value.y) ||
    !DIRECTIONS.has(value.direction)
  ) {
    throw new Error('O mapa contém um ponto de nascimento inválido.');
  }

  return Object.freeze({
    ...value,
    direction: value.direction as PlayerDirection,
  });
}

function freezePosition(position: {
  x: number;
  y: number;
  direction: PlayerDirection;
}): Readonly<{ x: number; y: number; direction: PlayerDirection }> {
  return Object.freeze(position);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
