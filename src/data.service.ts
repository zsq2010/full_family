import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Post, Assignee, ReactionType, Comment, NeedStatus, InventoryItem, InventoryStatus, AiSuggestion, HealthLog, WeatherInfo, AirQualityInfo, EnvironmentalContext, LocationInfo, InventoryItemComment } from './types';
import { of, Observable, throwError, forkJoin } from 'rxjs';
import { tap, catchError, map, switchMap, delay } from 'rxjs';
import { API_BASE_URL, USE_MOCK_API } from './config';
import { MOCK_POSTS, MOCK_INVENTORY, MOCK_HEALTH_LOGS } from './mock-data';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DataService {
    private http: HttpClient = inject(HttpClient);
    private authService: AuthService = inject(AuthService);
    
    posts = signal<Post[]>([]);
    inventory = signal<InventoryItem[]>([]);
    healthLogs = signal<HealthLog[]>([]);

    constructor() {}

    clearAllData(): void {
      this.posts.set([]);
      this.inventory.set([]);
      this.healthLogs.set([]);
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
        return this.http.get<Post[]>(`${API_BASE_URL}/posts`).pipe(
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
        return this.http.post<Post>(`${API_BASE_URL}/posts`, postData).pipe(
            tap((createdPost: Post) => {
                this.posts.update(currentPosts => [createdPost, ...currentPosts]);
            }),
            catchError(err => {
                console.error('Failed to add post', err);
                return throwError(() => err);
            })
        );
    }

    addReaction(postId: number, type: ReactionType, currentUser: Assignee): Observable<Post> {
      if (USE_MOCK_API) {
        let updatedPost: Post | undefined;
        this.posts.update(posts => posts.map(p => {
            if (p.id === postId) {
                const newReactions = p.reactions.filter(r => r.author.name !== currentUser.name || r.type !== type);
                const hasReacted = p.reactions.length !== newReactions.length;
                if (!hasReacted) {
                    newReactions.push({ author: currentUser, type });
                }
                updatedPost = { ...p, reactions: newReactions };
                return updatedPost;
            }
            return p;
        }));
        return updatedPost ? of(updatedPost) : throwError(() => new Error('Post not found'));
      }
      return this.http.post<Post>(`${API_BASE_URL}/posts/${postId}/reactions`, { type }).pipe(
        tap((updatedPost: Post) => {
            this.posts.update(posts => posts.map(p => p.id === postId ? updatedPost : p));
        }),
        catchError(err => {
            console.error('Failed to add reaction', err);
            return throwError(() => err);
        })
      );
    }

    addComment(postId: number, content: string, currentUser: Assignee): Observable<Post> {
        if (USE_MOCK_API) {
            let updatedPost: Post | undefined;
            const newComment: Comment = {
                id: Date.now(),
                author: currentUser.name,
                authorAvatar: currentUser.avatar,
                content: content,
                timestamp: new Date().toISOString(),
            };
            this.posts.update(posts => posts.map(p => {
                if (p.id === postId) {
                    updatedPost = { ...p, comments: [...p.comments, newComment] };
                    return updatedPost;
                }
                return p;
            }));
            return updatedPost ? of(updatedPost).pipe(delay(200)) : throwError(() => new Error('Post not found'));
        }
        return this.http.post<Post>(`${API_BASE_URL}/posts/${postId}/comments`, { content }).pipe(
            tap((updatedPost: Post) => {
                this.posts.update(posts => posts.map(p => p.id === postId ? updatedPost : p));
            }),
            catchError(err => {
                console.error('Failed to add comment', err);
                return throwError(() => err);
            })
        );
    }

    deleteComment(postId: number, commentId: number): Observable<Post> {
        if (USE_MOCK_API) {
            let updatedPost: Post | undefined;
            this.posts.update(posts => posts.map(p => {
                if (p.id === postId) {
                    updatedPost = { ...p, comments: p.comments.filter(c => c.id !== commentId) };
                    return updatedPost;
                }
                return p;
            }));
            return updatedPost ? of(updatedPost) : throwError(() => new Error('Post not found'));
        }
        return this.http.delete<Post>(`${API_BASE_URL}/posts/${postId}/comments/${commentId}`).pipe(
            tap((updatedPost: Post) => {
                this.posts.update(posts => posts.map(p => p.id === postId ? updatedPost : p));
            }),
            catchError(err => {
                console.error('Failed to delete comment', err);
                return throwError(() => err);
            })
        );
    }

    markTaskAsDone(postId: number): Observable<Post> {
      if (USE_MOCK_API) {
        let updatedPost: Post | undefined;
        this.posts.update(posts => posts.map(p => {
            if (p.id === postId) {
                updatedPost = { ...p, status: 'DONE' };
                return updatedPost;
            }
            return p;
        }));
        return updatedPost ? of(updatedPost) : throwError(() => new Error('Post not found'));
      }
      return this.http.patch<Post>(`${API_BASE_URL}/posts/${postId}`, { status: 'DONE' }).pipe(
        tap((updatedPost: Post) => {
            this.posts.update(posts => posts.map(p => p.id === postId ? updatedPost : p));
        }),
        catchError(err => {
            console.error('Failed to mark task as done', err);
            return throwError(() => err);
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
      return this.http.get<{ current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; } }>(url).pipe(
        map((response) => ({
          temperature: response.current.temperature_2m,
          humidity: response.current.relative_humidity_2m,
          weatherCode: response.current.weather_code,
        }))
      );
    }
    
    private getCurrentAirQuality(latitude: number, longitude: number): Observable<AirQualityInfo> {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;
      return this.http.get<{ current: { us_aqi: number; pm2_5: number; pm10: number; carbon_monoxide: number; nitrogen_dioxide: number; sulphur_dioxide: number; ozone: number; } }>(url).pipe(
        map((response) => ({
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
      return this.http.get<{ results?: { name: string; admin1: string; country: string; }[] }>(url).pipe(
          map((response) => {
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
                }
              }))
            )
          )
        );
    }

    // --- Health Log Methods ---
    getHealthLogs(): Observable<HealthLog[]> {
      if (USE_MOCK_API) {
        const familyId = this.authService.activeFamily()?.id;
        if(familyId === 'fam_demo') {
            this.healthLogs.set(MOCK_HEALTH_LOGS);
            return of(MOCK_HEALTH_LOGS).pipe(delay(150));
        }
        this.healthLogs.set([]);
        return of([]).pipe(delay(150));
      }
      return this.http.get<HealthLog[]>(`${API_BASE_URL}/health-logs`).pipe(
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
                ...logData
            };
            this.healthLogs.update(logs => [newLog, ...logs]);
            return of(newLog).pipe(delay(200));
        }
        return this.http.post<HealthLog>(`${API_BASE_URL}/health-logs`, logData).pipe(
          tap((createdLog: HealthLog) => {
            this.healthLogs.update(currentLogs => [createdLog, ...currentLogs]);
          }),
          catchError(err => {
              console.error('Failed to add health log', err);
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
            return of(MOCK_INVENTORY).pipe(delay(200));
        }
        this.inventory.set([]);
        return of([]).pipe(delay(200));
      }
      return this.http.get<InventoryItem[]>(`${API_BASE_URL}/inventory`).pipe(
        tap((items: InventoryItem[]) => this.inventory.set(items)),
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
            ...itemData
        };
        this.inventory.update(items => [newItem, ...items]);
        return of(newItem).pipe(delay(300));
      }
      return this.http.post<InventoryItem>(`${API_BASE_URL}/inventory`, itemData).pipe(
        tap((createdItem: InventoryItem) => {
          this.inventory.update(currentItems => [createdItem, ...currentItems]);
        }),
        catchError(err => {
            console.error('Failed to add inventory item', err);
            return throwError(() => err);
        })
      );
    }

    updateInventoryItem(itemId: number, itemData: Partial<Omit<InventoryItem, 'id' | 'status' | 'comments'>>): Observable<InventoryItem> {
        if (USE_MOCK_API) {
            let updatedItem: InventoryItem | undefined;
            this.inventory.update(items => items.map(i => {
                if (i.id === itemId) {
                    updatedItem = { ...i, ...itemData };
                    return updatedItem;
                }
                return i;
            }));
            return updatedItem ? of(updatedItem) : throwError(() => new Error('Item not found'));
        }
        return this.http.patch<InventoryItem>(`${API_BASE_URL}/inventory/${itemId}`, itemData).pipe(
            tap((updatedItem: InventoryItem) => {
                this.inventory.update(items => items.map(i => i.id === itemId ? updatedItem : i));
            }),
            catchError(err => {
                console.error('Failed to update inventory item', err);
                return throwError(() => err);
            })
        );
    }

    deleteInventoryItem(itemId: number): Observable<void> {
        if (USE_MOCK_API) {
            this.inventory.update(items => items.filter(i => i.id !== itemId));
            return of(undefined).pipe(delay(100));
        }
        return this.http.delete<void>(`${API_BASE_URL}/inventory/${itemId}`).pipe(
            tap(() => {
                this.inventory.update(items => items.filter(i => i.id !== itemId));
            }),
            catchError(err => {
                console.error('Failed to delete inventory item', err);
                return throwError(() => err);
            })
        );
    }

    updateInventoryItemStatus(itemId: number, status: InventoryStatus): Observable<InventoryItem> {
      if (USE_MOCK_API) {
        let updatedItem: InventoryItem | undefined;
        this.inventory.update(items => items.map(i => {
            if (i.id === itemId) {
                updatedItem = { ...i, status };
                return updatedItem;
            }
            return i;
        }));
        return updatedItem ? of(updatedItem) : throwError(() => new Error('Item not found'));
      }
      return this.http.patch<InventoryItem>(`${API_BASE_URL}/inventory/${itemId}`, { status }).pipe(
        tap((updatedItem: InventoryItem) => {
          this.inventory.update(items => items.map(i => i.id === itemId ? updatedItem : i));
        }),
        catchError(err => {
            console.error('Failed to update inventory item status', err);
            return throwError(() => err);
        })
      );
    }

    addInventoryComment(itemId: number, content: string, currentUser: Assignee): Observable<InventoryItem> {
        if (USE_MOCK_API) {
            let updatedItem: InventoryItem | undefined;
            const newComment: InventoryItemComment = {
                id: Date.now(),
                author: currentUser.name,
                authorAvatar: currentUser.avatar,
                content: content,
                timestamp: new Date().toISOString(),
            };
            this.inventory.update(items => items.map(i => {
                if (i.id === itemId) {
                    const existingComments = i.comments ?? [];
                    updatedItem = { ...i, comments: [...existingComments, newComment] };
                    return updatedItem;
                }
                return i;
            }));
            return updatedItem ? of(updatedItem).pipe(delay(200)) : throwError(() => new Error('Item not found'));
        }
        // This would be the implementation for a real API
        return this.http.post<InventoryItem>(`${API_BASE_URL}/inventory/${itemId}/comments`, { content }).pipe(
            tap((updatedItem: InventoryItem) => {
                this.inventory.update(items => items.map(p => p.id === itemId ? updatedItem : p));
            }),
            catchError(err => {
                console.error('Failed to add inventory comment', err);
                return throwError(() => err);
            })
        );
    }

    deleteInventoryComment(itemId: number, commentId: number): Observable<InventoryItem> {
        if (USE_MOCK_API) {
            let updatedItem: InventoryItem | undefined;
            this.inventory.update(items => items.map(i => {
                if (i.id === itemId) {
                    const existingComments = i.comments ?? [];
                    updatedItem = { ...i, comments: existingComments.filter(c => c.id !== commentId) };
                    return updatedItem;
                }
                return i;
            }));
            return updatedItem ? of(updatedItem) : throwError(() => new Error('Item not found'));
        }
        return this.http.delete<InventoryItem>(`${API_BASE_URL}/inventory/${itemId}/comments/${commentId}`).pipe(
            tap((updatedItem: InventoryItem) => {
                this.inventory.update(items => items.map(i => i.id === itemId ? updatedItem : i));
            }),
            catchError(err => {
                console.error('Failed to delete inventory comment', err);
                return throwError(() => err);
            })
        );
    }

    // --- AI Methods (local simulation) ---
    updatePostAiSuggestion(postId: number, data: { newSuggestion?: string; isLoading?: boolean; activeIndex?: number }): void {
        this.posts.update((currentPosts) =>
          currentPosts.map((post) => {
            if (post.id === postId) {
              const updatedPost = { ...post };
    
              if (typeof data.isLoading === 'boolean') {
                updatedPost.isLoadingAiSuggestion = data.isLoading;
              }
    
              if (typeof data.activeIndex === 'number') {
                updatedPost.activeAiSuggestionIndex = data.activeIndex;
              }
    
              if (data.newSuggestion) {
                const newSuggestion: AiSuggestion = {
                  id: Date.now(),
                  content: data.newSuggestion,
                };
                if (!updatedPost.aiSuggestions) {
                  updatedPost.aiSuggestions = [];
                }
                updatedPost.aiSuggestions.push(newSuggestion);
                updatedPost.activeAiSuggestionIndex = updatedPost.aiSuggestions.length - 1;
              }
              
              return updatedPost;
            }
            return post;
          })
        );
    }
}
