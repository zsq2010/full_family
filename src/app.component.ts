import { Component, ChangeDetectionStrategy, signal, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';

import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { Post, PostType, InventoryCategory } from './types';


type AuthView = 'login' | 'register';
type PostCategory = 'daily' | 'health' | 'knowledge';

@Component({
  selector: 'app-root',
  imports: [NgOptimizedImage, ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  private router = inject(Router);

  // --- Auth & Data State ---
  loggedInUser = this.authService.currentUser;
  activeFamily = this.authService.activeFamily;
  loginError = signal<string | null>(null);
  registerError = signal<string | null>(null);
  familyError = signal<string | null>(null);
  isLoggingIn = signal(false);
  isRegistering = signal(false);
  
  // --- UI State ---
  authView = signal<AuthView>('login');
  
  isFabMenuOpen = signal(false);
  isNewPostPanelOpen = signal(false);
  isNewItemPanelOpen = signal(false);
  newPostContent = signal('');
  newPostCategory = signal<PostCategory>('daily');

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

  constructor() {
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
    // Check for an existing session when the app loads.
    this.authService.checkSession().subscribe();
  }

  ngOnDestroy(): void {
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

  // NOTE: Family creation/joining is now handled in HomeComponent
  // to keep the switcher UI contained there.
  onCreateFamilySubmit(): void {
    const isCreatingFamily = signal(false);
    const familyError = signal<string|null>(null);
    if (this.createFamilyForm.invalid || isCreatingFamily()) return;
    isCreatingFamily.set(true);
    familyError.set(null);
    
    this.authService.createFamily(this.createFamilyForm.value.familyName!).subscribe({
      next: () => {
        isCreatingFamily.set(false);
        this.createFamilyForm.reset();
      },
      error: (err) => {
        familyError.set(err.message || '创建家庭失败。');
        isCreatingFamily.set(false);
      }
    });
  }

  onJoinFamilySubmit(): void {
    const isJoiningFamily = signal(false);
    const familyError = signal<string|null>(null);
    if (this.joinFamilyForm.invalid || isJoiningFamily()) return;
    isJoiningFamily.set(true);
    familyError.set(null);

    this.authService.joinFamily(this.joinFamilyForm.value.inviteCode!).subscribe({
      next: () => {
        isJoiningFamily.set(false);
        this.joinFamilyForm.reset();
      },
      error: (err) => {
        familyError.set(err.message || '加入家庭失败，请检查邀请码。');
        isJoiningFamily.set(false);
      }
    });
  }


  logout(): void {
    // FIX: Use `this.router` directly. Arrow functions in `subscribe` preserve the `this` context.
    this.authService.logout().subscribe(() => {
      this.loginForm.reset();
      this.registerForm.reset();
      this.authView.set('login');
      this.router.navigate(['/home']);
    });
  }

  // --- UI Navigation & Interaction ---
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
  
  closeNewItemPanel(): void {
    this.isNewItemPanelOpen.set(false);
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

    // NOTE: Editing is handled within the InventoryComponent now. 
    // This global form is only for creating new items.
    // FIX: Use `this.router` directly. Arrow functions in `subscribe` preserve the `this` context.
    this.dataService.addInventoryItem(itemData).subscribe(() => {
        this.closeNewItemPanel();
        this.router.navigate(['/inventory']);
    });
  }


  // --- Data Modification Methods (via DataService) ---
  quickSend(type: 'care' | 'help' | 'meeting' | 'meal_suggestion'): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;

    let newPost: Omit<Post, 'id' | 'author' | 'authorAvatar' | 'timestamp' | 'reactions' | 'comments' | 'assignees'>;
    
    switch (type) {
      case 'care':
        newPost = { type: 'FEELING', content: '今天感觉有点不舒服。🤒 希望能得到一些关心。', subject: currentUser };
        break;
      case 'help':
        newPost = { type: 'TASK', content: '我现在需要一些紧急帮助，有人有空吗？', status: 'TODO', priority: 'URGENT', subject: currentUser };
        break;
      case 'meeting':
        newPost = { type: 'APPOINTMENT', content: '我们开个会讨论一下事情吧，大家什么时候有空？', status: 'TODO', priority: 'NORMAL' };
        break;
      case 'meal_suggestion':
        newPost = { type: 'MEAL_SUGGESTION', content: '晚餐吃什么好呢？我没什么头绪，大家有什么想法吗？' };
        break;
    }

    // FIX: Use `this.router` directly. Arrow functions in `subscribe` preserve the `this` context.
    this.dataService.addPost(newPost).subscribe(newPostWithId => {
        this.router.navigate(['/home']);
        this.isFabMenuOpen.set(false);
        // Scrolling to post is now handled within HomeComponent
    });
  }

  publishNewPost(): void {
    const currentUser = this.loggedInUser();
    if (!currentUser) return;

    const content = this.newPostContent().trim();
    if (!content) return;

    const category = this.newPostCategory();
    let type: PostType;

    switch (category) {
        case 'health': type = 'FEELING'; break;
        case 'knowledge': type = 'DISCOVERY'; break;
        default: type = 'TASK'; break;
    }

    const newPost: Omit<Post, 'id' | 'author' | 'authorAvatar' | 'timestamp' | 'reactions' | 'comments' | 'assignees'> = {
        type, content,
        status: type === 'TASK' ? 'TODO' : undefined,
        priority: type === 'TASK' ? 'NORMAL' : undefined,
        subject: type === 'FEELING' ? currentUser : undefined,
    };
    
    // FIX: Use `this.router` directly. Arrow functions in `subscribe` preserve the `this` context.
    this.dataService.addPost(newPost).subscribe(newPostWithId => {
        this.closeNewPostPanel();
        this.router.navigate(['/home']);
    });
  }
}