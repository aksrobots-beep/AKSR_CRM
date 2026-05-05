import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { send500 } from '../utils/errorResponse.js';
import {
  isMicrosoftConfigured,
  buildAuthorizeUrl,
  saveConnectionFromCode,
  disconnectUser,
  upsertTodoForTask,
} from '../services/microsoftGraph.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

router.get('/oauth/callback', async (req, res) => {
  const fe = frontendBase();
  const { code, state, error, error_description: errDesc } = req.query;
  if (error) {
    return res.redirect(
      `${fe}/settings?tab=integrations&microsoft=error&msg=${encodeURIComponent(String(errDesc || error))}`
    );
  }
  if (!code || !state) {
    return res.redirect(
      `${fe}/settings?tab=integrations&microsoft=error&msg=${encodeURIComponent('Missing code or state')}`
    );
  }
  let userId;
  try {
    const payload = jwt.verify(String(state), JWT_SECRET);
    userId = payload.u || payload.sub || payload.id;
  } catch {
    return res.redirect(
      `${fe}/settings?tab=integrations&microsoft=error&msg=${encodeURIComponent('Invalid or expired link; try Connect again')}`
    );
  }
  if (!userId) {
    return res.redirect(
      `${fe}/settings?tab=integrations&microsoft=error&msg=${encodeURIComponent('Invalid state payload')}`
    );
  }
  try {
    await saveConnectionFromCode(String(userId), String(code));
    return res.redirect(`${fe}/settings?tab=integrations&microsoft=connected`);
  } catch (e) {
    return res.redirect(
      `${fe}/settings?tab=integrations&microsoft=error&msg=${encodeURIComponent(e?.message || 'Connection failed')}`
    );
  }
});

router.use(authenticateToken);

router.get('/status', async (req, res) => {
  try {
    const configured = isMicrosoftConfigured();
    if (!configured) {
      return res.json({ configured: false, connected: false });
    }
    const rows = await query(
      'SELECT ms_account_id, expires_at FROM user_microsoft_graph WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    res.json({
      configured: true,
      connected: Boolean(row),
      msAccountId: row?.ms_account_id || null,
      expiresAt: row?.expires_at || null,
    });
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
      return res.status(503).json({
        configured: isMicrosoftConfigured(),
        connected: false,
        error: 'Run migration: npm run migrate-microsoft-todo',
      });
    }
    send500(res, 'Microsoft status failed', e);
  }
});

router.get('/oauth/start', (req, res) => {
  if (!isMicrosoftConfigured()) {
    return res.status(503).json({ error: 'Microsoft To Do is not configured on this server' });
  }
  const state = jwt.sign({ u: req.user.id }, JWT_SECRET, { expiresIn: '15m' });
  const url = buildAuthorizeUrl(state);
  res.json({ url });
});

router.post('/disconnect', async (req, res) => {
  try {
    await disconnectUser(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    send500(res, 'Disconnect failed', e);
  }
});

router.post('/sync-tasks', async (req, res) => {
  try {
    if (!isMicrosoftConfigured()) {
      return res.status(503).json({ error: 'Microsoft To Do is not configured on this server' });
    }
    const linked = await query(
      'SELECT 1 FROM user_microsoft_graph WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    if (!Array.isArray(linked) || !linked.length) {
      return res.status(400).json({ error: 'Connect Microsoft account first' });
    }

    let taskRows;
    try {
      taskRows = await query(
        `SELECT id, title, description, due_date, microsoft_todo_item_id
         FROM tasks
         WHERE assigned_to = ? AND is_active = 1 AND status != 'completed'
         ORDER BY due_date ASC`,
        [req.user.id]
      );
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("Unknown column 'microsoft_todo_item_id'")) {
        return res.status(503).json({
          error: 'Run DB migration: npm run migrate-microsoft-todo',
        });
      }
      throw dbErr;
    }

    const list = Array.isArray(taskRows) ? taskRows : [];
    let synced = 0;
    const errors = [];
    for (const t of list) {
      try {
        await upsertTodoForTask(req.user.id, t);
        synced += 1;
      } catch (err) {
        errors.push({ taskId: t.id, message: err?.message || String(err) });
      }
    }
    res.json({ synced, total: list.length, errors });
  } catch (e) {
    send500(res, 'Sync failed', e);
  }
});

export const microsoftTodoRoutes = router;
