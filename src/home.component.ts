import { Component, ChangeDetectionStrategy, signal, computed, ElementRef, viewChild, inject, OnDestroy, OnInit } from '@angular/core';
import { NgOptimizedImage, DecimalPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

import { API_KEY } from './config';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { Post, Assignee, ReactionType, PostType, NeedStatus, Priority } from './types';

type ActiveHomeTab = 'all' | 'daily' | 'health' | 'knowledge';

@Component({
  selector: 'app-home',
  imports: [NgOptimizedImage, DecimalPipe, DatePipe, ReactiveFormsModule],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  private router = inject(Router);
  private ai!: GoogleGenAI;

  // --- Auth & Data State ---
  loggedInUser = this.authService.currentUser;
  userFamilies = this.authService.userFamilies;
  activeFamily = this.authService.activeFamily;
  posts = this.dataService.posts;
  inventory = this.dataService.inventory;
  
  // --- UI State ---
  readonly reactionTypes: ReactionType[] = ['ILL_DO_IT', 'ILL_JOIN', 'GOT_IT'];
  private timer: number | undefined;
  now = signal(new Date());
  activeHomeTab = signal<ActiveHomeTab>('all');
  
  // --- Commenting State ---
  commentingOnPostId = signal<number | null>(null);
  newCommentContent = signal('');

  // --- Family Gate & Switcher UI State ---
  isFamilySwitcherOpen = signal(false);
  showCreateFamilyForm = signal(false);
  showJoinFamilyForm = signal(false);
  familyError = signal<string | null>(null);
  isCreatingFamily = signal(false);
  isJoiningFamily = signal(false);

  // --- Forms ---
  createFamilyForm = new FormGroup({
    familyName: new FormControl('', Validators.required)
  });

  joinFamilyForm = new FormGroup({
    inviteCode: new FormControl('', Validators.required)
  });

  mainNav = viewChild.required<ElementRef>('mainNav');
  stickyNotice = viewChild<ElementRef>('stickyNotice');

  constructor() {
    if (API_KEY && API_KEY !== "YOUR_API_KEY_HERE") {
      this.ai = new GoogleGenAI({ apiKey: API_KEY });
    } else {
      console.warn("Google Gemini API key not found. Please add it to src/config.ts. AI features will be disabled.");
    }
  }

  ngOnInit(): void {
    // Start the clock
    this.timer = window.setInterval(() => {
      this.now.set(new Date());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  // --- Family Management ---
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
  
  onSwitchFamily(familyId: string): void {
    if (this.activeFamily()?.id === familyId) {
        this.isFamilySwitcherOpen.set(false);
        return;
    }
    this.familyError.set(null);
    this.authService.switchFamily(familyId).subscribe({
      next: () => {
        this.isFamilySwitcherOpen.set(false);
        this.router.navigate(['/home']); // Navigate to home on switch
      },
      error: (err) => {
        console.error('Failed to switch family', err);
        this.familyError.set(err.message || '切换家庭失败。');
        this.isFamilySwitcherOpen.set(false);
      }
    });
  }

  closeFamilySwitcher(): void {
    this.showCreateFamilyForm.set(false);
    this.showJoinFamilyForm.set(false);
    this.familyError.set(null);
    this.createFamilyForm.reset();
    this.joinFamilyForm.reset();
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

  // --- Tab & Panel Management ---
  setActiveHomeTab(tab: ActiveHomeTab): void {
    this.activeHomeTab.set(tab);
  }
  
  // --- Data Modification Methods (via DataService) ---
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
}
