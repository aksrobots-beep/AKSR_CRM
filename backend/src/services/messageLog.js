import { v4 as uuidv4 } from 'uuid';
import { insert } from '../db/index.js';

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * Persist a delivery log row (best-effort).
 * Safe to call even if table does not exist (it will be ignored).
 */
export async function logMessageEvent(data) {
  try {
    await insert('message_logs', {
      id: uuidv4(),
      channel: data.channel || 'email', // email | push
      status: data.status || 'sent', // sent | failed | skipped
      event_type: data.eventType || null,
      user_id: data.userId || null,
      to_email: data.toEmail || null,
      cc_email: data.ccEmail || null,
      title: data.title || null,
      subject: data.subject || null,
      message: data.message || null,
      link: data.link || null,
      error: data.error || null,
      meta_json: data.meta ? JSON.stringify(data.meta).slice(0, 16000) : null,
      created_at: nowSql(),
    });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) return;
    // Avoid breaking business flows because logging failed.
    console.warn('[message_logs] insert failed', msg);
  }
}

