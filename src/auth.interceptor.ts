import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { API_BASE_URL } from './config';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Define public routes that should not receive the auth token
  const isAuthRequest = req.url.includes('/auth/login') || req.url.includes('/auth/register');

  // Only add the token for requests to our API that are NOT auth requests
  if (token && req.url.startsWith(API_BASE_URL) && !isAuthRequest) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(cloned);
  }

  return next(req);
};
