(async () => {
  const me = await ready; if (!me) return goLogin();
  const parts = location.pathname.split('/'), editing = parts[3] === 'edit', f = $('#f');
  const staff = ['admin', 'moderator'].includes(me.role);
  let type = null, post = null, remove = [];
  const { tags } = await api('/users/meta');
  $('#tags').innerHTML = tags.map(t => `<label><input type="checkbox" name="tags" value="${t}">#${t}</label>`).join('');
  $('#tags').onchange = e => { if ($$('#tags input:checked').length > 5) { e.target.checked = false; toast('Max 5 tags', true); } };
  mentionable($('#content'));
  const ta = $('#content'); $('#imp').innerHTML = icon('file', 15) + ' Import .md file';
  const count = () => { $('#cnt').textContent = ta.value.length.toLocaleString() + ' / 50,000'; }; ta.addEventListener('input', count);
  const loadMd = async file => {
    if (!file) return;
    if (file.size > 200 * 1024) return toast('That file is too large (max 200 KB)', true);
    const text = await file.text();
    if (text.length > 50000) return toast('README is longer than 50,000 characters', true);
    ta.value = text; count();
    const h1 = text.match(/^#\s+(.+)$/m); if (h1 && !$('#title').value) $('#title').value = h1[1].replace(/[*_`\[\]]/g, '').slice(0, 150);
    toast('Imported ' + file.name);
  };
  $('#imp').onclick = () => $('#mdfile').click(); $('#mdfile').onchange = e => { loadMd(e.target.files[0]); e.target.value = ''; };
  ta.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(i => i.kind === 'file' && !i.type.startsWith('image/'))) e.preventDefault(); });
  ta.addEventListener('drop', e => { const f = [...e.dataTransfer.files].find(x => /\.(md|markdown|txt)$/i.test(x.name)); if (f) { e.preventDefault(); e.stopPropagation(); loadMd(f); } });
  $$('.edtabs [data-m]').forEach(b => b.onclick = () => {
    const prev = b.dataset.m === 'p'; $$('.edtabs [data-m]').forEach(x => x.classList.toggle('on', x === b));
    ta.hidden = prev; $('#prev').hidden = !prev;
    if (prev) { $('#prev').innerHTML = ta.value.trim() ? renderMarkdown(ta.value) : '<p class="muted">Nothing to preview yet.</p>'; enhanceMd($('#prev')); }
  });
  const dz = dropzone($('#dz'), { max: 4, paste: true });

  const PH = { discussion: 'What do you want to talk about?', question: 'Ask a clear, specific question', project: 'Name your project', tutorial: 'What will people learn?', cve: 'Short summary of the vulnerability', ctf: 'Name of the CTF', event: 'Name of the event' };
  function setType(t) {
    type = t; const T = TYPES[t];
    $('#step1').hidden = true; f.hidden = false;
    $('#tchip').innerHTML = typeChip(t);
    $('#chg').hidden = editing;
    $('#h').textContent = editing ? 'Edit post' : 'New ' + T.label.toLowerCase();
    $('#title').placeholder = PH[t];
    $$('[data-for]').forEach(g => { const on = g.dataset.for.split(' ').includes(t); g.hidden = !on; $$('[data-req]', g).forEach(i => { i.required = on; }); });
    const note = !me.birthdate ? '<span class="danger">Add your birthdate in <a href="/settings">Settings</a> before posting.</span>'
      : (me.points < 100 && !staff) ? 'New members: a moderator reviews your post first. Once approved you earn +5 points, and followers are notified.' : 'Your rank lets you publish instantly. Your followers get a notification.';
    $('#rule').innerHTML = note;
    window.scrollTo({ top: 0 });
  }
  $('#types').innerHTML = Object.entries(TYPES).map(([k, T]) => `<button type="button" class="tcard" data-t="${k}">${icon(T.icon, 22)}<b>${T.label}</b><span>${T.desc}</span></button>`).join('');
  $('#types').onclick = e => { const b = e.target.closest('[data-t]'); if (b) setType(b.dataset.t); };
  $('#chg').onclick = () => { f.hidden = true; $('#step1').hidden = false; };
  const pre = new URLSearchParams(location.search).get('type'); if (TYPES[pre] && !editing) setType(pre);

  if (editing) {
    $('#step1').hidden = true; $('#go').textContent = 'Save changes';
    post = (await api('/posts/by-slug/' + parts[2])).post;
    setType(post.type);
    for (const k of ['title', 'content']) f[k].value = post[k] || '';
    count();
    f.projectUrl.value = post.projectUrl || ''; f.youtube.value = post.youtubeId ? 'https://youtu.be/' + post.youtubeId : '';
    if (post.cve) { f.cveId.value = post.cve.id; f.severity.value = post.cve.severity; f.cvss.value = post.cve.score ?? ''; f.product.value = post.cve.product || ''; f.reference.value = post.cve.reference || ''; }
    if (post.event) { f.eventDate.value = post.event.date ? new Date(new Date(post.event.date) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''; f.eventLink.value = post.event.link || ''; f.location.value = post.event.location || ''; }
    post.tags.forEach(t => { const c = $(`#tags input[value="${t}"]`); if (c) c.checked = true; });
    $('#old').innerHTML = post.images.map(i => `<label><img src="${esc(i.url)}" alt=""><input type="checkbox" value="${esc(i.publicId)}">remove</label>`).join('');
    const sync = () => { remove = $$('#old input:checked').map(i => i.value); dz.max = 4 - (post.images.length - remove.length); };
    $('#old').onchange = sync;
  }
  f.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(); fd.append('type', type);
    for (const k of ['title', 'content', 'youtube', 'projectUrl', 'cveId', 'severity', 'cvss', 'product', 'reference', 'eventDate', 'eventLink', 'location']) fd.append(k, f[k].value);
    $$('#tags input:checked').forEach(c => fd.append('tags', c.value));
    dz.files.forEach(x => fd.append('images', x));
    if (editing) fd.append('removeImages', JSON.stringify(remove));
    const b = $('#go'); b.disabled = true;
    try {
      const d = await api(editing ? '/posts/' + post._id : '/posts', { method: editing ? 'PUT' : 'POST', form: fd });
      toast(d.pending ? 'Submitted. A moderator will review it soon.' : 'Published');
      setTimeout(() => location.href = '/post/' + d.slug, 700);
    } catch (er) { toast(er.message, true); b.disabled = false; }
  };
})();
