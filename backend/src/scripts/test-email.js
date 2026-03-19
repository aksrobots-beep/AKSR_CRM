// One-off script to verify SMTP/email sending.
// Usage:
//   node src/scripts/test-email.js you@example.com
//
// If no recipient is provided, it tries:
//  - first email in ACCOUNTS_TEAM_EMAILS
//  - then SMTP_USER

import '../load-env.js';
import { sendReminderEmail } from '../services/email.js';

const args = process.argv.slice(2);
const toFromEnv =
  process.env.ACCOUNTS_TEAM_EMAILS?.split(',').map(s => s.trim()).filter(Boolean)[0] ||
  process.env.SMTP_USER ||
  '';

const to = args[0] || toFromEnv;
if (!to) {
  console.error('Missing recipient email. Usage: node src/scripts/test-email.js you@example.com');
  process.exit(1);
}

const base = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

const result = await sendReminderEmail({
  to,
  name: 'CRM',
  title: 'AK Success CRM SMTP Test',
  message: 'If you received this email, SMTP and outbound email sending are working correctly.',
  link: base,
});

console.log('SMTP test result:', result);
process.exit(result?.sent ? 0 : 2);

