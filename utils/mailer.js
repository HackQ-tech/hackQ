// Sends email through the Resend API (https://resend.com).

exports.canEmail = (addr) => !!addr && !/@users\.noreply\.hackq\.local$/i.test(addr);

exports.parseFrom = (raw) => {
  let v = String(raw || '').trim().replace(/^["']|["']$/g, '');
  if (!v) return 'HackQ <onboarding@resend.dev>';
  if (/<[^<>@\s]+@[^<>@\s]+>/.test(v)) return v;                                   // already "Name <email>"
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)) return `HackQ <${v}>`;           // bare email
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return `HackQ <noreply@${v}>`;          // bare domain
  return v;
};

const HINTS = {
  401: 'RESEND_API_KEY is invalid or revoked. Create a new key at resend.com/api-keys.',
  403: 'The sender domain is not verified in Resend (or the key is restricted). Add the DNS records at resend.com/domains and wait until the domain shows "Verified". Until then Resend only delivers to your own account email.',
  422: 'Resend rejected the request, usually a malformed MAIL_FROM. Use  MAIL_FROM=HackQ <mail@yourdomain.com>',
  429: 'Resend rate limit reached, slow down.'
};

exports.mailMode = () => process.env.RESEND_API_KEY
  ? `Resend, sending from ${exports.parseFrom(process.env.MAIL_FROM)}`
  : 'DEV (RESEND_API_KEY is empty: emails are only printed in this console, nothing is sent)';

exports.sendMail = async ({ to, subject, html, text }) => {
  if (!exports.canEmail(to)) return { skipped: true };
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`\n--- [dev mail, NOT sent] to: ${to}\n--- subject: ${subject}\n${text}\n---\n`); return { dev: true }; }
  const from = exports.parseFrom(process.env.MAIL_FROM);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text })
  });
  const body = await r.text();
  if (!r.ok) {
    console.error(`[mail] Resend error ${r.status} (from: ${from}, to: ${to})\n[mail] ${body.slice(0, 300)}\n[mail] Hint: ${HINTS[r.status] || 'See https://resend.com/docs/api-reference/errors'}`);
    throw new Error(`Resend ${r.status}`);
  }
  return JSON.parse(body);
};
