import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Post, Assignee, ReactionType, Comment, NeedStatus, InventoryItem, InventoryStatus, AiSuggestion, HealthLog, WeatherInfo, AirQualityInfo, EnvironmentalContext, LocationInfo } from './types';
import { of, Observable, throwError, forkJoin } from 'rxjs';
// FIX: Corrected RxJS operator import path from 'rxjs/operators' to 'rxjs' for compatibility with modern RxJS versions.
import { tap, catchError, map, switchMap } from 'rxjs';

// --- Configuration ---
// Set to `false` to use the real API (placeholder).
const USE_MOCK_API = true;
const API_BASE_URL = '/api'; // Placeholder for real API base URL
// -------------------

const MOCK_POSTS: Post[] = [
    {
     id: 9,
     author: '我',
     authorAvatar: 'https://picsum.photos/seed/me/100/100',
     timestamp: '2分钟前',
     type: 'MEAL_SUGGESTION',
     content: '大家晚上想吃什么？',
     assignees: [],
     reactions: [],
     comments: [
        { id: 10, author: '妈妈', authorAvatar: 'https://picsum.photos/seed/mom/100/100', content: '我都可以，但最好是低糖的。', timestamp: '1分钟前' },
        { id: 11, author: '爸爸', authorAvatar: 'https://picsum.photos/seed/dad/100/100', content: '我胃有点不舒服，想吃点软的、好消化的，比如粥。', timestamp: '1分钟前' },
     ],
   },
    {
     id: 8,
     author: '我',
     authorAvatar: 'https://picsum.photos/seed/me/100/100',
     timestamp: '刚刚',
     type: 'MEDICATION',
     content: '提醒：爸爸需要从今天开始服用新的降压药，每天一次。',
     subject: { name: '爸爸', avatar: 'https://picsum.photos/seed/dad/100/100' },
     assignees: [],
     reactions: [],
     comments: [],
   },
   {
     id: 7,
     author: '我',
     authorAvatar: 'https://picsum.photos/seed/me/100/100',
     timestamp: '今天早上',
     type: 'EVENT',
     content: '妈妈今天去看病了，做了血常规检查。结果下午出来，我会及时同步。',
     subject: { name: '妈妈', avatar: 'https://picsum.photos/seed/mom/100/100' },
     assignees: [],
     reactions: [],
     comments: [],
   },
   {
     id: 3,
     author: '亚历克斯',
     authorAvatar: 'https://picsum.photos/seed/alex/100/100',
     timestamp: '3天前',
     type: 'FEELING',
     content: '今天感觉有点不舒服。🤒 要是能喝上一碗热汤就好了。',
     subject: { name: '亚历克斯', avatar: 'https://picsum.photos/seed/alex/100/100' },
     assignees: [],
     reactions: [],
     comments: [],
   },
   {
     id: 1,
     author: '妈妈',
     authorAvatar: 'https://picsum.photos/seed/mom/100/100',
     timestamp: '2小时前',
     type: 'TASK',
     content: '今天下午5点前有人能去取一下干洗的衣服吗？',
     status: 'TODO',
     priority: 'URGENT',
     dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
     assignees: [],
     reactions: [],
     comments: [],
   },
   {
     id: 2,
     author: '爸爸',
     authorAvatar: 'https://picsum.photos/seed/dad/100/100',
     timestamp: '昨天晚上8:15',
     type: 'DISCOVERY',
     content: '发现一个用橄榄油修复吱吱作响的门的好方法，再也没有噪音了！我还拍了张照片。',
     media: [{ type: 'image', url: 'https://picsum.photos/seed/door/400/250' }],
     assignees: [],
     reactions: [],
     comments: [
       {
         id: 1,
         author: '妈妈',
         authorAvatar: 'https://picsum.photos/seed/mom/100/100',
         content: '太棒了！下次试试。',
         timestamp: '昨天晚上9:00',
       },
     ],
   },
   {
     id: 4,
     author: '妈妈',
     authorAvatar: 'https://picsum.photos/seed/mom/100/100',
     timestamp: '4天前',
     type: 'CHORE',
     content: '我们家没有牛奶和鸡蛋了。我已经加到购物清单了。',
     status: 'IN_PROGRESS',
     priority: 'NORMAL',
     assignees: [{ name: '妈妈', avatar: 'https://picsum.photos/seed/mom/100/100' }],
     reactions: [],
     comments: [],
   },
   {
     id: 5,
     author: '爸爸',
     authorAvatar: 'https://picsum.photos/seed/dad/100/100',
     timestamp: '上周',
     type: 'TASK',
     content: '割草机又发出奇怪的声音了。已经找人看过了，现在修好了。',
     status: 'DONE',
     priority: 'LOW',
     assignees: [{ name: '爸爸', avatar: 'https://picsum.photos/seed/dad/100/100' }],
     reactions: [],
     comments: [],
   },
   {
     id: 6,
     author: '亚历克斯',
     authorAvatar: 'https://picsum.photos/seed/alex/100/100',
     timestamp: '下周二',
     type: 'APPOINTMENT',
     content: '提醒一下，我下周二下午3点有牙医复诊。',
     assignees: [],
     reactions: [],
     comments: [],
   },
 ];

 const MOCK_INVENTORY_ITEMS: InventoryItem[] = [
    { id: 101, name: '有机全脂牛奶', image: 'https://picsum.photos/seed/milk/200/200', category: '食材', brand: 'Organic Valley', store: 'Costco', notes: '买大包装的，孩子们喜欢喝。', status: 'IN_STOCK' },
    { id: 102, name: '无麸质面包', image: 'https://picsum.photos/seed/bread/200/200', category: '食材', brand: 'Canyon Bakehouse', store: 'Whole Foods', notes: '切片款', status: 'RUNNING_LOW' },
    { id: 103, name: '牛油果', image: 'https://picsum.photos/seed/avocado/200/200', category: '食材', store: 'Trader Joe\'s', notes: '一次买4个的网袋装。', status: 'IN_STOCK' },
    { id: 104, name: '浓缩洗衣液', image: 'https://picsum.photos/seed/laundry/200/200', category: '清洁用品', brand: 'Tide', store: 'Amazon', notes: '订阅购买，每两个月送一次。', status: 'OUT_OF_STOCK' },
    { id: 105, name: '洗碗块', image: 'https://picsum.photos/seed/dish/200/200', category: '清洁用品', brand: 'Cascade', store: 'Costco', status: 'RUNNING_LOW' },
    { id: 106, name: '厨房纸巾', image: 'https://picsum.photos/seed/paper/200/200', category: '生活用品', brand: 'Bounty', notes: '要选超强吸收的型号。', status: 'IN_STOCK' },
    { id: 107, name: '牙膏', image: 'https://picsum.photos/seed/paste/200/200', category: '生活用品', brand: 'Colgate', store: 'Target', status: 'IN_STOCK' },
    { id: 108, name: '小米', image: 'https://picsum.photos/seed/millet/200/200', category: '食材', status: 'IN_STOCK' },
    { id: 109, name: '南瓜', image: 'https://picsum.photos/seed/pumpkin/200/200', category: '食材', status: 'IN_STOCK' },
 ];
 
 const MOCK_HEALTH_LOGS: HealthLog[] = [
  { 
    id: 1, 
    author: '我', 
    timestamp: '今天 08:30', 
    content: '感觉精力充沛', 
    mood: '充沛',
    environmentalContext: {
      weather: { temperature: 28, humidity: 70, weatherCode: 1 },
      airQuality: { aqi: 45, pm2_5: 12.1, pm10: 40.3, carbonMonoxide: 300.1, nitrogenDioxide: 15.2, sulphurDioxide: 2.6, ozone: 80.4 },
      location: { latitude: 39.9042, longitude: 116.4074, name: '北京市, 中国' }
    }
  },
  { id: 2, author: '我', timestamp: '昨天 21:00', content: '晚上有点头痛，可能是没休息好。', mood: '疲惫' },
  { 
    id: 3, 
    author: '我', 
    timestamp: '3天前', 
    content: '心情不错', 
    mood: '不错',
    environmentalContext: {
      weather: { temperature: 22, humidity: 65, weatherCode: 3 },
      airQuality: { aqi: 78, pm2_5: 25.1, pm10: 55.3, carbonMonoxide: 800.1, nitrogenDioxide: 30.2, sulphurDioxide: 5.6, ozone: 70.4 },
      location: { latitude: 39.9042, longitude: 116.4074, name: '北京市, 中国' }
    }
  },
];

@Injectable({
  providedIn: 'root'
})
export class DataService {
    // FIX: The `inject(HttpClient)` call was being inferred as `unknown` by the
    // TypeScript compiler in this environment. Casting to `HttpClient` restores
    // type information and resolves subsequent compilation errors.
    private http = inject(HttpClient) as HttpClient;
    
    posts = signal<Post[]>([]);
    inventory = signal<InventoryItem[]>([]);
    healthLogs = signal<HealthLog[]>([]);

    constructor() {
        if(USE_MOCK_API) {
            this.posts.set(MOCK_POSTS); // Display in chronological order
            this.inventory.set(MOCK_INVENTORY_ITEMS);
            this.healthLogs.set(MOCK_HEALTH_LOGS);
        }
    }

    getPosts(): Observable<Post[]> {
        if (USE_MOCK_API) {
            return of(this.posts());
        }
        return this.http.get<Post[]>(`${API_BASE_URL}/posts`).pipe(
            // FIX: Explicitly type the 'posts' parameter to resolve TypeScript inference issue.
            tap((posts: Post[]) => this.posts.set(posts)),
            catchError(err => {
                console.error('Failed to fetch posts', err);
                return of([]); // Return empty array on error
            })
        );
    }
    
    addPost(postData: Omit<Post, 'id'>): Observable<Post> {
        const newPostWithId: Post = { ...postData, id: Date.now() };

        if (USE_MOCK_API) {
            this.posts.update(currentPosts => [newPostWithId, ...currentPosts].sort((a,b) => b.id - a.id));
            return of(newPostWithId);
        }

        return this.http.post<Post>(`${API_BASE_URL}/posts`, newPostWithId).pipe(
            // FIX: Explicitly type the 'createdPost' parameter to resolve TypeScript inference issue.
            tap((createdPost: Post) => {
                this.posts.update(currentPosts => [...currentPosts, createdPost]);
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
        this.posts.update((currentPosts) =>
          currentPosts.map((post) => {
            if (post.id === postId) {
              const hasReacted = post.reactions.some(r => r.author.name === currentUser.name && r.type === type);
              if (hasReacted) return post;
    
              const newReaction = { author: currentUser, type };
              let modifiedPost = { ...post, reactions: [...post.reactions, newReaction] };
    
              if (type === 'ILL_DO_IT' || type === 'ILL_JOIN') {
                  const isAlreadyAssignee = modifiedPost.assignees.some(a => a.name === currentUser.name);
                  if (!isAlreadyAssignee) {
                      modifiedPost.assignees = [...modifiedPost.assignees, currentUser];
                      if (modifiedPost.status === 'TODO') {
                        modifiedPost.status = 'IN_PROGRESS' as NeedStatus;
                      }
                  }
              }
              updatedPost = modifiedPost;
              return updatedPost;
            }
            return post;
          })
        );
        return updatedPost ? of(updatedPost) : throwError(() => new Error('Post not found'));
      }

      return this.http.post<Post>(`${API_BASE_URL}/posts/${postId}/reactions`, { type, user: currentUser }).pipe(
        // FIX: Explicitly type the 'post' parameter to resolve TypeScript inference issue.
        tap((post: Post) => {
            this.posts.update(posts => posts.map(p => p.id === postId ? post : p));
        }),
        catchError(err => {
            console.error('Failed to add reaction', err);
            return throwError(() => err);
        })
      );
    }

    addComment(postId: number, content: string, currentUser: Assignee): Observable<Post> {
        const newComment: Comment = {
            id: Date.now(),
            author: currentUser.name,
            authorAvatar: currentUser.avatar,
            content: content,
            timestamp: '刚刚',
        };

        if (USE_MOCK_API) {
            let updatedPost: Post | undefined;
            this.posts.update((currentPosts) =>
                currentPosts.map((post) => {
                    if (post.id === postId) {
                        updatedPost = { ...post, comments: [ ...post.comments, newComment ] };
                        return updatedPost;
                    }
                    return post;
                })
            );
            return updatedPost ? of(updatedPost) : throwError(() => new Error('Post not found'));
        }

        return this.http.post<Post>(`${API_BASE_URL}/posts/${postId}/comments`, { content: newComment.content }).pipe(
            // FIX: Explicitly type the 'post' parameter to resolve TypeScript inference issue.
            tap((post: Post) => {
                this.posts.update(posts => posts.map(p => p.id === postId ? post : p));
            }),
            catchError(err => {
                console.error('Failed to add comment', err);
                return throwError(() => err);
            })
        );
    }

    markTaskAsDone(postId: number): Observable<Post> {
      if (USE_MOCK_API) {
        let updatedPost: Post | undefined;
        this.posts.update((currentPosts) =>
          currentPosts.map((post) => {
            if (post.id === postId) {
              updatedPost = { ...post, status: 'DONE' };
              return updatedPost;
            }
            return post;
          })
        );
        return updatedPost ? of(updatedPost) : throwError(() => new Error('Post not found'));
      }
      
      return this.http.patch<Post>(`${API_BASE_URL}/posts/${postId}`, { status: 'DONE' }).pipe(
        // FIX: Explicitly type the 'post' parameter to resolve TypeScript inference issue.
        tap((post: Post) => {
            this.posts.update(posts => posts.map(p => p.id === postId ? post : p));
        }),
        catchError(err => {
            console.error('Failed to mark task as done', err);
            return throwError(() => err);
        })
      );
    }

    // --- Environment Data Methods ---
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
      // FIX: Replaced <any> with a specific type for the API response to ensure type safety.
      return this.http.get<{ current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; } }>(url).pipe(
        // FIX: Explicitly type the 'response' parameter to resolve TypeScript inference issue.
        map((response: { current: { temperature_2m: number; relative_humidity_2m: number; weather_code: number; } }) => ({
          temperature: response.current.temperature_2m,
          humidity: response.current.relative_humidity_2m,
          weatherCode: response.current.weather_code,
        }))
      );
    }
    
    private getCurrentAirQuality(latitude: number, longitude: number): Observable<AirQualityInfo> {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`;
      // FIX: Replaced <any> with a specific type for the API response to ensure type safety.
      return this.http.get<{ current: { us_aqi: number; pm2_5: number; pm10: number; carbon_monoxide: number; nitrogen_dioxide: number; sulphur_dioxide: number; ozone: number; } }>(url).pipe(
        // FIX: Explicitly type the 'response' parameter to resolve TypeScript inference issue.
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
      // FIX: Replaced <any> with a specific type for the API response to ensure type safety.
      return this.http.get<{ results?: { name: string; admin1: string; country: string; }[] }>(url).pipe(
          // FIX: Explicitly type the 'response' parameter to resolve TypeScript inference issue.
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
                }
              }))
            )
          )
        );
    }

    // --- Health Log Methods ---
    getHealthLogs(): Observable<HealthLog[]> {
      if (USE_MOCK_API) {
        return of(this.healthLogs());
      }
      return this.http.get<HealthLog[]>(`${API_BASE_URL}/health-logs`).pipe(
        // FIX: Explicitly type the 'logs' parameter to resolve TypeScript inference issue.
        tap((logs: HealthLog[]) => this.healthLogs.set(logs)),
        catchError(err => {
          console.error('Failed to fetch health logs', err);
          return of([]);
        })
      );
    }

    addHealthLog(logData: Omit<HealthLog, 'id' | 'timestamp'>): Observable<HealthLog> {
        const newLog: HealthLog = {
          ...logData,
          id: Date.now(),
          timestamp: '刚刚',
        };

        if (USE_MOCK_API) {
          this.healthLogs.update(currentLogs => [newLog, ...currentLogs]);
          return of(newLog);
        }
    
        // This would be the real API call path
        return this.http.post<HealthLog>(`${API_BASE_URL}/health-logs`, newLog).pipe(
          // FIX: Explicitly type the 'createdLog' parameter to resolve TypeScript inference issue.
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
        return of(this.inventory());
      }
      return this.http.get<InventoryItem[]>(`${API_BASE_URL}/inventory`).pipe(
        // FIX: Explicitly type the 'items' parameter to resolve TypeScript inference issue.
        tap((items: InventoryItem[]) => this.inventory.set(items)),
        catchError(err => {
          console.error('Failed to fetch inventory', err);
          return of([]);
        })
      );
    }

    addInventoryItem(itemData: Omit<InventoryItem, 'id' | 'status'>): Observable<InventoryItem> {
      const newItem: InventoryItem = {
        ...itemData,
        id: Date.now(),
        status: 'IN_STOCK'
      };
      
      if (USE_MOCK_API) {
        this.inventory.update(currentItems => [newItem, ...currentItems]);
        return of(newItem);
      }

      return this.http.post<InventoryItem>(`${API_BASE_URL}/inventory`, newItem).pipe(
        // FIX: Explicitly type the 'createdItem' parameter to resolve TypeScript inference issue.
        tap((createdItem: InventoryItem) => {
          this.inventory.update(currentItems => [createdItem, ...currentItems]);
        }),
        catchError(err => {
            console.error('Failed to add inventory item', err);
            return throwError(() => err);
        })
      );
    }

    updateInventoryItemStatus(itemId: number, status: InventoryStatus): Observable<InventoryItem> {
      if (USE_MOCK_API) {
        let updatedItem: InventoryItem | undefined;
        this.inventory.update(currentItems =>
          currentItems.map(item => {
            if (item.id === itemId) {
              updatedItem = { ...item, status };
              return updatedItem;
            }
            return item;
          })
        );
        return updatedItem ? of(updatedItem) : throwError(() => new Error('Item not found'));
      }

      return this.http.patch<InventoryItem>(`${API_BASE_URL}/inventory/${itemId}`, { status }).pipe(
        // FIX: Explicitly type the 'item' parameter to resolve TypeScript inference issue.
        tap((item: InventoryItem) => {
          this.inventory.update(items => items.map(i => i.id === itemId ? item : i));
        }),
        catchError(err => {
            console.error('Failed to update inventory item status', err);
            return throwError(() => err);
        })
      );
    }

    // --- AI Methods ---
    updatePostAiSuggestion(postId: number, data: { newSuggestion?: string; isLoading?: boolean; activeIndex?: number }): void {
      if (USE_MOCK_API) {
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
}