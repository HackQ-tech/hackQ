(async () => {
  const me = await ready, slug = location.pathname.split('/')[2];
  let p; try { p = (await api('/posts/by-slug/' + slug)).post; } catch (e) { $('#post').innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }
  document.title = p.title + ' · HackQ';
  const staff = me && ['admin', 'moderator'].includes(me.role), own = me && me._id === p.author._id, canEdit = own || staff;
  const banner = p.status === 'pending' ? `<div class="notice">${icon('clock', 16)}<span>Pending review. Only you and moderators can see this post until it is approved.</span></div>`
    : p.status === 'rejected' ? `<div class="notice">${icon('ban', 16)}<span>This post was rejected${p.rejectReason ? ': ' + esc(p.rejectReason) : ''}.</span></div>` : '';

  function details() {
    if (p.type === 'cve' && p.cve) { const c = p.cve; return `<div class="panel cve"><div><span>CVE ID</span><b><a href="https://nvd.nist.gov/vuln/detail/${esc(c.id)}" target="_blank" rel="noopener">${esc(c.id)}</a></b></div><div><span>Severity</span>${sevChip(c)}</div>${c.product ? `<div><span>Affected</span><b>${esc(c.product)}</b></div>` : ''}${c.reference ? `<div><span>Advisory</span><b><a href="${esc(c.reference)}" target="_blank" rel="noopener nofollow">Open link ${icon('external', 12)}</a></b></div>` : ''}</div>`; }
    if (['ctf', 'event'].includes(p.type) && p.event?.date) {
      const d = new Date(p.event.date), diff = d - Date.now(), days = Math.ceil(diff / 864e5);
      const when = diff < 0 ? 'Ended' : days <= 1 ? 'Starts within a day' : `Starts in ${days} days`;
      return `<div class="panel ev"><div><span>When</span><b>${fmtDate(d)}</b></div><div><span>Status</span><b>${when}</b></div><div><span>Where</span><b>${esc(p.event.location || 'Online')}</b></div>${p.event.link ? `<div><span>Event page</span><b><a href="${esc(p.event.link)}" target="_blank" rel="noopener nofollow">Open ${icon('external', 12)}</a></b></div>` : ''}</div>`;
    }
    return '';
  }
  $('#post').innerHTML = `<article class="card">${banner}<div class="meta">${typeChip(p.type)}${userLink(p.author)}<span class="muted">${ago(p.createdAt)}${p.edited ? ' · edited' : ''} · ${readMin(p.content.length)} min read</span></div>
  <h1 style="margin-top:.7rem">${esc(p.title)}</h1>${p.tags.length ? `<div class="tags">${tagChips(p.tags)}</div>` : ''}${details()}
  <div class="md">${renderMarkdown(p.content)}</div>
  ${p.youtubeId ? `<iframe class="video" src="https://www.youtube-nocookie.com/embed/${esc(p.youtubeId)}" title="Video" allowfullscreen loading="lazy"></iframe>` : ''}
  ${p.images.length ? `<div class="gallery">${p.images.map(i => `<a href="${esc(i.url)}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(i.url)}" alt=""></a>`).join('')}</div>` : ''}
  ${p.projectUrl ? `<p><a class="btn" href="${esc(p.projectUrl)}" target="_blank" rel="noopener nofollow">${icon('code', 15)} Open project</a></p>` : ''}
  <div class="foot" style="margin-top:1rem">${p.status === 'approved' ? reactBar('post', p._id, p.reactions, p.my) : ''}<span class="stat">${icon('eye', 15)} ${p.views}</span><button class="link" id="share">${icon('share', 15)} Share (${p.shares})</button>
  <button class="link ${p.bookmarked ? 'saved' : ''}" id="save">${icon('bookmark', 15)} <span>${p.bookmarked ? 'Saved' : 'Save'}</span></button>${canEdit ? `<a href="/post/${esc(p.slug)}/edit">${icon('edit', 15)} Edit</a><button class="link danger" id="del">${icon('trash', 15)} Delete</button>` : ''}</div></article>
  ${p.status === 'approved' ? '<section class="card" id="comments"><h2>Comments</h2><div id="root"></div><div id="clist"></div></section>' : ''}`;

  enhanceMd($('.md'));
  if (location.hash.startsWith('#user-content-')) $(CSS.escape ? '#' + CSS.escape(decodeURIComponent(location.hash.slice(1))) : location.hash)?.scrollIntoView();
  $('#share').onclick = async () => {
    const url = location.origin + '/post/' + p.slug;
    try { if (navigator.share) await navigator.share({ title: p.title, url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } api(`/posts/${p._id}/share`, { method: 'POST' }); } catch {}
  };
  $('#save').onclick = async () => { if (!me) return goLogin(); const d = await api(`/posts/${p._id}/bookmark`, { method: 'POST' }); $('#save').classList.toggle('saved', d.bookmarked); $('#save span').textContent = d.bookmarked ? 'Saved' : 'Save'; };
  $('#del')?.addEventListener('click', async () => { if (confirm('Delete this post and its comments?')) { await api('/posts/' + p._id, { method: 'DELETE' }); location.href = '/'; } });
  if (p.status !== 'approved') return;

  // ----- comments -----
  const form = parent => `<div class="cform" data-parent="${parent || ''}"><textarea maxlength="1500" placeholder="${parent ? 'Write a reply… (@ to mention)' : 'Add a comment… (@ to mention)'}"></textarea><div class="gifprev"></div>
    <div class="row"><button class="btn sm" data-send>${icon('send', 14)} ${parent ? 'Reply' : 'Comment'}</button><button type="button" class="btn ghost sm gifbtn" data-gif>${icon('gif', 16)} GIF</button></div><div class="gifpanel" hidden><input placeholder="Search GIFs (powered by GIPHY)"><div class="gifgrid"></div></div></div>`;
  const mount = html => { const w = document.createElement('div'); w.innerHTML = html; return w.firstElementChild; };
  if (me) { $('#root').innerHTML = form(); mentionable($('#root textarea')); } else $('#root').innerHTML = '<p class="muted"><a href="/login?next=' + encodeURIComponent(location.pathname) + '">Log in</a> to comment, react and reply.</p>';
  async function loadComments() {
    const { comments } = await api(`/posts/${p._id}/comments`);
    const kids = {}; comments.forEach(c => (kids[c.parent || 'root'] ||= []).push(c));
    const node = (c, reply) => `<div class="comment ${reply ? 'reply' : ''}" id="c-${c._id}"><div class="meta">${userLink(c.author)}<span class="muted">${ago(c.createdAt)}</span></div>
      ${c.text ? `<div class="rich">${renderText(c.text)}</div>` : ''}${c.gifUrl ? `<img class="gif" loading="lazy" src="${esc(c.gifUrl)}" alt="GIF">` : ''}
      <div class="foot">${reactBar('comment', c._id, c.reactions, c.my)}<button class="link" data-reply="${c._id}">${icon('reply', 14)} Reply</button>${me && (me._id === c.author._id || staff) ? `<button class="link danger" data-delc="${c._id}">${icon('trash', 14)} Delete</button>` : ''}</div>
      <div id="rb-${c._id}"></div>${(kids[c._id] || []).map(r => node(r, true)).join('')}</div>`;
    $('#clist').innerHTML = (kids.root || []).map(c => node(c)).join('') || '<p class="muted">No comments yet. Start the discussion.</p>';
    if (location.hash.startsWith('#c-')) $(location.hash)?.scrollIntoView();
  }
  await loadComments();

  let timer; const gifSearch = async panel => {
    try { const { gifs } = await api('/posts/giphy?q=' + encodeURIComponent($('input', panel).value));
      $('.gifgrid', panel).innerHTML = gifs.map(g => `<img src="${esc(g.preview)}" data-url="${esc(g.url)}" alt="gif">`).join('') || '<span class="muted">No GIFs found</span>'; } catch (e) { toast(e.message, true); }
  };
  document.addEventListener('input', e => { const pn = e.target.closest('.gifpanel'); if (pn) { clearTimeout(timer); timer = setTimeout(() => gifSearch(pn), 350); } });
  $('#comments').addEventListener('click', async e => {
    const t = e.target.closest('button,img') || e.target, cf = t.closest('.cform');
    try {
      if (t.dataset.gif !== undefined) { const pn = $('.gifpanel', cf); pn.hidden = !pn.hidden; if (!pn.hidden && !$('.gifgrid img', pn)) gifSearch(pn); }
      else if (t.closest('.gifgrid') && t.dataset.url) { cf.dataset.picked = t.dataset.url; $('.gifprev', cf).innerHTML = `<img class="gif" src="${esc(t.dataset.url)}" alt="">`; $('.gifpanel', cf).hidden = true; }
      else if (t.dataset.send !== undefined) {
        const text = $('textarea', cf).value;
        await api(`/posts/${p._id}/comments`, { method: 'POST', body: { text, gifUrl: cf.dataset.picked || '', parent: cf.dataset.parent || null } });
        if (cf.dataset.parent) cf.remove(); else { $('textarea', cf).value = ''; cf.dataset.picked = ''; $('.gifprev', cf).innerHTML = ''; }
        await loadComments(); toast('Posted');
      } else if (t.dataset.reply) { if (!me) return goLogin(); const box = $('#rb-' + t.dataset.reply); if (box.innerHTML) box.innerHTML = ''; else { box.innerHTML = form(t.dataset.reply); mentionable($('textarea', box)); $('textarea', box).focus(); } }
      else if (t.dataset.delc && confirm('Delete this comment?')) { await api('/comments/' + t.dataset.delc, { method: 'DELETE' }); await loadComments(); }
    } catch (er) { toast(er.message, true); }
  });
})();
