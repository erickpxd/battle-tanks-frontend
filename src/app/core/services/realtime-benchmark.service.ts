import { Injectable } from '@angular/core';

export type RealtimeEventKind = 'movement' | 'chat' | 'map';
export type BenchmarkProtocol = 'MQTT' | 'SignalR';

export interface ProtocolBenchmarkSample {
  readonly protocol: BenchmarkProtocol;
  readonly eventType: string;
  readonly eventId: string;
  readonly sentAt: number;
  readonly receivedAt: number;
  readonly latencyMs: number;
  readonly roomId: string;
}

export interface ProtocolBenchmarkSummary {
  readonly protocol: BenchmarkProtocol;
  readonly received: number;
  readonly duplicates: number;
  readonly minimumLatencyMs: number;
  readonly averageLatencyMs: number;
  readonly maximumLatencyMs: number;
  readonly p95LatencyMs: number;
}

export interface RealtimeBenchmarkReport {
  readonly sentEvents: number;
  readonly receivedEvents: number;
  readonly acknowledgedEvents: number;
  readonly averageRoundTripMs: number;
  readonly maximumRoundTripMs: number;
  readonly possibleCongestion: boolean;
}

@Injectable({ providedIn: 'root' })
export class RealtimeBenchmarkService {
  private readonly pending = new Map<string, number>();
  private readonly roundTrips: number[] = [];
  private readonly protocolSamples: ProtocolBenchmarkSample[] = [];
  private readonly receivedProtocolEvents = new Set<string>();
  private readonly duplicateCounts: Record<BenchmarkProtocol, number> = { MQTT: 0, SignalR: 0 };
  private sentEvents = 0;
  private receivedEvents = 0;

  recordSent(eventId: string): void {
    this.sentEvents += 1;
    this.pending.set(eventId, performance.now());
  }

  recordReceived(): void {
    this.receivedEvents += 1;
  }

  recordProtocolReceived(
    protocol: BenchmarkProtocol,
    eventType: string,
    eventId: string | null | undefined,
    sentAt: number | null | undefined,
    roomId: string,
  ): void {
    this.recordReceived();
    if (!eventId || !Number.isFinite(sentAt)) {
      return;
    }

    const uniqueKey = `${protocol}:${eventId}`;
    if (this.receivedProtocolEvents.has(uniqueKey)) {
      this.duplicateCounts[protocol] += 1;
      return;
    }
    this.receivedProtocolEvents.add(uniqueKey);

    const receivedAt = Date.now();
    this.protocolSamples.push({
      protocol,
      eventType,
      eventId,
      sentAt: sentAt as number,
      receivedAt,
      latencyMs: Math.max(0, receivedAt - (sentAt as number)),
      roomId,
    });
  }

  recordAcknowledged(eventId: string): void {
    const startedAt = this.pending.get(eventId);
    if (startedAt === undefined) {
      return;
    }

    this.pending.delete(eventId);
    this.roundTrips.push(performance.now() - startedAt);
  }

  report(): RealtimeBenchmarkReport {
    const total = this.roundTrips.reduce((sum, value) => sum + value, 0);
    const average = this.roundTrips.length === 0 ? 0 : total / this.roundTrips.length;
    const maximum = this.roundTrips.length === 0 ? 0 : Math.max(...this.roundTrips);
    return {
      sentEvents: this.sentEvents,
      receivedEvents: this.receivedEvents,
      acknowledgedEvents: this.roundTrips.length,
      averageRoundTripMs: round(average),
      maximumRoundTripMs: round(maximum),
      possibleCongestion: maximum > 250 || this.pending.size > 10,
    };
  }

  reset(): void {
    this.pending.clear();
    this.roundTrips.length = 0;
    this.sentEvents = 0;
    this.receivedEvents = 0;
    this.protocolSamples.length = 0;
    this.receivedProtocolEvents.clear();
    this.duplicateCounts.MQTT = 0;
    this.duplicateCounts.SignalR = 0;
  }

  protocolReport(): ProtocolBenchmarkSummary[] {
    return (['MQTT', 'SignalR'] as const).map((protocol) => {
      const latencies = this.protocolSamples
        .filter((sample) => sample.protocol === protocol)
        .map((sample) => sample.latencyMs)
        .sort((left, right) => left - right);
      const total = latencies.reduce((sum, latency) => sum + latency, 0);
      return {
        protocol,
        received: latencies.length,
        duplicates: this.duplicateCounts[protocol],
        minimumLatencyMs: round(latencies[0] ?? 0),
        averageLatencyMs: round(latencies.length ? total / latencies.length : 0),
        maximumLatencyMs: round(latencies.at(-1) ?? 0),
        p95LatencyMs: round(percentile(latencies, 0.95)),
      };
    });
  }

  exportJson(): string {
    return JSON.stringify(this.protocolSamples, null, 2);
  }

  exportCsv(): string {
    const header = 'protocol,eventType,eventId,sentAt,receivedAt,latencyMs,roomId';
    const rows = this.protocolSamples.map((sample) =>
      [
        sample.protocol,
        sample.eventType,
        sample.eventId,
        sample.sentAt,
        sample.receivedAt,
        sample.latencyMs,
        sample.roomId,
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(sortedValues: readonly number[], percentileValue: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1),
  );
  return sortedValues[index];
}
