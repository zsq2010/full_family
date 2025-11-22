import { Component, ChangeDetectionStrategy, signal, OnInit, OnDestroy, computed, ElementRef, viewChild, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
// FIX: Replaced FormBuilder with FormGroup and FormControl to address the type inference issue.
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { Post, Assignee, ReactionType, PostType, NeedStatus, Priority } from './types';

type ActiveTab = 'home' | 'overview';
type ActiveHomeTab = 'all' | 'daily' | 'health' | 'knowledge';
type PostCategory = 'daily' | 'health' | 'knowledge';

@Component({
  selector: 'app-root',
  imports: [NgOptimizedImage, ReactiveFormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  // FIX: Removed FormBuilder injection as it was being incorrectly inferred as 'unknown' type.
  // private fb = inject(FormBuilder);

  // --- Auth & Data State ---
  loggedInUser = this.authService.currentUser;
  posts = this.dataService.posts;
  loginError = signal<string | null>(null);

  // FIX: Initialized loginForm directly with FormGroup and FormControl to avoid using FormBuilder.
  loginForm = new FormGroup({
    username: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
  });

  // --- UI State ---
  readonly currentYear = new Date().getFullYear();
  readonly reactionTypes: ReactionType[] = ['ILL_DO_IT', 'ILL_JOIN', 'GOT_IT'];
  private timer: number | undefined;
  now = signal(new Date());
  activeTab = signal<ActiveTab>('home');
  activeHomeTab = signal<ActiveHomeTab>('all');
  navigationSource = signal<'direct' | 'overview'>('direct');
  
  isFabMenuOpen = signal(false);
  isNewPostPanelOpen = signal(false);
  newPostContent = signal('');
  newPostCategory = signal<PostCategory>('daily');

  mainNav = viewChild.required<ElementRef>('mainNav');
  stickyNotice = viewChild<ElementRef>('stickyNotice');

  ngOnInit(): void {
    this.timer = window.setInterval(() => {
      this.now.set(new Date());
    }, 1000);
    this.dataService.getPosts().subscribe(); // Initial fetch
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  // --- Authentication ---
  onLoginSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }
    this.loginError.set(null);
    const { username, password } = this.loginForm.value;
    const success = this.authService.login(username!, password!);
    if (!success) {
      this.loginError.set('无效的用户名或密码。');
    }
  }

  logout(): void {
    this.authService.logout();
    this.loginForm.reset();
  }

  // --- UI Navigation & Interaction ---
  scrollToPost(postId: number): void {
    const element = document.getElementById('post-' + postId);
    if (element) {
      const navHeight = this.mainNav().nativeElement.offsetHeight;
      const noticeHeight = this.stickyNotice()?.nativeElement.offsetHeight ?? 0;
      const offset = navHeight + noticeHeight;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  // --- Computed Signals for Data Filtering ---
  urgentHealthPosts = computed(() => {
    const user = this.loggedInUser();
    if (!user) return [];
    return this.posts().filter(p => {
      const isHealthPost = ['FEELING', 'EVENT', 'MEDICATION'].includes(p.type);
      if (!isHealthPost) return false;
      const hasAcknowledged = p.reactions.some(r => r.author.name === user.name && r.type === 'GOT_IT');
      return !hasAcknowledged;
    });
  });

  homePosts = computed(() => {
    const urgentPostIds = new Set(this.urgentHealthPosts().map(p => p.id));
    const regularPosts = this.posts().filter(p => !urgentPostIds.has(p.id));

    switch (this.activeHomeTab()) {
      case 'daily':
        return regularPosts.filter(p => ['TASK', 'CHORE', 'APPOINTMENT'].includes(p.type));
      case 'health':
        return regularPosts.filter(p => ['FEELING', 'EVENT', 'MEDICATION'].includes(p.type));
      case 'knowledge':
        return regularPosts.filter(p => p.type === 'DISCOVERY');
      default:
        return regularPosts;
    }
  });

  dailyPosts = computed(() => this.posts().filter(p => ['TASK', 'CHORE', 'APPOINTMENT'].includes(p.type)));
  healthPosts = computed(() => this.posts().filter(p => ['FEELING', 'EVENT', 'MEDICATION'].includes(p.type)));
  discoveries = computed(() => this.posts().filter(post => post.type === 'DISCOVERY'));

  // --- Tab & Panel Management ---
  setActiveTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    this.navigationSource.set('direct');
  }
  
  setActiveHomeTab(tab: ActiveHomeTab): void {
    this.activeHomeTab.set(tab);
    this.navigationSource.set('direct');
  }

  viewPostFromOverview(post: Post): void {
    this.navigationSource.set('overview');
    this.activeTab.set('home');

    const postType = post.type;
    if (['TASK', 'CHORE', 'APPOINTMENT'].includes(postType)) this.activeHomeTab.set('daily');
    else if (['FEELING', 'EVENT', 'MEDICATION'].includes(postType)) this.activeHomeTab.set('health');
    else if (postType === 'DISCOVERY') this.activeHomeTab.set('knowledge');
    else this.activeHomeTab.set('all');

    setTimeout(() => this.scrollToPost(post.id), 100); 
  }

  goBackToOverview(): void {
    this.activeTab.set('overview');
    this.navigationSource.set('direct');
  }
  
  toggleFabMenu(): void {
    this.isFabMenuOpen.update(value => !value);
  }

  openNewPostPanel(): void {
    this.isFabMenuOpen.set(false);
    this.isNewPostPanelOpen.set(true);
  }

  closeNewPostPanel(): void {
    this.isNewPostPanelOpen.set(false);
    this.newPostContent.set('');
    this.newPostCategory.set('daily');
  }
  
  onNewPostInput(event: Event): void {
    this.newPostContent.set((event.target as HTMLTextAreaElement).value);
  }

  // --- Data Modification Methods (via DataService) ---
  quickSend(type: 'care' | 'help' | 'meeting'): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;

    let newPost: Omit<Post, 'id'>;
    let targetTab: ActiveHomeTab;

    switch (type) {
      case 'care':
        targetTab = 'health';
        newPost = { author: currentUser.name, authorAvatar: currentUser.avatar, timestamp: '刚刚', type: 'FEELING', content: '今天感觉有点不舒服。🤒 希望能得到一些关心。', subject: currentUser, assignees: [], reactions: [], comments: [] };
        break;
      case 'help':
        targetTab = 'daily';
        newPost = { author: currentUser.name, authorAvatar: currentUser.avatar, timestamp: '刚刚', type: 'TASK', content: '我现在需要一些紧急帮助，有人有空吗？', status: 'TODO', priority: 'URGENT', assignees: [], reactions: [], comments: [], subject: currentUser };
        break;
      case 'meeting':
        targetTab = 'daily';
        newPost = { author: currentUser.name, authorAvatar: currentUser.avatar, timestamp: '刚刚', type: 'APPOINTMENT', content: '我们开个会讨论一下事情吧，大家什么时候有空？', status: 'TODO', priority: 'NORMAL', assignees: [], reactions: [], comments: [] };
        break;
    }

    this.dataService.addPost(newPost).subscribe(newPostWithId => {
        this.activeTab.set('home');
        if (this.activeHomeTab() !== 'all') this.activeHomeTab.set(targetTab);
        this.isFabMenuOpen.set(false);
        setTimeout(() => this.scrollToPost(newPostWithId.id), 100);
    });
  }

  publishNewPost(): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;

    const content = this.newPostContent().trim();
    if (!content) return;

    const category = this.newPostCategory();
    let type: PostType;
    let subject: Assignee | undefined = undefined;

    switch (category) {
        case 'health': type = 'FEELING'; subject = currentUser; break;
        case 'knowledge': type = 'DISCOVERY'; break;
        default: type = 'TASK'; break;
    }

    const newPost: Omit<Post, 'id'> = {
        author: currentUser.name, authorAvatar: currentUser.avatar, timestamp: '刚刚', type, content, assignees: [], reactions: [], comments: [],
        status: type === 'TASK' ? 'TODO' : undefined,
        priority: type === 'TASK' ? 'NORMAL' : undefined,
        subject: subject,
    };
    
    this.dataService.addPost(newPost).subscribe(newPostWithId => {
        this.closeNewPostPanel();
        setTimeout(() => {
            this.activeTab.set('home');
            const targetTab = category === 'knowledge' ? 'knowledge' : (category === 'health' ? 'health' : 'daily');
            this.activeHomeTab.set(targetTab);
            setTimeout(() => this.scrollToPost(newPostWithId.id), 50);
        }, 100);
    });
  }

  addReaction(postId: number, type: ReactionType): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;
    this.dataService.addReaction(postId, type, currentUser).subscribe();
  }

  addComment(postId: number): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;
    this.dataService.addComment(postId, currentUser).subscribe();
  }

  // --- Template Helper Methods ---
  getCountdown(dueDateString: string | undefined): string | null {
    if (!dueDateString) return null;
    const diff = new Date(dueDateString).getTime() - this.now().getTime();
    if (diff <= 0) return '已过期';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  getPostTypeConfig(post: Post) {
    const { type, subject } = post;
    const subjectName = subject?.name ?? '家庭';
    const baseConfig = { iconClasses: 'text-xl', assigneeRingClasses: '' };
    const whiteBubble = { bubbleClasses: 'bg-white text-slate-800 border border-slate-100', headerTextClasses: 'text-slate-900', bodyTextClasses: 'text-slate-700', separatorBorderClasses: 'border-black/5', reactionButtonClasses: 'bg-slate-100 hover:bg-slate-200 text-slate-700', assigneeRingClasses: 'ring-white', countdownClasses: 'text-rose-600', timestampClasses: 'text-slate-400' };

    switch (type) {
      case 'FEELING': case 'EVENT': case 'MEDICATION':
        const titles = { FEELING: '不舒服', EVENT: '去医院', MEDICATION: '看报告' };
        const icons = { FEELING: '🤒', EVENT: '🏥', MEDICATION: '💊' };
        return { ...baseConfig, ...whiteBubble, icon: icons[type], title: `${subjectName}健康 - ${titles[type]}`, colorClasses: 'bg-white border-red-200 text-red-800', priorityChipClasses: (p: Priority) => this.getPriorityConfig(p).colorClasses, statusChipClasses: (s: NeedStatus) => this.getNeedStatusConfig(s).colorClasses };
      case 'DISCOVERY':
        return { ...baseConfig, icon: '💡', title: '知识分享', bubbleClasses: 'bg-purple-600 text-white', headerTextClasses: 'text-white', bodyTextClasses: 'text-purple-50', separatorBorderClasses: 'border-white/20', reactionButtonClasses: 'bg-white/20 hover:bg-white/30 text-white', assigneeRingClasses: 'ring-purple-600', countdownClasses: 'text-purple-200', timestampClasses: 'text-purple-200', colorClasses: 'bg-purple-50 border-purple-200 text-purple-800', priorityChipClasses: () => 'bg-white/20 text-white', statusChipClasses: () => 'bg-white/20 text-white' };
      case 'CHORE': case 'TASK': case 'APPOINTMENT':
        return { ...baseConfig, icon: '📝', title: '家庭日常', bubbleClasses: 'bg-sky-500 text-white', headerTextClasses: 'text-white', bodyTextClasses: 'text-sky-50', separatorBorderClasses: 'border-white/20', reactionButtonClasses: 'bg-white/20 hover:bg-white/30 text-white', assigneeRingClasses: 'ring-sky-500', countdownClasses: 'text-rose-200', timestampClasses: 'text-sky-200', colorClasses: 'bg-sky-50 border-sky-200 text-sky-800', priorityChipClasses: () => 'bg-white/20 text-white', statusChipClasses: () => 'bg-white/20 text-white' };
    }
  }

  getNeedStatusConfig(status: NeedStatus) {
    switch (status) {
      case 'TODO': return { text: '待办', colorClasses: 'bg-gray-100 text-gray-800' };
      case 'IN_PROGRESS': return { text: '进行中', colorClasses: 'bg-sky-100 text-sky-800' };
      case 'DONE': return { text: '已完成', colorClasses: 'bg-emerald-100 text-emerald-800' };
    }
  }

  getPriorityConfig(priority: Priority) {
    switch (priority) {
      case 'URGENT': return { text: '紧急', colorClasses: 'bg-rose-100 text-rose-800' };
      case 'NORMAL': return { text: '普通', colorClasses: 'bg-blue-100 text-blue-800' };
      case 'LOW': return { text: '以后再说', colorClasses: 'bg-gray-100 text-gray-500' };
    }
  }

  getReactionConfig(type: ReactionType) {
    switch (type) {
      case 'ILL_DO_IT': return { label: '🙋 我来做:' };
      case 'ILL_JOIN': return { label: '🙌 我参加:' };
      case 'GOT_IT': return { label: '👌 收到:' };
    }
  }
  
  getReactionsByType(post: Post, type: ReactionType): Assignee[] {
    return post.reactions.filter(r => r.type === type).map(r => r.author);
  }

  hasReacted(post: Post, type: ReactionType): boolean {
    const user = this.loggedInUser();
    if (!user) return false;
    return post.reactions.some(r => r.author.name === user.name && r.type === type);
  }
}
