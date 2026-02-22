import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import cookieParser from 'cookie-parser';

dotenv.config();

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

const db = new Database('traffic_exchange.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    wallet_address TEXT,
    points REAL DEFAULT 0,
    earnings REAL DEFAULT 0,
    locked_earnings REAL DEFAULT 0,
    referral_code TEXT UNIQUE,
    referred_by INTEGER,
    fraud_flags INTEGER DEFAULT 0,
    last_earning_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(referred_by) REFERENCES users(id)
  );

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
    session_id TEXT,
    start_time DATETIME,
    is_valid INTEGER DEFAULT 1,
    fraud_reason TEXT,
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

  CREATE TABLE IF NOT EXISTS adsterra_revenue_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    revenue REAL,
    impressions INTEGER,
    cpm REAL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration helper: Add columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
const columns = tableInfo.map(c => c.name);

if (!columns.includes('referral_code')) {
  try {
    db.prepare('ALTER TABLE users ADD COLUMN referral_code TEXT UNIQUE').run();
    console.log('Migration: Added referral_code column to users table');
  } catch (e) { console.error('Migration error (referral_code):', e); }
}

if (!columns.includes('referred_by')) {
  try {
    db.prepare('ALTER TABLE users ADD COLUMN referred_by INTEGER').run();
    console.log('Migration: Added referred_by column to users table');
  } catch (e) { console.error('Migration error (referred_by):', e); }
}

if (!columns.includes('email')) {
  try {
    db.prepare('ALTER TABLE users ADD COLUMN email TEXT UNIQUE').run();
    console.log('Migration: Added email column to users table');
  } catch (e) { console.error('Migration error (email):', e); }
}

if (!columns.includes('password')) {
  try {
    db.prepare('ALTER TABLE users ADD COLUMN password TEXT').run();
    console.log('Migration: Added password column to users table');
  } catch (e) { console.error('Migration error (password):', e); }
}

if (!columns.includes('fraud_flags')) {
  try {
    db.prepare('ALTER TABLE users ADD COLUMN fraud_flags INTEGER DEFAULT 0').run();
  } catch (e) {}
}

const viewColumns = (db.prepare("PRAGMA table_info(views)").all() as any[]).map(c => c.name);
if (!viewColumns.includes('session_id')) {
  try {
    db.prepare('ALTER TABLE views ADD COLUMN session_id TEXT').run();
    db.prepare('ALTER TABLE views ADD COLUMN start_time DATETIME').run();
    db.prepare('ALTER TABLE views ADD COLUMN is_valid INTEGER DEFAULT 1').run();
    db.prepare('ALTER TABLE views ADD COLUMN fraud_reason TEXT').run();
  } catch (e) {}
}

// Helper: VPN/Proxy Detection (Basic)
function isProxy(req: express.Request): boolean {
  const proxyHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'via',
    'forwarded',
    'x-forwarded-proto',
    'proxy-connection'
  ];
  
  // Check for common proxy headers
  for (const header of proxyHeaders) {
    if (req.headers[header]) return true;
  }

  // Check for common VPN/Proxy user agents or patterns (simplified)
  const ua = req.headers['user-agent']?.toLowerCase() || '';
  if (ua.includes('proxy') || ua.includes('vpn') || ua.includes('tor')) return true;

  return false;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  
  // Request logging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.use(session({
    secret: process.env.SESSION_SECRET || 'traffic-exchange-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // API Routes
  app.post('/api/register', async (req, res) => {
    const { username, email, password, referralCode } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      let referredById = null;
      if (referralCode) {
        const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode) as any;
        if (referrer) {
          referredById = referrer.id;
        }
      }

      const result = db.prepare(`
        INSERT INTO users (username, email, password, referral_code, referred_by, points) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(username, email, hashedPassword, newReferralCode, referredById, referredById ? 50 : 0); // 50 bonus points if referred

      if (referredById) {
        // Award bonus to referrer too
        db.prepare('UPDATE users SET points = points + 50 WHERE id = ?').run(referredById);
      }

      const userId = Number(result.lastInsertRowid);
      req.session.userId = userId;
      
      const user = db.prepare('SELECT id, username, email, points, earnings, locked_earnings, referral_code FROM users WHERE id = ?').get(userId);
      res.json(user);
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Registration failed', details: err.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      req.session.userId = user.id;
      
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  app.get('/api/stats', (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const user = db.prepare('SELECT id, username, email, points, earnings, locked_earnings, referral_code FROM users WHERE id = ?').get(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (err) {
      console.error('Error in /api/stats:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/referrals', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    
    const userId = req.session.userId;
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
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = req.session.userId;
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
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId;

    if (!url || !pointsPerView) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const result = db.prepare('INSERT INTO sites (owner_id, url, points_per_view) VALUES (?, ?, ?)').run(userId, url, pointsPerView);
      res.json({ success: true, id: Number(result.lastInsertRowid) });
    } catch (err) {
      res.status(500).json({ error: 'Failed to add site' });
    }
  });

  app.post('/api/view-start', (req, res) => {
    const { siteId } = req.body;
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId;
    
    const sessionId = Math.random().toString(36).substring(7);
    const startTime = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO views (viewer_id, site_id, session_id, start_time, ip_address, user_agent, is_valid) 
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(userId, siteId, sessionId, startTime, req.ip, req.headers['user-agent']);
      
      res.json({ sessionId });
    } catch (err) {
      res.status(500).json({ error: 'Failed to start view session' });
    }
  });

  app.post('/api/view-complete', (req, res) => {
    const { siteId, sessionId } = req.body;
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId;

    const ip = req.ip;
    const ua = req.headers['user-agent'];

    // 1. VPN/Proxy Detection
    if (isProxy(req)) {
      db.prepare('UPDATE users SET fraud_flags = fraud_flags + 1 WHERE id = ?').run(userId);
      return res.status(403).json({ error: 'VPN/Proxy detected. Earning disabled.' });
    }

    // 2. Daily Earning Cap (100,000 points)
    const today = new Date().toISOString().split('T')[0];
    const dailyPoints = db.prepare('SELECT SUM(points_earned) as total FROM views WHERE viewer_id = ? AND viewed_at >= ?').get(userId, today) as any;
    if ((dailyPoints?.total || 0) >= 100000) {
      return res.status(400).json({ error: 'Daily earning cap reached' });
    }

    // 3. IP Cooldown (10 minutes)
    const recentIpView = db.prepare(`
      SELECT id FROM views 
      WHERE ip_address = ? 
      AND viewed_at > datetime('now', '-10 minutes') 
      AND is_valid = 1
    `).get(ip);
    if (recentIpView) {
      return res.status(400).json({ error: 'IP cooldown active (10 mins)' });
    }

    // 4. Session Validation & Duration (20 seconds)
    const viewSession = db.prepare('SELECT * FROM views WHERE session_id = ? AND viewer_id = ?').get(sessionId, userId) as any;
    if (!viewSession) {
      return res.status(400).json({ error: 'Invalid session' });
    }

    const startTime = new Date(viewSession.start_time).getTime();
    const now = Date.now();
    const durationSeconds = (now - startTime) / 1000;

    if (durationSeconds < 20) {
      db.prepare('UPDATE views SET fraud_reason = "Duration too short" WHERE session_id = ?').run(sessionId);
      return res.status(400).json({ error: 'View duration too short (min 20s)' });
    }

    // 5. Anti-Refresh / Duplicate Session Check
    if (viewSession.is_valid === 1) {
      return res.status(400).json({ error: 'Session already completed' });
    }

    try {
      const points = 1; 
      db.prepare(`
        UPDATE views 
        SET points_earned = ?, is_valid = 1, viewed_at = CURRENT_TIMESTAMP 
        WHERE session_id = ?
      `).run(points, sessionId);
      
      db.prepare('UPDATE users SET points = points + ?, last_earning_at = CURRENT_TIMESTAMP WHERE id = ?').run(points, userId);
      
      res.json({ success: true, points_earned: points });
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get('/api/adsterra/revenue', async (req, res) => {
    try {
      // Try to get the latest log from today
      const today = new Date().toISOString().split('T')[0];
      const latestLog = db.prepare(`
        SELECT * FROM adsterra_revenue_logs 
        WHERE date = ? 
        ORDER BY fetched_at DESC LIMIT 1
      `).get(today) as any;

      if (latestLog) {
        return res.json({
          daily_revenue: latestLog.revenue,
          impressions: latestLog.impressions,
          total_unpaid: latestLog.revenue, // Simplified
          cpm: latestLog.cpm,
          is_mock: false,
          last_updated: latestLog.fetched_at
        });
      }

      // Fallback if no log exists yet for today
      const apiKey = process.env.ADSTERRA_API_KEY;
      if (!apiKey || apiKey === 'MY_ADSTERRA_API_KEY' || apiKey.trim() === '') {
        return res.json({
          daily_revenue: 1.24,
          total_unpaid: 15.60,
          cpm: 0.45,
          is_mock: true,
          message: "No valid ADSTERRA_API_KEY found. Showing mock data."
        });
      }

      res.json({
        daily_revenue: 0,
        total_unpaid: 0,
        cpm: 0,
        is_mock: false,
        message: "Revenue data is being fetched. Please check back in a few minutes."
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch revenue stats' });
    }
  });

  // Background Job: Fetch Adsterra Revenue every hour
  async function updateAdsterraRevenue() {
    const apiKey = process.env.ADSTERRA_API_KEY;
    if (!apiKey || apiKey === 'MY_ADSTERRA_API_KEY' || apiKey.trim() === '') {
      console.log('Background Job: Skipping Adsterra fetch (No API Key)');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const url = `https://api.adsterra.com/v1/publisher/stats.json?api_key=${apiKey}&date_from=${today}&date_to=${today}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Adsterra API error: ${response.status}`);
      
      const data = await response.json();
      let dailyRevenue = 0;
      let impressions = 0;
      
      if (data && Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          dailyRevenue += parseFloat(item.revenue || 0);
          impressions += parseInt(item.impressions || 0);
        });
      }

      const cpm = impressions > 0 ? (dailyRevenue / impressions) * 1000 : 0;

      db.prepare(`
        INSERT INTO adsterra_revenue_logs (date, revenue, impressions, cpm)
        VALUES (?, ?, ?, ?)
      `).run(today, dailyRevenue, impressions, cpm);

      console.log(`Background Job: Successfully updated Adsterra revenue for ${today}`);
    } catch (err) {
      console.error('Background Job: Failed to fetch Adsterra revenue:', err);
    }
  }

  // Run immediately on start and then every hour
  updateAdsterraRevenue();
  setInterval(updateAdsterraRevenue, 60 * 60 * 1000);

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

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
