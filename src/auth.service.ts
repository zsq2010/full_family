import { Injectable, signal } from '@angular/core';
import { Assignee } from './types';
import { DEV_AUTO_LOGIN, DEV_DEFAULT_USER } from './config';

// --- 开发配置 ---
// 配置已移至 src/config.ts
// --------------------

export const FAMILY_MEMBERS: Assignee[] = [
  { name: '我', avatar: 'https://picsum.photos/seed/me/100/100', age: 25 },
  { name: '妈妈', avatar: 'https://picsum.photos/seed/mom/100/100', age: 49 },
  { name: '爸爸', avatar: 'https://picsum.photos/seed/dad/100/100', age: 52 },
  { name: '亚历克斯', avatar: 'https://picsum.photos/seed/alex/100/100', age: 18 },
];

// Mock user credentials. Usernames are for login, names are for display.
const USERS = new Map<string, { password: string, user: Assignee }>([
    ['me', { password: 'password123', user: FAMILY_MEMBERS[0] }],
    ['mom', { password: 'password123', user: FAMILY_MEMBERS[1] }],
    ['dad', { password: 'password123', user: FAMILY_MEMBERS[2] }],
    ['alex', { password: 'password123', user: FAMILY_MEMBERS[3] }],
]);


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  currentUser = signal<Assignee | null>(null);

  constructor() {
    // Read auto-login settings from the config file.
    if (DEV_AUTO_LOGIN) {
      const devUser = USERS.get(DEV_DEFAULT_USER);
      if (devUser) {
        this.currentUser.set(devUser.user);
      }
    }
  }

  login(username: string, password: string): boolean {
    const cleanUsername = username.toLowerCase().trim();
    const userData = USERS.get(cleanUsername);
    if (userData && userData.password === password) {
      this.currentUser.set(userData.user);
      return true;
    }
    return false;
  }

  logout(): void {
    this.currentUser.set(null);
  }
}