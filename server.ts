import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const db = new Database('traffic_exchange.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    wallet_address TEXT,
    points REAL DEFAULT 0,
    earnings REAL DEFAULT 0,
    locked_earnings REAL DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(referred_by) REFERENCES users(id)
  );

  -- Migration: Add columns if they don't exist (for existing DB)
  -- SQLite doesn't support ADD COLUMN IF NOT EXISTS easily in one line, 
  -- but since this is an MVP we can just ensure the table is created correctly.
  -- For a real app, we'd use a migration script.

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER,
    url TEXT,
    points_per_view REAL DEFAULT 1,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    viewer_id INTEGER,
    site_id INTEGER,
    points_earned REAL,
    ip_address TEXT,
    user_agent TEXT,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(viewer_id) REFERENCES users(id),
    FOREIGN KEY(site_id) REFERENCES sites(id)
  );

  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    status TEXT DEFAULT 'pending',
    wallet_address TEXT,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/stats', (req, res) => {
    // Mock user for MVP (normally would use session/JWT)
    let user = db.prepare('SELECT * FROM users LIMIT 1').get();
    
    if (!user) {
      // Create a default demo user if none exists
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      db.prepare('INSERT INTO users (username, points, earnings, locked_earnings, referral_code) VALUES (?, ?, ?, ?, ?)').run(
        'AfricanPioneer', 1240, 52.30, 15.45, referralCode
      );
      user = db.prepare('SELECT * FROM users LIMIT 1').get();
    }
    
    res.json(user);
  });

  app.get('/api/referrals', (req, res) => {
    const userId = 1; // Mock user ID
    const referrals = db.prepare(`
      SELECT username, created_at 
      FROM users 
      WHERE referred_by = ?
    `).all(userId);
    
    res.json({
      count: referrals.length,
      list: referrals,
      bonus_per_referral: 50 // Points
    });
  });

  app.get('/api/my-sites', (req, res) => {
    const userId = 1; // Mock user ID
    const sites = db.prepare(`
      SELECT s.*, COUNT(v.id) as total_views 
      FROM sites s 
      LEFT JOIN views v ON s.id = v.site_id 
      WHERE s.owner_id = ? 
      GROUP BY s.id
    `).all(userId);
    res.json(sites);
  });

  app.post('/api/sites', (req, res) => {
    const { url, pointsPerView } = req.body;
    const userId = 1; // Mock user ID

    if (!url || !pointsPerView) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const result = db.prepare('INSERT INTO sites (owner_id, url, points_per_view) VALUES (?, ?, ?)').run(userId, url, pointsPerView);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add site' });
    }
  });

  app.post('/api/view-complete', (req, res) => {
    const { siteId, userId, duration } = req.body;
    const ip = req.ip;
    const ua = req.headers['user-agent'];

    // Anti-fraud: Basic check
    if (duration < 10) {
      return res.status(400).json({ error: 'View duration too short' });
    }

    // Check for duplicate views from same IP in last hour
    const recentView = db.prepare('SELECT id FROM views WHERE ip_address = ? AND site_id = ? AND viewed_at > datetime("now", "-1 hour")').get(ip, siteId);
    
    if (recentView) {
      return res.status(400).json({ error: 'Duplicate view detected' });
    }

    try {
      const points = 1; // Configurable
      db.prepare('INSERT INTO views (viewer_id, site_id, points_earned, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)').run(userId, siteId, points, ip, ua);
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(points, userId);
      
      res.json({ success: true, points_earned: points });
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get('/api/adsterra/revenue', async (req, res) => {
    const apiKey = process.env.ADSTERRA_API_KEY;
    
    if (!apiKey) {
      // Fallback to mock data if API key is missing
      return res.json({
        daily_revenue: 1.24,
        total_unpaid: 15.60,
        cpm: 0.45,
        is_mock: true
      });
    }

    try {
      // Fetch stats for today
      const today = new Date().toISOString().split('T')[0];
      const url = `https://api.adsterra.com/v1/publisher/stats.json?api_key=${apiKey}&date_from=${today}&date_to=${today}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Adsterra API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Adsterra returns an array of stats per day/placement
      // We'll aggregate them for the dashboard
      let dailyRevenue = 0;
      let impressions = 0;
      
      if (data && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          dailyRevenue += parseFloat(item.revenue || 0);
          impressions += parseInt(item.impressions || 0);
        });
      }

      res.json({
        daily_revenue: dailyRevenue,
        impressions: impressions,
        total_unpaid: dailyRevenue, // Simplified for MVP
        cpm: impressions > 0 ? (dailyRevenue / impressions) * 1000 : 0,
        is_mock: false
      });
    } catch (err) {
      console.error('Adsterra API Fetch Error:', err);
      res.status(500).json({ error: 'Failed to fetch Adsterra stats', details: (err as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
