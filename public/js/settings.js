(async () => {
  const me = await ready; if (!me) return goLogin();
  const meta = await api('/users/meta'), u = me, pv = u.privacy;
  const sw = (k, l) => `<div class="switch"><span>${l}</span><label style="margin:0"><input type="checkbox" data-pv="${k}" ${pv[k] ? 'checked' : ''}> public</label></div>`;
  $('#s').innerHTML = `${new URLSearchParams(location.search).get('complete') || !u.birthdate ? '<div class="box">Welcome! Add your birthdate below to finish setting up your account.</div>' : ''}
  <div class="card"><h2>Profile picture</h2><div class="avatars" id="av"><img class="ava xl" src="${esc(u.avatar)}" alt="current"></div>
    <label>Pick a preset</label><div class="avatars">${meta.presets.map(a => `<label><input type="radio" name="preset" value="${a}"><img src="/img/avatars/${a}.svg" alt="${a}"></label>`).join('')}</div>
    <label>…or upload your own (max 6 MB)</label><div id="avdz"></div></div>
  <form class="card" id="pf"><h2>Profile</h2><label>Bio (300 max)</label><textarea name="bio" maxlength="300" style="min-height:80px">${esc(u.bio)}</textarea>
    <label>Portfolio URL</label><input name="portfolio" value="${esc(u.portfolio)}" placeholder="https://"><label>GitHub username</label><input name="github" value="${esc(u.github)}">
    <label>Birthdate</label><input type="date" name="birthdate" value="${u.birthdate ? u.birthdate.slice(0, 10) : ''}">
    <label>What do you do?</label><select name="job"><option value="">—</option>${meta.jobs.map(j => `<option ${u.job === j ? 'selected' : ''}>${j}</option>`).join('')}</select>
    <label>Interests (they tune your feed)</label><div class="chips">${meta.tags.map(t => `<label><input type="checkbox" name="interests" value="${t}" ${u.interests.includes(t) ? 'checked' : ''}>#${t}</label>`).join('')}</div>
    <h3 style="margin-top:1.2rem">Privacy</h3>${sw('bio', 'Bio')}${sw('portfolio', 'Portfolio')}${sw('github', 'GitHub')}${sw('job', 'Role')}${sw('interests', 'Interests')}${sw('birthdate', 'Birthdate')}
    <h3 style="margin-top:1.2rem">Notifications</h3>
    <div class="switch"><span>When people I follow publish a post</span><label style="margin:0"><input type="checkbox" data-nf="posts" ${u.notify?.posts !== false ? 'checked' : ''}> on</label></div>
    <div class="switch"><span>When someone @mentions me</span><label style="margin:0"><input type="checkbox" data-nf="mentions" ${u.notify?.mentions !== false ? 'checked' : ''}> on</label></div>
    <p><button class="btn">Save settings</button></p></form>
  <form class="card" id="pw"><h2>${u.hasPassword ? 'Change' : 'Set'} password</h2>${u.hasPassword ? '<label>Current password</label><input type="password" name="current" autocomplete="current-password">' : ''}<label>New password (min 8)</label><input type="password" name="password" minlength="8" required autocomplete="new-password"><p><button class="btn">Update password</button></p></form>`;
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const privacy = {}; $$('[data-pv]').forEach(c => privacy[c.dataset.pv] = c.checked);
    const notify = {}; $$('[data-nf]').forEach(c => notify[c.dataset.nf] = c.checked);
    const body = { bio: f.bio.value, portfolio: f.portfolio.value, github: f.github.value, job: f.job.value, birthdate: f.birthdate.value || undefined, interests: $$('input[name=interests]:checked', f).map(c => c.value), privacy, notify };
    try { await api('/users/me', { method: 'PATCH', body }); toast('Settings saved'); } catch (er) { toast(er.message, true); }
  };
  $('#pw').onsubmit = async e => { e.preventDefault(); try { await api('/users/me/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Password updated'); e.target.reset(); } catch (er) { toast(er.message, true); } };
  $$('input[name=preset]').forEach(r => r.onchange = async () => { try { await api('/users/me', { method: 'PATCH', body: { avatarPreset: r.value } }); location.reload(); } catch (er) { toast(er.message, true); } });
  dropzone($('#avdz'), { max: 1, multiple: false, onChange: async files => {
    if (!files.length) return;
    const fd = new FormData(); fd.append('avatar', files[0]);
    try { await api('/users/me/avatar', { method: 'POST', form: fd }); location.reload(); } catch (er) { toast(er.message, true); }
  } });
})();
