export type LookupType =
  | 'vehicle'
  | 'num2'
  | 'aadhar2info'
  | 'aadhar2family'
  | 'voter'
  | 'lpg'
  | 'upi2num'
  | 'gst2name'
  | 'gst2pan'
  | 'gst';

export interface LookupOption {
  id: LookupType;
  title: string;
  icon: string;
  placeholder: string;
  example: string;
  description: string;
  category: 'vehicles' | 'identity' | 'telecom' | 'business';
}

export interface SearchResult {
  success: boolean;
  type: LookupType;
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

export interface RedeemCode {
  code: string;
  days: number;
  role: string;
  usesLeft: number;
  totalUses: number;
  createdAt: string;
}
