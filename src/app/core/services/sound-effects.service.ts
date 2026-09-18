import { Injectable, signal } from '@angular/core';

import { GAME_CONFIG } from '../config/game.config';
import { PowerUpType } from '../models/power-up.model';

type OscillatorWave = OscillatorType;

@Injectable({ providedIn: 'root' })
export class SoundEffectsService {
  private readonly enabledState = signal(readInitialSoundPreference());
  private context?: AudioContext;

  readonly enabled = this.enabledState.asReadonly();

  toggle(): boolean {
    const enabled = !this.enabledState();
    this.enabledState.set(enabled);
    localStorage.setItem(GAME_CONFIG.soundEnabledStorageKey, String(enabled));
    if (enabled) {
      this.unlock();
      this.playPowerUp('repair-kit');
    }
    return enabled;
  }

  unlock(): void {
    const context = this.getContext();
    if (context?.state === 'suspended') {
      void context.resume();
    }
  }

  playMove(): void {
    this.tone(72, 52, 0.055, 0.035, 'square');
  }

  playShot(machineGun = false): void {
    this.tone(
      machineGun ? 310 : 230,
      machineGun ? 125 : 82,
      machineGun ? 0.055 : 0.1,
      0.09,
      'square',
    );
  }

  playImpact(destructive = false): void {
    this.noise(destructive ? 0.15 : 0.08, destructive ? 0.12 : 0.07);
    this.tone(destructive ? 105 : 155, 48, destructive ? 0.16 : 0.08, 0.065, 'sawtooth');
  }

  playPlayerHit(destroyed = false): void {
    this.noise(destroyed ? 0.32 : 0.13, destroyed ? 0.16 : 0.1);
    this.tone(destroyed ? 92 : 175, 42, destroyed ? 0.3 : 0.13, 0.09, 'square');
  }

  playPowerUp(type: PowerUpType): void {
    const patterns: Record<PowerUpType, readonly number[]> = {
      'machine-gun': [180, 260, 360],
      'double-damage': [220, 330, 440],
      shield: [260, 390, 520],
      'speed-boost': [300, 450, 650],
      'repair-kit': [330, 440, 660],
    };
    patterns[type].forEach((frequency, index) => {
      this.tone(frequency, frequency * 1.08, 0.09, 0.055, 'square', index * 0.065);
    });
  }

  playGameOver(): void {
    [330, 247, 196, 131].forEach((frequency, index) => {
      this.tone(frequency, frequency * 0.92, 0.18, 0.07, 'square', index * 0.14);
    });
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    durationSeconds: number,
    volume: number,
    wave: OscillatorWave,
    delaySeconds = 0,
  ): void {
    const context = this.readyContext();
    if (!context) {
      return;
    }
    const startsAt = context.currentTime + delaySeconds;
    const endsAt = startsAt + durationSeconds;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(startFrequency, startsAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 1), endsAt);
    gain.gain.setValueAtTime(volume, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.001, endsAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startsAt);
    oscillator.stop(endsAt);
  }

  private noise(durationSeconds: number, volume: number): void {
    const context = this.readyContext();
    if (!context) {
      return;
    }
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const startsAt = context.currentTime;
    gain.gain.setValueAtTime(volume, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startsAt + durationSeconds);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(startsAt);
  }

  private readyContext(): AudioContext | undefined {
    if (!this.enabledState()) {
      return undefined;
    }
    const context = this.getContext();
    if (context?.state === 'suspended') {
      void context.resume();
    }
    return context;
  }

  private getContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }
    const AudioContextConstructor =
      globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) {
      return undefined;
    }
    this.context = new AudioContextConstructor();
    return this.context;
  }
}

function readInitialSoundPreference(): boolean {
  if (typeof localStorage === 'undefined') {
    return true;
  }
  return localStorage.getItem(GAME_CONFIG.soundEnabledStorageKey) !== 'false';
}
