import { createReadStream, existsSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query, insert } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import { canViewAllTasksAndDiary } from '../utils/taskPermissions.js';
import { formatTotalTime } from '../services/taskHelpers.js';
import {
  getTaskDiaryUploadsRoot,
  resolveTaskDiaryStoredFile,
  TASK_DIARY_ALLOWED_EXT,
  TASK_DIARY_MAX_BYTES,
} from '../utils/taskDiaryStorage.js';
import {
  normalizeTaskWorkCategory,
  TASK_WORK_CATEGORY_LABELS,
} from '../constants/taskWorkCategories.js';

const router = Router();

const diaryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TASK_DIARY_MAX_BYTES },
});

function parseDiaryPost(req, res, next) {
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    return diaryUpload.single('attachment')(req, res, next);
  }
  next();
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeTime(t) {
  if (!t || typeof t !== 'string') return null;
  const parts = t.trim().split(':').map((p) => p.trim());
  if (parts.length < 2) return null;
  const h = Math.min(23, Math.max(0, parseInt(parts[0], 10)));
  const m = Math.min(59, Math.max(0, parseInt(parts[1], 10)));
  const sec = parts[2] != null ? Math.min(59, Math.max(0, parseInt(parts[2], 10))) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function computeTotalMinutes(startTime, endTime) {
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  if (!start || !end) return null;
  const [sh, sm, ss] = start.split(':').map((x) => parseInt(x, 10));
  const [eh, em, es] = end.split(':').map((x) => parseInt(x, 10));
  const s = sh * 3600 + sm * 60 + (ss || 0);
  const e = eh * 3600 + em * 60 + (es || 0);
  if (e <= s) return null;
  return Math.round((e - s) / 60);
}

/** ISO string for JSON (MySQL datetime string or Date from driver). */
function serializeDbDateTime(v) {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

function mapLogRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name || null,
    taskId: r.task_id,
    taskTitle: r.task_title || null,
    taskStatus: r.task_status != null ? String(r.task_status) : null,
    taskCompletedAt: serializeDbDateTime(r.task_completed_at),
    workDate: r.work_date,
    startTime: String(r.start_time).slice(0, 8),
    endTime: String(r.end_time).slice(0, 8),
    totalMinutes: r.total_minutes,
    totalTime: formatTotalTime(r.total_minutes),
    notes: r.notes,
    createdAt: r.created_at,
    attachmentUrl: r.attachment_path ? `/api/task-diary/${r.id}/attachment` : null,
    attachmentName: r.attachment_original_name || null,
    workCategory: r.work_category || null,
    workCategoryLabel: r.work_category ? TASK_WORK_CATEGORY_LABELS[r.work_category] || r.work_category : null,
  };
}

function diaryLogIdLooksValid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function userCanReadTaskDiaryRow(req, row) {
  if (!row) return false;
  const manager = canViewAllTasksAndDiary(req.user.role);
  if (manager) return true;
  return row.user_id === req.user.id;
}

/** GET …/task-diary/:id/attachment — download stored file (Authorization required). */
router.get('/:id/attachment', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!diaryLogIdLooksValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rows = await query('SELECT * FROM task_logs WHERE id = ? LIMIT 1', [id]);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.attachment_path) {
      return res.status(404).json({ error: 'No attachment' });
    }
    if (!userCanReadTaskDiaryRow(req, row)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let abs;
    try {
      abs = resolveTaskDiaryStoredFile(row.attachment_path);
    } catch {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!existsSync(abs)) {
      return res.status(404).json({ error: 'File missing' });
    }

    const mime = row.attachment_mime || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    const rawName = row.attachment_original_name || row.attachment_path || 'attachment';
    const asciiName = String(rawName).replace(/[\r\n"]/g, '_').slice(0, 180);
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"`);
    createReadStream(abs).pipe(res);
  } catch (e) {
    send500(res, 'Failed to download attachment', e);
  }
});

router.post('/', parseDiaryPost, async (req, res) => {
  try {
    const body = req.body || {};
    const { task_id, work_date, start_time, end_time, notes, work_category } = body;
    const manager = canViewAllTasksAndDiary(req.user.role);

    let userId = req.user.id;
    if (manager && body.user_id && String(body.user_id).trim()) {
      userId = String(body.user_id).trim();
      const u = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
      if (!u?.length) return res.status(400).json({ error: 'Invalid user_id' });
    }

    if (!work_date || typeof work_date !== 'string') {
      return res.status(400).json({ error: 'work_date is required (YYYY-MM-DD)' });
    }
    const dateStr = work_date.slice(0, 10);
    const totalMinutes = computeTotalMinutes(start_time, end_time);
    if (totalMinutes == null) {
      return res.status(400).json({ error: 'Invalid start_time / end_time (end must be after start)' });
    }

    let taskId = task_id ? String(task_id).trim() : null;
    if (taskId) {
      const tr = await query(
        'SELECT id, assigned_to FROM tasks WHERE id = ? AND is_active = 1 LIMIT 1',
        [taskId]
      );
      const task = tr?.[0];
      if (!task) return res.status(400).json({ error: 'Invalid task_id' });
      if (!manager && task.assigned_to !== userId) {
        return res.status(403).json({ error: 'You can only log time on tasks assigned to you' });
      }
    }

    const st = normalizeTime(start_time);
    const et = normalizeTime(end_time);
    const id = uuidv4();
    const ts = nowSql();

    const file = req.file;
    let attachment_path = null;
    let attachment_original_name = null;
    let attachment_mime = null;
    let diskPath = null;

    if (file?.buffer) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!TASK_DIARY_ALLOWED_EXT.has(ext)) {
        return res.status(400).json({
          error: `Unsupported file type. Allowed: ${[...TASK_DIARY_ALLOWED_EXT].join(', ')}`,
        });
      }
      attachment_path = `${id}${ext}`;
      attachment_original_name = String(file.originalname || 'file').replace(/[\r\n\0]/g, '').slice(0, 255);
      attachment_mime = file.mimetype || 'application/octet-stream';
      diskPath = path.join(getTaskDiaryUploadsRoot(), attachment_path);
      await writeFile(diskPath, file.buffer);
    }

    let wc = null;
    if (work_category !== undefined && work_category !== null && String(work_category).trim() !== '') {
      const n = normalizeTaskWorkCategory(work_category);
      if (!n) return res.status(400).json({ error: 'Invalid work_category' });
      wc = n;
    }

    const insertPayload = {
      id,
      user_id: userId,
      task_id: taskId,
      work_date: dateStr,
      start_time: st,
      end_time: et,
      total_minutes: totalMinutes,
      notes: notes != null ? String(notes) : null,
      created_at: ts,
      ...(wc ? { work_category: wc } : {}),
      ...(attachment_path
        ? { attachment_path, attachment_original_name, attachment_mime }
        : {}),
    };

    try {
      await insert('task_logs', insertPayload);
    } catch (insErr) {
      const im = String(insErr?.message || '');
      if (
        diskPath &&
        (im.includes('attachment_path') ||
          im.includes('attachment_original_name') ||
          im.includes('attachment_mime'))
      ) {
        try {
          await unlink(diskPath);
        } catch {
          /* ignore */
        }
        return res.status(503).json({
          error:
            'Task diary attachment columns missing. Run: cd backend && node src/scripts/migrate-tasks-module.js (MySQL) or add columns on Postgres — see repo task_logs DDL.',
        });
      }
      if (im.includes('work_category')) {
        const { work_category: _w, ...rest } = insertPayload;
        await insert('task_logs', rest);
      } else {
        throw insErr;
      }
    }

    if (taskId) {
      await query('UPDATE tasks SET last_activity_at = ?, updated_at = ? WHERE id = ?', [ts, ts, taskId]);
    }

    const [row] = await query(
      `SELECT tl.*, u.name AS user_name, t.title AS task_title,
              t.status AS task_status, t.completed_at AS task_completed_at
       FROM task_logs tl
       LEFT JOIN users u ON u.id = tl.user_id
       LEFT JOIN tasks t ON t.id = tl.task_id
       WHERE tl.id = ?`,
      [id]
    );
    res.status(201).json(mapLogRow(row));
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
      return res.status(503).json({ error: 'Task diary tables not initialized' });
    }
    send500(res, 'Failed to create diary entry', e);
  }
});

router.get('/', async (req, res) => {
  try {
    const manager = canViewAllTasksAndDiary(req.user.role);
    let userId = req.user.id;
    if (manager && req.query.user_id && String(req.query.user_id).trim()) {
      userId = String(req.query.user_id).trim();
    }

    const where = ['tl.user_id = ?'];
    const params = [userId];

    if (req.query.task_id && String(req.query.task_id).trim()) {
      where.push('tl.task_id = ?');
      params.push(String(req.query.task_id).trim());
    }

    if (req.query.date && String(req.query.date).trim()) {
      where.push('tl.work_date = ?');
      params.push(String(req.query.date).trim().slice(0, 10));
    }
    if (req.query.from && String(req.query.from).trim()) {
      where.push('tl.work_date >= ?');
      params.push(String(req.query.from).trim().slice(0, 10));
    }
    if (req.query.to && String(req.query.to).trim()) {
      where.push('tl.work_date <= ?');
      params.push(String(req.query.to).trim().slice(0, 10));
    }

    let rows;
    try {
      rows = await query(
        `SELECT tl.*, u.name AS user_name, t.title AS task_title,
                t.status AS task_status, t.completed_at AS task_completed_at
         FROM task_logs tl
         LEFT JOIN users u ON u.id = tl.user_id
         LEFT JOIN tasks t ON t.id = tl.task_id
         WHERE ${where.join(' AND ')}
         ORDER BY tl.work_date DESC, tl.start_time DESC`,
        params
      );
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.json([]);
      }
      throw dbErr;
    }

    res.json((Array.isArray(rows) ? rows : []).map(mapLogRow));
  } catch (e) {
    send500(res, 'Failed to list diary entries', e);
  }
});

export const taskDiaryRoutes = router;
