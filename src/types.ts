export interface User {
  id: number;
  username: string;
  wallet_address: string;
  points: number;
  earnings: number;
  locked_earnings: number;
  referral_code?: string;
  referred_by?: number;
  created_at: string;
}

export interface ReferralData {
  count: number;
  list: { username: string; created_at: string }[];
  bonus_per_referral: number;
}

export interface Site {
  id: number;
  url: string;
  points_per_view: number;
}

export interface Stats {
  daily_revenue: number;
  total_unpaid: number;
  cpm: number;
  impressions?: number;
  is_mock?: boolean;
}
