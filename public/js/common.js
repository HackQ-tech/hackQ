const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REACTS = { like: { icon: 'thumb', label: 'Like' }, fire: { icon: 'flame', label: 'Fire' }, bulb: { icon: 'bulb', label: 'Insightful' }, skull: { icon: 'skull', label: 'Brutal' } };
const TYPES = {
  discussion: { label: 'Discussion', plural: 'Discussions', icon: 'message', desc: 'Start a conversation, share news or an opinion.' },
  question: { label: 'Question', plural: 'Questions', icon: 'help', desc: 'Stuck on something? Ask the community.' },
  project: { label: 'Project', plural: 'Projects', icon: 'code', desc: 'Show off a tool, exploit or app you built.' },
  tutorial: { label: 'Tutorial', plural: 'Tutorials', icon: 'play', desc: 'Teach a technique, with an optional video.' },
  cve: { label: 'CVE', plural: 'CVEs', icon: 'shield', desc: 'Share or discuss a published vulnerability.' },
  ctf: { label: 'CTF', plural: 'CTFs', icon: 'flag', desc: 'Announce a capture-the-flag or post a write-up.' },
  event: { label: 'Event', plural: 'Events', icon: 'calendar', desc: 'Meetups, conferences and workshops.' }
};
const NOTIF_ICON = { mention: 'at', comment: 'comment', reply: 'reply', reaction: 'thumb', follow: 'userplus', post: 'sparkles', system: 'bell', bug: 'bug' };
const AVATARS = ['default', 'neon', 'cyber', 'ghost', 'robot', 'skull', 'alien'];

function toast(msg, err) { const d = document.createElement('div'); if (err) d.className = 'err'; d.textContent = msg; $('#toast').append(d); setTimeout(() => d.remove(), 3500); }
function goLogin() { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); }
async function api(url, { method = 'GET', body, form } = {}) {
  const o = { method, headers: {}, credentials: 'same-origin' };
  if (form) o.body = form; else if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  const r = await fetch('/api' + url, o); let d = {}; try { d = await r.json(); } catch {}
  if (r.status === 401 && !url.startsWith('/auth/')) { goLogin(); throw new Error('Please log in to continue'); }
  if (!r.ok) { const e = new Error(d.error || 'Something went wrong'); e.data = d; e.status = r.status; throw e; }
  return d;
}
function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  for (const [n, u] of [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']]) if (s >= n) return Math.floor(s / n) + u + ' ago';
  return 'just now';
}
function renderText(t) {            // escape first, then add a tiny safe subset of formatting
  return esc(t).replace(/```([\s\S]*?)```/g, (m, c) => `<pre><code>${c.trim()}</code></pre>`)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/(^|[\s(])@([A-Za-z0-9_]{3,20})\b/g, (m, p, u) => `${p}<a class="mention" href="/u/${u}">@${u}</a>`)
    .replace(/(https?:\/\/[^\s<]+)/g, u => `<a href="${u}" target="_blank" rel="noopener nofollow ugc">${u}</a>`);
}

//  Markdown (GitHub-flavoured, sanitized) 
const IMG_HOST = /^(github\.com|[\w-]+\.githubusercontent\.com|img\.shields\.io|i\.imgur\.com|res\.cloudinary\.com|[\w-]+\.giphy\.com)$/;
const slugH = t => String(t).toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
function renderMarkdown(src, opts = {}) {
  const parse = (window.marked.marked || window.marked).parse;
  const dirty = parse(String(src), { gfm: true, breaks: false });
  const clean = DOMPurify.sanitize(dirty, { FORBID_TAGS: ['style', 'form', 'textarea', 'button', 'select', 'option', 'link', 'meta'], FORBID_ATTR: ['style'] });
  const tpl = document.createElement('template'); tpl.innerHTML = clean; const root = tpl.content;
  const used = {};
  if (!opts.preview) root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => { let id = slugH(h.textContent), n = used[id] = (used[id] ?? -1) + 1; h.id = 'user-content-' + id + (n ? '-' + n : ''); });
  root.querySelectorAll('a[href]').forEach(a => {
    const h = a.getAttribute('href');
    if (h.startsWith('#')) { try { a.setAttribute('href', '#user-content-' + slugH(decodeURIComponent(h.slice(1)))); } catch {} }
    else { a.target = '_blank'; a.rel = 'noopener nofollow ugc'; }
  });
  root.querySelectorAll('img').forEach(img => {
    let ok = false; try { const u = new URL(img.getAttribute('src') || ''); ok = u.protocol === 'https:' && IMG_HOST.test(u.hostname); } catch {}
    if (ok) { img.loading = 'lazy'; img.setAttribute('referrerpolicy', 'no-referrer'); }
    else { const s = document.createElement('span'); s.className = 'md-blocked'; s.textContent = `[image: ${img.alt || 'host not allowed'}]`; img.replaceWith(s); }
  });
  root.querySelectorAll('table').forEach(t => { const w = document.createElement('div'); w.className = 'tbl'; t.replaceWith(w); w.append(t); });
  const nodes = [], tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (tw.nextNode()) nodes.push(tw.currentNode);
  nodes.forEach(n => {          // @mentions inside normal text
    if (n.parentElement?.closest('a,code,pre') || !/(^|[\s(])@[A-Za-z0-9_]{3,20}\b/.test(n.nodeValue)) return;
    const sp = document.createElement('span');
    sp.innerHTML = esc(n.nodeValue).replace(/(^|[\s(])@([A-Za-z0-9_]{3,20})\b/g, (m, p, u) => `${p}<a class="mention" href="/u/${u}">@${u}</a>`);
    n.replaceWith(...sp.childNodes);
  });
  const out = document.createElement('div'); out.append(root); return out.innerHTML;
}
// call after inserting rendered markdown: syntax highlighting + copy buttons
function enhanceMd(el, opts = {}) {
  $$('pre > code', el).forEach(code => {
    const lang = (code.className.match(/language-([\w+-]+)/) || [])[1];
    if (lang && window.hljs?.getLanguage(lang)) window.hljs.highlightElement(code);
    const pre = code.parentElement; if (pre.parentElement.classList.contains('codewrap')) return;
    const w = document.createElement('div'); w.className = 'codewrap'; pre.replaceWith(w);
    w.innerHTML = opts.copy === false ? '' : `<button type="button" class="copy" data-copy aria-label="Copy code">${icon('copy', 14)}</button>`; w.append(pre);
    if (lang) w.insertAdjacentHTML('afterbegin', `<span class="lang">${esc(lang)}</span>`);
  });
}
function plainText(md) {       // for feed excerpts
  return String(md).replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`([^`]*)`/g, '$1').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ').replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '').replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, ' ').replace(/\[[ xX]\]/g, '').replace(/[*_~|]/g, '').replace(/\s+/g, ' ').trim();
}
const readMin = n => Math.max(1, Math.round(n / 1200));
const badges = u => {
  let h = '';
  const color = u.badge && u.badge !== 'none' ? u.badge : (u.verified ? 'blue' : '');
  if (color) h += `<span class="vb ${color}" title="Verified">${icon('check', 10)}</span>`;
  if (u.role === 'admin') h += '<span class="chip admin">ADMIN</span>'; else if (u.role === 'moderator') h += '<span class="chip mod">MOD</span>';
  return h;
};
const rankChip = r => `<span class="chip r-${esc(String(r).toLowerCase())}">${esc(r)}</span>`;
const userLink = u => `<a class="ulink" href="/u/${encodeURIComponent(u.username)}"><img class="ava" src="${esc(u.avatar)}" alt=""><b>${esc(u.username)}</b></a>${badges(u)} ${rankChip(u.rank)}`;
const tagChips = t => (t || []).map(x => `<a class="tag" href="/?tag=${esc(x)}">#${esc(x)}</a>`).join('');
function reactBar(kind, id, counts = {}, my = null) {
  return `<div class="reacts" data-kind="${kind}" data-id="${id}">` + Object.entries(REACTS).map(([k, r]) => `<button class="react ${my === k ? 'on' : ''}" data-react="${k}" title="${r.label}" aria-label="${r.label}">${icon(r.icon, 15)}<span>${counts[k] || 0}</span></button>`).join('') + '</div>';
}
const typeChip = t => { const T = TYPES[t] || TYPES.discussion; return `<span class="type t-${esc(t)}">${icon(T.icon, 13)} ${T.label}</span>`; };
const sevChip = c => `<span class="sev ${esc(c.severity)}">${icon('shield', 13)} ${esc(c.severity)}${c.score != null ? ' ' + esc(c.score) : ''}</span>`;
const fmtDate = d => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
function postFacts(p) {
  if (p.type === 'cve' && p.cve) return `<div class="facts">${sevChip(p.cve)}<span class="chip">${esc(p.cve.id)}</span>${p.cve.product ? `<span class="muted small">${esc(p.cve.product)}</span>` : ''}</div>`;
  if (['ctf', 'event'].includes(p.type) && p.event?.date) return `<div class="facts"><span class="when">${icon('calendar', 14)} ${fmtDate(p.event.date)}</span><span class="muted small">${icon('pin', 13)} ${esc(p.event.location || 'Online')}</span></div>`;
  if (p.type === 'project' && p.projectUrl) return `<div class="facts"><span class="muted small">${icon('link', 13)} ${esc(new URL(p.projectUrl).hostname)}</span>${p.youtubeId ? `<span class="muted small">${icon('play', 13)} demo video</span>` : ''}</div>`;
  if (p.type === 'tutorial' && p.youtubeId) return `<div class="facts"><span class="muted small">${icon('play', 13)} includes video</span></div>`;
  return '';
}
// feed card preview: the same Markdown renderer as the post page, clamped by CSS
function cardMd(p) {
  let t = p.content;
  if (p.length > t.length) { const i = t.lastIndexOf('\n'); if (i > t.length * .5) t = t.slice(0, i); if ((t.match(/```/g) || []).length % 2) t += '\n```'; }
  return (window.marked && window.DOMPurify) ? renderMarkdown(t, { preview: true }) : `<p>${esc(plainText(t).slice(0, 260))}</p>`;
}
const measureCard = el => { const clipped = el.dataset.trunc === '1' || el.scrollHeight > el.clientHeight + 6; el.classList.toggle('clipped', clipped); const m = el.nextElementSibling; if (m?.classList.contains('morewrap')) m.hidden = !clipped; };
function enhanceCards() {
  $$('.preview:not([data-done])').forEach(el => { el.dataset.done = 1; enhanceMd(el, { copy: false }); measureCard(el); el.addEventListener('load', () => measureCard(el), true); });
}
new MutationObserver(enhanceCards).observe(document.body, { childList: true, subtree: true });
function postCard(p) {
  const img = p.images?.[0] ? `<img class="thumb" loading="lazy" src="${esc(p.images[0].url)}" alt="">` : '';
  return `<article class="card post t-${esc(p.type)}"><div class="meta">${typeChip(p.type)}${userLink(p.author)}<span class="muted">${ago(p.createdAt)}</span>${p.status !== 'approved' ? `<span class="chip warn">${esc(p.status)}</span>` : ''}</div>
  <a class="title" href="/post/${esc(p.slug)}">${esc(p.title)}</a>${postFacts(p)}<div class="md preview" data-trunc="${p.length > p.content.length ? 1 : 0}">${cardMd(p)}</div><p class="morewrap" hidden><a class="more" href="/post/${esc(p.slug)}">Read more</a><span class="muted small">${readMin(p.length)} min read</span></p>${img}
  ${p.tags.length ? `<div class="tags">${tagChips(p.tags)}</div>` : ''}
  <div class="foot">${reactBar('post', p._id, p.reactions, p.my)}<a class="stat" href="/post/${esc(p.slug)}#comments">${icon('comment', 15)} ${p.commentCount}</a><span class="stat">${icon('eye', 15)} ${p.views}</span></div></article>`;
}

//  drag & drop image picker 
function dropzone(root, { max = 4, maxMB = 6, multiple = true, paste = false, onChange } = {}) {
  const st = { files: [], max };
  root.classList.add('dz');
  root.innerHTML = `<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" ${multiple ? 'multiple' : ''} hidden>
  <div class="dz-hint" tabindex="0" role="button">${icon('upload', 26)}<b>Drag &amp; drop ${multiple ? 'images' : 'an image'} here</b><span>or click to browse${paste ? ' · you can paste too' : ''} · PNG, JPG, GIF, WEBP up to ${maxMB} MB</span></div><div class="dz-prev"></div>`;
  const input = $('input', root), prev = $('.dz-prev', root), hint = $('.dz-hint', root);
  const draw = () => { prev.innerHTML = st.files.map((f, i) => `<div class="dz-item"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" data-i="${i}" aria-label="Remove image">${icon('x', 13)}</button></div>`).join(''); onChange && onChange(st.files); };
  st.add = list => {
    for (const f of list) {
      if (!/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) { toast('Only PNG, JPG, GIF or WEBP images', true); continue; }
      if (f.size > maxMB * 1048576) { toast(`${f.name} is larger than ${maxMB} MB`, true); continue; }
      if (!multiple) st.files = [f];
      else if (st.files.length >= st.max) { toast(`You can attach up to ${st.max} images`, true); break; }
      else st.files.push(f);
    }
    draw();
  };
  st.clear = () => { st.files = []; draw(); };
  hint.onclick = () => input.click();
  hint.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
  input.onchange = () => { st.add(input.files); input.value = ''; };
  ['dragenter', 'dragover'].forEach(ev => root.addEventListener(ev, e => { e.preventDefault(); root.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => root.addEventListener(ev, e => { e.preventDefault(); root.classList.remove('over'); }));
  root.addEventListener('drop', e => st.add(e.dataTransfer.files));
  prev.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { st.files.splice(+b.dataset.i, 1); draw(); } };
  if (paste) document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])]; if (f.length) st.add(f); });
  return st;
}

//  @mention autocomplete 
function mentionable(ta) {
  if (ta._m) return; ta._m = 1;
  const box = document.createElement('div'); box.className = 'mbox'; box.hidden = true;
  ta.parentNode.style.position = 'relative'; ta.after(box);
  let t;
  ta.addEventListener('input', () => {
    const m = /(?:^|[\s(])@([A-Za-z0-9_]{0,20})$/.exec(ta.value.slice(0, ta.selectionStart));
    clearTimeout(t); if (!m || !window.ME) { box.hidden = true; return; }
    t = setTimeout(async () => {
      try {
        const { users } = await api('/users/search?q=' + encodeURIComponent(m[1]));
        box.innerHTML = users.map(u => `<button type="button" data-u="${esc(u.username)}"><img class="ava" src="${esc(u.avatar)}" alt=""> ${esc(u.username)} ${rankChip(u.rank)}</button>`).join('');
        box.style.top = ta.offsetTop + ta.offsetHeight + 4 + 'px'; box.hidden = !users.length;
      } catch { box.hidden = true; }
    }, 200);
  });
  box.addEventListener('mousedown', e => {
    const b = e.target.closest('[data-u]'); if (!b) return; e.preventDefault();
    const pos = ta.selectionStart, before = ta.value.slice(0, pos).replace(/@[A-Za-z0-9_]*$/, '@' + b.dataset.u + ' ');
    ta.value = before + ta.value.slice(pos); ta.focus(); ta.selectionStart = ta.selectionEnd = before.length; box.hidden = true;
  });
  ta.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
}

//  nav 
const ready = (async () => {
  let d = { user: null, unread: 0 };
  try { d = await api('/auth/me'); } catch {}
  window.ME = d.user; renderNav(d); return d.user;
})();
const drawerHTML = (user, staff) => `<div class="scrim" id="scrim" hidden></div>
<aside class="drawer" id="mnav" aria-label="Menu" aria-hidden="true"><div class="dr-head"><a class="logo" href="/">Hack<span>Q</span><i>_</i></a><button class="x" data-close aria-label="Close menu">${icon('x', 20)}</button></div>
<form class="dr-search" id="dsf"><span class="si">${icon('search', 16)}</span><input type="search" name="q" placeholder="Search posts, CVEs, tools…" aria-label="Search"></form>
<nav class="dr-links"><a href="/">${icon('home', 18)} Home</a><a href="/leaderboard">${icon('trophy', 18)} Ranks</a>${user ? `<a href="/create">${icon('plus', 18)} New post</a><a href="/?tab=saved">${icon('bookmark', 18)} Saved posts</a>` : ''}
<p class="dr-h">Browse</p>${Object.entries(TYPES).map(([k, T]) => `<a href="/?type=${k}">${icon(T.icon, 18)} ${T.plural}</a>`).join('')}
<p class="dr-h">Account</p>${user ? `<a href="/u/${esc(user.username)}"><img class="ava" src="${esc(user.avatar)}" alt=""> ${esc(user.username)}</a><a href="/settings">${icon('settings', 18)} Settings</a>${staff ? `<a href="/admin">${icon('shield', 18)} Admin panel</a>` : ''}<button data-action="logout">${icon('logout', 18)} Log out</button>` : `<a href="/login">${icon('user', 18)} Log in</a><a href="/register">${icon('userplus', 18)} Sign up</a>`}
<p class="dr-h">More</p><a href="/report-bug">${icon('bug', 18)} Report a bug</a><a href="/privacy">${icon('file', 18)} Privacy</a><a href="/terms">${icon('file', 18)} Terms</a></nav></aside>`;
function renderNav({ user, unread }) {
  const nav = $('#nav'); if (!nav) return;
  const staff = user && ['admin', 'moderator'].includes(user.role);
  nav.innerHTML = `<header class="nav"><div class="in"><button class="burger" id="burger" aria-label="Open menu" aria-expanded="false">${icon('menu', 22)}</button><a class="logo" href="/">Hack<span>Q</span><i>_</i></a>
  <form id="sf"><span class="si">${icon('search', 16)}</span><input type="search" name="q" placeholder="Search posts, CVEs, tools…" aria-label="Search"></form>
  <div class="links"><a class="navl" href="/leaderboard">${icon('trophy', 16)}<span>Ranks</span></a>${user ? `<a class="btn sm" href="/create">${icon('plus', 15)} <span>Post</span></a>
  <button class="bell" id="bell" aria-label="Notifications">${icon('bell', 20)}${unread ? `<b>${unread}</b>` : ''}</button>
  <details class="menu"><summary><img class="ava" src="${esc(user.avatar)}" alt="Account menu"></summary><div class="dd"><a href="/u/${esc(user.username)}">${icon('user', 15)} My profile</a><a href="/?tab=saved">${icon('bookmark', 15)} Saved posts</a><a href="/settings">${icon('settings', 15)} Settings</a><a href="/report-bug">${icon('bug', 15)} Report a bug</a>${staff ? `<a href="/admin">${icon('shield', 15)} Admin panel</a>` : ''}<button data-action="logout">${icon('logout', 15)} Log out</button></div></details>`
      : '<a class="navl" href="/login">Log in</a><a class="btn sm" href="/register">Sign up</a>'}</div></div></header><div id="notif" hidden></div>${drawerHTML(user, staff)}`;
  $('#sf').onsubmit = e => { e.preventDefault(); location.href = '/?q=' + encodeURIComponent(e.target.q.value); };
}
document.addEventListener('click', async e => {
  const t = e.target;
  if (t.closest('#bell')) {
    const box = $('#notif'); box.hidden = !box.hidden; if (box.hidden) return;
    const { items } = await api('/users/me/notifications');
    box.innerHTML = items.length ? items.map(n => `<a class="${n.read ? '' : 'new'}" href="${esc(n.link || '#')}"><span class="ni">${icon(NOTIF_ICON[n.type] || 'bell', 16)}</span><span>${esc(n.text)}<br><span class="muted small">${ago(n.createdAt)}</span></span></a>`).join('') : '<div class="empty">No notifications yet. Mentions, replies and posts from people you follow show up here.</div>';
    api('/users/me/notifications/read', { method: 'POST' }); $('#bell b')?.remove(); return;
  }
  const cp = t.closest('[data-copy]');
  if (cp) { const code = cp.parentElement.querySelector('code'); try { await navigator.clipboard.writeText(code.textContent); cp.innerHTML = icon('check', 14); setTimeout(() => { cp.innerHTML = icon('copy', 14); }, 1500); } catch { toast('Could not copy', true); } return; }
  if (t.closest('[data-action="logout"]')) { await api('/auth/logout', { method: 'POST' }); location.href = '/'; return; }
  const rb = t.closest('[data-react]');
  if (rb) {
    const bar = rb.closest('.reacts');
    try { const d = await api(`/${bar.dataset.kind}s/${bar.dataset.id}/react`, { method: 'POST', body: { type: rb.dataset.react } }); bar.outerHTML = reactBar(bar.dataset.kind, bar.dataset.id, d.counts, d.my); }
    catch (err) { toast(err.message, true); }
  }
});
document.addEventListener('error', e => { const i = e.target; if (i.classList?.contains('ava') && !i.dataset.f) { i.dataset.f = 1; i.src = '/img/avatars/default.svg'; } }, true);

//  mobile: slide-in menu (left) and slide-out sidebar (right) 
const lockBody = () => document.body.classList.toggle('noscroll', !!($('#mnav.open') || $('.side.open')));
function setNav(on) { const d = $('#mnav'); if (!d) return; d.classList.toggle('open', on); d.setAttribute('aria-hidden', String(!on)); $('#burger')?.setAttribute('aria-expanded', String(on)); $('#scrim').hidden = !(on || $('.side.open')); lockBody(); }
function setSide(on) { const s = $('.side'); if (!s) return; s.classList.toggle('open', on); $('#scrim').hidden = !(on || $('#mnav.open')); lockBody(); }
function initSide() {
  const s = $('.side'); if (!s || s.dataset.init) return; s.dataset.init = 1;
  s.insertAdjacentHTML('afterbegin', `<div class="side-head"><b>Discover</b><button class="x" data-close-side aria-label="Close sidebar">${icon('x', 20)}</button></div>`);
  document.body.insertAdjacentHTML('beforeend', `<button class="fab" data-fab aria-label="Open sidebar">${icon('sidebar', 18)}<span>Discover</span></button>`);
}
ready.then(initSide);
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('#burger')) return setNav(true);
  if (t.closest('#mnav [data-close]') || t.closest('#mnav a')) return setNav(false);
  if (t.closest('#scrim')) { setNav(false); setSide(false); return; }
  if (t.closest('[data-fab]')) return setSide(true);
  if (t.closest('[data-close-side]') || t.closest('.side.open a')) return setSide(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { setNav(false); setSide(false); } });
document.addEventListener('submit', e => { if (e.target.id === 'dsf') { e.preventDefault(); location.href = '/?q=' + encodeURIComponent(e.target.q.value); } });
window.matchMedia('(min-width: 861px)').addEventListener('change', e => { if (e.matches) { setNav(false); setSide(false); } });

//  bug reports (shared by the report page and the admin panel) 
const BUG_CATS = { ui: 'Layout / UI', functionality: 'Something does not work', security: 'Security issue', performance: 'Slow / performance', content: 'Content / wording', other: 'Other' };
const BUG_ST = { open: ['Open', 'warn'], in_progress: ['In progress', 'info'], fixed: ['Fixed', 'ok'], invalid: ['Not a bug', 'bad'], duplicate: ['Duplicate', ''] };
const bugChip = b => { const [l, c] = BUG_ST[b.status] || ['?', '']; return `<span class="chip st ${c}">${l}${b.rewarded ? ' · +1000 pts' : ''}</span>`; };
