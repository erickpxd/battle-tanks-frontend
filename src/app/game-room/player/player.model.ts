export interface PlayerPosition {
  x: number;
  y: number;
  rotation: number;
}

export type PlayerTeam = 'blue' | 'red' | 'neutral';

export interface ConnectedPlayer {
  id: string;
  name: string;
  position: PlayerPosition;
  health: number;
  maxHealth: number;
  score: number;
  team: PlayerTeam;
  connectedAt: string;
  lastSeenAt: string;
}

export type NewPlayer = Omit<ConnectedPlayer, 'connectedAt' | 'lastSeenAt'> &
  Partial<Pick<ConnectedPlayer, 'connectedAt' | 'lastSeenAt'>>;

export type PlayerRoomEvent =
  | {
      type: 'playerJoined';
      player: NewPlayer;
    }
  | {
      type: 'playerLeft';
      playerId: string;
    }
  | {
      type: 'playerMoved';
      playerId: string;
      position: Partial<PlayerPosition>;
    };
