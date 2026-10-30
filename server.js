require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const passport = require('./config/passport');
const connectDB = require('./config/db');
const User = require('./models/User');
const { attachUser } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/error');
const { mailMode } = require('./utils/mailer');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.giphy.com', 'https://*.githubusercontent.com', 'https://github.com', 'https://img.shields.io', 'https://i.imgur.com', 'https://*.googleusercontent.com'],
    frameSrc: ['https://www.youtube-nocookie.com'], connectSrc: ["'self'"], upgradeInsecureRequests: null
  } }
}));
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0 }));

app.use('/api', (req, res, next) => { res.set('X-Robots-Tag', 'noindex'); next(); }, apiLimiter, attachUser);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// HTML pages: every page goes through sendPage so crawlers and link previews get real <title>, description, Open Graph tags etc.
const fs = require('fs');
const seo = require('./utils/seo');
const prod = process.env.NODE_ENV === 'production', cache = {};
const read = f => prod ? (cache[f] ??= fs.readFileSync(path.join(__dirname, 'views', f), 'utf8')) : fs.readFileSync(path.join(__dirname, 'views', f), 'utf8');
const legal = html => html.replace(/\{\{SITE_NAME\}\}/g, seo.site().name).replace(/\{\{SITE_URL\}\}/g, seo.site().base)
  .replace(/\{\{CONTACT_EMAIL\}\}/g, process.env.CONTACT_EMAIL || 'contact@' + new URL(seo.site().base).hostname).replace(/\{\{UPDATED\}\}/g, process.env.LEGAL_UPDATED || 'October 30, 2026')
  .replace(/\{\{JURISDICTION\}\}/g, process.env.LEGAL_JURISDICTION || 'the country in which the operator of this site is established');
const sendPage = (file, meta = async () => ({})) => async (req, res, next) => {
  try {
    const m = await meta(req); let html = read(file).replace(/<title>[\s\S]*?<\/title>/, seo.head(m));
    if (m.inject) html = m.inject(html);
    if (file === 'privacy.html' || file === 'terms.html') html = legal(html);
    if (m.noindex) res.set('X-Robots-Tag', 'noindex');
    res.status(m.status || 200).type('html').send(html);
  } catch (e) { next(e); }
};
app.get('/sitemap.xml', require('./middleware/error').wrap(seo.sitemap));
app.get('/robots.txt', seo.robots);
app.get('/', sendPage('index.html', seo.home));
app.get(['/login', '/register', '/forgot-password', '/reset-password', '/secure-account'], sendPage('auth.html', seo.noindex('Account')));
app.get('/create', sendPage('create.html', seo.noindex('Write a post')));
app.get('/post/:slug/edit', sendPage('create.html', seo.noindex('Edit post')));
app.get('/post/:slug', sendPage('post.html', seo.post));
app.get('/u/:username', sendPage('profile.html', seo.profile));
app.get('/settings', sendPage('settings.html', seo.noindex('Settings')));
app.get('/leaderboard', sendPage('leaderboard.html', seo.simple('Leaderboard', 'The top hackers and builders on HackQ, ranked by points from posts, comments and reactions.', '/leaderboard')));
app.get('/admin', sendPage('admin.html', seo.noindex('Admin')));
app.get('/privacy', sendPage('privacy.html', seo.simple('Privacy Policy', 'How HackQ collects, uses and protects your personal data.', '/privacy')));
app.get('/terms', sendPage('terms.html', seo.simple('Terms of Service', 'The rules for using HackQ: acceptable use, content, accounts and responsibilities.', '/terms')));
app.use(sendPage('404.html', seo.notFound));
app.use(errorHandler);

async function ensureAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME = 'admin' } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  const email = ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) { if (existing.role !== 'admin') { existing.role = 'admin'; existing.verified = true; existing.badge = 'blue'; await existing.save(); } return; }
  await User.create({ emailVerified: true, username: ADMIN_USERNAME, email, password: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'admin', verified: true, badge: 'blue', birthdate: new Date('1990-01-01'), points: 3000 });
  console.log(`Admin account created: ${email}`);
}

const PORT = process.env.PORT || 3000;
connectDB().then(ensureAdmin).then(() => app.listen(PORT, () => { console.log(`HackQ running on http://localhost:${PORT}`); console.log(`Mail: ${mailMode()}`); }))
  .catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
