// Usage: npm run test-mail -- you@example.com
// Sends a test email and prints exactly what Resend answers.
require('dotenv').config();
const { sendMail, mailMode } = require('../utils/mailer');
const to = process.argv[2];
if (!to) { console.error('Usage: npm run test-mail -- you@example.com'); process.exit(1); }
console.log('Mail mode:', mailMode());
sendMail({ to, subject: 'HackQ test email', text: 'If you can read this, email sending works.', html: '<p>If you can read this, <b>email sending works</b>.</p>' })
  .then(r => { console.log('Result:', r); process.exit(0); })
  .catch(e => { console.error('FAILED:', e.message); process.exit(1); });
