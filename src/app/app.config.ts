import { ApplicationConfig, APP_INITIALIZER, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { FirebaseService } from './services/firebase.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Ensure FirebaseService (and thus Analytics) is initialized at startup
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [FirebaseService],
      multi: true,
    },
  ],
};
