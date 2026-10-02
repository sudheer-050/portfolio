const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || '/data';
const CONTENT_PATH = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SEED_CONTENT_PATH = path.join(__dirname, 'seed', 'content.json');
const PORT = process.env.PORT || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const COOKIE_NAME = 'cms_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

if (!ADMIN_PASSWORD_HASH) {
  console.error('FATAL: ADMIN_PASSWORD_HASH env var is not set. Refusing to start.');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(CONTENT_PATH)) {
  fs.copyFileSync(SEED_CONTENT_PATH, CONTENT_PATH);
  console.log('Seeded content.json into', CONTENT_PATH);
}

// --- in-memory session store (restart = everyone re-logs in; acceptable for single-admin use) ---
const sessions = new Map(); // token -> expiresAt
function issueSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}
function isValidSession(token) {
  if (!token) return false;
  const expires = sessions.get(token);
  if (!expires) return false;
  if (Date.now() > expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [token, expires] of sessions) {
    if (now > expires) sessions.delete(token);
  }
}, 60 * 60 * 1000).unref();

// --- simple login rate limiting per IP ---
const loginAttempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}
function recordFailedAttempt(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}
function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

const app = express();
app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

function requireAdmin(req, res, next) {
  if (isValidSession(req.cookies[COOKIE_NAME])) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.redirect('login');
}

// --- public, read-only ---
app.get('/api/content', (req, res) => {
  try {
    const raw = fs.readFileSync(CONTENT_PATH, 'utf8');
    res.type('application/json').send(raw);
  } catch (err) {
    res.status(500).json({ error: 'Could not read content' });
  }
});

// --- auth ---
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  const { password } = req.body || {};
  if (!password || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    recordFailedAttempt(ip);
    return res.status(401).json({ error: 'Incorrect password' });
  }
  clearAttempts(ip);
  const token = issueSession();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token) sessions.delete(token);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ authenticated: isValidSession(req.cookies[COOKIE_NAME]) });
});

// --- admin-only writes ---
app.post('/api/content', requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid content payload' });
  }
  try {
    fs.writeFileSync(CONTENT_PATH, JSON.stringify(body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not save content' });
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext) ? ext : '.png';
      const name = crypto.randomBytes(8).toString('hex') + safeExt;
      cb(null, name);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: `uploads/${req.file.filename}` });
});

// --- admin UI pages ---
app.get('/login', (req, res) => {
  if (isValidSession(req.cookies[COOKIE_NAME])) return res.redirect('admin');
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`portfolio-cms listening on :${PORT}`);
});
