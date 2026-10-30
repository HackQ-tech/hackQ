(async () => {
  const me = await ready, qs = new URLSearchParams(location.search), path = location.pathname;
  const next = qs.get('next') || '/', safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const token = qs.get('token') || '';
  if (me && !['/reset-password', '/secure-account'].includes(path)) return location.replace(safe);

  $$('[data-ic]').forEach(e => { e.innerHTML = icon(e.dataset.ic, +e.dataset.s || 16); });
  $$('.oauth').forEach(o => { o.innerHTML = `<a class="btn ghost" href="/api/auth/github">${icon('github', 17)} GitHub</a><a class="btn ghost" href="/api/auth/google">${icon('google', 17)} Google</a>`; });
  const showEye = b => { b.innerHTML = icon('eye', 16); };
  $$('[data-eye]').forEach(showEye);
  document.addEventListener('click', e => { const b = e.target.closest('[data-eye]'); if (!b) return; const i = $('input', b.parentElement), on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.innerHTML = icon(on ? 'eyeoff' : 'eye', 16); b.setAttribute('aria-label', on ? 'Hide password' : 'Show password'); });

  const views = $$('[data-view]');
  const show = v => { views.forEach(x => { x.hidden = x.dataset.view !== v; }); $$('.ferr').forEach(x => { x.textContent = ''; }); };
  const err = (id, m) => { const el = $('#e-' + id); el.textContent = m || ''; if (m) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } };
  const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = on ? 'Please wait…' : label; };
  const mask = m => m.replace(/^(.{2}).*(@.*)$/, '$1•••$2');

  // password strength
  function meter(inputId, barId, textId) {
    $(inputId).addEventListener('input', e => {
      const v = e.target.value; let s = 0;
      if (v.length >= 8) s++; if (v.length >= 12) s++; if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
      const lv = !v ? 0 : s <= 2 ? 1 : s === 3 ? 2 : s === 4 ? 3 : 4, names = ['', 'Weak', 'Fair', 'Good', 'Strong'];
      $(barId).dataset.lv = lv; $(barId + ' i').style.width = lv * 25 + '%'; if (textId && v) $(textId).textContent = 'Strength: ' + names[lv];
    });
  }
  meter('#r-pw', '#m-reg', '#m-reg-t'); meter('#n-pw', '#m-res', '#m-res-t');

  // ---------- login ----------
  $('#login').onsubmit = async e => {
    e.preventDefault(); const b = e.target.querySelector('.btn'); err('login'); busy(b, true, 'Log in');
    try { await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); location.href = safe; }
    catch (er) {
      busy(b, false, 'Log in');
      if (er.data?.needsVerify) { startVerify(er.data.email, er.data.expiresIn); toast('Verify your email to continue'); }
      else err('login', er.message);
    }
  };

  // ---------- register (2 steps + verify) ----------
  $('#avatars').innerHTML = AVATARS.map((a, i) => `<label><input type="radio" name="avatar" value="${a}" ${i === 0 ? 'checked' : ''}><img src="/img/avatars/${a}.svg" alt="${a}"><span class="tick">${icon('check', 12)}</span></label>`).join('');
  const maxBd = new Date(); maxBd.setFullYear(maxBd.getFullYear() - 13); $('#r-bd').max = maxBd.toISOString().slice(0, 10);
  let reg = {};
  $('#reg1').onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); err('reg1');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(d.username)) return err('reg1', 'Username: 3-20 letters, numbers or underscores');
    if (!/^\S+@\S+\.\S+$/.test(d.email)) return err('reg1', 'Enter a valid email address');
    if (d.password.length < 8) return err('reg1', 'Password must be at least 8 characters');
    reg = d; $('#reg1').hidden = true; $('#reg2').hidden = false; $$('.steps i')[1].classList.add('on'); $('#r-bd').focus();
  };
  $('#back1').onclick = () => { $('#reg2').hidden = true; $('#reg1').hidden = false; $$('.steps i')[1].classList.remove('on'); };
  $('#reg2').onsubmit = async e => {
    e.preventDefault(); const b = e.target.querySelector('button:not(.ghost)'); err('reg2'); busy(b, true, 'Create account');
    const d = Object.fromEntries(new FormData(e.target));
    try { const r = await api('/auth/register', { method: 'POST', body: { ...reg, ...d } }); startVerify(r.email, r.expiresIn); }
    catch (er) { busy(b, false, 'Create account'); err('reg2', er.message); if (/username|email/i.test(er.message)) { $('#reg2').hidden = true; $('#reg1').hidden = false; err('reg1', er.message); } }
  };

  // ---------- verify (6-box code, 30 min countdown, resend cooldown) ----------
  let vEmail = '', expTimer, coolTimer;
  const otp = $('#otp'); otp.innerHTML = Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Digit ${i + 1}">`).join('');
  const boxes = $$('input', otp), code = () => boxes.map(b => b.value).join('');
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); if (code().length === 6) $('#verify').requestSubmit(); });
    b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) { boxes[i - 1].focus(); boxes[i - 1].value = ''; } if (e.key === 'ArrowLeft' && boxes[i - 1]) boxes[i - 1].focus(); if (e.key === 'ArrowRight' && boxes[i + 1]) boxes[i + 1].focus(); });
    b.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); t.split('').forEach((c, k) => { boxes[k].value = c; }); (boxes[Math.min(t.length, 5)]).focus(); if (t.length === 6) $('#verify').requestSubmit(); });
  });
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function countdown(secs) {
    clearInterval(expTimer); let left = secs;
    const tick = () => { $('#v-timer').innerHTML = left > 0 ? `Code expires in <b>${fmt(left)}</b>` : '<span class="danger">Code expired. Request a new one.</span>'; if (left-- <= 0) clearInterval(expTimer); };
    tick(); expTimer = setInterval(tick, 1000);
  }
  function cooldown(secs) {
    clearInterval(coolTimer); const b = $('#resend'); let left = secs; b.disabled = true;
    const tick = () => { b.textContent = left > 0 ? `Resend code in ${left}s` : 'Resend code'; if (left <= 0) { b.disabled = false; clearInterval(coolTimer); } left--; };
    tick(); coolTimer = setInterval(tick, 1000);
  }
  function startVerify(email, expiresIn) {
    vEmail = email; $('#v-mail').textContent = mask(email); show('verify'); boxes.forEach(b => { b.value = ''; }); boxes[0].focus();
    countdown(expiresIn || 1800); cooldown(45);
  }
  $('#verify').onsubmit = async e => {
    e.preventDefault(); if (code().length < 6) return err('verify', 'Enter all 6 digits'); const b = $('#v-go'); err('verify'); busy(b, true, 'Verify email');
    try { await api('/auth/verify', { method: 'POST', body: { email: vEmail, code: code() } }); toast('Email verified. Welcome to HackQ!'); setTimeout(() => { location.href = safe; }, 600); }
    catch (er) { busy(b, false, 'Verify email'); err('verify', er.message); boxes.forEach(x => { x.value = ''; }); boxes[0].focus(); }
  };
  $('#resend').onclick = async () => {
    try { const r = await api('/auth/resend', { method: 'POST', body: { email: vEmail } }); toast('New code sent'); countdown(r.expiresIn || 1800); cooldown(60); err('verify'); }
    catch (er) { err('verify', er.message); }
  };

  // ---------- forgot / reset / secure ----------
  $('#forgot').onsubmit = async e => {
    e.preventDefault(); const b = e.target.querySelector('.btn'); err('forgot'); busy(b, true, 'Send reset link');
    try { const email = e.target.email.value; await api('/auth/forgot', { method: 'POST', body: { email } }); $('#s-mail').textContent = email; show('sent'); }
    catch (er) { err('forgot', er.message); } finally { busy(b, false, 'Send reset link'); }
  };
  $('#reset').onsubmit = async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); err('reset');
    if (d.password.length < 8) return err('reset', 'Password must be at least 8 characters');
    if (d.password !== d.confirm) return err('reset', 'Passwords do not match');
    const b = e.target.querySelector('.btn'); busy(b, true, 'Update password');
    try { await api('/auth/reset', { method: 'POST', body: { token, password: d.password } }); toast('Password updated. You are signed in.'); setTimeout(() => { location.href = '/'; }, 700); }
    catch (er) { busy(b, false, 'Update password'); err('reset', er.message); }
  };
  $('#secure-go').onclick = async e => {
    const b = e.currentTarget; busy(b, true, 'Lock account & reset password');
    try { const r = await api('/auth/secure', { method: 'POST', body: { token } }); location.href = '/reset-password?token=' + r.resetToken; }
    catch (er) { busy(b, false, 'Lock account & reset password'); err('secure', er.message); }
  };

  // ---------- which view? ----------
  const error = qs.get('error');
  if (error) toast(error === 'locked' ? 'This account is locked. Use "Forgot password" to recover it.' : error === 'banned' ? 'This account is banned' : error.includes('not_configured') ? 'That sign-in method is not set up yet' : 'Sign-in failed, try again', true);
  if (path === '/register') show('register');
  else if (path === '/forgot-password') show('forgot');
  else if (path === '/reset-password') show(token ? 'reset' : 'bad');
  else if (path === '/secure-account') show(token ? 'secure' : 'bad');
  else { show('login'); if (qs.get('next')) $('[data-view="login"] .muted').textContent = 'Log in or create an account to continue.'; }
})();
