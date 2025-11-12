import { Component, ChangeDetectionStrategy, signal, OnInit, OnDestroy, computed, ElementRef, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

export type PostType =
  | 'FEELING'
  | 'DISCOVERY'
  | 'CHORE'
  | 'TASK'
  | 'APPOINTMENT'
  | 'EVENT'
  | 'MEDICATION';
export type NeedStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type Priority = 'URGENT' | 'NORMAL' | 'LOW';
export type ReactionType = 'GOT_IT' | 'ILL_DO_IT' | 'ILL_JOIN';

export interface Media {
  type: 'image' | 'video';
  url: string;
}

export interface Comment {
  id: number;
  author: string;
  authorAvatar: string;
  content: string;
  timestamp: string;
}

export interface Assignee {
  name: string;
  avatar: string;
}

export interface Reaction {
  author: Assignee;
  type: ReactionType;
}

export interface Post {
  id: number;
  author: string;
  authorAvatar: string;
  timestamp: string;
  type: PostType;
  content: string;
  media?: Media[];
  status?: NeedStatus;
  priority?: Priority;
  dueDate?: string;
  assignees: Assignee[];
  reactions: Reaction[];
  comments: Comment[];
  subject?: Assignee;
}

const CURRENT_USER: Assignee = {
  name: '我',
  avatar: 'https://picsum.photos/seed/me/100/100',
};

type ActiveTab = 'home' | 'overview';
type ActiveHomeTab = 'all' | 'daily' | 'health' | 'knowledge';
type PostCategory = 'daily' | 'health' | 'knowledge';

@Component({
  selector: 'app-root',
  imports: [NgOptimizedImage],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  readonly currentUser = CURRENT_USER;
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
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

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

  posts = signal<Post[]>([
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
  ]);

  urgentHealthPosts = computed(() => {
    // A health-related post is considered "urgent" and pinned
    // if the current user has not yet acknowledged it with "GOT_IT".
    return this.posts().filter(p => {
      const isHealthPost = ['FEELING', 'EVENT', 'MEDICATION'].includes(p.type);
      if (!isHealthPost) {
        return false;
      }
      const hasAcknowledged = p.reactions.some(
        r => r.author.name === this.currentUser.name && r.type === 'GOT_IT'
      );
      return !hasAcknowledged;
    });
  });

  homePosts = computed(() => {
    const urgentPostIds = new Set(this.urgentHealthPosts().map(p => p.id));
    // Exclude all urgent posts from the main feed
    const regularPosts = this.posts().filter(p => !urgentPostIds.has(p.id));

    const currentTab = this.activeHomeTab();
    switch (currentTab) {
      case 'daily':
        return regularPosts.filter(p => ['TASK', 'CHORE', 'APPOINTMENT'].includes(p.type));
      case 'health':
        return regularPosts.filter(p => ['FEELING', 'EVENT', 'MEDICATION'].includes(p.type));
      case 'knowledge':
        return regularPosts.filter(p => p.type === 'DISCOVERY');
      case 'all':
      default:
        return regularPosts;
    }
  });

  dailyPosts = computed(() => 
    this.posts().filter(p => ['TASK', 'CHORE', 'APPOINTMENT'].includes(p.type))
  );

  healthPosts = computed(() => 
    this.posts().filter(p => ['FEELING', 'EVENT', 'MEDICATION'].includes(p.type))
  );

  discoveries = computed(() =>
    this.posts().filter(post => post.type === 'DISCOVERY')
  );

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
    if (['TASK', 'CHORE', 'APPOINTMENT'].includes(postType)) {
      this.activeHomeTab.set('daily');
    } else if (['FEELING', 'EVENT', 'MEDICATION'].includes(postType)) {
      this.activeHomeTab.set('health');
    } else if (postType === 'DISCOVERY') {
      this.activeHomeTab.set('knowledge');
    } else {
      this.activeHomeTab.set('all');
    }

    setTimeout(() => {
      this.scrollToPost(post.id);
    }, 100); 
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
    const target = event.target as HTMLTextAreaElement;
    this.newPostContent.set(target.value);
  }

  quickSend(type: 'care' | 'help' | 'meeting'): void {
    let newPost: Omit<Post, 'id'>;
    let targetTab: ActiveHomeTab;

    switch (type) {
      case 'care':
        targetTab = 'health';
        newPost = {
          author: this.currentUser.name,
          authorAvatar: this.currentUser.avatar,
          timestamp: '刚刚',
          type: 'FEELING',
          content: '今天感觉有点不舒服。🤒 希望能得到一些关心。',
          subject: { name: this.currentUser.name, avatar: this.currentUser.avatar },
          assignees: [],
          reactions: [],
          comments: [],
        };
        break;
      case 'help':
        targetTab = 'daily';
        newPost = {
          author: this.currentUser.name,
          authorAvatar: this.currentUser.avatar,
          timestamp: '刚刚',
          type: 'TASK',
          content: '我现在需要一些紧急帮助，有人有空吗？',
          status: 'TODO',
          priority: 'URGENT',
          assignees: [],
          reactions: [],
          comments: [],
          subject: { name: this.currentUser.name, avatar: this.currentUser.avatar },
        };
        break;
      case 'meeting':
        targetTab = 'daily';
        newPost = {
          author: this.currentUser.name,
          authorAvatar: this.currentUser.avatar,
          timestamp: '刚刚',
          type: 'APPOINTMENT',
          content: '我们开个会讨论一下事情吧，大家什么时候有空？',
          status: 'TODO',
          priority: 'NORMAL',
          assignees: [],
          reactions: [],
          comments: [],
          subject: undefined,
        };
        break;
    }

    const newPostWithId = { ...newPost, id: Date.now() };

    this.posts.update(currentPosts => [...currentPosts, newPostWithId]);
    
    this.activeTab.set('home');
    // Only switch tabs if the user is in a filtered view.
    if (this.activeHomeTab() !== 'all') {
      this.activeHomeTab.set(targetTab);
    }
    this.isFabMenuOpen.set(false);

    // Scroll to new post after a short delay to allow for rendering
    setTimeout(() => {
      this.scrollToPost(newPostWithId.id);
    }, 100);
  }

  publishNewPost(): void {
    const content = this.newPostContent().trim();
    if (!content) return;

    const category = this.newPostCategory();
    let type: PostType;
    let subject: Assignee | undefined = undefined;

    switch (category) {
        case 'health':
            type = 'FEELING';
            subject = this.currentUser;
            break;
        case 'knowledge':
            type = 'DISCOVERY';
            break;
        case 'daily':
        default:
            type = 'TASK';
            break;
    }

    const newPost: Omit<Post, 'id'> = {
        author: this.currentUser.name,
        authorAvatar: this.currentUser.avatar,
        timestamp: '刚刚',
        type: type,
        content: content,
        assignees: [],
        reactions: [],
        comments: [],
        status: type === 'TASK' ? 'TODO' : undefined,
        priority: type === 'TASK' ? 'NORMAL' : undefined,
        subject: subject,
    };
    
    const newPostWithId = { ...newPost, id: Date.now() };

    this.posts.update(currentPosts => [newPostWithId, ...currentPosts]);
    
    this.closeNewPostPanel();

    setTimeout(() => {
      this.activeTab.set('home');
      const targetTab = category === 'knowledge' ? 'knowledge' : (category === 'health' ? 'health' : 'daily');
      this.activeHomeTab.set(targetTab);
      setTimeout(() => {
        this.scrollToPost(newPostWithId.id);
      }, 50);
    }, 100);
  }

  getCountdown(dueDateString: string | undefined): string | null {
    if (!dueDateString) {
      return null;
    }

    const dueDate = new Date(dueDateString);
    const diff = dueDate.getTime() - this.now().getTime();

    if (diff <= 0) {
      return '已过期';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  getPostTypeConfig(post: Post) {
    const { type, subject } = post;
    const subjectName = subject?.name ?? '家庭';

    const baseConfig = {
      iconClasses: 'text-xl',
      assigneeRingClasses: '',
    };
    
    const whiteBubble = {
      bubbleClasses: 'bg-white text-slate-800 border border-slate-100',
      headerTextClasses: 'text-slate-900',
      bodyTextClasses: 'text-slate-700',
      separatorBorderClasses: 'border-black/5',
      reactionButtonClasses: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
      assigneeRingClasses: 'ring-white',
      countdownClasses: 'text-rose-600',
      timestampClasses: 'text-slate-400',
    };

    switch (type) {
      case 'FEELING':
      case 'EVENT':
      case 'MEDICATION':
        const titles = {
            FEELING: '不舒服',
            EVENT: '去医院',
            MEDICATION: '看报告',
        };
        const icons = {
            FEELING: '🤒',
            EVENT: '🏥',
            MEDICATION: '💊',
        }
        return {
          ...baseConfig,
          ...whiteBubble,
          icon: icons[type],
          title: `${subjectName}健康 - ${titles[type]}`,
          colorClasses: 'bg-white border-red-200 text-red-800', // For sticky bar
          priorityChipClasses: (p: Priority) => this.getPriorityConfig(p).colorClasses,
          statusChipClasses: (s: NeedStatus) => this.getNeedStatusConfig(s).colorClasses,
        };
      case 'DISCOVERY':
        return {
          ...baseConfig,
          icon: '💡',
          title: '知识分享',
          bubbleClasses: 'bg-purple-600 text-white',
          headerTextClasses: 'text-white',
          bodyTextClasses: 'text-purple-50',
          separatorBorderClasses: 'border-white/20',
          reactionButtonClasses: 'bg-white/20 hover:bg-white/30 text-white',
          assigneeRingClasses: 'ring-purple-600',
          countdownClasses: 'text-purple-200',
          timestampClasses: 'text-purple-200',
          colorClasses: 'bg-purple-50 border-purple-200 text-purple-800',
          priorityChipClasses: () => 'bg-white/20 text-white',
          statusChipClasses: () => 'bg-white/20 text-white',
        };
      case 'CHORE':
      case 'TASK':
      case 'APPOINTMENT':
        return {
          ...baseConfig,
          icon: '📝',
          title: '家庭日常',
          bubbleClasses: 'bg-sky-500 text-white',
          headerTextClasses: 'text-white',
          bodyTextClasses: 'text-sky-50',
          separatorBorderClasses: 'border-white/20',
          reactionButtonClasses: 'bg-white/20 hover:bg-white/30 text-white',
          assigneeRingClasses: 'ring-sky-500',
          countdownClasses: 'text-rose-200',
          timestampClasses: 'text-sky-200',
          colorClasses: 'bg-sky-50 border-sky-200 text-sky-800',
          priorityChipClasses: () => 'bg-white/20 text-white',
          statusChipClasses: () => 'bg-white/20 text-white',
        };
    }
  }

  getNeedStatusConfig(status: NeedStatus) {
    switch (status) {
      case 'TODO':
        return { text: '待办', colorClasses: 'bg-gray-100 text-gray-800' };
      case 'IN_PROGRESS':
        return {
          text: '进行中',
          colorClasses: 'bg-sky-100 text-sky-800',
        };
      case 'DONE':
        return {
          text: '已完成',
          colorClasses: 'bg-emerald-100 text-emerald-800',
        };
    }
  }

  getPriorityConfig(priority: Priority) {
    switch (priority) {
      case 'URGENT':
        return { text: '紧急', colorClasses: 'bg-rose-100 text-rose-800' };
      case 'NORMAL':
        return { text: '普通', colorClasses: 'bg-blue-100 text-blue-800' };
      case 'LOW':
        return {
          text: '以后再说',
          colorClasses: 'bg-gray-100 text-gray-500',
        };
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
    return post.reactions.some(r => r.author.name === this.currentUser.name && r.type === type);
  }

  addReaction(postId: number, type: ReactionType): void {
    this.posts.update((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id === postId) {
          if (this.hasReacted(post, type)) {
            return post; // User has already made this reaction, do nothing.
          }
  
          const newReaction: Reaction = {
            author: this.currentUser,
            type: type,
          };
          
          let updatedPost = { ...post, reactions: [...post.reactions, newReaction] };
  
          // Also handle joining tasks/chores/events and updating status
          if (type === 'ILL_DO_IT' || type === 'ILL_JOIN') {
              const isAlreadyAssignee = updatedPost.assignees.some(
                (a) => a.name === this.currentUser.name
              );
              if (!isAlreadyAssignee) {
                  updatedPost.assignees = [...updatedPost.assignees, this.currentUser];
                  if(updatedPost.status === 'TODO') {
                    updatedPost.status = 'IN_PROGRESS' as NeedStatus;
                  }
              }
          }
          return updatedPost;
        }
        return post;
      })
    );
  }

  addComment(postId: number): void {
    this.posts.update((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id === postId) {
          const newComment: Comment = {
            id: Date.now(),
            author: CURRENT_USER.name,
            authorAvatar: CURRENT_USER.avatar,
            content: '好的，收到！',
            timestamp: '刚刚',
          };
          return {
            ...post,
            comments: [...post.comments, newComment],
          };
        }
        return post;
      })
    );
  }
}