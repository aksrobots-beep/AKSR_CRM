import { Router } from 'express';
import { query } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';

const router = Router();

// GET /api/admin/message-logs
// Query params: channel=email|push, status=sent|failed|skipped, q=search, limit, offset
router.get('/', async (req, res) => {
  try {
    const {
      channel,
      status,
      q,
      limit: limitRaw,
      offset: offsetRaw,
    } = req.query || {};

    const limit = Math.min(200, Math.max(1, parseInt(String(limitRaw || '100'), 10) || 100));
    const offset = Math.max(0, parseInt(String(offsetRaw || '0'), 10) || 0);

    const where = [];
    const params = [];

    if (channel && (channel === 'email' || channel === 'push')) {
      where.push('channel = ?');
      params.push(channel);
    }
    if (status && ['sent', 'failed', 'skipped'].includes(String(status))) {
      where.push('status = ?');
      params.push(status);
    }
    if (q && String(q).trim()) {
      const pattern = `%${String(q).trim()}%`;
      where.push('(to_email LIKE ? OR cc_email LIKE ? OR title LIKE ? OR subject LIKE ? OR message LIKE ? OR error LIKE ?)');
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    let rows;
    try {
      rows = await query(
        `SELECT id, channel, status, event_type, user_id, to_email, cc_email, title, subject, message, link, error, meta_json, created_at
         FROM message_logs
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) return res.json({ items: [], total: 0 });
      throw dbErr;
    }

    let total = 0;
    try {
      const countRows = await query(`SELECT COUNT(*) as cnt FROM message_logs ${whereSql}`, params);
      total = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].cnt) : 0;
    } catch {
      total = 0;
    }

    const items = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      channel: r.channel,
      status: r.status,
      eventType: r.event_type || undefined,
      userId: r.user_id || undefined,
      toEmail: r.to_email || undefined,
      ccEmail: r.cc_email || undefined,
      title: r.title || undefined,
      subject: r.subject || undefined,
      message: r.message || undefined,
      link: r.link || undefined,
      error: r.error || undefined,
      meta: r.meta_json ? (() => { try { return JSON.parse(r.meta_json); } catch { return undefined; } })() : undefined,
      createdAt: r.created_at,
    }));

    res.json({ items, total });
  } catch (error) {
    send500(res, 'Failed to get message logs', error);
  }
});

export const messageLogsRoutes = router;

