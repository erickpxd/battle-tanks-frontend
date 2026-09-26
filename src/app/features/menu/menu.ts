import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { GAME_CONFIG } from '../../core/config/game.config';
import { AuthService } from '../../core/services/auth.service';
import { RoomApiService } from '../../core/services/room-api.service';

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
  isLoading = false;
  apiError = '';

  constructor(
    private readonly authService: AuthService,
    private readonly roomApiService: RoomApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const savedName = this.authService.getUsername() || sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey);
    this.playerName = savedName ?? '';
    this.roomCode = sessionStorage.getItem(GAME_CONFIG.roomCodeStorageKey) ?? '';
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  goToAuth(): void {
    void this.router.navigate(['/auth']);
  }

  logout(): void {
    this.authService.logout();
    this.playerName = '';
  }

  createRoom(): void {
    this.clearErrors();
    if (!this.authService.isAuthenticated()) {
      void this.router.navigate(['/auth']);
      return;
    }

    const name = normalizeName(this.playerName);
    if (!name) {
      this.nameError = 'Informe seu nome para criar uma sala.';
      return;
    }

    this.isLoading = true;
    this.roomApiService.createRoom('default').subscribe({
      next: (room) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.openWaitingRoom(name, room.roomCode);
      },
      error: (err: Error) => {
        this.isLoading = false;
        this.apiError = err.message;
        this.cdr.detectChanges();
      },
    });
  }

  joinRoom(): void {
    this.clearErrors();
    if (!this.authService.isAuthenticated()) {
      void this.router.navigate(['/auth']);
      return;
    }

    const name = normalizeName(this.playerName);
    const roomCode = normalizeRoomCode(this.roomCode);
    this.nameError = name ? '' : 'Informe seu nome para entrar na sala.';
    this.roomCodeError = roomCode ? '' : 'Informe o código da sala.';
    if (!name || !roomCode) {
      return;
    }

    this.isLoading = true;
    console.log('Sending join request...', roomCode);
    this.roomApiService.joinRoomByCode(roomCode).subscribe({
      next: (room) => {
        console.log('Join request successful', room);
        this.isLoading = false;
        this.cdr.detectChanges();
        this.openWaitingRoom(name, room.roomCode);
      },
      error: (err: Error) => {
        console.log('Join request error', err);
        this.isLoading = false;
        this.roomCodeError = err.message;
        this.cdr.detectChanges();
      },
    });
  }

  openTutorial(): void {
    void this.router.navigate(['/tutorial']);
  }

  private clearErrors(): void {
    this.nameError = '';
    this.roomCodeError = '';
    this.apiError = '';
  }

  private openWaitingRoom(name: string, roomCode: string): void {
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
