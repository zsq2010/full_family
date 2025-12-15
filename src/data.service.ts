import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Post, Assignee, ReactionType, Comment, NeedStatus, InventoryItem, InventoryStatus, AiSuggestion, HealthLog, WeatherInfo, AirQualityInfo, EnvironmentalContext, LocationInfo, InventoryItemComment, InventoryCategory, UserApplicationsResponse, UserApplicationEntry, AppConfig, ConfigData } from './types';
import { of, Observable, throwError, forkJoin } from 'rxjs';
// FIX: Operators should be imported from 'rxjs' directly, not 'rxjs/operators'.
import { tap, catchError, map, switchMap, delay } from 'rxjs';
import { API_BASE_URL, USE_MOCK_API } from './config';
import { MOCK_POSTS, MOCK_INVENTORY, MOCK_HEALTH_LOGS } from './mock-data';
import { AuthService } from './auth.service';

const MOCK_USER_APPLICATIONS_RESPONSE: UserApplicationsResponse = {
    systemSettings: {
        "GLOBAL_HTTP_PROXY": "http://company-proxy:8888",
        "OPENAI_API_BASE": "https://api.openai-proxy.com/v1"
    },
    applications: [
        {
            application: {
                id: "app-theme-settings",
                name: "APP主题设置",
                description: "管理应用外观、主题和UI偏好设置。",
                defaultConfig: {
                    "features": {
                        "featureA": false
                    },
                    "initialTheme": "light",
                    "loggingLevel": "info",
                    "userSettings": {
                        "enabled": true
                    },
                    "sidebarExpanded": true
                },
                status: "active",
                createdAt: "2025-12-15T14:33:49.92+08:00",
                updatedAt: "2025-12-15T14:33:49.92+08:00"
            },
            appConfigs: []
        },
        {
            application: {
                id: "llm-service",
                name: "AI 大模型中心",
                description: "统一管理 Gemini、Ollama 等大语言模型接口。",
                defaultConfig: {
                    "model": "gemini-pro",
                    "gemini": {
                        "apiKey": ""
                    },
                    "ollama": {
                        "apiServer": "http://localhost:11434"
                    },
                    "temperature": 0.7,
                    "userSettings": {
                        "enabled": true
                    }
                },
                status: "active",
                createdAt: "2025-12-15T14:33:50.07+08:00",
                updatedAt: "2025-12-15T14:33:50.07+08:00"
            },
            appConfigs: []
        },
        {
            application: {
                id: "notification-service",
                name: "消息通知中心",
                description: "聚合邮件、Bark 等多渠道的消息推送服务。",
                defaultConfig: {
                    "bark": {
                        "apiKey": ""
                    },
                    "email": {
                        "address": ""
                    },
                    "enableDND": false,
                    "userSettings": {
                        "enabled": true
                    }
                },
                status: "active",
                createdAt: "2025-12-15T14:33:50.142+08:00",
                updatedAt: "2025-12-15T14:33:50.142+08:00"
            },
            appConfigs: [
              {
                id: "appconf_me_notify_dev",
                userId: 101,
                appId: "notification-service",
                environment: "development",
                configData: {
                    bark: {
                        apiKey: "oSwCejcHSuzhJrPbRPLzJX"
                    },
                    email: {
                        address: "asetof@outlook.com"
                    },
                    userSettings: {
                        enabled: true
                    }
                },
                createdAt: "2025-12-16T10:00:00.000+08:00",
                updatedAt: "2025-12-16T10:00:00.000+08:00"
              }
            ]
        },
        {
            application: {
                id: "weather-service",
                name: "天气助手",
                description: "集成多种天气源，提供精准的本地天气预报。",
                defaultConfig: {
                    "hefeng": {
                        "apiKey": ""
                    },
                    "source": "hefeng",
                    "weatherOne": {
                        "apiKey": ""
                    },
                    "weatherTwo": {
                        "apiKey": ""
                    },
                    "userSettings": {
                        "enabled": true
                    },
                    "refreshInterval": 60
                },
                status: "active",
                createdAt: "2025-12-15T14:33:49.998+08:00",
                updatedAt: "2025-12-15T14:33:49.998+08:00"
            },
            appConfigs: []
        }
    ]
};


@Injectable({
  providedIn: 'root'
})
export class DataService {
    private http: HttpClient = inject(HttpClient);
    private authService: AuthService = inject(AuthService);
    
    posts = signal<Post[]>([]);
    inventory = signal<InventoryItem[]>([]);
    healthLogs = signal<HealthLog[]>([]);
    userApplications = signal<UserApplicationEntry[]>([]);


    // This is a helper method to update a single post's AI suggestion state
    updatePostAiSuggestion(postId: number, update: { newSuggestion?: string, isLoading?: boolean, activeIndex?: number }): void {
      this.posts.update(posts => posts.map(p => {
        if (p.id === postId) {
          const newSuggestions = update.newSuggestion 
              ? [...(p.aiSuggestions ?? []), { id: Date.now(), content: update.newSuggestion }]
              : p.aiSuggestions;
          
          let activeIndex = update.activeIndex ?? p.activeAiSuggestionIndex;
          if (update.newSuggestion) {
            activeIndex = (newSuggestions?.length ?? 1) - 1;
          }

          return { 
            ...p, 
            aiSuggestions: newSuggestions,
            isLoadingAiSuggestion: update.isLoading ?? p.isLoadingAiSuggestion,
            activeAiSuggestionIndex: activeIndex,
          };
        }
        return p;
      }));
    }

    constructor() {}

    clearAllData(): void {
      this.posts.set([]);
      this.inventory.set([]);
      this.healthLogs.set([]);
      this.userApplications.set([]);
    }
    
    private getFamilyApiUrl(endpoint: string): string | null {
        const familyId = this.authService.activeFamily()?.id;
        if (!familyId) {
            console.error(`Cannot build API URL for ${endpoint}: Active family ID is not set.`);
            return null;
        }
        return `${API_BASE_URL}/families/${familyId}/${endpoint}`;
    }

    getPosts(): Observable<Post[]> {
        if (USE_MOCK_API) {
            const familyId = this.authService.activeFamily()?.id;
            // Only show mock posts for the demo family
            if (familyId === 'fam_demo') {
                this.posts.set(MOCK_POSTS);
                return of(MOCK_POSTS).pipe(delay(250));
            }
            this.posts.set([]);
            return of([]).pipe(delay(250));
        }
        const url = this.getFamilyApiUrl('posts');
        if (!url) return of([]);
        
        return this.http.get<Post[]>(url).pipe(
            tap((posts: Post[]) => this.posts.set(posts)),
            catchError(err => {
                console.error('Failed to fetch posts', err);
                return of([]);
            })
        );
    }
    
    addPost(postData: Omit<Post, 'id' | 'author' | 'authorAvatar' | 'timestamp' | 'reactions' | 'comments' | 'assignees'>): Observable<Post> {
        const currentUser = this.authService.currentUser();
        if (!currentUser) return throwError(() => new Error('User not logged in'));

        if (USE_MOCK_API) {
            const newPost: Post = {
                id: Date.now(),
                author: currentUser.name,
                authorAvatar: currentUser.avatar,
                timestamp: new Date().toISOString(),
                reactions: [],
                comments: [],
                assignees: [],
                ...postData
            };
            this.posts.update(currentPosts => [newPost, ...currentPosts]);
            return of(newPost).pipe(delay(300));
        }
        
        const url = this.getFamilyApiUrl('posts');
        if (!url) return throwError(() => new Error('Active family not set'));

        return this.http.post<Post>(url, postData).pipe(
            tap((createdPost: Post) => {
                this.posts.update(currentPosts => [createdPost, ...currentPosts]);
            }),
            catchError(err => {
                console.error('Failed to add post', err);
                return throwError(() => err);
            })
        );
    }

    addReaction(postId: number, type: ReactionType, currentUser: Assignee): Observable<void> {
      if (USE_MOCK_API) {
        this.posts.update(posts => posts.map(p => {
            if (p.id === postId) {
                const newReactions = p.reactions.filter(r => r.author.name !== currentUser.name || r.type !== type);
                const hasReacted = p.reactions.length !== newReactions.length;
                if (!hasReacted) {
                    newReactions.push({ author: currentUser, type });
                }
                return { ...p, reactions: newReactions };
            }
            return p;
        }));
        return of(undefined);
      }
      
      const url = this.getFamilyApiUrl(`posts/${postId}/reactions`);
      if (!url) return throwError(() => new Error('Active family not set'));
      
      return this.http.post<void>(url, { type }).pipe(
        tap(() => { // Optimistic update
            this.posts.update(posts => posts.map(p => {
                if (p.id === postId) {
                    const newReactions = p.reactions.filter(r => r.author.name !== currentUser.name || r.type !== type);
                    const hasReacted = p.reactions.length !== newReactions.length;
                     if (!hasReacted) {
                        newReactions.push({ author: currentUser, type });
                    }
                    return { ...p, reactions: newReactions };
                }
                return p;
            }));
        }),
        catchError(err => {
            console.error('Failed to add reaction', err);
            // Optionally: add logic to revert optimistic update
            return throwError(() => err);
        })
      );
    }

    addComment(postId: number, content: string, currentUser: Assignee): Observable<void> {
        if (USE_MOCK_API) {
            const newComment: Comment = {
                id: Date.now(),
                author: currentUser.name,
                authorAvatar: currentUser.avatar,
                content: content,
                timestamp: new Date().toISOString(),
            };
            this.posts.update(posts => posts.map(p => {
                if (p.id === postId) {
                    return { ...p, comments: [...p.comments, newComment] };
                }
                return p;
            }));
            return of(undefined).pipe(delay(200));
        }
        
        const url = this.getFamilyApiUrl(`posts/${postId}/comments`);
        if (!url) return throwError(() => new Error('Active family not set'));

        return this.http.post<Comment>(url, { content }).pipe(
            tap((newComment: Comment) => {
                this.posts.update(posts => posts.map(p => {
                    if (p.id === postId) {
                        return { ...p, comments: [...p.comments, newComment] };
                    }
                    return p;
                }));
            }),
            map(() => undefined), // Transform to Observable<void> for the component
            catchError(err => {
                console.error('Failed to add comment', err);
                return throwError(() => err);
            })
        );
    }

    deleteComment(postId: number, commentId: number): Observable<void> {
        if (USE_MOCK_API) {
            this.posts.update(posts => posts.map(p => {
                if (p.id === postId) {
                    return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
                }
                return p;
            }));
            return of(undefined);
        }
        
        const url = this.getFamilyApiUrl(`posts/${postId}/comments/${commentId}`);
        if (!url) return throwError(() => new Error('Active family not set'));

        return this.http.delete<void>(url).pipe(
            tap(() => {
                this.posts.update(posts => posts.map(p => {
                    if (p.id === postId) {
                        return { ...p, comments: p.comments.filter(c => c.id !== commentId) };
                    }
                    return p;
                }));
            }),
            catchError(err => {
                console.error('Failed to delete comment', err);
                return throwError(() => err);
            })
        );
    }

    markTaskAsDone(postId: number): Observable<void> {
      if (USE_MOCK_API) {
        this.posts.update(posts => posts.map(p => {
            if (p.id === postId) {
                return { ...p, status: 'DONE' };
            }
            return p;
        }));
        return of(undefined);
      }
      
      const url = this.getFamilyApiUrl(`posts/${postId}`);
      if (!url) return throwError(() => new Error('Active family not set'));
      
      return this.http.patch<void>(url, { status: 'DONE' }).pipe(
        tap(() => { // Optimistic update
            this.posts.update(posts => posts.map(p => {
                if (p.id === postId) {
                    return { ...p, status: 'DONE' };
                }
                return p;
            }));
        }),
        catchError(err => {
            console.error('Failed to mark task as done', err);
            // Optionally: add logic to revert optimistic update
            return throwError(() => err);
        })
      );
    }

    // --- Inventory Methods ---

    getInventory(): Observable<InventoryItem[]> {
        if (USE_MOCK_API) {
            const familyId = this.authService.activeFamily()?.id;
            if (familyId === 'fam_demo') {
                this.inventory.set(MOCK_INVENTORY);
                return of(MOCK_INVENTORY).pipe(delay(150));
            }
            this.inventory.set([]);
            return of([]).pipe(delay(150));
        }
        const url = this.getFamilyApiUrl('inventory');
        if (!url) return of([]);
        
        return this.http.get<InventoryItem[]>(url).pipe(
            tap((inventory: InventoryItem[]) => this.inventory.set(inventory)),
            catchError(err => {
                console.error('Failed to fetch inventory', err);
                return of([]);
            })
        );
    }

    addInventoryItem(itemData: Omit<InventoryItem, 'id' | 'status' | 'comments'>): Observable<InventoryItem> {
        if (USE_MOCK_API) {
            const newItem: InventoryItem = {
                id: Date.now(),
                status: 'IN_STOCK',
                comments: [],
                ...itemData,
            };
            this.inventory.update(current => [newItem, ...current]);
            return of(newItem).pipe(delay(300));
        }
        
        const url = this.getFamilyApiUrl('inventory');
        if (!url) return throwError(() => new Error('Active family not set'));
        
        return this.http.post<InventoryItem>(url, { ...itemData, status: 'IN_STOCK' }).pipe(
            tap(createdItem => {
                this.inventory.update(current => [createdItem, ...current]);
            })
        );
    }

    updateInventoryItem(itemId: number, itemData: Partial<Omit<InventoryItem, 'id' | 'comments'>>): Observable<InventoryItem> {
        if (USE_MOCK_API) {
            let updatedItem: InventoryItem | undefined;
            this.inventory.update((items: InventoryItem[]) => items.map((item: InventoryItem) => {
                if (item.id === itemId) {
                    // FIX: Add explicit cast to satisfy TypeScript compiler.
                    updatedItem = { ...item, ...itemData } as InventoryItem;
                    return updatedItem;
                }
                return item;
            }));
            if (updatedItem) {
                return of(updatedItem).pipe(delay(300));
            }
            return throwError(() => new Error('Item not found'));
        }

        const url = this.getFamilyApiUrl(`inventory/${itemId}`);
        if (!url) return throwError(() => new Error('Active family not set'));

        return this.http.patch<InventoryItem>(url, itemData).pipe(
            tap(updatedItemFromServer => {
                this.inventory.update(items => items.map(item =>
                    item.id === itemId ? updatedItemFromServer : item
                ));
            })
        );
    }

    updateInventoryItemStatus(itemId: number, status: InventoryStatus): Observable<void> {
        if (USE_MOCK_API) {
            // FIX: Add explicit return type to map() callback to fix type inference issue.
            this.inventory.update((items: InventoryItem[]) => items.map((item: InventoryItem): InventoryItem =>
                item.id === itemId ? { ...item, status } : item
            ));
            return of(undefined).pipe(delay(100));
        }

        const url = this.getFamilyApiUrl(`inventory/${itemId}`);
        if (!url) return throwError(() => new Error('Active family not set'));
        
        return this.http.patch<void>(url, { status }).pipe(
            tap(() => { // Optimistic update
                this.inventory.update((items: InventoryItem[]) => items.map((item: InventoryItem) =>
                    item.id === itemId ? { ...item, status } : item
                ));
            })
        );
    }

    deleteInventoryItem(itemId: number): Observable<void> {
        if (USE_MOCK_API) {
            this.inventory.update(items => items.filter(item => item.id !== itemId));
            return of(undefined).pipe(delay(300));
        }

        const url = this.getFamilyApiUrl(`inventory/${itemId}`);
        if (!url) return throwError(() => new Error('Active family not set'));

        return this.http.delete<void>(url).pipe(
            tap(() => {
                this.inventory.update(items => items.filter(item => item.id !== itemId));
            })
        );
    }

    addInventoryComment(itemId: number, content: string, currentUser: Assignee): Observable<void> {
        if (USE_MOCK_API) {
            const newComment: InventoryItemComment = {
                id: Date.now(),
                author: currentUser.name,
                authorAvatar: currentUser.avatar,
                content: content,
                timestamp: new Date().toISOString(),
            };
            this.inventory.update((items: InventoryItem[]) => items.map((item: InventoryItem) => {
                if (item.id === itemId) {
                    const comments: InventoryItemComment[] = [...(item.comments || []), newComment];
                    // FIX: Add explicit cast to ensure the returned object is of type InventoryItem.
                    return { ...item, comments } as InventoryItem;
                }
                return item;
            }));
            return of(undefined).pipe(delay(200));
        }
        
        const url = this.getFamilyApiUrl(`inventory/${itemId}/comments`);
        if (!url) return throwError(() => new Error('Active family not set'));

        return this.http.post<InventoryItemComment>(url, { content }).pipe(
            tap(newComment => {
                this.inventory.update((items: InventoryItem[]) => items.map((item: InventoryItem) => {
                    if (item.id === itemId) {
                        const comments = [...(item.comments || []), newComment];
                        // FIX: Add explicit cast to ensure the returned object is of type InventoryItem.
                        return { ...item, comments } as InventoryItem;
                    }
                    return item;
                }));
            }),
            map(() => undefined)
        );
    }

    deleteInventoryComment(itemId: number, commentId: number): Observable<void> {
        if (USE_MOCK_API) {
            this.inventory.update(items => items.map(item => {
                if (item.id === itemId) {
                    const comments = item.comments?.filter(c => c.id !== commentId);
                    return { ...item, comments };
                }
                return item;
            }));
            return of(undefined);
        }
        
        const url = this.getFamilyApiUrl(`inventory/${itemId}/comments/${commentId}`);
        if (!url) return throwError(() => new Error('Active family not set'));

        return this.http.delete<void>(url).pipe(
            tap(() => {
                this.inventory.update(items => items.map(item => {
                    if (item.id === itemId) {
                        const comments = item.comments?.filter(c => c.id !== commentId);
                        return { ...item, comments };
                    }
                    return item;
                }));
            })
        );
    }

    // --- Health Log Methods ---

    getHealthLogs(): Observable<HealthLog[]> {
        if (USE_MOCK_API) {
            const familyId = this.authService.activeFamily()?.id;
            if (familyId === 'fam_demo') {
                this.healthLogs.set(MOCK_HEALTH_LOGS);
                return of(MOCK_HEALTH_LOGS).pipe(delay(200));
            }
            this.healthLogs.set([]);
            return of([]).pipe(delay(200));
        }
        const url = this.getFamilyApiUrl('health-logs');
        if (!url) return of([]);
        
        return this.http.get<HealthLog[]>(url).pipe(
            tap((logs: HealthLog[]) => this.healthLogs.set(logs)),
            catchError(err => {
                console.error('Failed to fetch health logs', err);
                return of([]);
            })
        );
    }

    addHealthLog(logData: Omit<HealthLog, 'id' | 'timestamp' | 'author'>): Observable<HealthLog> {
        const currentUser = this.authService.currentUser();
        if (!currentUser) return throwError(() => new Error('User not logged in'));

        if (USE_MOCK_API) {
            const newLog: HealthLog = {
                id: Date.now(),
                author: currentUser.name,
                timestamp: new Date().toISOString(),
                ...logData,
            };
            // FIX: Rewrite update logic to be more explicit, helping the compiler infer the correct array type.
            this.healthLogs.update((current: HealthLog[]) => {
                const updatedLogs = [newLog, ...current];
                // FIX: Let TypeScript infer types for sort callback parameters.
                return updatedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
            return of(newLog).pipe(delay(300));
        }
        
        const url = this.getFamilyApiUrl('health-logs');
        if (!url) return throwError(() => new Error('Active family not set'));
        
        return this.http.post<HealthLog>(url, logData).pipe(
            tap(createdLog => {
                // FIX: Rewrite update logic to be more explicit, helping the compiler infer the correct array type.
                this.healthLogs.update((current: HealthLog[]) => {
                    const updatedLogs = [createdLog, ...current];
                    return updatedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                });
            })
        );
    }

    // --- Environment Data Methods (Always live) ---
    private getUserLocation(): Observable<{ latitude: number; longitude: number }> {
      return new Observable(observer => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          observer.error('Geolocation is not supported by your browser.');
          return;
        }
    
        const options = {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        };

        navigator.geolocation.getCurrentPosition(
          (position) => {
            observer.next({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            observer.complete();
          },
          (error) => {
            observer.error(error);
          },
          options
        );
      });
    }

    private getCurrentWeather(latitude: number, longitude: number): Observable<WeatherInfo> {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;
      // FIX: Add explicit type to http.get and map callback parameter to correctly handle API response.
      return this.http.get<{ current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; } }>(url).pipe(
        map((response: { current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; } }) => ({
          temperature: response.current.temperature_2m,
          humidity: response.current.relative_humidity_2m,
          weatherCode: response.current.weather_code,
        }))
      );
    }
    
    private getCurrentAirQuality(latitude: number, longitude: number): Observable<AirQualityInfo> {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;
      // FIX: Add explicit type to http.get and map callback parameter to correctly handle API response.
      return this.http.get<{ current: { us_aqi: number; pm2_5: number; pm10: number; carbon_monoxide: number; nitrogen_dioxide: number; sulphur_dioxide: number; ozone: number; } }>(url).pipe(
        map((response: { current: { us_aqi: number; pm2_5: number; pm10: number; carbon_monoxide: number; nitrogen_dioxide: number; sulphur_dioxide: number; ozone: number; } }) => ({
          aqi: response.current.us_aqi,
          pm2_5: response.current.pm2_5,
          pm10: response.current.pm10,
          carbonMonoxide: response.current.carbon_monoxide,
          nitrogenDioxide: response.current.nitrogen_dioxide,
          sulphurDioxide: response.current.sulphur_dioxide,
          ozone: response.current.ozone,
        }))
      );
    }

    private getLocationName(latitude: number, longitude: number): Observable<string | null> {
      const url = `https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&count=1&language=zh_CN`;
      // FIX: Add explicit type to http.get and map callback parameter to correctly handle API response.
      return this.http.get<{ results?: { name: string; admin1: string; country: string; }[] }>(url).pipe(
          map((response: { results?: { name: string; admin1: string; country: string; }[] }) => {
              if (response.results && response.results.length > 0) {
                  const result = response.results[0];
                  const parts = [result.name, result.admin1, result.country].filter(Boolean);
                  return parts.join(', ');
              }
              return null;
          }),
          catchError(() => of(null))
      );
    }

    public getEnvironmentalContext(): Observable<EnvironmentalContext> {
        return this.getUserLocation().pipe(
          switchMap(coords => 
            forkJoin({
              weather: this.getCurrentWeather(coords.latitude, coords.longitude),
              airQuality: this.getCurrentAirQuality(coords.latitude, coords.longitude),
              locationName: this.getLocationName(coords.latitude, coords.longitude)
            }).pipe(
              map(result => ({
                weather: result.weather,
                airQuality: result.airQuality,
                location: {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  name: result.locationName
                } as LocationInfo
              }))
            )
          ),
          catchError(err => {
            console.error('Error in environmental context pipeline:', err);
            return throwError(() => err);
          })
        );
    }

    // --- App Config Methods ---
    getUserApplications(): Observable<UserApplicationsResponse> {
        if (USE_MOCK_API) {
            this.userApplications.set(MOCK_USER_APPLICATIONS_RESPONSE.applications);
            return of(MOCK_USER_APPLICATIONS_RESPONSE).pipe(delay(200));
        }
        const url = `${API_BASE_URL}/applications/user`;
        return this.http.get<UserApplicationsResponse>(url).pipe(
            tap(response => {
                this.userApplications.set(response.applications);
            }),
            catchError(err => {
                console.error('Failed to fetch user applications', err);
                this.userApplications.set([]);
                return throwError(() => err);
            })
        );
    }
    
    createAppConfig(config: { appId: string; environment: string; configData: ConfigData; }): Observable<AppConfig> {
        const currentUser = this.authService.currentUser();
        if (!currentUser) return throwError(() => new Error('User not logged in'));

        if (USE_MOCK_API) {
            const newConfig: AppConfig = {
                id: `appconf_${Date.now()}`,
                userId: currentUser.id,
                ...config,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
    
            this.userApplications.update(apps => apps.map(appEntry => {
                if (appEntry.application.id === config.appId) {
                    return { ...appEntry, appConfigs: [newConfig] };
                }
                return appEntry;
            }));
          
            return of(newConfig).pipe(delay(300));
        }
        
        const url = `${API_BASE_URL}/appconfigs`;
        return this.http.post<AppConfig>(url, config).pipe(
            tap(createdConfig => {
                 this.userApplications.update(apps => apps.map(appEntry => {
                    if (appEntry.application.id === createdConfig.appId) {
                        // Assuming one config per env, replace any existing.
                        return { ...appEntry, appConfigs: [createdConfig] };
                    }
                    return appEntry;
                }));
            })
        );
    }
    
    updateAppConfig(configId: string, configData: ConfigData): Observable<AppConfig> {
        if (USE_MOCK_API) {
            let updatedConfig: AppConfig | undefined;
            this.userApplications.update(apps => apps.map(appEntry => ({
                ...appEntry,
                appConfigs: appEntry.appConfigs.map(conf => {
                    if (conf.id === configId) {
                        updatedConfig = { ...conf, configData, updatedAt: new Date().toISOString() };
                        return updatedConfig;
                    }
                    return conf;
                })
            })));
    
            if (updatedConfig) {
                return of(updatedConfig).pipe(delay(300));
            }
            return throwError(() => new Error('Config not found'));
        }

        const url = `${API_BASE_URL}/appconfigs/${configId}`;
        return this.http.patch<AppConfig>(url, { configData }).pipe(
             tap(updatedConfig => {
                 this.userApplications.update(apps => apps.map(appEntry => ({
                    ...appEntry,
                    appConfigs: appEntry.appConfigs.map(conf => 
                        conf.id === configId ? updatedConfig : conf
                    )
                })));
            })
        );
    }
}