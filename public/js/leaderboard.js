(async () => {
  await ready; const d = await api('/users/leaderboard');
  $('#lb').innerHTML = `<h1>Leaderboard</h1><div class="grid"><div class="card overflow"><table><tr><th class="c">#</th><th>Hacker</th><th class="c">Posts</th><th class="c">Comments</th><th class="r">Points</th></tr>
  ${d.users.map((u, i) => `<tr><td class="c"><span class="pos p${i + 1}">${i + 1}</span></td><td><div class="urow">${userLink(u)}</div></td><td class="c">${u.stats.posts}</td><td class="c">${u.stats.comments}</td><td class="r"><b class="pts">${u.points}</b></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No ranked hackers yet.</td></tr>'}</table></div>
  <aside><div class="card"><h3>How to earn points</h3><p class="small">Approved post <b>+5</b><br>Comment <b>+3</b> (first 10 per day)<br>Every 3 reactions you give <b>+1</b></p><p class="small muted">New members' posts are reviewed first. From 100 points (Rookie) your posts publish instantly.</p></div>
  <div class="card"><h3>Ranks</h3>${d.ranks.map(r => `<div class="meta" style="margin:.4rem 0">${rankChip(r.name)}<span class="muted small">${r.min}+ pts · ${r.dailyPosts} post${r.dailyPosts > 1 ? 's' : ''}/day</span></div>`).join('')}</div></aside></div>`;
})();
