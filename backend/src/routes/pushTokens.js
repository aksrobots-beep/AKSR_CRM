import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, insert } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';

const router = Router();

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * POST /api/push-tokens — register or refresh FCM token for current device
 * Body: { token: string, platform?: 'android' | 'ios' }
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { token, platform } = req.body || {};
    if (!token || typeof token !== 'string' || token.length > 512) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    const plat = platform === 'ios' ? 'ios' : 'android';
    const ts = nowSql();

    try {
      await query('DELETE FROM user_push_tokens WHERE token = ?', [token]);
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.status(503).json({ error: 'Push storage not available' });
      }
      throw dbErr;
    }

    const id = uuidv4();
    try {
      await insert('user_push_tokens', {
        id,
        user_id: userId,
        token,
        platform: plat,
        created_at: ts,
        updated_at: ts,
      });
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.status(503).json({ error: 'Push storage not available' });
      }
      throw dbErr;
    }

    res.json({ ok: true });
  } catch (error) {
    send500(res, 'Failed to register push token', error);
  }
});

/**
 * DELETE /api/push-tokens — remove all push tokens for current user (e.g. logout)
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    try {
      await query('DELETE FROM user_push_tokens WHERE user_id = ?', [userId]);
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.json({ ok: true });
      }
      throw dbErr;
    }

    res.json({ ok: true });
  } catch (error) {
    send500(res, 'Failed to remove push tokens', error);
  }
});

export const pushTokenRoutes = router;
