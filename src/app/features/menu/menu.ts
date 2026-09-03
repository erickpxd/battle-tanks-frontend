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
  nameError = '';

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.playerName = sessionStorage.getItem(GAME_CONFIG.playerNameStorageKey) ?? '';
  }

  enterWaitingRoom(): void {
    const name = normalizeName(this.playerName);
    if (!name) {
      this.nameError = 'Informe seu nome para entrar na sala.';
      return;
    }

    this.nameError = '';
    this.playerName = name;
    sessionStorage.setItem(GAME_CONFIG.playerNameStorageKey, name);
    void this.router.navigate(['/waiting-room']);
  }

  openTutorial(): void {
    void this.router.navigate(['/tutorial']);
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
