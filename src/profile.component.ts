import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';

import { AuthService } from './auth.service';

@Component({
  selector: 'app-profile',
  imports: [NgOptimizedImage, RouterLink],
  templateUrl: './profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  // FIX: Explicitly typing injected services to fix type inference issues causing '... on type unknown' errors.
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);

  loggedInUser = this.authService.currentUser;
  activeFamily = this.authService.activeFamily;
  
  logout(): void {
    // FIX: Use `this.router` directly. Arrow functions in `subscribe` preserve the `this` context.
    this.authService.logout().subscribe(() => {
      this.router.navigate(['/home']);
    });
  }
}