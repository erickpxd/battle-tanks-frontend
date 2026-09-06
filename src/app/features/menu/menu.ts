import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { GAME_CONFIG } from '../../core/config/game.config';

@Component({
  selector: 'app-menu',
  imports: [FormsModule],
  templateUrl: './menu.html',
  styleUrl: './menu.scss',
})
export class Menu implements OnInit {
  playerName = '';
  roomCode = '';
  nameError = '';
  roomCodeError = '';

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.playerName = sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ?? '';
    this.roomCode = sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey) ?? '';
  }

  createRoom(): void {
    const name = normalizeName(this.playerName);
    if (!name) {
      this.nameError = 'Informe seu nome para criar uma sala.';
      return;
    }

    this.openWaitingRoom(name, createRoomCode());
  }

  joinRoom(): void {
    const name = normalizeName(this.playerName);
    const roomCode = normalizeRoomCode(this.roomCode);
    this.nameError = name ? '' : 'Informe seu nome para entrar na sala.';
    this.roomCodeError = roomCode ? '' : 'Informe o código da sala.';
    if (!name || !roomCode) {
      return;
    }

    this.openWaitingRoom(name, roomCode);
  }

  openTutorial(): void {
    void this.router.navigate(['/tutorial']);
  }

  private openWaitingRoom(name: string, roomCode: string): void {
    this.nameError = '';
    this.roomCodeError = '';
    this.playerName = name;
    this.roomCode = roomCode;
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, name);
    sessionStorage.setItem(GAME_CONFIG.roomCodeStorageKey, roomCode);
    void this.router.navigate(['/waiting-room']);
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().replace(/\s+/g, '').toUpperCase();
}

function createRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = crypto.getRandomValues(new Uint8Array(6));
  return [...values].map((value) => alphabet[value % alphabet.length]).join('');
}
