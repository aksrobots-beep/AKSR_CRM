import nodemailer from 'nodemailer';

function getSmtpConfig() {
  const t = (v) => (v || '').replace(/[\r\n]+/g, '').trim();
  const host = t(process.env.SMTP_HOST);
  const port = parseInt(t(process.env.SMTP_PORT) || '587', 10);
  const user = t(process.env.SMTP_USER);
  const pass = t(process.env.SMTP_PASS);
  const secure = t(process.env.SMTP_SECURE).toLowerCase() === 'true' || port === 465;
  const from = t(process.env.SMTP_FROM) || t(process.env.MAIL_FROM) || user || 'no-reply@example.com';
  const smtpServername = t(process.env.SMTP_TLS_SERVERNAME);

  if (!host || !user || !pass) {
    return { configured: false, from };
  }

  // Build TLS options:
  // - If host is an IP, the cert won't match; use rejectUnauthorized:false
  //   or set SMTP_TLS_SERVERNAME to the hostname on the cert.
  // - SMTP_IGNORE_TLS_ERRORS=true also disables certificate checks.
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const ignoreTls = String(process.env.SMTP_IGNORE_TLS_ERRORS || '').toLowerCase() === 'true';
  const tls = {};
  if (ignoreTls || isIp) tls.rejectUnauthorized = false;
  if (smtpServername) tls.servername = smtpServername;

  return {
    configured: true,
    host,
    port,
    secure,
    auth: { user, pass },
    from,
    tls: Object.keys(tls).length ? tls : undefined,
  };
}

export async function sendPasswordResetEmail({ to, name, resetLink, expiresMinutes }) {
  const cfg = getSmtpConfig();
  const subject = 'Reset your password';
  const displayName = name || 'there';

  const text = [
    `Hi ${displayName},`,
    '',
    'We received a request to reset your password.',
    `Use this link to reset it: ${resetLink}`,
    '',
    `This link expires in ${expiresMinutes} minutes and can only be used once.`,
    'If you did not request this, you can safely ignore this email.',
    '',
    'AK Success CRM',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#222;">
      <p>Hi ${displayName},</p>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#0c8de6;color:#fff;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">This link expires in ${expiresMinutes} minutes and can only be used once.</p>
      <p style="font-size: 13px; color: #555;">If you did not request this, you can safely ignore this email.</p>
      <p>AK Success CRM</p>
    </div>
  `;

  if (!cfg.configured) {
    // Safe fallback for environments without SMTP configured.
    console.warn('[email] SMTP not configured. Reset link generated but email not sent.');
    console.warn('[email] Recipient:', to);
    console.warn('[email] Reset link:', resetLink);
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    tls: cfg.tls,
  });

  await transporter.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });

  console.log('[CRM email] Password reset sent', { to, at: new Date().toISOString() });
  return { sent: true };
}

/**
 * Send an email when a service ticket is assigned to a user.
 */
export async function sendAssignmentEmail({ to, assigneeName, ticketNumber, ticketTitle, priority = 'medium', link }) {
  const cfg = getSmtpConfig();
  const displayName = assigneeName || 'there';
  const appName = 'AK Success CRM';
  const subject = `Task assigned to you: ${ticketNumber || 'Service Ticket'} - AK Success CRM`;

  const text = [
    `Hi ${displayName},`,
    '',
    'A service ticket has been assigned to you.',
    '',
    `Ticket: ${ticketNumber || '—'}`,
    `Title: ${ticketTitle || '—'}`,
    `Priority: ${priority}`,
    '',
    link ? `View in CRM: ${link}` : '',
    '',
    appName,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#222;">
      <p>Hi ${displayName},</p>
      <p>A service ticket has been assigned to you.</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 12px 6px 0; color:#555;">Ticket</td><td style="padding:6px 0;"><strong>${ticketNumber || '—'}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0; color:#555;">Title</td><td style="padding:6px 0;">${ticketTitle || '—'}</td></tr>
        <tr><td style="padding:6px 12px 6px 0; color:#555;">Priority</td><td style="padding:6px 0;">${priority}</td></tr>
      </table>
      ${link ? `<p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#0c8de6;color:#fff;text-decoration:none;border-radius:6px;">Open in CRM</a></p>` : ''}
      <p style="font-size: 13px; color: #555;">${appName}</p>
    </div>
  `;

  if (!cfg.configured) {
    console.log('[CRM email] Assignment email not sent (SMTP not configured)', { to, ticketNumber });
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    tls: cfg.tls,
  });

  try {
    await transporter.sendMail({
      from: cfg.from,
      to,
      subject,
      text,
      html,
    });
    console.log('[CRM email] Assignment email sent', { to, ticketNumber, at: new Date().toISOString() });
    return { sent: true };
  } catch (err) {
    console.error('[CRM email] Assignment email failed', { to, ticketNumber, error: err?.message });
    return { sent: false, reason: 'send_failed', error: err?.message };
  }
}

/**
 * Send a billing request email with itemized billing details to the accounts team.
 */
export async function sendBillingRequestEmail({
  to,
  cc,
  ticketNumber,
  ticketTitle,
  clientName,
  priority,
  resolvedBy,
  billingItems = [],
  billingNotes,
  link,
  attachments = [],
}) {
  const cfg = getSmtpConfig();
  const appName = 'AK Success CRM';
  const subject = `Billing Request: ${ticketNumber || 'Service Ticket'} - ${ticketTitle || ''}`.trim();

  const grandTotal = billingItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);

  const itemsText = billingItems.map((item, i) =>
    `${i + 1}. ${item.description || '—'}  |  Qty: ${item.quantity || 0}  |  Unit: RM${(item.unit_price || 0).toFixed(2)}  |  Total: RM${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}`
  ).join('\n');

  const text = [
    'Billing Request',
    '',
    `Ticket: ${ticketNumber || '—'}`,
    `Title: ${ticketTitle || '—'}`,
    clientName ? `Client: ${clientName}` : '',
    `Priority: ${priority || '—'}`,
    resolvedBy ? `Resolved by: ${resolvedBy}` : '',
    '',
    'Billing Items:',
    itemsText || '(none)',
    '',
    `Grand Total: RM${grandTotal.toFixed(2)}`,
    billingNotes ? `\nNotes: ${billingNotes}` : '',
    link ? `\nView in CRM: ${link}` : '',
    '',
    appName,
  ].filter(Boolean).join('\n');

  const itemsHtml = billingItems.map((item) => {
    const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
    return `<tr>
      <td style="padding:8px 12px; border:1px solid #ddd;">${item.description || '—'}</td>
      <td style="padding:8px 12px; border:1px solid #ddd; text-align:center;">${item.quantity || 0}</td>
      <td style="padding:8px 12px; border:1px solid #ddd; text-align:right;">RM${(item.unit_price || 0).toFixed(2)}</td>
      <td style="padding:8px 12px; border:1px solid #ddd; text-align:right;">RM${lineTotal.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#222;">
      <h2 style="color:#0c8de6; margin-bottom:4px;">Billing Request</h2>
      <table style="border-collapse: collapse; margin: 12px 0;">
        <tr><td style="padding:4px 12px 4px 0; color:#555;">Ticket</td><td style="padding:4px 0;"><strong>${ticketNumber || '—'}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0; color:#555;">Title</td><td style="padding:4px 0;">${ticketTitle || '—'}</td></tr>
        ${clientName ? `<tr><td style="padding:4px 12px 4px 0; color:#555;">Client</td><td style="padding:4px 0;">${clientName}</td></tr>` : ''}
        <tr><td style="padding:4px 12px 4px 0; color:#555;">Priority</td><td style="padding:4px 0;">${priority || '—'}</td></tr>
        ${resolvedBy ? `<tr><td style="padding:4px 12px 4px 0; color:#555;">Resolved by</td><td style="padding:4px 0;">${resolvedBy}</td></tr>` : ''}
      </table>
      <h3 style="margin-top:16px;">Billing Items</h3>
      <table style="border-collapse: collapse; width:100%; margin: 8px 0;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px 12px; border:1px solid #ddd; text-align:left;">Description</th>
            <th style="padding:8px 12px; border:1px solid #ddd; text-align:center;">Qty</th>
            <th style="padding:8px 12px; border:1px solid #ddd; text-align:right;">Unit Price</th>
            <th style="padding:8px 12px; border:1px solid #ddd; text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="4" style="padding:8px 12px; border:1px solid #ddd; color:#999;">No items</td></tr>'}
        </tbody>
        <tfoot>
          <tr style="background:#f0f7ff;">
            <td colspan="3" style="padding:8px 12px; border:1px solid #ddd; text-align:right;"><strong>Grand Total</strong></td>
            <td style="padding:8px 12px; border:1px solid #ddd; text-align:right;"><strong>RM${grandTotal.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
      ${billingNotes ? `<p style="margin-top:12px;"><strong>Notes:</strong> ${billingNotes.replace(/\n/g, '<br/>')}</p>` : ''}
      ${attachments.length > 0 ? `<p style="margin-top:12px;"><strong>Attachments:</strong> ${attachments.map(a => a.filename).join(', ')}</p>` : ''}
      ${link ? `<p style="margin-top:16px;"><a href="${link}" style="display:inline-block;padding:10px 16px;background:#0c8de6;color:#fff;text-decoration:none;border-radius:6px;">Open in CRM</a></p>` : ''}
      <p style="font-size: 13px; color: #555; margin-top:16px;">${appName}</p>
    </div>
  `;

  if (!cfg.configured) {
    console.log('[CRM email] Billing request email not sent (SMTP not configured)', { to, ticketNumber });
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    tls: cfg.tls,
  });

  const mailAttachments = attachments
    .filter(a => a.filename && a.content)
    .map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType || 'application/octet-stream',
    }));

  try {
    await transporter.sendMail({
      from: cfg.from,
      to,
      cc,
      subject,
      text,
      html,
      attachments: mailAttachments.length ? mailAttachments : undefined,
    });
    console.log('[CRM email] Billing request sent', {
      to,
      cc: cc || '',
      ticketNumber,
      attachmentCount: mailAttachments.length,
      at: new Date().toISOString(),
    });
    return { sent: true };
  } catch (err) {
    console.error('[CRM email] Billing request failed', { to, ticketNumber, error: err?.message });
    return { sent: false, reason: 'send_failed', error: err?.message };
  }
}

/**
 * Send a reminder/notification email to an employee.
 * Used for SIM reminders, ticket assignments, and other in-app reminder tasks.
 */
export async function sendReminderEmail({ to, cc, name, title, message, link }) {
  const cfg = getSmtpConfig();
  const displayName = name || 'there';
  const appName = 'AK Success CRM';
  const text = [
    `Hi ${displayName},`,
    '',
    title || 'Reminder',
    message ? `\n${message}` : '',
    link ? `\nLink: ${link}` : '',
    '',
    appName,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#222;">
      <p>Hi ${displayName},</p>
      <h3 style="color:#0c8de6;">${title || 'Reminder'}</h3>
      ${message ? `<p>${message.replace(/\n/g, '<br/>')}</p>` : ''}
      ${link ? `<p><a href="${link}" style="color:#0c8de6;">Open in CRM</a></p>` : ''}
      <p style="font-size: 13px; color: #555;">${appName}</p>
    </div>
  `;

  if (!cfg.configured) {
    console.log('[CRM email] Notification not sent (SMTP not configured)', { to, title: title || 'Reminder' });
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    tls: cfg.tls,
  });

  const subject = title || 'Reminder - AK Success CRM';
  try {
    await transporter.sendMail({
      from: cfg.from,
      to,
      cc,
      subject,
      text,
      html,
    });
    console.log('[CRM email] Notification sent', {
      to,
      cc: cc || '',
      subject,
      at: new Date().toISOString(),
    });
    return { sent: true };
  } catch (err) {
    console.error('[CRM email] Notification send failed', {
      to,
      cc: cc || '',
      subject,
      error: err?.message || String(err),
      at: new Date().toISOString(),
    });
    return { sent: false, reason: 'send_failed', error: err?.message };
  }
}
