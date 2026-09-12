import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { benchmarkInterceptor } from './core/interceptors/benchmark.interceptor';
import { gameFeatureKey, gameReducer } from './core/store/game.reducer';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([benchmarkInterceptor])),
    provideStore({ [gameFeatureKey]: gameReducer }),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(),
      autoPause: true,
      name: 'Battle Tanks Multiplayer',
    }),
  ],
};
