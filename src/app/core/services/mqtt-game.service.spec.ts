import { parseGameEvent, roomSubscription } from './mqtt-game.service';

describe('MQTT game event helpers', () => {
  it('should parse a valid backend envelope', () => {
    const serialized = JSON.stringify({
      eventId: 'event-1',
      eventType: 'map.tile-destroyed',
      roomId: 'ROOM-ONE',
      playerId: 'player-1',
      sentAtUnixMs: 1000,
      publishedAtUnixMs: 1010,
      data: { column: 4, row: 5 },
    });

    expect(parseGameEvent(serialized)).toEqual(expect.objectContaining({ eventId: 'event-1' }));
  });

  it('should reject malformed or unsupported events', () => {
    expect(parseGameEvent('{broken-json')).toBeNull();
    expect(
      parseGameEvent(
        JSON.stringify({
          eventId: 'event-2',
          eventType: 'unknown.event',
          roomId: 'ROOM-ONE',
          sentAtUnixMs: 1000,
          publishedAtUnixMs: 1010,
          data: {},
        }),
      ),
    ).toBeNull();
  });

  it('should build a normalized room-only subscription', () => {
    expect(roomSubscription(' room-one ')).toBe('battle-tanks/ROOM-ONE/events/#');
  });
});
