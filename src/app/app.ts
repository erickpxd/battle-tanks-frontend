import { Component } from '@angular/core';

import { GameRoomComponent } from './game-room/game-room.component';

@Component({
  selector: 'app-root',
  imports: [GameRoomComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
