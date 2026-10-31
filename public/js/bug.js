(async () => {
  const me = await ready; if (!me) return goLogin();
  const SEVS = { low: 'Low: a minor annoyance', medium: 'Medium: gets in my way', high: 'High: a feature is broken', critical: 'Critical: unusable or unsafe' };
  let tab = 'new', mine = [], reward = 1000;
  let pre = new URLSearchParams(location.search).get('from') || '';
  try { const u = new URL(document.referrer); if (!pre && u.origin === location.origin && !u.pathname.startsWith('/report-bug')) pre = u.pathname + u.search; } catch {}

  const root = $('#bug');
  root.innerHTML = `<h1>Report a bug</h1><p class="muted">Found something broken or confusing? Tell us. Reports are private: only the HackQ admins see them.</p>
  <div class="reward"><span class="ri">${icon('trophy', 22)}</span><div><b>Earn ${reward.toLocaleString()} points</b><span>When your report is confirmed as a valid bug and fixed, ${reward.toLocaleString()} points are added to your profile. That is enough to jump ranks.</span></div></div>
  <div class="tabs" id="bt"></div><div id="bp"></div>`;
  const drawTabs = () => { $('#bt').innerHTML = `<button data-t="new" class="${tab === 'new' ? 'on' : ''}">${icon('bug', 15)} Report a bug</button><button data-t="mine" class="${tab === 'mine' ? 'on' : ''}">${icon('inbox', 15)} My reports${mine.length ? ` (${mine.length})` : ''}</button>`; };
  $('#bt').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; show(); } };

  function form() {
    $('#bp').innerHTML = `<form class="card" id="bf">
      <label for="b-title">What went wrong? (short title)</label><input id="b-title" name="title" required minlength="5" maxlength="120" placeholder="e.g. Cannot upload an image on the post page">
      <div class="row2"><div><label for="b-cat">Category</label><select id="b-cat" name="category">${Object.entries(BUG_CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div><label for="b-sev">How bad is it?</label><select id="b-sev" name="severity">${Object.entries(SEVS).map(([k, v]) => `<option value="${k}" ${k === 'medium' ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <div class="notice" id="secnote" hidden>${icon('shield', 16)}<span>Security issue? This report is private and goes only to the admins. Please do not post details publicly until it is fixed.</span></div>
      <label for="b-page">Where did it happen? (page or link, optional)</label><input id="b-page" name="pageUrl" value="${esc(pre)}" placeholder="/post/my-post">
      <label for="b-desc">Describe the problem</label><textarea id="b-desc" name="description" required minlength="10" maxlength="5000" placeholder="What did you expect, and what happened instead?"></textarea>
      <label for="b-steps">Steps to reproduce (optional but very helpful)</label><textarea id="b-steps" name="steps" maxlength="3000" style="min-height:90px" placeholder="1. Go to...&#10;2. Click...&#10;3. See the error"></textarea>
      <label>Screenshots (up to 3)</label><div id="bdz"></div>
      <p class="hint">We automatically include your browser, system and screen size to help us reproduce it.</p>
      <p><button class="btn" id="bgo">${icon('send', 15)} Send report</button></p></form>`;
    $('#b-cat').onchange = e => { $('#secnote').hidden = e.target.value !== 'security'; };
    const dz = dropzone($('#bdz'), { max: 3, paste: true });
    $('#bf').onsubmit = async e => {
      e.preventDefault(); const f = e.target, fd = new FormData();
      for (const k of ['title', 'category', 'severity', 'pageUrl', 'description', 'steps']) fd.append(k, f[k].value);
      fd.append('viewport', `${innerWidth}x${innerHeight} @${devicePixelRatio}x`); dz.files.forEach(x => fd.append('images', x));
      const b = $('#bgo'); b.disabled = true;
      try { const r = await api('/bugs', { method: 'POST', form: fd }); done(r.ref); }
      catch (er) { toast(er.message, true); b.disabled = false; }
    };
  }
  function done(ref) {
    $('#bp').innerHTML = `<div class="card center"><div class="badge-ic ok" style="margin:0 auto 1rem">${icon('checkcircle', 28)}</div><h2>Report sent. Thank you!</h2>
      <p class="muted">Your reference is <b class="ref">${esc(ref)}</b>. A confirmation is on its way to <b>${esc(me.email)}</b>.</p>
      <p class="muted">We will email you and notify you here when the status changes.</p>
      <p><button class="btn" id="again">Report another</button> <button class="btn ghost" id="seeall">View my reports</button></p></div>`;
    $('#again').onclick = () => { pre = ''; form(); }; $('#seeall').onclick = () => { tab = 'mine'; show(); };
    load();
  }
  async function load() { try { const d = await api('/bugs/mine'); mine = d.bugs; reward = d.reward; drawTabs(); } catch {} }
  function list() {
    $('#bp').innerHTML = mine.map(b => `<div class="card"><div class="meta">${bugChip(b)}${sevChip({ severity: b.severity })}<span class="chip">${esc(BUG_CATS[b.category] || b.category)}</span><span class="muted">${esc(b.ref)} · ${ago(b.createdAt)}</span></div>
      <h3 style="margin:.6rem 0 .3rem">${esc(b.title)}</h3><div class="rich muted">${esc(b.description.slice(0, 300))}${b.description.length > 300 ? '…' : ''}</div>
      ${b.adminNote ? `<div class="box"><span class="muted small">Note from the team</span><br>${esc(b.adminNote)}</div>` : ''}
      ${b.rewarded ? `<p class="ok">${icon('trophy', 15)} ${reward.toLocaleString()} points awarded. Thank you!</p>` : ''}</div>`).join('') || `<div class="empty">You have not reported any bugs yet.</div>`;
  }
  function show() { drawTabs(); tab === 'new' ? form() : list(); }
  await load(); show();
})();
