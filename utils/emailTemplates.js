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
