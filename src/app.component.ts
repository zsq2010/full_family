import { Component, ChangeDetectionStrategy, signal, OnInit, OnDestroy, computed, ElementRef, viewChild, inject, effect } from '@angular/core';
import { NgOptimizedImage, DecimalPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

import { API_KEY } from './config';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { Post, Assignee, ReactionType, PostType, NeedStatus, Priority, InventoryItem, InventoryStatus, InventoryCategory, HealthLog, Mood, EnvironmentalContext, Family } from './types';

// --- AI 配置 ---
// API 密钥现在于 src/config.ts 文件中配置。
// -----------------


type ActiveTab = 'home' | 'inventory' | 'health' | 'profile';
type ActiveHomeTab = 'all' | 'daily' | 'health' | 'knowledge';
type PostCategory = 'daily' | 'health' | 'knowledge';
interface QuickLogOption {
  label: string;
  mood?: Mood;
  emoji: string;
}
type EnvironmentState = 'idle' | 'loading' | 'success' | 'error';
type AuthView = 'login' | 'register';

@Component({
  selector: 'app-root',
  imports: [NgOptimizedImage, ReactiveFormsModule, DecimalPipe, DatePipe],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  private ai!: GoogleGenAI;

  // --- Auth & Data State ---
  loggedInUser = this.authService.currentUser;
  userFamilies = this.authService.userFamilies;
  activeFamily = this.authService.activeFamily;
  posts = this.dataService.posts;
  inventory = this.dataService.inventory;
  healthLogs = this.dataService.healthLogs;
  loginError = signal<string | null>(null);
  registerError = signal<string | null>(null);
  familyError = signal<string | null>(null);
  isLoggingIn = signal(false);
  isRegistering = signal(false);
  isCreatingFamily = signal(false);
  isJoiningFamily = signal(false);
  
  // --- UI State ---
  authView = signal<AuthView>('login');
  readonly currentYear = new Date().getFullYear();
  readonly reactionTypes: ReactionType[] = ['ILL_DO_IT', 'ILL_JOIN', 'GOT_IT'];
  private timer: number | undefined;
  now = signal(new Date());
  activeTab = signal<ActiveTab>('home');
  activeHomeTab = signal<ActiveHomeTab>('all');
  
  isFabMenuOpen = signal(false);
  isNewPostPanelOpen = signal(false);
  isNewItemPanelOpen = signal(false);
  editingItemId = signal<number | null>(null);
  activeInventoryTab = signal<'stock' | 'shopping'>('stock');
  newPostContent = signal('');
  newPostCategory = signal<PostCategory>('daily');
  isSavingHealthLog = signal(false);

  // --- Health Tab Environment State ---
  currentEnvironmentalContext = signal<EnvironmentalContext | null>(null);
  environmentState = signal<EnvironmentState>('idle');
  environmentDataError = signal<string | null>(null);
  
  // --- Family Gate & Switcher UI State ---
  isFamilySwitcherOpen = signal(false);
  showCreateFamilyForm = signal(false);
  showJoinFamilyForm = signal(false);

  // --- Forms ---
  loginForm = new FormGroup({
    username: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required),
  });

  registerForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    displayName: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });
  
  createFamilyForm = new FormGroup({
    familyName: new FormControl('', Validators.required)
  });

  joinFamilyForm = new FormGroup({
    inviteCode: new FormControl('', Validators.required)
  });

  newItemForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    category: new FormControl<InventoryCategory>('食材', [Validators.required]),
    image: new FormControl('https://picsum.photos/seed/newitem/200/200'),
    brand: new FormControl(''),
    store: new FormControl(''),
    notes: new FormControl(''),
    usageScenario: new FormControl(''),
  });

  quickLogOptions: QuickLogOption[] = [
    { label: '心情不错', mood: '不错', emoji: '😊' },
    { label: '精力充沛', mood: '充沛', emoji: '⚡️' },
    { label: '有点疲惫', mood: '疲惫', emoji: '🥱' },
    { label: '压力山大', mood: '压力大', emoji: '🤯' },
    { label: '吃了药', emoji: '💊' },
    { label: '运动了', emoji: '🏃' },
    { label: '没睡好', mood: '疲惫', emoji: '😴' },
  ];

  newHealthLogForm = new FormGroup({
    content: new FormControl('', [Validators.required]),
    mood: new FormControl<Mood | undefined>(undefined),
  });

  // --- Commenting State ---
  commentingOnPostId = signal<number | null>(null);
  newCommentContent = signal('');
  commentingOnItemId = signal<number | null>(null);
  newInventoryCommentContent = signal('');

  mainNav = viewChild.required<ElementRef>('mainNav');
  stickyNotice = viewChild<ElementRef>('stickyNotice');

  constructor() {
    if (API_KEY && API_KEY !== "YOUR_API_KEY_HERE") {
      this.ai = new GoogleGenAI({ apiKey: API_KEY });
    } else {
      console.warn("Google Gemini API key not found. Please add it to src/config.ts. AI features will be disabled.");
    }

    // React to family changes to fetch or clear data.
    effect(() => {
      if (this.activeFamily()) {
        this.dataService.getPosts().subscribe();
        this.dataService.getInventory().subscribe();
        this.dataService.getHealthLogs().subscribe();
      } else {
        this.dataService.clearAllData();
      }
    });
  }

  ngOnInit(): void {
    // Start the clock
    this.timer = window.setInterval(() => {
      this.now.set(new Date());
    }, 1000);

    // Check for an existing session when the app loads.
    this.authService.checkSession().subscribe();
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  // --- Authentication ---
  onLoginSubmit(): void {
    if (this.loginForm.invalid || this.isLoggingIn()) {
      return;
    }
    this.isLoggingIn.set(true);
    this.loginError.set(null);
    const { username, password } = this.loginForm.value;
    
    this.authService.login(username!, password!).subscribe({
      next: () => {
        // Successful login, effect will trigger data fetch if family exists.
        this.isLoggingIn.set(false);
      },
      error: (err) => {
        this.loginError.set(err.message || '无效的用户名或密码。');
        this.isLoggingIn.set(false);
      }
    });
  }

  onRegisterSubmit(): void {
    if (this.registerForm.invalid || this.isRegistering()) {
      return;
    }
    this.isRegistering.set(true);
    this.registerError.set(null);
    const { username, displayName, password } = this.registerForm.value;

    this.authService.register(username!, displayName!, password!).subscribe({
      next: () => {
        // Successfully registered and logged in. User will be directed to family gate.
        this.isRegistering.set(false);
      },
      error: (err) => {
        this.registerError.set(err.message || '注册失败，请稍后再试。');
        this.isRegistering.set(false);
      }
    });
  }

  onCreateFamilySubmit(): void {
    if (this.createFamilyForm.invalid || this.isCreatingFamily()) return;
    this.isCreatingFamily.set(true);
    this.familyError.set(null);
    
    this.authService.createFamily(this.createFamilyForm.value.familyName!).subscribe({
      next: () => {
        this.isCreatingFamily.set(false);
        this.showCreateFamilyForm.set(false); // Hide form on success
        this.isFamilySwitcherOpen.set(false); // Close switcher if open
        this.createFamilyForm.reset();
      },
      error: (err) => {
        this.familyError.set(err.message || '创建家庭失败。');
        this.isCreatingFamily.set(false);
      }
    });
  }

  onJoinFamilySubmit(): void {
    if (this.joinFamilyForm.invalid || this.isJoiningFamily()) return;
    this.isJoiningFamily.set(true);
    this.familyError.set(null);

    this.authService.joinFamily(this.joinFamilyForm.value.inviteCode!).subscribe({
      next: () => {
        this.isJoiningFamily.set(false);
        this.showJoinFamilyForm.set(false); // Hide form on success
        this.isFamilySwitcherOpen.set(false); // Close switcher if open
        this.joinFamilyForm.reset();
      },
      error: (err) => {
        this.familyError.set(err.message || '加入家庭失败，请检查邀请码。');
        this.isJoiningFamily.set(false);
      }
    });
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.loginForm.reset();
      this.registerForm.reset();
      this.createFamilyForm.reset();
      this.joinFamilyForm.reset();
      this.authView.set('login');
      this.activeTab.set('home');
      this.isFamilySwitcherOpen.set(false);
    });
  }

  onSwitchFamily(familyId: string): void {
    if (this.activeFamily()?.id === familyId) {
        this.isFamilySwitcherOpen.set(false);
        return;
    }
    this.familyError.set(null);
    this.authService.switchFamily(familyId).subscribe({
      next: () => {
        this.isFamilySwitcherOpen.set(false);
        this.activeHomeTab.set('all'); // Reset home tab on switch
      },
      error: (err) => {
        console.error('Failed to switch family', err);
        this.familyError.set(err.message || '切换家庭失败。');
        this.isFamilySwitcherOpen.set(false);
      }
    });
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
  
  urgentHealthPostIds = computed(() => {
    return new Set(this.urgentHealthPosts().map(p => p.id));
  });

  homePosts = computed(() => {
    const allPosts = this.posts();

    switch (this.activeHomeTab()) {
      case 'daily':
        return allPosts.filter(p => ['TASK', 'CHORE', 'APPOINTMENT', 'MEAL_SUGGESTION'].includes(p.type));
      case 'health':
        return allPosts.filter(p => ['FEELING', 'EVENT', 'MEDICATION'].includes(p.type));
      case 'knowledge':
        return allPosts.filter(p => p.type === 'DISCOVERY');
      default:
        return allPosts;
    }
  });

  userHealthLogs = computed(() => {
    const user = this.loggedInUser();
    if (!user) return [];
    return this.healthLogs().filter(log => log.author === user.name);
  });

  groupedInventory = computed(() => {
    return this.inventory()
      .filter(item => item.status === 'IN_STOCK')
      .reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<InventoryCategory, InventoryItem[]>);
  });

  inventoryCategories = computed(() => {
    return Object.keys(this.groupedInventory()) as InventoryCategory[];
  });

  shoppingListItems = computed(() => {
    return this.inventory()
      .filter(item => item.status === 'RUNNING_LOW' || item.status === 'OUT_OF_STOCK')
      .sort((a, b) => {
        if (a.status === 'OUT_OF_STOCK' && b.status === 'RUNNING_LOW') return -1;
        if (a.status === 'RUNNING_LOW' && b.status === 'OUT_OF_STOCK') return 1;
        return 0;
      });
  });

  // --- Tab & Panel Management ---
  setActiveTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
    // Automatically fetch environmental data when switching to the health tab for the first time, or after an error.
    if (tab === 'health' && !this.currentEnvironmentalContext() && this.environmentState() !== 'loading' && this.environmentState() !== 'success') {
      this.fetchCurrentEnvironmentData();
    }
  }
  
  setActiveHomeTab(tab: ActiveHomeTab): void {
    this.activeHomeTab.set(tab);
  }

  viewInventory(tab: 'stock' | 'shopping'): void {
    this.activeTab.set('inventory');
    this.activeInventoryTab.set(tab);
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
  
  openNewItemPanel(): void {
    this.isFabMenuOpen.set(false);
    this.isNewItemPanelOpen.set(true);
  }

  openEditItemPanel(item: InventoryItem): void {
    this.editingItemId.set(item.id);
    this.newItemForm.patchValue({
      name: item.name,
      category: item.category,
      image: item.image,
      brand: item.brand ?? '',
      store: item.store ?? '',
      notes: item.notes ?? '',
      usageScenario: item.usageScenario ?? ''
    });
    this.isNewItemPanelOpen.set(true);
  }
  
  closeNewItemPanel(): void {
    this.isNewItemPanelOpen.set(false);
    this.editingItemId.set(null);
    this.newItemForm.reset({
      name: '',
      category: '食材',
      image: `https://picsum.photos/seed/${Date.now()}/200/200`,
      brand: '',
      store: '',
      notes: '',
      usageScenario: '',
    });
  }

  onNewPostInput(event: Event): void {
    this.newPostContent.set((event.target as HTMLTextAreaElement).value);
  }

  // --- Data Modification Methods (via DataService) ---
  quickSend(type: 'care' | 'help' | 'meeting' | 'meal_suggestion'): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;

    let newPost: Omit<Post, 'id' | 'author' | 'authorAvatar' | 'timestamp' | 'reactions' | 'comments' | 'assignees'>;
    let targetTab: ActiveHomeTab;

    switch (type) {
      case 'care':
        targetTab = 'health';
        newPost = { type: 'FEELING', content: '今天感觉有点不舒服。🤒 希望能得到一些关心。', subject: currentUser };
        break;
      case 'help':
        targetTab = 'daily';
        newPost = { type: 'TASK', content: '我现在需要一些紧急帮助，有人有空吗？', status: 'TODO', priority: 'URGENT', subject: currentUser };
        break;
      case 'meeting':
        targetTab = 'daily';
        newPost = { type: 'APPOINTMENT', content: '我们开个会讨论一下事情吧，大家什么时候有空？', status: 'TODO', priority: 'NORMAL' };
        break;
      case 'meal_suggestion':
        targetTab = 'daily';
        newPost = { type: 'MEAL_SUGGESTION', content: '晚餐吃什么好呢？我没什么头绪，大家有什么想法吗？' };
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

    const newPost: Omit<Post, 'id' | 'author' | 'authorAvatar' | 'timestamp' | 'reactions' | 'comments' | 'assignees'> = {
        type, content,
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

  selectQuickLog(option: QuickLogOption): void {
    this.newHealthLogForm.setValue({
      content: option.label,
      mood: option.mood ?? undefined,
    });
  }

  fetchCurrentEnvironmentData(): void {
    this.environmentState.set('loading');
    this.environmentDataError.set(null);
    this.currentEnvironmentalContext.set(null);
    
    this.dataService.getEnvironmentalContext()
        .subscribe({
            next: (context) => {
                this.currentEnvironmentalContext.set(context);
                this.environmentState.set('success');
            },
            error: (err) => {
                console.error('Failed to get environmental context', err);
                let message = '无法获取您的位置或环境数据。';
                if (err.code === 1) { // PERMISSION_DENIED
                    message = '您已拒绝位置权限。请在浏览器设置中允许位置访问。';
                } else if (err.code === 2) { // POSITION_UNAVAILABLE
                    message = '无法确定您的位置，请检查设备的定位服务。';
                } else if (err.code === 3) { // TIMEOUT
                     message = '获取位置信息超时。';
                }
                this.environmentDataError.set(message);
                this.environmentState.set('error');
            }
        });
  }

  onAddNewHealthLogSubmit(): void {
    if (this.newHealthLogForm.invalid || this.isSavingHealthLog()) return;

    const currentUser = this.loggedInUser();
    if (!currentUser) return;
    
    this.isSavingHealthLog.set(true);

    const formValue = this.newHealthLogForm.value;
    const newLogData: Omit<HealthLog, 'id' | 'timestamp' | 'author'> = {
        content: formValue.content!,
        mood: formValue.mood || undefined,
        environmentalContext: this.currentEnvironmentalContext() ?? undefined,
    };

    this.dataService.addHealthLog(newLogData)
      .subscribe({
        next: () => {
            this.newHealthLogForm.reset({ content: '', mood: undefined });
            this.isSavingHealthLog.set(false);
        },
        error: () => {
             this.isSavingHealthLog.set(false);
        }
    });
  }

  addReaction(postId: number, type: ReactionType): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;
    this.dataService.addReaction(postId, type, currentUser).subscribe();
  }

  toggleCommentInput(postId: number): void {
    this.commentingOnPostId.update(currentId => currentId === postId ? null : postId);
    this.newCommentContent.set('');
  }

  onCommentInput(event: Event): void {
    this.newCommentContent.set((event.target as HTMLTextAreaElement).value);
  }
  
  submitComment(postId: number): void {
    const currentUser = this.loggedInUser();
    const content = this.newCommentContent().trim();
    if (!currentUser || !content) return;

    this.dataService.addComment(postId, content, currentUser).subscribe(() => {
        this.toggleCommentInput(postId);
    });
  }

  deletePostComment(postId: number, commentId: number): void {
    if (confirm('您确定要删除这条评论吗？')) {
        this.dataService.deleteComment(postId, commentId).subscribe();
    }
  }

  markAsDone(postId: number): void {
    this.dataService.markTaskAsDone(postId).subscribe();
  }
  
  onAddNewItemSubmit(): void {
    if (this.newItemForm.invalid) {
      return;
    }
    const formValue = this.newItemForm.value;
    const itemData = {
      name: formValue.name!,
      category: formValue.category!,
      image: formValue.image || `https://picsum.photos/seed/${formValue.name}/200/200`,
      brand: formValue.brand || undefined,
      store: formValue.store || undefined,
      notes: formValue.notes || undefined,
      usageScenario: formValue.usageScenario || undefined,
    };

    const currentEditingId = this.editingItemId();
    if (currentEditingId) {
        this.dataService.updateInventoryItem(currentEditingId, itemData).subscribe(() => {
            this.closeNewItemPanel();
        });
    } else {
        this.dataService.addInventoryItem(itemData).subscribe(() => {
            this.closeNewItemPanel();
        });
    }
  }

  deleteItem(itemId: number, itemName: string): void {
    if (confirm(`您确定要删除 "${itemName}" 吗？此操作无法撤销。`)) {
      this.dataService.deleteInventoryItem(itemId).subscribe();
    }
  }

  updateItemStatus(itemId: number, status: InventoryStatus): void {
    this.dataService.updateInventoryItemStatus(itemId, status).subscribe();
  }

  markAsPurchased(itemId: number): void {
    this.dataService.updateInventoryItemStatus(itemId, 'IN_STOCK').subscribe();
  }

  toggleInventoryCommentInput(itemId: number): void {
    this.commentingOnItemId.update(currentId => currentId === itemId ? null : itemId);
    this.newInventoryCommentContent.set('');
  }

  onInventoryCommentInput(event: Event): void {
      this.newInventoryCommentContent.set((event.target as HTMLTextAreaElement).value);
  }

  submitInventoryComment(itemId: number): void {
      const currentUser = this.loggedInUser();
      const content = this.newInventoryCommentContent().trim();
      if (!currentUser || !content) return;

      this.dataService.addInventoryComment(itemId, content, currentUser).subscribe(() => {
          this.toggleInventoryCommentInput(itemId);
      });
  }

  deleteInventoryItemComment(itemId: number, commentId: number): void {
    if (confirm('您确定要删除这条评论吗？')) {
        this.dataService.deleteInventoryComment(itemId, commentId).subscribe();
    }
  }

  async getAiAnalysisForPost(post: Post): Promise<void> {
    if (!this.ai) {
      console.error("AI client not initialized.");
      this.dataService.updatePostAiSuggestion(post.id, { newSuggestion: "AI 服务不可用，请在 `src/config.ts` 中检查您的 API Key 配置。", isLoading: false });
      return;
    }
  
    this.dataService.updatePostAiSuggestion(post.id, { isLoading: true });
    
    const familyMembers = this.activeFamily()?.members ?? [];
    const familyProfileString = familyMembers.map(m => `- ${m.name} (年龄: ${m.age})`).join('\n');
    const commentsString = post.comments.map(c => `- ${c.author}: "${c.content}"`).join('\n');
    const initialRequest = post.content;
  
    let prompt = '';
  
    switch (post.type) {
      case 'MEAL_SUGGESTION':
        const inventoryString = this.inventory()
          .filter(i => i.status === 'IN_STOCK' || i.status === 'RUNNING_LOW')
          .map(i => `- ${i.name} (${i.brand ?? ''})`)
          .join('\n');
        prompt = `
          You are a caring family nutritionist and expert home chef. Your role is to act as a mediator and create a harmonious meal plan by synthesizing a discussion from multiple family members.
          ## Family Profile:
          ${familyProfileString}
          ## Current Home Inventory:
          We have these items on hand:
          ${inventoryString}
          ## Family Meal Discussion:
          The conversation started with this request: "${initialRequest}"
          Here are the comments and preferences from other family members:
          ${commentsString ? commentsString : "(No other comments were added.)"}
          ## Your Task:
          Based on all the information above, please synthesize the family's discussion and generate a complete, thoughtful meal plan that tries to satisfy everyone.
          1.  **Analyze and Acknowledge all opinions** from the discussion.
          2.  **Propose one or two dishes** that form a cohesive meal.
          3.  **Strictly adhere to any absolute dietary restrictions** mentioned.
          4.  **Prioritize using ingredients from the home inventory.**
          5.  For each dish, provide a simple name, ingredients, and clear instructions.
          6.  **Explain your reasoning clearly.** Start with a summary of how your proposed meal addresses the different requests.
          7.  Format your entire response in clear, friendly, and well-structured Markdown.
        `;
        break;
  
      case 'TASK':
      case 'CHORE':
      case 'APPOINTMENT':
        prompt = `
          You are a helpful and efficient family assistant. A family member has posted a task, chore, or appointment.
          ## Family Profile:
          ${familyProfileString}
          ## The Request: "${initialRequest}"
          ## Comments from others:
          ${commentsString ? commentsString : "(No other comments were added.)"}
          ## Your Task:
          Analyze the request and provide practical, actionable advice.
          1.  If it's a task, break it down into smaller, manageable steps.
          2.  Suggest any tools or resources that might be helpful.
          3.  Offer tips for completing it efficiently or making it more enjoyable.
          4.  If it's an appointment, suggest things to prepare or remember.
          5.  Keep your tone encouraging and supportive. Format as Markdown.
        `;
        break;
  
      case 'FEELING':
      case 'EVENT':
      case 'MEDICATION':
        prompt = `
          You are a caring and empathetic family health companion. A family member has shared a health-related update.
          ## Family Member's Post: "${initialRequest}"
          ## Your Task:
          Your role is to offer supportive and comforting words.
          1.  Acknowledge the post with empathy and care.
          2.  Offer general, non-medical wellness suggestions (e.g., "希望你多休息", "记得多喝水", "需要聊聊我随时都在").
          3.  **Crucially, DO NOT provide any medical advice, diagnosis, or treatment suggestions.**
          4.  Keep your response concise, warm, and reassuring.
          5.  At the end of your response, you **MUST** include the following disclaimer exactly as written, in Markdown.

          ---

          *免责声明：我是一个 AI 助手，不能提供医疗建议。请务必咨询专业医生。*
        `;
        break;
  
      case 'DISCOVERY':
        prompt = `
          You are a curious and knowledgeable enthusiast. A family member has shared a new discovery or a piece of knowledge.
          ## The Discovery: "${initialRequest}"
          ## Your Task:
          Expand on this topic in an interesting and engaging way for a family audience.
          1.  Provide 2-3 related fun facts or interesting details.
          2.  You could explain the "why" or "how" behind the discovery in simple terms.
          3.  Keep the tone light, fun, and easy to understand.
          4.  Format your response in well-structured Markdown.
        `;
        break;
  
      default:
        // Generic fallback, though we should have a case for all types.
        prompt = `Analyze this family post: "${initialRequest}" and provide a helpful comment.`;
        break;
    }

    try {
      // FIX: Use 'contents' instead of 'prompt' for the generateContent call, as per @google/genai guidelines.
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      const rawSuggestion = response.text;
      const htmlSuggestion = await marked.parse(rawSuggestion);
      this.dataService.updatePostAiSuggestion(post.id, { newSuggestion: htmlSuggestion, isLoading: false });
    } catch (error) {
      console.error('Error getting AI analysis:', error);
      const errorMessage = '抱歉，我在思考时遇到了点问题，请稍后再试。';
      this.dataService.updatePostAiSuggestion(post.id, { newSuggestion: errorMessage, isLoading: false });
    }
  }

  changeSuggestion(post: Post, direction: 'next' | 'prev'): void {
    const suggestions = post.aiSuggestions;
    if (!suggestions || suggestions.length <= 1) {
      return;
    }
  
    let currentIndex = post.activeAiSuggestionIndex ?? 0;
    
    if (direction === 'next') {
      currentIndex++;
      if (currentIndex >= suggestions.length) {
        currentIndex = 0; // Loop around
      }
    } else { // 'prev'
      currentIndex--;
      if (currentIndex < 0) {
        currentIndex = suggestions.length - 1; // Loop around
      }
    }
    
    this.dataService.updatePostAiSuggestion(post.id, { activeIndex: currentIndex });
  }

  // --- Template Helper Methods ---
  isUserInvolved(post: Post): boolean {
    const user = this.loggedInUser();
    if (!user) return false;
    const isAssignee = post.assignees.some(a => a.name === user.name);
    const hasReactedToDo = post.reactions.some(r => r.author.name === user.name && (r.type === 'ILL_DO_IT' || r.type === 'ILL_JOIN'));
    return isAssignee || hasReactedToDo;
  }
  
  isDarkCard(postType: PostType): boolean {
    return ['DISCOVERY', 'CHORE', 'TASK', 'APPOINTMENT', 'MEAL_SUGGESTION'].includes(postType);
  }

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
      case 'MEAL_SUGGESTION':
        return { ...baseConfig, icon: '🍲', title: '吃点什么？', bubbleClasses: 'bg-amber-500 text-white', headerTextClasses: 'text-white', bodyTextClasses: 'text-amber-50', separatorBorderClasses: 'border-white/20', reactionButtonClasses: 'bg-white/20 hover:bg-white/30 text-white', assigneeRingClasses: 'ring-amber-500', countdownClasses: 'text-amber-200', timestampClasses: 'text-amber-200', colorClasses: 'bg-amber-50 border-amber-200 text-amber-800', priorityChipClasses: () => 'bg-white/20 text-white', statusChipClasses: () => 'bg-white/20 text-white' };
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

  getInventoryStatusConfig(status: InventoryStatus) {
    switch (status) {
      case 'IN_STOCK': return { text: '充足', color: 'bg-emerald-500', buttonClasses: 'bg-emerald-100 text-emerald-800' };
      case 'RUNNING_LOW': return { text: '快用完了', color: 'bg-amber-500', buttonClasses: 'bg-amber-100 text-amber-800' };
      case 'OUT_OF_STOCK': return { text: '已用完', color: 'bg-rose-500', buttonClasses: 'bg-rose-100 text-rose-800' };
    }
  }

  getMoodEmoji(mood: Mood): string | undefined {
    return this.quickLogOptions.find(o => o.mood === mood)?.emoji;
  }

  getWeatherIcon(code: number): string {
    if (code === 0) return '☀️'; // Clear sky
    if (code >= 1 && code <= 3) return '☁️'; // Cloudy
    if (code >= 45 && code <= 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 67) return '🌧️'; // Rain/Drizzle
    if (code >= 71 && code <= 77) return '❄️'; // Snow
    if (code >= 80 && code <= 99) return '⛈️'; // Showers/Thunderstorm
    return '-';
  }

  getAqiInfo(aqi: number | undefined): { text: string; colorClasses: string } {
    if (aqi === undefined) return { text: 'N/A', colorClasses: 'bg-slate-100 text-slate-800' };
    if (aqi <= 50) return { text: '优', colorClasses: 'bg-emerald-100 text-emerald-800' };
    if (aqi <= 100) return { text: '良', colorClasses: 'bg-yellow-100 text-yellow-800' };
    if (aqi <= 150) return { text: '轻度污染', colorClasses: 'bg-orange-100 text-orange-800' };
    if (aqi <= 200) return { text: '中度污染', colorClasses: 'bg-rose-100 text-rose-800' };
    if (aqi <= 300) return { text: '重度污染', colorClasses: 'bg-purple-100 text-purple-800' };
    return { text: '严重污染', colorClasses: 'bg-red-200 text-red-900' };
  }
}