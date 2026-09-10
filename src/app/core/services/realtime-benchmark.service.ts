import { Injectable } from '@angular/core';

export type RealtimeEventKind = 'movement' | 'chat' | 'map';

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
  private sentEvents = 0;
  private receivedEvents = 0;

  recordSent(eventId: string): void {
    this.sentEvents += 1;
    this.pending.set(eventId, performance.now());
  }

  recordReceived(): void {
    this.receivedEvents += 1;
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
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
