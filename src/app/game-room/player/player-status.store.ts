import { computed, Injectable, signal } from '@angular/core';

import { ConnectedPlayer, NewPlayer, PlayerPosition, PlayerRoomEvent } from './player.model';

interface PlayerStatusState {
  players: Record<string, ConnectedPlayer>;
}

const initialState: PlayerStatusState = {
  players: {},
};

@Injectable({
  providedIn: 'root',
})
export class PlayerStatusSignalStore {
  private readonly state = signal<PlayerStatusState>(initialState);

  readonly players = computed(() =>
    Object.values(this.state().players).sort((first, second) =>
      first.name.localeCompare(second.name),
    ),
  );

  readonly playerCount = computed(() => this.players().length);

  readonly hasPlayers = computed(() => this.playerCount() > 0);

  addPlayer(player: NewPlayer): void {
    const now = new Date().toISOString();
    const normalizedPlayer: ConnectedPlayer = {
      ...player,
      position: { ...player.position },
      health: clamp(player.health, 0, player.maxHealth),
      connectedAt: player.connectedAt ?? now,
      lastSeenAt: player.lastSeenAt ?? now,
    };

    this.state.update((state) => ({
      players: {
        ...state.players,
        [normalizedPlayer.id]: normalizedPlayer,
      },
    }));
  }

  removePlayer(playerId: string): void {
    this.state.update((state) => {
      if (!state.players[playerId]) {
        return state;
      }

      const { [playerId]: removedPlayer, ...remainingPlayers } = state.players;

      return {
        players: remainingPlayers,
      };
    });
  }

  updatePlayerPosition(playerId: string, position: Partial<PlayerPosition>): void {
    this.state.update((state) => {
      const currentPlayer = state.players[playerId];

      if (!currentPlayer) {
        return state;
      }

      return {
        players: {
          ...state.players,
          [playerId]: {
            ...currentPlayer,
            position: {
              ...currentPlayer.position,
              ...position,
            },
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
    });
  }

  applyRoomEvent(event: PlayerRoomEvent): void {
    switch (event.type) {
      case 'playerJoined':
        this.addPlayer(event.player);
        return;
      case 'playerLeft':
        this.removePlayer(event.playerId);
        return;
      case 'playerMoved':
        this.updatePlayerPosition(event.playerId, event.position);
        return;
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
