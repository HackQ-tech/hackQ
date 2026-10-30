(async () => {
  const me = await ready, name = decodeURIComponent(location.pathname.split('/')[2]);
  let u; try { u = (await api('/users/' + encodeURIComponent(name))).user; } catch (e) { $('#p').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  document.title = u.username + ' · HackQ';
  const followLabel = f => f ? `${icon('check', 14)} Following` : `${icon('userplus', 14)} Follow`;
  const r = u.rankInfo, row = (l, v) => v ? `<p class="small"><span class="muted">${l}:</span> ${v}</p>` : '';
  $('#p').innerHTML = `<div class="card prof"><img class="ava xl" src="${esc(u.avatar)}" alt=""><div style="flex:1;min-width:240px">
    <h1>${esc(u.username)} ${badges(u)}</h1><div class="meta">${rankChip(u.rank)}<b>${u.points} pts</b><span class="muted">joined ${new Date(u.createdAt).toLocaleDateString()}</span></div>
    <div class="bar" style="margin:.6rem 0 .2rem"><i style="width:${r.progress}%"></i></div><p class="small muted">${r.next ? `${r.next.min - u.points} pts to ${r.next.name}` : 'Max rank reached'}</p>
    ${u.bio ? `<p>${esc(u.bio)}</p>` : ''}${row('Role', esc(u.job))}${row('Portfolio', u.portfolio && `<a href="${esc(u.portfolio)}" target="_blank" rel="noopener nofollow">${esc(u.portfolio)}</a>`)}
    ${row('GitHub', u.github && `<a href="https://github.com/${esc(u.github)}" target="_blank" rel="noopener">@${esc(u.github)}</a>`)}${row('Birthday', u.birthdate && new Date(u.birthdate).toLocaleDateString())}
    ${u.interests?.length ? `<div class="tags">${tagChips(u.interests)}</div>` : ''}
    <p class="small"><b>${u.followers}</b> followers · <b>${u.following}</b> following · ${u.stats.posts} posts · ${u.stats.comments} comments</p>
    ${u.isOwner ? '<a class="btn ghost sm" href="/settings">Edit profile</a>' : `<button class="btn sm" id="fb">${followLabel(u.isFollowing)}</button>`}</div></div><h2>Posts</h2><div id="posts"></div>`;
  $('#fb')?.addEventListener('click', async () => { if (!me) return goLogin(); const d = await api(`/users/${encodeURIComponent(u.username)}/follow`, { method: 'POST' }); $('#fb').innerHTML = followLabel(d.isFollowing); });
  const { posts } = await api(`/users/${encodeURIComponent(u.username)}/posts`);
  $('#posts').innerHTML = posts.map(postCard).join('') || '<div class="empty">No posts yet.</div>';
})();
