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
