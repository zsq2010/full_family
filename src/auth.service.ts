import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Assignee, Family, MockFamily, MockUser } from './types';
import { API_BASE_URL, USE_MOCK_API, DEV_AUTO_LOGIN, DEV_DEFAULT_USER } from './config';
import { Observable, of, throwError, delay } from 'rxjs';
import { tap, catchError } from 'rxjs';

// --- Mock Data Store ---
// This will act as our in-memory database for the mock API.

// The original family members, now used for the "demo" family.
export const FAMILY_MEMBERS: Assignee[] = [
  { id: 1, name: '我', avatar: 'https://picsum.photos/seed/me/100/100', age: 25 },
  { id: 2, name: '妈妈', avatar: 'https://picsum.photos/seed/mom/100/100', age: 49 },
  { id: 3, name: '爸爸', avatar: 'https://picsum.photos/seed/dad/100/100', age: 52 },
  { id: 4, name: '亚历克斯', avatar: 'https://picsum.photos/seed/alex/100/100', age: 18 },
];

const MOCK_FAMILIES: MockFamily[] = [
  { id: 'fam_demo', name: '演示家庭', memberIds: [1, 2, 3, 4], inviteCode: 'DEMO123' }
];

let ALL_ASSIGNEES: Assignee[] = [...FAMILY_MEMBERS];

const MOCK_USERS: MockUser[] = [
  { id: 101, username: 'me', password: 'password123', assigneeId: 1, familyIds: ['fam_demo'] },
  { id: 102, username: 'mom', password: 'password123', assigneeId: 2, familyIds: ['fam_demo'] },
  { id: 103, username: 'dad', password: 'password123', assigneeId: 3, familyIds: ['fam_demo'] },
  { id: 104, username: 'alex', password: 'password123', assigneeId: 4, familyIds: ['fam_demo'] },
];

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http: HttpClient = inject(HttpClient);
  currentUser = signal<Assignee | null>(null);
  userFamilies = signal<Family[]>([]);
  activeFamily = signal<Family | null>(null);

  constructor() {}

  checkSession(): Observable<Assignee | null> {
    if (USE_MOCK_API) {
      if (DEV_AUTO_LOGIN) {
        const user = MOCK_USERS.find(u => u.username === DEV_DEFAULT_USER.toLowerCase());
        if (user) {
          this._setSession(user);
          return of(this.currentUser());
        }
      }
      this._clearSession();
      return of(null);
    }

    return this.http.get<any>(`${API_BASE_URL}/auth/me`).pipe(
      tap(response => {
        this.currentUser.set(response.user);
        this.userFamilies.set(response.families);
        this.activeFamily.set(response.families?.[0] ?? null);
      }),
      catchError(() => {
        this._clearSession();
        return of(null);
      })
    );
  }

  login(username: string, password: string): Observable<Assignee> {
    if (USE_MOCK_API) {
      const user = MOCK_USERS.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
      if (user) {
        this._setSession(user);
        return of(this.currentUser()!).pipe(delay(500));
      }
      return throwError(() => new Error('无效的用户名或密码。')).pipe(delay(500));
    }

    return this.http.post<any>(`${API_BASE_URL}/auth/login`, { username, password }).pipe(
      tap(response => {
        this.currentUser.set(response.user);
        this.userFamilies.set(response.families);
        this.activeFamily.set(response.families?.[0] ?? null);
      })
    );
  }

  register(username: string, displayName: string, password: string): Observable<Assignee> {
    if (USE_MOCK_API) {
      if (MOCK_USERS.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return throwError(() => new Error('该用户名已被使用。')).pipe(delay(500));
      }

      const newAssignee: Assignee = {
        id: Date.now(),
        name: displayName,
        avatar: `https://picsum.photos/seed/${username}/100/100`,
        age: 0, // Age can be set later
      };
      ALL_ASSIGNEES.push(newAssignee);
      
      const newUser: MockUser = {
        id: Date.now(),
        username: username,
        password: password,
        assigneeId: newAssignee.id,
        familyIds: [],
      };
      MOCK_USERS.push(newUser);
      
      this._setSession(newUser);
      return of(this.currentUser()!).pipe(delay(500));
    }
    
    return this.http.post<any>(`${API_BASE_URL}/auth/register`, { username, displayName, password }).pipe(
      tap(response => {
        this.currentUser.set(response.user);
        // A new user won't have a family yet
        this.userFamilies.set([]);
        this.activeFamily.set(null);
      })
    );
  }

  createFamily(familyName: string): Observable<Family> {
    if (USE_MOCK_API) {
      const currentUser = this.currentUser();
      if (!currentUser) return throwError(() => new Error('用户未登录'));
      
      const userRecord = MOCK_USERS.find(u => u.assigneeId === currentUser.id);
      if (!userRecord) return throwError(() => new Error('无法找到用户记录'));

      const newFamily: MockFamily = {
        id: `fam_${Date.now()}`,
        name: familyName,
        memberIds: [currentUser.id],
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      };
      MOCK_FAMILIES.push(newFamily);
      userRecord.familyIds.push(newFamily.id);
      
      const newFullFamily: Family = {
        ...newFamily,
        members: [currentUser],
      }
      this.userFamilies.update(families => [...families, newFullFamily]);
      this.activeFamily.set(newFullFamily);

      return of(newFullFamily).pipe(delay(500));
    }
    return this.http.post<Family>(`${API_BASE_URL}/families`, { name: familyName }).pipe(
      tap(family => {
        this.userFamilies.update(families => [...families, family]);
        this.activeFamily.set(family);
      })
    );
  }

  joinFamily(inviteCode: string): Observable<Family> {
     if (USE_MOCK_API) {
      const currentUser = this.currentUser();
      if (!currentUser) return throwError(() => new Error('用户未登录'));
      
      const userRecord = MOCK_USERS.find(u => u.assigneeId === currentUser.id);
      if (!userRecord) return throwError(() => new Error('无法找到用户记录'));

      const familyToJoin = MOCK_FAMILIES.find(f => f.inviteCode === inviteCode.toUpperCase());
      if (!familyToJoin) return throwError(() => new Error('邀请码无效'));

      if(userRecord.familyIds.includes(familyToJoin.id)) {
        return throwError(() => new Error('您已经是该家庭的成员。')).pipe(delay(500));
      }

      familyToJoin.memberIds.push(currentUser.id);
      userRecord.familyIds.push(familyToJoin.id);

      const members = familyToJoin.memberIds.map(id => ALL_ASSIGNEES.find(a => a.id === id)!).filter(Boolean);
      const joinedFullFamily: Family = {
          ...familyToJoin,
          members,
      };

      this.userFamilies.update(families => [...families, joinedFullFamily]);
      this.activeFamily.set(joinedFullFamily);
      
      return of(joinedFullFamily).pipe(delay(500));
    }
    return this.http.post<Family>(`${API_BASE_URL}/families/join`, { inviteCode }).pipe(
      tap(family => {
        this.userFamilies.update(families => [...families, family]);
        this.activeFamily.set(family);
      })
    );
  }

  switchFamily(familyId: string) {
    const familyToActivate = this.userFamilies().find(f => f.id === familyId);
    if (familyToActivate) {
        this.activeFamily.set(familyToActivate);
    } else {
        console.error(`Attempted to switch to non-existent family ID: ${familyId}`);
    }
  }

  logout(): Observable<unknown> {
    this._clearSession();
    if (USE_MOCK_API) {
      return of(null);
    }
    
    return this.http.post(`${API_BASE_URL}/auth/logout`, {}).pipe(
      catchError((err) => {
        console.error('Logout API call failed, logging out on client.', err);
        return of(null);
      })
    );
  }

  private _setSession(user: MockUser): void {
    const assignee = ALL_ASSIGNEES.find(a => a.id === user.assigneeId);
    this.currentUser.set(assignee || null);

    if (user.familyIds && user.familyIds.length > 0) {
      const userFamilies = MOCK_FAMILIES
        .filter(f => user.familyIds.includes(f.id))
        .map(mockFamily => {
          const members = mockFamily.memberIds.map(id => ALL_ASSIGNEES.find(a => a.id === id)!).filter(Boolean);
          return { ...mockFamily, members };
        });
      this.userFamilies.set(userFamilies);
      this.activeFamily.set(userFamilies[0] ?? null);
    } else {
      this.userFamilies.set([]);
      this.activeFamily.set(null);
    }
  }

  private _clearSession(): void {
    this.currentUser.set(null);
    this.userFamilies.set([]);
    this.activeFamily.set(null);
  }
}
