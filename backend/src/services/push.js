import admin from 'firebase-admin';
import { query } from '../db/index.js';
import { logMessageEvent } from './messageLog.js';

let firebaseReady = false;

/**
 * Parse FIREBASE_SERVICE_ACCOUNT: raw JSON string or base64-encoded JSON.
 */
function getServiceAccountJson() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  try {
    if (s.startsWith('{')) {
      return JSON.parse(s);
    }
    const decoded = Buffer.from(s, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT is invalid JSON or base64');
    return null;
  }
}

function ensureFirebase() {
  if (firebaseReady) return true;
  const credJson = getServiceAccountJson();
  if (!credJson) return false;
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(credJson),
      });
    }
    firebaseReady = true;
    return true;
  } catch (err) {
    console.error('[push] Firebase init failed:', err?.message || err);
    void logMessageEvent({
      channel: 'push',
      status: 'failed',
      eventType: 'init',
      error: err?.message || String(err),
    });
    return false;
  }
}

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Send FCM to all stored tokens for a user. Prunes invalid tokens from DB.
 * No-op if Firebase is not configured or user has no tokens.
 */
export async function sendPushToUser(userId, { title, body, link, type }) {
  if (!userId || !ensureFirebase()) return;

  let rows;
  try {
    rows = await query(
      'SELECT token FROM user_push_tokens WHERE user_id = ?',
      [userId]
    );
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
      console.warn('[push] user_push_tokens missing, skipping FCM');
      return;
    }
    throw err;
  }

  const tokens = (Array.isArray(rows) ? rows : []).map((r) => r.token).filter(Boolean);
  if (tokens.length === 0) return;

  const messaging = admin.messaging();
  const dataPayload = {
    link: link || '',
    type: type || 'info',
  };

  try {
    const resp = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: title || 'Notification',
        body: body || '',
      },
      data: {
        link: String(dataPayload.link),
        type: String(dataPayload.type),
      },
      android: {
        priority: 'high',
      },
    });

    const toDelete = [];
    resp.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code || '';
      if (INVALID_TOKEN_CODES.has(code) || code.includes('registration-token')) {
        toDelete.push(tokens[i]);
      } else {
        console.warn('[push] FCM send error', { token: tokens[i]?.slice(0, 20), code, message: r.error?.message });
      }
    });

    for (const t of toDelete) {
      try {
        await query('DELETE FROM user_push_tokens WHERE token = ?', [t]);
      } catch (e) {
        console.warn('[push] Failed to prune token', e?.message);
      }
    }

    void logMessageEvent({
      channel: 'push',
      status: resp.failureCount > 0 && resp.successCount === 0 ? 'failed' : 'sent',
      eventType: 'notification',
      userId,
      title: title || 'Notification',
      message: body || '',
      link: link || '',
      meta: {
        tokenCount: tokens.length,
        successCount: resp.successCount,
        failureCount: resp.failureCount,
        prunedCount: toDelete.length,
      },
    });
  } catch (err) {
    console.error('[push] sendEachForMulticast failed', err?.message || err);
    void logMessageEvent({
      channel: 'push',
      status: 'failed',
      eventType: 'notification',
      userId,
      title: title || 'Notification',
      message: body || '',
      link: link || '',
      error: err?.message || String(err),
      meta: { tokenCount: tokens.length },
    });
  }
}
