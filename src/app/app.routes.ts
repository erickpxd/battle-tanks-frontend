import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'waiting-room',
  },
  {
    path: 'waiting-room',
    loadComponent: () =>
      import('./features/waiting-room/waiting-room').then((component) => component.WaitingRoom),
  },
  {
    path: 'game',
    loadComponent: () => import('./features/game/game').then((component) => component.Game),
  },
  {
    path: '**',
    redirectTo: 'waiting-room',
  },
];
