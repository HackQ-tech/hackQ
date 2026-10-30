const Post = require('../models/Post');
const User = require('../models/User');
const { getRank } = require('./ranks');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const site = () => ({
  name: process.env.SITE_NAME || 'HackQ',
  base: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  desc: process.env.SITE_DESCRIPTION || 'HackQ is a community for hackers, developers and curious minds. Share CVEs, CTF events, projects, tutorials and security research, and climb the ranks.',
  twitter: process.env.TWITTER_HANDLE || ''
});
exports.site = site;

// markdown - plain text 
const plain = md => String(md || '').replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`([^`]*)`/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, ' ').replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '').replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, ' ').replace(/\[[ xX]\]/g, '').replace(/[*_~|]/g, '').replace(/\s+/g, ' ').trim();
const clip = (t, n) => t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
exports.plain = plain;

// Cloudinary: serve the social image already cropped to 1200x630
const ogImage = url => (/res\.cloudinary\.com\/.+\/image\/upload\//.test(url || '') ? url.replace('/image/upload/', '/image/upload/c_fill,w_1200,h_630,q_auto,f_jpg/') : url);
const abs = (u, base) => !u ? `${base}/img/og-default.png` : /^https?:\/\//.test(u) ? u : base + u;
const jsonLd = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

// Builds the whole <head> SEO block that replaces the page's title
exports.head = (m = {}) => {
  const s = site(), title = m.title || `${s.name} · Hack. Build. Share.`, desc = clip(m.description || s.desc, 200);
  const url = s.base + (m.path || '/'), img = abs(m.image, s.base), isDefaultImg = img.endsWith('/img/og-default.png');
  const robots = m.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1';
  const t = [
    `<title>${esc(title)}</title>`, `<meta name="description" content="${esc(desc)}">`, `<meta name="robots" content="${robots}">`, `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${esc(s.name)}">`, `<meta property="og:type" content="${m.type || 'website'}">`, `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`, `<meta property="og:url" content="${esc(url)}">`, `<meta property="og:image" content="${esc(img)}">`,
    ...(isDefaultImg ? ['<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">'] : []),
    `<meta property="og:image:alt" content="${esc(m.imageAlt || title)}">`, `<meta property="og:locale" content="en_US">`,
    `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${esc(title)}">`, `<meta name="twitter:description" content="${esc(desc)}">`, `<meta name="twitter:image" content="${esc(img)}">`,
    ...(s.twitter ? [`<meta name="twitter:site" content="@${esc(s.twitter.replace(/^@/, ''))}">`] : []),
    ...(m.published ? [`<meta property="article:published_time" content="${new Date(m.published).toISOString()}">`] : []),
    ...(m.modified ? [`<meta property="article:modified_time" content="${new Date(m.modified).toISOString()}">`] : []),
    ...(m.section ? [`<meta property="article:section" content="${esc(m.section)}">`] : []),
    ...(m.author ? [`<meta property="article:author" content="${esc(m.author)}">`] : []),
    ...(m.tags || []).map(x => `<meta property="article:tag" content="${esc(x)}">`),
    '<meta name="theme-color" content="#101114">',
    '<link rel="icon" href="/favicon.ico" sizes="any">', '<link rel="icon" href="/favicon.svg" type="image/svg+xml">', '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', '<link rel="manifest" href="/site.webmanifest">',
    ...(m.jsonld ? [jsonLd(m.jsonld)] : [])
  ];
  return t.join('\n');
};

const FILTER_TITLES = { discussion: 'Discussions', question: 'Questions', project: 'Projects', tutorial: 'Tutorials', cve: 'CVEs & Vulnerabilities', ctf: 'CTFs', event: 'Security & Tech Events' };
exports.home = async (req) => {
  const s = site(), q = req.query;
  if (q.q || q.tag || q.tab || q.page) return { title: `Search · ${s.name}`, noindex: true, path: '/' };           // filtered/search views: not indexed
  if (FILTER_TITLES[q.type]) return { title: `${FILTER_TITLES[q.type]} · ${s.name}`, description: `Browse the latest ${FILTER_TITLES[q.type].toLowerCase()} shared by the ${s.name} community.`, path: `/?type=${q.type}` };
  return { title: `${s.name} · Community for hackers, builders and the curious`, path: '/', jsonld: { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', name: s.name, url: s.base, description: s.desc, potentialAction: { '@type': 'SearchAction', target: `${s.base}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    { '@type': 'Organization', name: s.name, url: s.base, logo: `${s.base}/icon-512.png` }] } };
};
exports.simple = (title, description, path, extra = {}) => async () => ({ title: `${title} · ${site().name}`, description, path, ...extra });
exports.noindex = title => async () => ({ title: `${title} · ${site().name}`, noindex: true });
exports.notFound = async () => ({ title: `Page not found · ${site().name}`, noindex: true, status: 404 });

exports.post = async (req) => {
  const s = site(), post = await Post.findOne({ slug: req.params.slug }).populate('author', 'username').lean();
  if (!post) return { title: `Post not found · ${s.name}`, noindex: true, status: 404 };
  if (post.status !== 'approved') return { title: `Post · ${s.name}`, noindex: true, path: `/post/${post.slug}` };   // pending/rejected: never leak or index
  const body = plain(post.content);
  let lead = '';
  if (post.type === 'cve' && post.cve?.id) lead = `${post.cve.id} (${post.cve.severity}${post.cve.score != null ? ' ' + post.cve.score : ''})${post.cve.product ? ' · ' + post.cve.product : ''}. `;
  if (['ctf', 'event'].includes(post.type) && post.event?.date) lead = `${post.type === 'ctf' ? 'CTF' : 'Event'} on ${new Date(post.event.date).toUTCString().slice(5, 16)}${post.event.location ? ' · ' + post.event.location : ''}. `;
  const description = clip(lead + body, 200), url = `${s.base}/post/${post.slug}`, image = post.images?.[0]?.url ? ogImage(post.images[0].url) : null;
  const title = `${clip(post.title, 70)} · ${s.name}`;
  return {
    title, description, path: `/post/${post.slug}`, type: 'article', image, imageAlt: post.title, published: post.createdAt, modified: post.updatedAt, section: post.type, author: `${s.base}/u/${post.author?.username}`, tags: post.tags,
    jsonld: { '@context': 'https://schema.org', '@type': 'DiscussionForumPosting', headline: clip(post.title, 110), description, url, mainEntityOfPage: url, datePublished: post.createdAt, dateModified: post.updatedAt, image: image ? [abs(image, s.base)] : [`${s.base}/img/og-default.png`], keywords: post.tags.join(', '), commentCount: post.commentCount, author: { '@type': 'Person', name: post.author?.username, url: `${s.base}/u/${post.author?.username}` }, publisher: { '@type': 'Organization', name: s.name, logo: { '@type': 'ImageObject', url: `${s.base}/icon-512.png` } } },
    // Real content in the first HTML response (crawlers, link previews, slow connections). The page script replaces it.
    inject: html => html.replace('<div class="empty">Loading…</div>', `<article class="card"><h1>${esc(post.title)}</h1><p class="muted">by ${esc(post.author?.username)}</p><p>${esc(clip(body, 900))}</p></article>`)
  };
};

exports.profile = async (req) => {
  const s = site(), u = await User.findOne({ usernameLower: String(req.params.username).toLowerCase() }).lean();
  if (!u || u.banned) return { title: `User not found · ${s.name}`, noindex: true, status: 404 };
  const rank = getRank(u.points).name;
  let description = `${u.username} is a ${rank} on ${s.name} with ${u.points} points and ${u.stats?.posts || 0} posts.`;
  if (u.privacy?.bio && u.bio) description += ' ' + u.bio;
  const image = /^https:\/\//.test(u.avatar) ? ogImage(u.avatar) : null;                                  // preset SVG avatars can't be used as share images
  return { title: `${u.username} (${rank}) · ${s.name}`, description, path: `/u/${u.username}`, type: 'profile', image, noindex: !(u.stats?.posts > 0),   // thin profiles stay out of search
    jsonld: { '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: u.username, url: `${s.base}/u/${u.username}`, ...(image ? { image } : {}) } } };
};

//  sitemap.xml & robots.txt 
exports.sitemap = async (req, res) => {
  const s = site(), day = d => new Date(d).toISOString().slice(0, 10), urls = [];
  const add = (loc, lastmod, freq, prio) => urls.push(`<url><loc>${esc(s.base + loc)}</loc>${lastmod ? `<lastmod>${day(lastmod)}</lastmod>` : ''}<changefreq>${freq}</changefreq><priority>${prio}</priority></url>`);
  add('/', new Date(), 'hourly', '1.0');
  Object.keys(FILTER_TITLES).forEach(t => add(`/?type=${t}`, new Date(), 'daily', '0.7'));
  ['/leaderboard', '/privacy', '/terms'].forEach(p => add(p, null, 'monthly', '0.3'));
  (await Post.find({ status: 'approved' }).sort({ updatedAt: -1 }).limit(45000).select('slug updatedAt').lean()).forEach(p => add(`/post/${p.slug}`, p.updatedAt, 'weekly', '0.8'));
  (await User.find({ banned: false, 'stats.posts': { $gt: 0 } }).sort({ points: -1 }).limit(4000).select('username updatedAt').lean()).forEach(u => add(`/u/${u.username}`, u.updatedAt, 'weekly', '0.4'));
  res.set('Cache-Control', 'public, max-age=3600').type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
};
exports.robots = (req, res) => {
  const s = site();
  res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /settings
Disallow: /create
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /secure-account
Disallow: /post/*/edit
Disallow: /*?q=
Disallow: /*?tab=
Disallow: /*?tag=

Sitemap: ${s.base}/sitemap.xml
`);
};
