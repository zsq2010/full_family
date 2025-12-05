import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

import { AuthService } from './auth.service';

@Component({
  selector: 'app-profile',
  imports: [NgOptimizedImage],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  loggedInUser = this.authService.currentUser;
  activeFamily = this.authService.activeFamily;
  
  logout(): void {
    // FIX: Use `this.router` directly. Arrow functions in `subscribe` preserve the `this` context.
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/home']);
    });
  }
}