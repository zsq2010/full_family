import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { InventoryComponent } from './inventory.component';
import { HealthComponent } from './health.component';
import { ProfileComponent } from './profile.component';
import { AppsComponent } from './apps.component';
import { AppDetailComponent } from './app-detail.component';

export const appRoutes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'inventory', component: InventoryComponent },
  { path: 'health', component: HealthComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'apps', component: AppsComponent },
  { path: 'apps/:id', component: AppDetailComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' } // Wildcard route for a 404 page
];