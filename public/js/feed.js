(async () => {
  const me = await ready, qs = new URLSearchParams(location.search);
  let tab = qs.get('tab') || (me ? 'foryou' : 'latest'), type = TYPES[qs.get('type')] ? qs.get('type') : '', tag = qs.get('tag') || '', q = qs.get('q') || '', page = 1;
  if (!me) $('#hero').innerHTML = `<div class="hero"><h1>Hack. Build. Share.</h1><p class="muted">Exploits, CVEs, CTFs, tools and tutorials from people who break and build things. Join to post, comment and climb the ranks.</p><div class="btns"><a class="btn" href="/register">Join HackQ</a><a class="btn ghost" href="/?type=cve">Browse CVEs</a></div></div>`;

  const sync = () => { const p = new URLSearchParams(); if (tab) p.set('tab', tab); if (type) p.set('type', type); if (tag) p.set('tag', tag); if (q) p.set('q', q); history.replaceState(null, '', '/?' + p); };
  const drawTypes = () => $('#typebar').innerHTML = `<button class="pill ${!type ? 'on' : ''}" data-ty="">${icon('grid', 14)} All</button>` + Object.entries(TYPES).map(([k, T]) => `<button class="pill ${type === k ? 'on' : ''}" data-ty="${k}">${icon(T.icon, 14)} ${T.plural}</button>`).join('');
  const drawTabs = () => {
    const eventish = ['ctf', 'event'].includes(type);
    const all = [['foryou', 'For you', 'sparkles'], ['latest', 'Latest', 'clock'], ['trending', 'Trending', 'trending'], ['upcoming', 'Upcoming', 'calendar'], ['following', 'Following', 'users'], ['saved', 'Saved', 'bookmark']]
      .filter(([k]) => (me || ['latest', 'trending', 'upcoming'].includes(k)) && (k !== 'upcoming' || eventish));
    if (!all.some(([k]) => k === tab)) tab = me ? 'foryou' : 'latest';
    $('#tabs').innerHTML = all.map(([k, l, ic]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${icon(ic, 15)} ${l}</button>`).join('');
  };
  $('#typebar').onclick = e => { const b = e.target.closest('[data-ty]'); if (!b) return; type = b.dataset.ty; if (type && ['ctf', 'event'].includes(type)) tab = 'upcoming'; else if (tab === 'upcoming') tab = me ? 'foryou' : 'latest'; drawTypes(); drawTabs(); load(true); };
  $('#tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; drawTabs(); load(true); } };
  async function load(reset) {
    if (reset) { page = 1; $('#list').innerHTML = ''; sync(); }
    $('#filter').innerHTML = (tag || q) ? `<p class="muted">Showing ${tag ? '#' + esc(tag) : ''} ${q ? '“' + esc(q) + '”' : ''} · <a href="/">clear</a></p>` : '';
    try {
      const d = await api(`/posts?tab=${tab}&page=${page}&type=${type}&tag=${encodeURIComponent(tag)}&q=${encodeURIComponent(q)}`);
      const none = tab === 'following' ? 'Follow some people to fill this tab.' : tab === 'saved' ? 'No saved posts yet.' : type ? `No ${TYPES[type].plural.toLowerCase()} yet. <a href="${me ? '/create?type=' + type : '/register'}">Be the first to post one.</a>` : 'No posts here yet. Be the first!';
      $('#list').insertAdjacentHTML('beforeend', d.posts.map(postCard).join('') || (reset ? `<div class="empty">${none}</div>` : ''));
      $('#more').hidden = !d.hasMore;
    } catch (e) { toast(e.message, true); }
  }
  $('#more').onclick = () => { page++; load(); };
  drawTypes(); drawTabs(); load(true);

  // sidebar widgets
  api('/posts/widgets').then(({ events, cves }) => {
    const w = [];
    w.push(`<div class="card"><h3>${icon('calendar', 16)} Upcoming CTFs &amp; events</h3>${events.map(e => `<a class="wl" href="/post/${esc(e.slug)}">${esc(e.title)}<small>${typeChip(e.type)}<span>${fmtDate(e.event.date)}</span></small></a>`).join('') || '<p class="muted small">Nothing scheduled. <a href="/create?type=ctf">Announce one</a>.</p>'}</div>`);
    w.push(`<div class="card"><h3>${icon('shield', 16)} Latest CVEs</h3>${cves.map(c => `<a class="wl" href="/post/${esc(c.slug)}">${esc(c.title)}<small>${sevChip(c.cve)}<span>${esc(c.cve.id)}</span></small></a>`).join('') || '<p class="muted small">No CVEs yet. <a href="/create?type=cve">Share one</a>.</p>'}</div>`);
    $('#wgt').innerHTML = w.join('');
  }).catch(() => {});
  api('/posts/tags').then(d => $('#ttags').innerHTML = d.trending.map(t => `<a class="tag" href="/?tag=${esc(t.tag)}">#${esc(t.tag)} <span class="muted">${t.count}</span></a>`).join('') || '<span class="muted small">Nothing yet</span>');
  api('/users/leaderboard?limit=5').then(d => $('#top').innerHTML = d.users.map(u => `<div class="meta" style="margin:.4rem 0">${userLink(u)}<span class="muted">${u.points}</span></div>`).join('') || '<span class="muted small">No ranked users yet</span>');
})();
