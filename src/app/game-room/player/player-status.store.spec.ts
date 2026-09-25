import { NewPlayer } from './player.model';
import { PlayerStatusSignalStore } from './player-status.store';

describe('PlayerStatusSignalStore', () => {
  let store: PlayerStatusSignalStore;

  beforeEach(() => {
    store = new PlayerStatusSignalStore();
  });

  it('should add a player', () => {
    const player = createPlayer({
      id: 'player-1',
      name: 'Ana'
    });

    store.addPlayer(player);

    expect(store.players()).toEqual([
      expect.objectContaining({
        id: 'player-1',
        name: 'Ana',
      }),
    ]);
    expect(store.playerCount()).toBe(1);
  });

  it('should update a player position', () => {
    const player = createPlayer({
      id: 'player-1',
      name: 'Ana'
    });

    store.addPlayer(player);
    store.updatePlayerPosition('player-1', {
      x: 42,
      y: 18,
      rotation: 90
    });

    expect(store.players()[0]?.position).toEqual({
      x: 42,
      y: 18,
      rotation: 90,
    });
  });

  it('should remove a player', () => {
    const player = createPlayer({
      id: 'player-1',
      name: 'Ana'
    });

    store.addPlayer(player);
    store.removePlayer('player-1');

    expect(store.players()).toEqual([]);
    expect(store.playerCount()).toBe(0);
  });
});

function createPlayer(overrides: Partial<NewPlayer> = {}): NewPlayer {
  return {
    id: 'player-1',
    name: 'Jogador',
    position: {
      x: 10,
      y: 20,
      rotation: 0,
    },
    health: 100,
    maxHealth: 100,
    score: 0,
    team: 'blue',
    ...overrides,
  };
}
