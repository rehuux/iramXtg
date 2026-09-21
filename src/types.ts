export type LookupType = string;

export interface LookupOption {
  id: string;
  title: string;
  icon: string;
  placeholder: string;
  example: string;
  description: string;
  category: 'vehicles' | 'identity' | 'telecom' | 'business' | 'custom';
  enabled?: boolean;
  apiUrl?: string;
  isCustom?: boolean;
}

export interface SearchResult {
  success: boolean;
  type: string;
  query: string;
  timestamp: string;
  data: any;
  error?: string;
}

export interface StatsData {
  totalUsers: number;
  premiumUsers: number;
  bannedUsers: number;
  todaySearches: number;
  allTimeSearches: number;
  userRole: 'admin' | 'premium' | 'free';
  dailyRemaining: number;
  dailyLimit: number;
  channelVerified: boolean;
  channelId?: string;
  channelLink?: string;
}

export interface BotConfig {
  botName: string;
  botVersion: string;
  botUsername: string;
  developer: string;
  developerLink: string;
  channelId: string;
  channelUsername: string;
  channelLink: string;
  supportGroup: string;
  telegramActive: boolean;
}

export interface BotButton {
  id: string;
  label: string;
  category: string;
  apiUrl: string;
  placeholder?: string;
  example?: string;
  description?: string;
  enabled: boolean;
  isCustom?: boolean;
  sortOrder?: number;
  dailyLimit?: number;
}

export interface BotUser {
  userId: string;
  role: 'admin' | 'premium' | 'free';
  dailySearches: number;
  dailyLimit: number;
  remaining: number;
  totalSearches: number;
  channelVerified: boolean;
  referralCount: number;
  referralBonusDaily?: number;
  allowDm: boolean;
  lastSearchDate: string;
  dailyButtonUsage?: Record<string, number>;
}

export interface RedeemCode {
  code: string;
  days: number;
  role: string;
  usesLeft: number;
  totalUses: number;
  createdAt: string;
  usedBy?: string[];
}
