import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/splash/splash').then((component) => component.Splash),
  },
  {
    path: 'menu',
    loadComponent: () => import('./features/menu/menu').then((component) => component.Menu),
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
    path: 'tutorial',
    loadComponent: () => import('./features/game/game').then((component) => component.Game),
  },
  {
    path: '**',
    redirectTo: 'menu',
  },
];
