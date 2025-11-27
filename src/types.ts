export type PostType =
  | 'FEELING'
  | 'DISCOVERY'
  | 'CHORE'
  | 'TASK'
  | 'APPOINTMENT'
  | 'EVENT'
  | 'MEDICATION'
  | 'MEAL_SUGGESTION';
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
  age?: number;
}

export interface Reaction {
  author: Assignee;
  type: ReactionType;
}

export interface AiSuggestion {
  id: number;
  content: string;
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
  aiSuggestions?: AiSuggestion[];
  activeAiSuggestionIndex?: number;
  isLoadingAiSuggestion?: boolean;
}

// --- New Types for Inventory Management ---

export type InventoryCategory = '食材' | '清洁用品' | '生活用品';
export type InventoryStatus = 'IN_STOCK' | 'RUNNING_LOW' | 'OUT_OF_STOCK';

export interface InventoryItemComment {
  id: number;
  author: string;
  authorAvatar: string;
  content: string;
  timestamp: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  image: string;
  category: InventoryCategory;
  brand?: string;
  store?: string;
  notes?: string;
  usageScenario?: string;
  status: InventoryStatus;
  comments?: InventoryItemComment[];
}

// --- New Types for Health Logging ---

export type Mood = '不错' | '充沛' | '疲惫' | '压力大';

export interface WeatherInfo {
  temperature: number;
  humidity: number;
  weatherCode: number;
}

export interface AirQualityInfo {
  aqi?: number;
  pm2_5?: number;
  pm10?: number;
  carbonMonoxide?: number;
  nitrogenDioxide?: number;
  sulphurDioxide?: number;
  ozone?: number;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  name?: string | null;
}

export interface EnvironmentalContext {
  weather: WeatherInfo;
  airQuality: AirQualityInfo;
  location?: LocationInfo;
}

export interface HealthLog {
  id: number;
  author: string;
  timestamp: string;
  content: string;
  mood?: Mood;
  environmentalContext?: EnvironmentalContext;
}