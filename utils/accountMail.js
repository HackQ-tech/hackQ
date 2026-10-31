const tokens = require('./tokens');
const T = require('./emailTemplates');
const { sendMail, canEmail } = require('./mailer');
const BASE = () => (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const device = (ua = '') => {
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
  const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown OS';
  return `${b} on ${o}`;
};
exports.device = device;
const meta = req => ({ at: Date.now(), ip: req?.ip || 'unknown', device: device(req?.headers?.['user-agent']) });

exports.sendCode = async (user) => { const code = await tokens.createCode(user._id); await sendMail({ to: user.email, ...T.verify(user, code) }); };
exports.sendWelcome = (user) => canEmail(user.email) ? sendMail({ to: user.email, ...T.welcome(user) }).catch(e => console.error('welcome mail failed:', e.message)) : null;
exports.sendReset = async (user) => { const raw = await tokens.createLink(user._id, 'reset', 30); await sendMail({ to: user.email, ...T.reset(user, `${BASE()}/reset-password?token=${raw}`) }); };
// Always sent after a password change/reset, with a one-click "this wasn't me" link
exports.notifyPasswordChange = async (user, req, kind = 'changed') => {
  try {
    const raw = await tokens.createLink(user._id, 'secure', 48 * 60);
    await sendMail({ to: user.email, ...T.passwordChanged(user, `${BASE()}/secure-account?token=${raw}`, meta(req), kind) });
  } catch (e) { console.error('password-change mail failed:', e.message); }
};

const log = what => e => console.error(`${what} failed:`, e.message);
exports.sendBugReport = async (bug, user) => {
  const to = (process.env.BUG_REPORT_EMAIL || process.env.ADMIN_EMAIL || '').split(',').map(s => s.trim()).filter(Boolean);
  if (to.length) await sendMail({ to, replyTo: user.email, ...T.bugAdmin(bug, user) }).catch(log('bug admin mail'));   // admin: reply goes straight to the reporter
  await sendMail({ to: user.email, ...T.bugReceipt(bug, user) }).catch(log('bug receipt mail'));                       // reporter: confirmation
};
exports.sendBugStatus = (bug, user, reward) => ['fixed', 'invalid', 'duplicate'].includes(bug.status) ? sendMail({ to: user.email, ...T.bugStatus(bug, user, reward) }).catch(log('bug status mail')) : null;
