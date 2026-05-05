import { Router } from 'express';
import { query } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';

const router = Router();

// GET /api/admin/activity-logs (mounted with requireRole)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

    const where = [];
    const params = [];

    if (req.query.user_id && String(req.query.user_id).trim()) {
      where.push('al.user_id = ?');
      params.push(String(req.query.user_id).trim());
    }
    if (req.query.entity_type && String(req.query.entity_type).trim()) {
      where.push('al.entity_type = ?');
      params.push(String(req.query.entity_type).trim().slice(0, 50));
    }
    if (req.query.action && String(req.query.action).trim()) {
      where.push('al.action = ?');
      params.push(String(req.query.action).trim().slice(0, 50));
    }
    if (req.query.from && String(req.query.from).trim()) {
      where.push('al.`timestamp` >= ?');
      params.push(String(req.query.from).trim().slice(0, 19));
    }
    if (req.query.to && String(req.query.to).trim()) {
      where.push('al.`timestamp` <= ?');
      params.push(String(req.query.to).trim().slice(0, 19));
    }
    if (req.query.q && String(req.query.q).trim()) {
      const p = `%${String(req.query.q).trim().slice(0, 200)}%`;
      where.push('(al.entity_type LIKE ? OR al.entity_id LIKE ? OR al.action LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
      params.push(p, p, p, p, p);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    let rows;
    let countRows;
    try {
      rows = await query(
        `SELECT al.id, al.entity_type, al.entity_id, al.action, al.previous_value, al.new_value, al.user_id, al.\`timestamp\` AS ts, al.ip_address, u.name AS user_name, u.email AS user_email
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         ${whereSql}
         ORDER BY al.\`timestamp\` DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      countRows = await query(
        `SELECT COUNT(*) AS cnt FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${whereSql}`,
        params
      );
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.json({ items: [], total: 0, warning: 'audit_logs_table_missing' });
      }
      throw dbErr;
    }

    const total = Array.isArray(countRows) && countRows[0] ? Number(countRows[0].cnt) : 0;
    const items = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      previousValue: r.previous_value,
      newValue: r.new_value,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      timestamp: r.ts,
      ipAddress: r.ip_address,
    }));

    res.json({ items, total });
  } catch (error) {
    send500(res, 'Failed to get activity logs', error);
  }
});

export { router as activityLogsRoutes };
