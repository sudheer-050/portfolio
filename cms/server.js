const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { createPublishing } = require('./publishing');

const DATA_DIR = process.env.DATA_DIR || '/data';
const CONTENT_PATH = path.join(DATA_DIR, 'content.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SEED_CONTENT_PATH = path.join(__dirname, 'seed', 'content.json');
const PORT = process.env.PORT || 4000;
const PUBLISH_DIR = process.env.PUBLISH_DIR || '/published';
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
const publishing = createPublishing(DATA_DIR, PUBLISH_DIR, path.join(__dirname, 'templates'));
// The legacy file is retained as the recoverable migration baseline.
publishing.init(JSON.parse(fs.readFileSync(SEED_CONTENT_PATH, 'utf8')));

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
app.set('trust proxy', 1);
app.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  res.set('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
    const origin=req.get('origin');
    if(origin && !['https://sudheerkumargandiboyana.com','https://myhai.org',...(process.env.DEV_ORIGIN?[process.env.DEV_ORIGIN]:[])].includes(origin))return res.status(403).json({error:'Untrusted origin'});
    if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Cross-site writes are not allowed'});
  }
  next();
});
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
    res.json(publishing.publicContent());
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
  try {
    res.json(publishing.publish(req.body.content,req.body.expectedRevision));
  } catch (err) {
    res.status(err.status||400).json({ error: err.message });
  }
});
app.get('/api/draft',requireAdmin,(req,res)=>res.json(publishing.draft()));
app.post('/api/draft',requireAdmin,(req,res)=>{
  try{res.json(publishing.saveDraft(req.body.content,req.body.expectedRevision));}
  catch(err){res.status(err.status||400).json({error:err.message});}
});
app.get('/api/history',requireAdmin,(req,res)=>res.json(publishing.history()));
app.post('/api/restore',requireAdmin,(req,res)=>{
  try{res.json(publishing.restore(req.body.revision,req.body.expectedRevision));}
  catch(err){res.status(err.status||400).json({error:err.message});}
});
app.get('/api/publishing-status',requireAdmin,(req,res)=>{
  let github={state:'pending',message:'Waiting for GitHub synchronization'};
  let publicChecks=null;
  try{github=JSON.parse(fs.readFileSync(process.env.GITHUB_STATUS_PATH||'/github-status/status.json','utf8'));}catch{}
  try{publicChecks=JSON.parse(fs.readFileSync('/github-status/public-verification.json','utf8'));}catch{}
  res.json({revision:publishing.revision(),snapshots:{portfolio:'generated',hai:'generated'},github,publicChecks});
});
app.post('/api/releases/:id/refresh',requireAdmin,async(req,res)=>{
  const draft=publishing.draft(),project=draft.content.projects.find(p=>p.id===req.params.id);
  if(!project||project.sourceAvailability!=='public'||!/^https:\/\/github.com\/sudheer-050\/[A-Za-z0-9_.-]+\/?$/.test(project.sourceUrl||''))return res.status(400).json({error:'A public owned GitHub repository is required'});
  try{
    if(req.body.expectedRevision!==publishing.revision())return res.status(409).json({error:'Reload the changed revision first'});
    const repo=new URL(project.sourceUrl).pathname.replace(/\/$/,'');
    const response=await fetch('https://api.github.com/repos'+repo+'/releases?per_page=100',{headers:{'Accept':'application/vnd.github+json','User-Agent':'website-catalog'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('GitHub returned '+response.status+'; the saved releases were preserved');
    const rows=await response.json();
    project.releases=rows.filter(r=>!r.draft).map(r=>({version:r.tag_name,preview:r.prerelease,date:r.published_at,notes:(r.body||'').slice(0,19000),url:r.html_url,assets:r.assets.map(a=>({name:a.name,url:a.browser_download_url}))}));
    publishing.saveDraft(draft.content,req.body.expectedRevision);
    res.json({ok:true,content:draft.content,baseRevision:draft.baseRevision});
  }catch(err){res.status(400).json({error:err.message});}
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
      const name = crypto.randomBytes(8).toString('hex') + safeExt;
      cb(null, name);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/png','image/jpeg','image/webp','image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  },
});

app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: `https://sudheerkumargandiboyana.com/uploads/${req.file.filename}` });
});

// --- admin UI pages ---
app.get('/login', (req, res) => {
  if (isValidSession(req.cookies[COOKIE_NAME])) return res.redirect('admin');
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.use((err,req,res,next)=>res.status(400).json({error:err.message||'Invalid request'}));
app.listen(PORT, () => {
  console.log(`portfolio-cms listening on :${PORT}`);
});
