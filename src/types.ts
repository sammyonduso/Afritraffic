export interface User {
  id: number;
  username: string;
  wallet_address: string;
  points: number;
  earnings: number;
  locked_earnings: number;
  created_at: string;
}

export interface Site {
  id: number;
  url: string;
  points_per_view: number;
}

export interface Campaign extends Site {
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
  status: 'Active' | 'Completed' | 'Paused';
  owner_name: string;
}

export interface Stats {
  daily_revenue: number;
  total_unpaid: number;
  cpm: number;
  impressions?: number;
  is_mock?: boolean;
}
