import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, insert, update } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import { sendReminderEmail } from '../services/email.js';

const router = Router();

const baseUrl = () => process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Create a notification for a user and send reminder to their email.
 * All reminder tasks go to the employee's email (in addition to in-app notification).
 * @param {string} userId - Target user id
 * @param {{ title: string, message?: string, type?: string, link?: string }} data
 */
export async function createNotification(userId, data) {
  if (!userId) return;
  const id = uuidv4();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await insert('notifications', {
    id,
    user_id: userId,
    title: data.title || 'Notification',
    message: data.message || '',
    type: data.type || 'info',
    link: data.link || null,
    is_read: 0,
    created_at: now,
  });

  // Send reminder to employee email
  try {
    const users = await query('SELECT email, name FROM users WHERE id = ? LIMIT 1', [userId]);
    const user = Array.isArray(users) && users.length ? users[0] : null;
    if (user && user.email) {
      const fullLink = data.link ? `${baseUrl()}${data.link.startsWith('/') ? data.link : '/' + data.link}` : undefined;
      const result = await sendReminderEmail({
        to: user.email,
        name: user.name || undefined,
        title: data.title || 'Reminder',
        message: data.message || '',
        link: fullLink,
      });
      if (!result.sent) {
        console.log('[CRM notification] Email skipped', { userId, to: user.email, title: data.title, reason: result.reason || 'unknown' });
      }
    } else {
      console.log('[CRM notification] No email sent (user has no email)', { userId, title: data.title });
    }
  } catch (err) {
    console.error('[CRM notification] Email send failed', { userId, title: data.title, error: err?.message || String(err) });
  }

  return id;
}

// GET /api/notifications — current user's notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const rows = await query(
      'SELECT id, user_id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [userId]
    );
    const list = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      message: r.message || '',
      type: r.type || 'info',
      link: r.link || undefined,
      read: r.is_read === 1 || r.is_read === true,
      createdAt: r.created_at,
    }));
    res.json(list);
  } catch (error) {
    send500(res, 'Failed to get notifications', error);
  }
});

// PATCH /api/notifications/read-all — mark all as read (must be before /:id/read)
router.patch('/read-all', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ ok: true });
  } catch (error) {
    send500(res, 'Failed to mark all read', error);
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const rows = await query('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    await update('notifications', req.params.id, { is_read: 1 });
    res.json({ ok: true });
  } catch (error) {
    send500(res, 'Failed to mark notification read', error);
  }
});

export const notificationRoutes = router;
