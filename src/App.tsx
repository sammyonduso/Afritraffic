import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Globe, 
  Wallet, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Menu,
  X,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Stats, Site } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'exchange' | 'wallet' | 'admin'>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isViewing, setIsViewing] = useState(false);
  const [exchangeSubTab, setExchangeSubTab] = useState<'surf' | 'manage'>('surf');
  const [mySites, setMySites] = useState<(Site & { total_views: number })[]>([]);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSitePoints, setNewSitePoints] = useState(1);
  const [currentSite, setCurrentSite] = useState<Site | null>(null);
  const [countdown, setCountdown] = useState(0);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchStats();
    fetchMySites();
    // Mock user login
    setUser({
      id: 1,
      username: 'AfricanPioneer',
      wallet_address: 'T...',
      points: 1240,
      earnings: 52.30,
      locked_earnings: 15.45,
      created_at: '2026-01-10'
    });
  }, []);

  const fetchMySites = async () => {
    try {
      const res = await fetch('/api/my-sites');
      const data = await res.json();
      setMySites(data);
    } catch (err) {
      console.error('Failed to fetch my sites');
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newSiteUrl, pointsPerView: newSitePoints })
      });
      if (res.ok) {
        setNewSiteUrl('');
        setNewSitePoints(1);
        fetchMySites();
      }
    } catch (err) {
      console.error('Failed to add site');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/adsterra/revenue');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  const startExchange = () => {
    setIsViewing(true);
    setCurrentSite({
      id: Math.floor(Math.random() * 100),
      url: 'https://example.com',
      points_per_view: 1
    });
    setCountdown(15);
    
    viewTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(viewTimerRef.current!);
          completeView();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const completeView = async () => {
    try {
      const res = await fetch('/api/view-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: currentSite?.id, userId: user?.id, duration: 15 })
      });
      const data = await res.json();
      if (data.success) {
        setUser(prev => prev ? { ...prev, points: prev.points + data.points_earned } : null);
        // Continue to next site
        startExchange();
      }
    } catch (err) {
      setIsViewing(false);
    }
  };

  const stopExchange = () => {
    if (viewTimerRef.current) clearInterval(viewTimerRef.current);
    setIsViewing(false);
    setCurrentSite(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans flex">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen z-40"
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Zap size={24} />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight">AfriTraffic</span>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Globe size={20} />} 
            label="Traffic Exchange" 
            active={activeTab === 'exchange'} 
            onClick={() => setActiveTab('exchange')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Wallet size={20} />} 
            label="Wallet & Payouts" 
            active={activeTab === 'wallet'} 
            onClick={() => setActiveTab('wallet')}
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<ShieldCheck size={20} />} 
            label="Admin Panel" 
            active={activeTab === 'admin'} 
            onClick={() => setActiveTab('admin')}
            collapsed={!isSidebarOpen}
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-full p-2 hover:bg-gray-50 rounded-lg flex justify-center text-gray-400"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-bottom border-gray-200 px-8 flex items-center justify-between sticky top-0 z-30">
          <h2 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-emerald-700">{user?.points.toLocaleString()} Points</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{user?.username}</p>
                <p className="text-xs text-gray-500">Standard Member</p>
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded-full border-2 border-white shadow-sm overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    title="Available Balance" 
                    value={`$${user?.earnings.toFixed(2)}`} 
                    icon={<Wallet className="text-emerald-600" />}
                    trend="+12% from last week"
                  />
                  <StatCard 
                    title="Locked Earnings" 
                    value={`$${user?.locked_earnings.toFixed(2)}`} 
                    icon={<Clock className="text-amber-600" />}
                    subtitle="Unlocks in 15 days"
                  />
                  <StatCard 
                    title="Daily Ad Revenue" 
                    value={`$${stats?.daily_revenue.toFixed(2) || '0.00'}`} 
                    icon={<TrendingUp className="text-blue-600" />}
                    subtitle={stats?.is_mock ? "Using Mock Data (No API Key)" : `Based on ${stats?.impressions?.toLocaleString()} impressions`}
                    trend={stats?.is_mock ? undefined : "Live from Adsterra"}
                  />
                  <StatCard 
                    title="Total Points" 
                    value={user?.points.toLocaleString() || '0'} 
                    icon={<Zap className="text-purple-600" />}
                    subtitle="1000 pts = $1.00"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg">Recent Activity</h3>
                        <button className="text-emerald-600 text-sm font-semibold flex items-center gap-1">
                          View All <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                                <Globe size={20} />
                              </div>
                              <div>
                                <p className="font-semibold">Viewed Website</p>
                                <p className="text-xs text-gray-500">2 hours ago • +1.0 Points</p>
                              </div>
                            </div>
                            <span className="text-sm font-mono text-gray-400">#48291</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 rounded-2xl text-white shadow-xl shadow-emerald-100">
                      <h3 className="font-bold text-lg mb-2">Start Earning Now</h3>
                      <p className="text-emerald-50 text-sm mb-6">View websites and earn points that convert to real USDT earnings.</p>
                      <button 
                        onClick={() => setActiveTab('exchange')}
                        className="w-full py-3 bg-white text-emerald-700 rounded-xl font-bold shadow-lg hover:bg-emerald-50 transition-colors"
                      >
                        Launch Exchange
                      </button>
                    </section>

                    <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-lg mb-4">Payout Status</h3>
                      <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-sm">
                        <AlertCircle size={18} />
                        <span>Next payout available in 4 days</span>
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'exchange' && (
              <motion.div 
                key="exchange"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col space-y-6"
              >
                {!isViewing && (
                  <div className="flex gap-4 border-b border-gray-200 pb-4">
                    <button 
                      onClick={() => setExchangeSubTab('surf')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${exchangeSubTab === 'surf' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      Surfing
                    </button>
                    <button 
                      onClick={() => setExchangeSubTab('manage')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${exchangeSubTab === 'manage' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                      My Sites
                    </button>
                  </div>
                )}

                {exchangeSubTab === 'surf' ? (
                  !isViewing ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6">
                      <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600 mb-4">
                        <Zap size={40} />
                      </div>
                      <h2 className="text-3xl font-bold">Traffic Exchange</h2>
                      <p className="text-gray-500">
                        Earn points by viewing websites for 15 seconds each. 
                        Our anti-fraud system ensures quality traffic for all members.
                      </p>
                      <div className="grid grid-cols-2 gap-4 w-full">
                        <div className="p-4 bg-white border border-gray-200 rounded-2xl">
                          <p className="text-2xl font-bold">1.0</p>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Points / View</p>
                        </div>
                        <div className="p-4 bg-white border border-gray-200 rounded-2xl">
                          <p className="text-2xl font-bold">15s</p>
                          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Minimum Time</p>
                        </div>
                      </div>
                      <button 
                        onClick={startExchange}
                        className="px-12 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all transform hover:-translate-y-1"
                      >
                        Start Surfing
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xl">
                      <div className="h-14 bg-gray-900 text-white px-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-mono text-emerald-400">SURFING MODE</span>
                          <div className="h-4 w-px bg-gray-700" />
                          <span className="text-sm opacity-70 truncate max-w-[200px]">{currentSite?.url}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-emerald-400" />
                            <span className="font-mono text-lg">{countdown}s</span>
                          </div>
                          <button 
                            onClick={stopExchange}
                            className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors"
                          >
                            STOP
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 bg-gray-100 relative">
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6" />
                          <h3 className="text-xl font-bold mb-2">Loading Partner Website...</h3>
                          <p className="text-gray-500 max-w-md">
                            Please keep this tab active to earn points. 
                            Switching tabs will pause the timer.
                          </p>
                          <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm">
                            Adsterra Popunder Active
                          </div>
                        </div>
                        <iframe 
                          src={currentSite?.url} 
                          className="w-full h-full border-none opacity-0 pointer-events-none" 
                          title="Traffic Site"
                        />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="space-y-8">
                    <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-lg mb-6">Add New Website</h3>
                      <form onSubmit={handleAddSite} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Website URL</label>
                          <input 
                            type="url" 
                            required
                            placeholder="https://your-website.com"
                            value={newSiteUrl}
                            onChange={(e) => setNewSiteUrl(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Points per View</label>
                          <div className="flex gap-2">
                            <input 
                              type="number" 
                              min="1"
                              max="10"
                              required
                              value={newSitePoints}
                              onChange={(e) => setNewSitePoints(parseInt(e.target.value))}
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button 
                              type="submit"
                              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </form>
                    </section>

                    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold">My Websites</h3>
                      </div>
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase">
                          <tr>
                            <th className="px-6 py-4">URL</th>
                            <th className="px-6 py-4">Points/View</th>
                            <th className="px-6 py-4">Total Views</th>
                            <th className="px-6 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {mySites.map(site => (
                            <tr key={site.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <span className="text-sm font-medium truncate max-w-xs block">{site.url}</span>
                              </td>
                              <td className="px-6 py-4 text-sm">{site.points_per_view}</td>
                              <td className="px-6 py-4 text-sm font-mono">{site.total_views}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold uppercase">Active</span>
                              </td>
                            </tr>
                          ))}
                          {mySites.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">
                                No websites added yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </section>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'wallet' && (
              <motion.div 
                key="wallet"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-1 space-y-4">
                    <h3 className="text-gray-500 font-medium">Total Balance</h3>
                    <p className="text-5xl font-bold tracking-tight">${(user?.earnings || 0 + (user?.locked_earnings || 0)).toFixed(2)}</p>
                    <div className="flex gap-4">
                      <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                        AVAILABLE: ${user?.earnings.toFixed(2)}
                      </div>
                      <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold">
                        LOCKED: ${user?.locked_earnings.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-auto">
                    <button className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                      Withdraw USDT
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-6">Payout Settings</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">USDT TRC20 Address</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            defaultValue={user?.wallet_address}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button className="p-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">
                            Save
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        * Minimum withdrawal: $10.00. Processing time: 24-48 hours.
                      </p>
                    </div>
                  </section>

                  <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-lg mb-6">Earnings History</h3>
                    <div className="space-y-4">
                      {[1, 2].map(i => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-semibold">Points Conversion</p>
                            <p className="text-xs text-gray-400">Feb 20, 2026</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-600">+$5.00</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'admin' && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">Total Users</h4>
                    <p className="text-2xl font-bold">1,482</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">Pending Payouts</h4>
                    <p className="text-2xl font-bold text-amber-600">12 ($450.00)</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-1">Fraud Alerts</h4>
                    <p className="text-2xl font-bold text-red-600">3</p>
                  </div>
                </div>

                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold">User Management</h3>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Search users..." className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" />
                    </div>
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase">
                      <tr>
                        <th className="px-6 py-4">User</th>
                        <th className="px-6 py-4">Points</th>
                        <th className="px-6 py-4">Earnings</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[1, 2, 3, 4].map(i => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full" />
                              <span className="text-sm font-semibold">User_{i}00</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">{(i * 1200).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm">${(i * 12.5).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold uppercase">Active</span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="text-gray-400 hover:text-gray-600"><ExternalLink size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, collapsed: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl transition-all
        ${active 
          ? 'bg-emerald-50 text-emerald-700 font-semibold' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
      `}
    >
      <span className={`${active ? 'text-emerald-600' : 'text-gray-400'}`}>{icon}</span>
      {!collapsed && <span className="text-sm">{label}</span>}
      {active && !collapsed && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 bg-emerald-600 rounded-full" />}
    </button>
  );
}

function StatCard({ title, value, icon, trend, subtitle }: { title: string, value: string, icon: React.ReactNode, trend?: string, subtitle?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">
          {icon}
        </div>
        {trend && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{trend}</span>}
      </div>
      <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</h4>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
  );
}
