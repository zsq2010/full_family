import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Assignee } from './types';
import { API_BASE_URL, USE_MOCK_API, DEV_AUTO_LOGIN, DEV_DEFAULT_USER } from './config';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs';

export const FAMILY_MEMBERS: Assignee[] = [
  { name: '我', avatar: 'https://picsum.photos/seed/me/100/100', age: 25 },
  { name: '妈妈', avatar: 'https://picsum.photos/seed/mom/100/100', age: 49 },
  { name: '爸爸', avatar: 'https://picsum.photos/seed/dad/100/100', age: 52 },
  { name: '亚历克斯', avatar: 'https://picsum.photos/seed/alex/100/100', age: 18 },
];

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // FIX: Cast injected HttpClient to its type to avoid type inference issues.
  private http = inject(HttpClient) as HttpClient;
  currentUser = signal<Assignee | null>(null);

  constructor() {
    // 构造函数现在为空，会话检查由应用组件主动发起
  }

  checkSession(): Observable<Assignee | null> {
    if (USE_MOCK_API) {
      if (DEV_AUTO_LOGIN) {
        const user = FAMILY_MEMBERS.find(m => m.name.toLowerCase() === DEV_DEFAULT_USER) ?? FAMILY_MEMBERS[0];
        this.currentUser.set(user);
        return of(user);
      }
      this.currentUser.set(null);
      return of(null);
    }

    return this.http.get<Assignee>(`${API_BASE_URL}/auth/me`).pipe(
      tap(user => this.currentUser.set(user)),
      catchError(() => {
        this.currentUser.set(null);
        return of(null);
      })
    );
  }

  login(username: string, password: string): Observable<Assignee> {
    if (USE_MOCK_API) {
      const user = FAMILY_MEMBERS.find(
        (m) => m.name.toLowerCase() === username.toLowerCase()
      );
      if (user && password === 'password123') {
        this.currentUser.set(user);
        return of(user);
      }
      return throwError(() => new Error('无效的用户名或密码'));
    }

    return this.http.post<Assignee>(`${API_BASE_URL}/auth/login`, { username, password }).pipe(
      tap(user => {
        this.currentUser.set(user);
      })
    );
  }

  logout(): Observable<unknown> {
    if (USE_MOCK_API) {
      this.currentUser.set(null);
      return of(null);
    }
    
    return this.http.post(`${API_BASE_URL}/auth/logout`, {}).pipe(
      tap(() => {
        this.currentUser.set(null);
      }),
      catchError((err) => {
        console.error('Logout API call failed, logging out on client.', err);
        this.currentUser.set(null);
        return of(null);
      })
    );
  }
}
