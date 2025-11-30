import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection, importProvidersFrom } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter, withHashLocation } from '@angular/router';

import { AppComponent } from './src/app.component';
import { authInterceptor } from './src/auth.interceptor';
import { appRoutes } from './src/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes, withHashLocation()),
    provideZonelessChangeDetection(),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    importProvidersFrom(ReactiveFormsModule),
  ],
}).catch(err => console.error(err));

// AI Studio always uses an `index.tsx` file for all project types.