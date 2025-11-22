import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Post, Assignee, ReactionType, Comment, NeedStatus } from './types';
import { of, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

// --- Configuration ---
// Set to `false` to use the real API (placeholder).
const USE_MOCK_API = true;
const API_BASE_URL = '/api'; // Placeholder for real API base URL
// -------------------

const MOCK_POSTS: Post[] = [
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

@Injectable({
  providedIn: 'root'
})
export class DataService {
    private http = inject(HttpClient);
    
    posts = signal<Post[]>([]);

    constructor() {
        if(USE_MOCK_API) {
            this.posts.set(MOCK_POSTS);
        }
    }

    getPosts(): Observable<Post[]> {
        if (USE_MOCK_API) {
            return of(this.posts());
        }
        return this.http.get<Post[]>(`${API_BASE_URL}/posts`).pipe(
            tap(posts => this.posts.set(posts)),
            catchError(err => {
                console.error('Failed to fetch posts', err);
                return of([]); // Return empty array on error
            })
        );
    }
    
    addPost(postData: Omit<Post, 'id'>): Observable<Post> {
        const newPostWithId: Post = { ...postData, id: Date.now() };

        if (USE_MOCK_API) {
            this.posts.update(currentPosts => [newPostWithId, ...currentPosts]);
            return of(newPostWithId);
        }

        return this.http.post<Post>(`${API_BASE_URL}/posts`, newPostWithId).pipe(
            tap(createdPost => {
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
        tap(post => {
            this.posts.update(posts => posts.map(p => p.id === postId ? post : p));
        }),
        catchError(err => {
            console.error('Failed to add reaction', err);
            return throwError(() => err);
        })
      );
    }

    addComment(postId: number, currentUser: Assignee): Observable<Post> {
        const newComment: Comment = {
            id: Date.now(),
            author: currentUser.name,
            authorAvatar: currentUser.avatar,
            content: '好的，收到！', // Mock content
            timestamp: '刚刚',
        };

        if (USE_MOCK_API) {
            let updatedPost: Post | undefined;
            this.posts.update((currentPosts) =>
                currentPosts.map((post) => {
                    if (post.id === postId) {
                        updatedPost = { ...post, comments: [...post.comments, newComment] };
                        return updatedPost;
                    }
                    return post;
                })
            );
            return updatedPost ? of(updatedPost) : throwError(() => new Error('Post not found'));
        }

        return this.http.post<Post>(`${API_BASE_URL}/posts/${postId}/comments`, { content: newComment.content }).pipe(
            tap(post => {
                this.posts.update(posts => posts.map(p => p.id === postId ? post : p));
            }),
            catchError(err => {
                console.error('Failed to add comment', err);
                return throwError(() => err);
            })
        );
    }
}
