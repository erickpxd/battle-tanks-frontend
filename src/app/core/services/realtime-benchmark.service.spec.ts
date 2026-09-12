import { RealtimeBenchmarkService } from './realtime-benchmark.service';

describe('RealtimeBenchmarkService', () => {
  it('should deduplicate protocol samples and export CSV', () => {
    const service = new RealtimeBenchmarkService();
    const sentAt = Date.now() - 10;

    service.recordProtocolReceived('MQTT', 'collision.player-hit', 'event-1', sentAt, 'ROOM-ONE');
    service.recordProtocolReceived('MQTT', 'collision.player-hit', 'event-1', sentAt, 'ROOM-ONE');

    const mqtt = service.protocolReport().find((summary) => summary.protocol === 'MQTT');
    expect(mqtt).toEqual(expect.objectContaining({ received: 1, duplicates: 1 }));
    expect(service.exportCsv()).toContain(
      'protocol,eventType,eventId,sentAt,receivedAt,latencyMs,roomId',
    );
    expect(service.exportCsv()).toContain('MQTT,collision.player-hit,event-1');
  });
});
