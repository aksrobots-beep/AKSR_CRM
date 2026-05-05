import { Router } from 'express';
import { query } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import { canViewAllTasksAndDiary } from '../utils/taskPermissions.js';

const router = Router();

const isPostgres = (process.env.DB_ENGINE || 'mysql').toLowerCase() === 'postgres';
/** Average hours from created_at to completed_at (MySQL vs Postgres). */
const avgCompletionHoursSql = isPostgres
  ? 'AVG(EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600.0)'
  : 'AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.completed_at))';

function scopeUserId(req) {
  const manager = canViewAllTasksAndDiary(req.user.role);
  const q = req.query.user_id && String(req.query.user_id).trim();
  if (manager && q) return q;
  return req.user.id;
}

/** GET /api/task-reports/employee-tasks */
router.get('/employee-tasks', async (req, res) => {
  try {
    const userId = scopeUserId(req);
    const from = req.query.from ? String(req.query.from).slice(0, 10) : null;
    const to = req.query.to ? String(req.query.to).slice(0, 10) : null;

    const params = [userId];
    let dateFilter = '';
    if (from) {
      dateFilter += ' AND t.created_at >= ?';
      params.push(from + ' 00:00:00');
    }
    if (to) {
      dateFilter += ' AND t.created_at <= ?';
      params.push(to + ' 23:59:59');
    }

    let rows;
    try {
      rows = await query(
        `SELECT
           COUNT(*) AS total_assigned,
           SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN t.status != 'completed' AND ((t.due_at IS NOT NULL AND t.due_at < NOW()) OR (t.due_at IS NULL AND t.due_date < CURRENT_DATE)) THEN 1 ELSE 0 END) AS overdue,
           SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress
         FROM tasks t
         WHERE t.is_active = 1 AND t.assigned_to = ? ${dateFilter}`,
        params
      );
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.json({
          userId,
          totalAssigned: 0,
          completed: 0,
          overdue: 0,
          pending: 0,
          inProgress: 0,
          warning: 'tasks_table_missing',
        });
      }
      throw dbErr;
    }

    const r = rows?.[0] || {};
    res.json({
      userId,
      from: from || null,
      to: to || null,
      totalAssigned: Number(r.total_assigned) || 0,
      completed: Number(r.completed) || 0,
      overdue: Number(r.overdue) || 0,
      pending: Number(r.pending) || 0,
      inProgress: Number(r.in_progress) || 0,
    });
  } catch (e) {
    send500(res, 'Failed employee task report', e);
  }
});

/** GET /api/task-reports/diary */
router.get('/diary', async (req, res) => {
  try {
    const userId = scopeUserId(req);
    const from = req.query.from ? String(req.query.from).slice(0, 10) : null;
    const to = req.query.to ? String(req.query.to).slice(0, 10) : null;

    const params = [userId];
    let dateFilter = '';
    if (from) {
      dateFilter += ' AND tl.work_date >= ?';
      params.push(from);
    }
    if (to) {
      dateFilter += ' AND tl.work_date <= ?';
      params.push(to);
    }

    let byDay;
    let byTask;
    try {
      byDay = await query(
        `SELECT tl.work_date AS day, SUM(tl.total_minutes) AS total_minutes
         FROM task_logs tl
         WHERE tl.user_id = ? ${dateFilter}
         GROUP BY tl.work_date
         ORDER BY tl.work_date ASC`,
        params
      );
      byTask = await query(
        `SELECT tl.task_id AS task_id, MAX(t.title) AS task_title,
            SUM(tl.total_minutes) AS total_minutes,
            COUNT(*) AS entry_count
         FROM task_logs tl
         LEFT JOIN tasks t ON t.id = tl.task_id
         WHERE tl.user_id = ? AND tl.task_id IS NOT NULL ${dateFilter}
         GROUP BY tl.task_id
         ORDER BY total_minutes DESC`,
        params
      );
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.json({
          userId,
          hoursPerDay: [],
          timePerTask: [],
          totalMinutes: 0,
          warning: 'task_logs_table_missing',
        });
      }
      throw dbErr;
    }

    const hoursPerDay = (Array.isArray(byDay) ? byDay : []).map((x) => ({
      date: x.day,
      hoursWorked: Math.round((Number(x.total_minutes) / 60) * 100) / 100,
      totalMinutes: Number(x.total_minutes) || 0,
    }));

    const timePerTask = (Array.isArray(byTask) ? byTask : []).map((x) => ({
      taskId: x.task_id,
      taskTitle: x.task_title,
      totalMinutes: Number(x.total_minutes) || 0,
      hoursWorked: Math.round((Number(x.total_minutes) / 60) * 100) / 100,
      entryCount: Number(x.entry_count) || 0,
    }));

    const totalMinutes = hoursPerDay.reduce((a, x) => a + x.totalMinutes, 0);

    res.json({
      userId,
      from: from || null,
      to: to || null,
      hoursPerDay,
      timePerTask,
      productivity: {
        totalHours: Math.round((totalMinutes / 60) * 100) / 100,
        totalMinutes,
        daysLogged: hoursPerDay.length,
      },
    });
  } catch (e) {
    send500(res, 'Failed diary report', e);
  }
});

/** GET /api/task-reports/performance */
router.get('/performance', async (req, res) => {
  try {
    const userId = scopeUserId(req);
    const from = req.query.from ? String(req.query.from).slice(0, 10) : null;
    const to = req.query.to ? String(req.query.to).slice(0, 10) : null;

    const params = [userId];
    let dateFilter = '';
    if (from) {
      dateFilter += ' AND t.completed_at >= ?';
      params.push(from + ' 00:00:00');
    }
    if (to) {
      dateFilter += ' AND t.completed_at <= ?';
      params.push(to + ' 23:59:59');
    }

    let agg;
    let assignedCount;
    try {
      agg = await query(
        `SELECT
           COUNT(*) AS completed_count,
           ${avgCompletionHoursSql} AS avg_completion_hours
         FROM tasks t
         WHERE t.is_active = 1 AND t.assigned_to = ? AND t.status = 'completed' AND t.completed_at IS NOT NULL ${dateFilter}`,
        params
      );

      const p2 = [userId];
      let df2 = '';
      if (from) {
        df2 += ' AND t.created_at >= ?';
        p2.push(from + ' 00:00:00');
      }
      if (to) {
        df2 += ' AND t.created_at <= ?';
        p2.push(to + ' 23:59:59');
      }
      assignedCount = await query(
        `SELECT COUNT(*) AS c FROM tasks t WHERE t.is_active = 1 AND t.assigned_to = ? ${df2}`,
        p2
      );
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.json({
          userId,
          completedCount: 0,
          assignedInPeriod: 0,
          completionRate: null,
          avgCompletionHours: null,
          warning: 'tasks_table_missing',
        });
      }
      throw dbErr;
    }

    const a = agg?.[0] || {};
    const completedCount = Number(a.completed_count) || 0;
    const avgHours = a.avg_completion_hours != null ? Number(a.avg_completion_hours) : null;
    const assignedInPeriod = Number(assignedCount?.[0]?.c) || 0;
    const completionRate =
      assignedInPeriod > 0 ? Math.round((completedCount / assignedInPeriod) * 10000) / 100 : null;

    let workMinutes = 0;
    try {
      const lp = [userId];
      let df = '';
      if (from) {
        df += ' AND tl.work_date >= ?';
        lp.push(from);
      }
      if (to) {
        df += ' AND tl.work_date <= ?';
        lp.push(to);
      }
      const wm = await query(
        `SELECT COALESCE(SUM(tl.total_minutes), 0) AS m FROM task_logs tl WHERE tl.user_id = ? ${df}`,
        lp
      );
      workMinutes = Number(wm?.[0]?.m) || 0;
    } catch {
      workMinutes = 0;
    }

    res.json({
      userId,
      from: from || null,
      to: to || null,
      completedCount,
      assignedInPeriod,
      completionRate,
      avgCompletionHours: avgHours != null ? Math.round(avgHours * 100) / 100 : null,
      workTimeFromDiaryHours: Math.round((workMinutes / 60) * 100) / 100,
    });
  } catch (e) {
    send500(res, 'Failed performance report', e);
  }
});

export const taskReportRoutes = router;
