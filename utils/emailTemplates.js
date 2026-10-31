const BASE = () => (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = t => `<p style="margin:0 0 14px;line-height:1.65;color:#c9c7bf;font-size:15px">${t}</p>`;
const btn = (href, label, color = '#ffb454', fg = '#1a1200') => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td style="background:${color};border-radius:6px"><a href="${href}" style="display:inline-block;padding:12px 22px;font:600 15px 'Courier New',monospace;color:${fg};text-decoration:none">${label}</a></td></tr></table>`;
const fine = t => `<p style="margin:14px 0 0;line-height:1.6;color:#8d909b;font-size:13px">${t}</p>`;

function layout({ preheader, title, body }) {
  return `<!doctype html><html><body style="margin:0;background:#101114;font-family:Helvetica,Arial,sans-serif;color:#e8e6df">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#101114"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%">
<tr><td style="padding:0 0 16px;font:600 26px 'Courier New',monospace;color:#e8e6df">Hack<span style="color:#ffb454">Q_</span></td></tr>
<tr><td style="background:#17181d;border:1px solid #2b2e37;border-left:3px solid #ffb454;border-radius:8px;padding:28px">
<h1 style="margin:0 0 16px;font:600 21px 'Courier New',monospace;color:#e8e6df;line-height:1.3">${title}</h1>${body}</td></tr>
<tr><td style="padding:18px 4px;color:#8d909b;font-size:12px;line-height:1.6">You are receiving this because of activity on your HackQ account.<br>HackQ will never ask for your password by email.</td></tr>
</table></td></tr></table></body></html>`;
}

exports.verify = (user, code) => ({
  subject: `${code} is your HackQ verification code`,
  html: layout({ preheader: `Your code is ${code}. It expires in 30 minutes.`, title: 'Verify your email', body:
    P(`Hey <b style="color:#e8e6df">${esc(user.username)}</b>, welcome aboard. Enter this code to finish creating your account:`) +
    `<div style="margin:20px 0;padding:18px;background:#0b0c0e;border:1px dashed #4a3a1f;border-radius:6px;text-align:center;font:700 34px 'Courier New',monospace;letter-spacing:10px;color:#ffb454">${code}</div>` +
    P('This code expires in <b style="color:#e8e6df">30 minutes</b>. If you did not sign up, you can safely ignore this email.') }),
  text: `Your HackQ verification code is ${code}. It expires in 30 minutes. If you did not sign up, ignore this email.`
});

exports.welcome = (user) => ({
  subject: 'Welcome to HackQ',
  html: layout({ preheader: 'Your account is ready. Here is how to get started.', title: `Welcome, ${esc(user.username)}`, body:
    P('Your account is verified and ready. HackQ is a home for hackers, builders and the curious: CVEs, CTFs, projects, tutorials and good questions.') +
    P('<b style="color:#e8e6df">Get started</b><br>1. Finish your profile and pick your interests so your feed fits you.<br>2. Write your first post. New members are reviewed once, then you earn <b style="color:#ffb454">+5 points</b>.<br>3. Comment, react and follow people. Reach <b style="color:#ffb454">100 points</b> to become a Rookie and publish instantly.') +
    btn(BASE(), 'Open HackQ') + fine('Please use what you learn here responsibly and legally.') }),
  text: `Welcome to HackQ, ${user.username}! Your account is verified. Finish your profile, write your first post and start earning points: ${BASE()}`
});

const when = m => `${new Date(m.at).toUTCString()}`;
exports.passwordChanged = (user, secureUrl, m, kind = 'changed') => ({
  subject: `Your HackQ password was ${kind}`,
  html: layout({ preheader: `Your password was ${kind}. If this wasn't you, secure your account now.`, title: `Your password was ${kind}`, body:
    P(`Hi <b style="color:#e8e6df">${esc(user.username)}</b>, the password on your HackQ account was just ${kind}.`) +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;font-size:13px;color:#c9c7bf"><tr><td style="padding:2px 14px 2px 0;color:#8d909b">When</td><td>${esc(when(m))}</td></tr><tr><td style="padding:2px 14px 2px 0;color:#8d909b">Device</td><td>${esc(m.device)}</td></tr><tr><td style="padding:2px 14px 2px 0;color:#8d909b">IP address</td><td>${esc(m.ip)}</td></tr></table>` +
    P('<b style="color:#e8e6df">Was this you?</b> Then there is nothing to do.') +
    P('<b style="color:#ff8f8f">Not you?</b> Use the button below. We will immediately sign out every device, lock the account, and let you set a new password.') +
    btn(secureUrl, 'Secure my account', '#ff6b6b', '#1a0000') + fine('This link works for 48 hours. If the button does not work, copy this address into your browser:<br>' + esc(secureUrl)) }),
  text: `Your HackQ password was ${kind} (${when(m)}, ${m.device}, IP ${m.ip}). If this was NOT you, secure your account (valid 48h): ${secureUrl}`
});

exports.reset = (user, url) => ({
  subject: 'Reset your HackQ password',
  html: layout({ preheader: 'Use this link within 30 minutes to choose a new password.', title: 'Reset your password', body:
    P(`Hi <b style="color:#e8e6df">${esc(user.username)}</b>, we received a request to reset your password. Click below to choose a new one.`) +
    btn(url, 'Choose a new password') + fine('This link expires in <b>30 minutes</b> and can be used once. If you did not ask for this, ignore this email, your password stays the same.<br><br>' + esc(url)) }),
  text: `Reset your HackQ password (valid 30 minutes): ${url}\nIf you did not request this, ignore this email.`
});

const SEV = { low: '#7bd88f', medium: '#ffd166', high: '#ff9f43', critical: '#ff6b6b' };
const row = (k, v) => v ? `<tr><td style="padding:3px 14px 3px 0;color:#8d909b;vertical-align:top;white-space:nowrap">${k}</td><td style="color:#e8e6df">${v}</td></tr>` : '';
const box = t => `<div style="margin:6px 0 14px;padding:12px 14px;background:#0b0c0e;border:1px solid #2b2e37;border-radius:6px;color:#c9c7bf;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(t)}</div>`;

exports.bugAdmin = (bug, user) => ({
  subject: `[Bug ${bug.severity.toUpperCase()}] ${bug.title}`,
  html: layout({ preheader: `${user.username} reported: ${bug.title}`, title: 'New bug report', body:
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;font-size:14px">${row('Reference', `<b>${esc(bug.ref)}</b>`)}${row('Title', esc(bug.title))}${row('Severity', `<b style="color:${SEV[bug.severity]}">${esc(bug.severity)}</b>`)}${row('Category', esc(bug.category))}${row('Reporter', `${esc(user.username)} &lt;${esc(user.email)}&gt;`)}${row('Page', bug.pageUrl ? esc(bug.pageUrl) : '')}${row('Device', esc(bug.device))}${row('Screen', esc(bug.viewport))}</table>` +
    `<p style="margin:0 0 4px;color:#8d909b;font-size:13px">Description</p>${box(bug.description)}` + (bug.steps ? `<p style="margin:0 0 4px;color:#8d909b;font-size:13px">Steps to reproduce</p>${box(bug.steps)}` : '') +
    (bug.images?.length ? P('Screenshots:<br>' + bug.images.map(i => `<a href="${esc(i.url)}" style="color:#6cc4ff">${esc(i.url)}</a>`).join('<br>')) : '') +
    btn(`${BASE()}/admin#bugs`, 'Review in admin panel') + fine('Reply to this email to write to the reporter directly. Marking the bug "Fixed &amp; valid" in the admin panel pays them 1000 points.') }),
  text: `New bug report ${bug.ref} (${bug.severity}/${bug.category}) from ${user.username} <${user.email}>\n${bug.title}\n\n${bug.description}\n\nSteps: ${bug.steps || '-'}\nPage: ${bug.pageUrl || '-'}\nDevice: ${bug.device}\n\nReview: ${BASE()}/admin#bugs`
});

exports.bugReceipt = (bug, user) => ({
  subject: `We got your bug report (${bug.ref})`,
  html: layout({ preheader: `Thanks for reporting "${bug.title}".`, title: 'Thanks for the report', body:
    P(`Hi <b style="color:#e8e6df">${esc(user.username)}</b>, we received your bug report and the team will look at it.`) +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;font-size:14px">${row('Reference', `<b>${esc(bug.ref)}</b>`)}${row('Title', esc(bug.title))}${row('Severity', esc(bug.severity))}</table>` +
    P('<b style="color:#ffb454">Bug bounty:</b> if your report is confirmed as a valid bug and gets fixed, you receive <b style="color:#ffb454">1000 points</b> on your profile.') +
    P('You will get an email and a notification when the status changes. You can follow it any time under "My reports".') +
    btn(`${BASE()}/report-bug`, 'View my reports') }),
  text: `Thanks ${user.username}! We received your bug report ${bug.ref}: "${bug.title}". If it is confirmed valid and fixed you get 1000 points. Follow it at ${BASE()}/report-bug`
});

const STATUS_COPY = {
  fixed: ['Your bug was fixed', 'Good news, your report was confirmed as a valid bug and it is now fixed.', true],
  invalid: ['Update on your bug report', 'After review, we could not confirm this as a bug in HackQ.', false],
  duplicate: ['Update on your bug report', 'This bug was already reported by someone else, so we closed it as a duplicate.', false]
};
exports.bugStatus = (bug, user, reward) => {
  const [title, lead, good] = STATUS_COPY[bug.status];
  return { subject: `${bug.status === 'fixed' ? 'Fixed: ' : 'Update: '}${bug.title} (${bug.ref})`,
    html: layout({ preheader: good ? `+${reward} points added to your profile.` : lead, title, body:
      P(`Hi <b style="color:#e8e6df">${esc(user.username)}</b>,`) + P(lead) + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;font-size:14px">${row('Reference', `<b>${esc(bug.ref)}</b>`)}${row('Title', esc(bug.title))}</table>` +
      (bug.adminNote ? `<p style="margin:0 0 4px;color:#8d909b;font-size:13px">Note from the team</p>${box(bug.adminNote)}` : '') +
      (good ? `<div style="margin:16px 0;padding:16px;border:1px solid #2b4a33;background:#14221a;border-radius:6px;text-align:center;font:700 22px 'Courier New',monospace;color:#7bd88f">+${reward} points</div>` + P('Thank you for helping make HackQ better. The points are already on your profile.') : P('Thanks anyway, reports like yours help us keep HackQ healthy.')) +
      btn(`${BASE()}/report-bug`, 'View my reports') }),
    text: `${title}: ${bug.title} (${bug.ref}). ${lead}${bug.adminNote ? '\nNote: ' + bug.adminNote : ''}${good ? `\n+${reward} points added to your profile.` : ''}` };
};
