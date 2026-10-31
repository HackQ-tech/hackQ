(async () => {
  const me = await ready; if (!me) return goLogin();
  if (!['admin', 'moderator'].includes(me.role)) { $('#panel').innerHTML = '<div class="empty">Staff only.</div>'; return; }
  const isAdmin = me.role === 'admin';
  const tabs = [['stats', 'Overview'], ['pending', 'Pending posts'], ['comments', 'Comments'], ['rejected', 'Rejected'], ...(isAdmin ? [['bugs', 'Bugs'], ['users', 'Users']] : [])];
  let tab = location.hash === '#bugs' && isAdmin ? 'bugs' : 'stats', bugFilter = 'open';
  const draw = () => { $('#tabs').innerHTML = tabs.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join(''); show(); };
  $('#tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; draw(); } };
  const P = $('#panel');
  async function show() {
    try {
      if (tab === 'stats') { const s = await api('/admin/stats'); P.innerHTML = `<div class="stats">${Object.entries({ Users: s.users, 'Open bugs': s.bugsOpen, 'Live posts': s.posts, 'Awaiting review': s.pending, Comments: s.comments, Banned: s.banned, 'New users 24h': s.newUsers, 'New posts 24h': s.newPosts }).map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('')}</div>`; }
      else if (tab === 'pending' || tab === 'rejected') {
        const { posts } = await api('/admin/posts?status=' + tab);
        P.innerHTML = posts.map(p => `<div class="card" id="r-${p._id}">${postCard(p).replace('<article class="card post">', '<div>').replace('</article>', '</div>')}
          <p>${tab === 'pending' ? `<button class="btn sm" data-ap="${p._id}">Approve (+5 pts)</button> ` : ''}${tab === 'pending' ? `<button class="btn red sm" data-rj="${p._id}">Reject</button> ` : `<button class="btn sm" data-ap="${p._id}">Approve</button> `}<button class="btn ghost sm" data-dp="${p._id}">Delete</button></p></div>`).join('') || `<div class="empty">Nothing ${tab}.</div>`;
      } else if (tab === 'comments') {
        const { comments } = await api('/admin/comments');
        P.innerHTML = comments.map(c => `<div class="card"><div class="meta">${userLink(c.author)}<span class="muted">on <a href="/post/${esc(c.post?.slug)}#c-${c._id}">${esc(c.post?.title || 'deleted post')}</a> · ${ago(c.createdAt)}</span></div><div class="rich">${renderText(c.text || '')}</div>${c.gifUrl ? `<img class="gif" src="${esc(c.gifUrl)}" alt="">` : ''}<button class="link danger" data-dc="${c._id}">Delete comment</button></div>`).join('') || '<div class="empty">No comments.</div>';
      } else if (tab === 'bugs') { await showBugs();
      } else if (tab === 'users') {
        P.innerHTML = '<input id="uq" placeholder="Search username or email…" style="max-width:320px;margin-bottom:.8rem"><div class="card overflow" id="ut"></div>'; $('#uq').oninput = () => { clearTimeout(window._t); window._t = setTimeout(users, 300); }; users();
      }
    } catch (e) { toast(e.message, true); }
  }
  const bugCard = b => `<div class="card bug" data-id="${b._id}"><div class="meta">${bugChip(b)}${sevChip({ severity: b.severity })}<span class="chip">${esc(BUG_CATS[b.category] || b.category)}</span><b>${esc(b.title)}</b></div>
    <div class="meta" style="margin:.5rem 0">${userLink(b.reporter)}<span class="muted small">${esc(b.reporterEmail || '')}</span><span class="muted small">${esc(b.ref)} · ${ago(b.createdAt)}</span></div>
    <div class="rich">${renderText(b.description)}</div>${b.steps ? `<p class="small muted" style="margin:.7rem 0 .2rem">Steps</p><div class="rich small">${renderText(b.steps)}</div>` : ''}
    <p class="small muted" style="margin:.7rem 0">${b.pageUrl ? `Page: ${esc(b.pageUrl)} · ` : ''}${esc(b.device || '')}${b.viewport ? ' · ' + esc(b.viewport) : ''}</p>
    ${(b.images || []).length ? `<div class="keep">${b.images.map(i => `<a href="${esc(i.url)}" target="_blank" rel="noopener"><img src="${esc(i.url)}" alt="screenshot"></a>`).join('')}</div>` : ''}
    <textarea placeholder="Note to the reporter (optional, included in their email)" style="min-height:60px">${esc(b.adminNote || '')}</textarea>
    <p class="acts">${b.status !== 'in_progress' && !b.rewarded ? `<button class="btn ghost sm" data-bs="in_progress">In progress</button>` : ''}<button class="btn sm" data-bs="fixed" ${b.rewarded ? 'disabled' : ''}>${icon('check', 14)} Valid &amp; fixed (+1000)</button>${b.rewarded ? '' : `<button class="btn red sm" data-bs="invalid">Not a bug</button><button class="btn ghost sm" data-bs="duplicate">Duplicate</button>`}</p></div>`;
  async function showBugs() {
    const d = await api('/admin/bugs?status=' + (bugFilter === 'all' ? '' : bugFilter));
    const pills = [['open', 'Open'], ['in_progress', 'In progress'], ['fixed', 'Fixed'], ['invalid', 'Not a bug'], ['duplicate', 'Duplicate'], ['all', 'All']].map(([k, l]) => `<button class="pill ${bugFilter === k ? 'on' : ''}" data-bf="${k}">${l}${k !== 'all' ? ` <span class="muted">${d.counts[k] || 0}</span>` : ''}</button>`).join('');
    P.innerHTML = `<div class="types-bar">${pills}</div>` + (d.bugs.map(bugCard).join('') || '<div class="empty">No bug reports here.</div>');
  }
  async function users() {
    const { users } = await api('/admin/users?q=' + encodeURIComponent($('#uq').value));
    const sel = (field, opts, v) => `<select data-f="${field}">${opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    $('#ut').innerHTML = `<table><tr><th>User</th><th>Role</th><th>Badge</th><th>Verified</th><th>Points</th><th>Status</th></tr>${users.map(u => `<tr data-id="${u._id}"><td><a href="/u/${esc(u.username)}">${esc(u.username)}</a><br><span class="muted small">${esc(u.email)}</span></td>
      <td>${sel('role', ['user', 'moderator', 'admin'], u.role)}</td><td>${sel('badge', ['none', 'blue', 'gray', 'gold', 'red'], u.badge)}</td><td><input type="checkbox" data-f="verified" ${u.verified ? 'checked' : ''}></td>
      <td>${u.points} <button class="link" data-pts title="Adjust points" aria-label="Adjust points">${icon('edit', 13)}</button></td><td>${u.banned ? '<b class="danger">banned</b> ' : ''}<button class="btn ghost sm" data-ban="${u.banned ? 0 : 1}">${u.banned ? 'Unban' : 'Ban'}</button></td></tr>`).join('')}</table>`;
  }
  P.addEventListener('change', async e => {
    const tr = e.target.closest('tr[data-id]'), f = e.target.dataset.f; if (!tr || !f) return;
    try { await api('/admin/users/' + tr.dataset.id, { method: 'PATCH', body: { [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } }); toast('Updated'); users(); } catch (er) { toast(er.message, true); users(); }
  });
  P.addEventListener('click', async e => {
    const t = e.target, d = t.dataset;
    try {
      if (d.bf !== undefined) { bugFilter = d.bf; return showBugs(); }
      else if (d.bs) { const card = t.closest('.bug'); const r = await api('/admin/bugs/' + card.dataset.id, { method: 'PATCH', body: { status: d.bs, note: $('textarea', card).value } }); toast(r.rewarded ? 'Marked fixed. The reporter received 1000 points' : 'Updated'); return showBugs(); }
      else if (d.ap) await api(`/admin/posts/${d.ap}/approve`, { method: 'POST' });
      else if (d.rj) { const reason = prompt('Reason for rejection (shown to the author):') ; if (reason === null) return; await api(`/admin/posts/${d.rj}/reject`, { method: 'POST', body: { reason } }); }
      else if (d.dp) { if (!confirm('Delete this post permanently?')) return; await api('/posts/' + d.dp, { method: 'DELETE' }); }
      else if (d.dc) { if (!confirm('Delete this comment?')) return; await api('/comments/' + d.dc, { method: 'DELETE' }); }
      else if (d.ban !== undefined) { const id = t.closest('tr').dataset.id, ban = d.ban === '1'; const reason = ban ? prompt('Ban reason:') : ''; if (ban && reason === null) return; await api('/admin/users/' + id, { method: 'PATCH', body: { banned: ban, reason } }); return users(); }
      else if (d.pts !== undefined) { const n = prompt('Add or remove points (e.g. 50 or -20):'); if (!n) return; await api('/admin/users/' + t.closest('tr').dataset.id, { method: 'PATCH', body: { points: n } }); return users(); }
      else return;
      toast('Done'); show();
    } catch (er) { toast(er.message, true); }
  });
  draw();
})();
