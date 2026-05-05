import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, insert, update } from '../db/index.js';
import { send500 } from '../utils/errorResponse.js';
import { createNotification } from './notifications.js';
import { writeAudit } from '../services/auditLog.js';
import {
  canAssignTasks,
  canTechnicianCreateOwnTask,
  canViewAllTasksAndDiary,
  canUpdateTaskStatus,
} from '../utils/taskPermissions.js';
import {
  effectiveStatus,
  inactiveWarning,
  completionSeconds,
} from '../services/taskHelpers.js';
import { completeMicrosoftTodo } from '../services/microsoftGraph.js';
import {
  normalizeTaskWorkCategory,
  DEFAULT_TASK_WORK_CATEGORY,
  TASK_WORK_CATEGORY_LABELS,
} from '../constants/taskWorkCategories.js';
import {
  insertAutoDiaryForCompletedTask,
  insertAutoDiaryForInProgressTask,
} from '../services/taskCompletionDiary.js';

const router = Router();

const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high']);
const WORKFLOW_STATUS = new Set(['pending', 'in_progress', 'completed']);

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeDatetimeSql(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function taskPriorityFromTicket(ticketPriority) {
  const p = String(ticketPriority || '').toLowerCase();
  if (p === 'critical') return 'high';
  if (ALLOWED_PRIORITY.has(p)) return p;
  return 'medium';
}

function mapTaskRow(r, diaryCount) {
  const dc = Number(diaryCount) || 0;
  const eff = effectiveStatus(r);
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    ticketId: r.ticket_id || null,
    ticketNumber: r.ticket_number || null,
    ticketTitle: r.ticket_title || null,
    assignedTo: r.assigned_to,
    assignedBy: r.assigned_by,
    assigneeName: r.assignee_name || null,
    assignerName: r.assigner_name || null,
    priority: r.priority,
    status: r.status,
    effectiveStatus: eff,
    dueDate: r.due_date,
    dueAt: r.due_at,
    completedAt: r.completed_at,
    lastActivityAt: r.last_activity_at,
    diaryEntryCount: dc,
    inactiveWarning: inactiveWarning(r, dc),
    completionTimeSeconds: completionSeconds(r),
    microsoftTodoItemId: r.microsoft_todo_item_id || null,
    taskCategory: r.task_category || DEFAULT_TASK_WORK_CATEGORY,
    taskCategoryLabel: TASK_WORK_CATEGORY_LABELS[r.task_category || DEFAULT_TASK_WORK_CATEGORY],
    inProgressStartedAt: r.in_progress_started_at || null,
    reminderAt: r.reminder_at || null,
    reminderSentAt: r.reminder_sent_at || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.post('/', async (req, res) => {
  try {
    const managerAssign = canAssignTasks(req.user.role);
    const techOwn = canTechnicianCreateOwnTask(req.user.role);
    if (!managerAssign && !techOwn) {
      return res.status(403).json({ error: 'Not allowed to create tasks' });
    }
    const body = req.body || {};
    const { description, assigned_to: bodyAssignee, priority: bodyPriority, due_date: bodyDue, due_at } = body;
    let title = typeof body.title === 'string' ? body.title.trim() : '';
    let ticketId = body.ticket_id != null && String(body.ticket_id).trim() ? String(body.ticket_id).trim() : null;

    let ticketRow = null;
    if (ticketId) {
      const tr = await query(
        `SELECT id, ticket_number, title, description, priority, due_date, assigned_to, is_active
         FROM tickets WHERE id = ? LIMIT 1`,
        [ticketId]
      );
      ticketRow = Array.isArray(tr) && tr[0] ? tr[0] : null;
      if (!ticketRow) return res.status(400).json({ error: 'Invalid ticket_id' });
      const inactive = ticketRow.is_active === 0 || ticketRow.is_active === false;
      if (inactive) return res.status(400).json({ error: 'Cannot link task to inactive ticket' });
      if (techOwn && !managerAssign && ticketRow.assigned_to && ticketRow.assigned_to !== req.user.id) {
        return res.status(403).json({ error: 'You can only link tasks to tickets assigned to you' });
      }
    }

    let assigned_to = bodyAssignee != null && String(bodyAssignee).trim() ? String(bodyAssignee).trim() : '';
    if (techOwn && !managerAssign) {
      assigned_to = req.user.id;
    } else {
      if (!assigned_to && ticketRow?.assigned_to) assigned_to = ticketRow.assigned_to;
      if (!assigned_to || typeof assigned_to !== 'string') {
        return res.status(400).json({ error: 'assigned_to is required (or choose a ticket with an assignee)' });
      }
    }

    if (!title && ticketRow?.title) title = String(ticketRow.title).trim();
    if (!title) return res.status(400).json({ error: 'title is required (or provide ticket_id to copy from service ticket)' });

    let descVal = description != null ? String(description) : null;
    if ((descVal == null || descVal === '') && ticketRow?.description) descVal = ticketRow.description ? String(ticketRow.description) : null;

    let pr = bodyPriority != null && String(bodyPriority).trim() ? String(bodyPriority).toLowerCase() : '';
    if (!pr && ticketRow?.priority) pr = taskPriorityFromTicket(ticketRow.priority);
    if (!pr) pr = 'medium';
    if (!ALLOWED_PRIORITY.has(pr)) {
      return res.status(400).json({ error: 'priority must be low, medium, or high' });
    }

    let due_date = bodyDue != null && String(bodyDue).trim() ? String(bodyDue).trim().slice(0, 10) : '';
    if (!due_date && ticketRow?.due_date) {
      const d = ticketRow.due_date;
      due_date = typeof d === 'string' ? d.slice(0, 10) : d;
    }
    if (!due_date) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 7);
      due_date = fallback.toISOString().slice(0, 10);
    }

    const assigneeRows = await query('SELECT id FROM users WHERE id = ? AND (is_active = 1 OR is_active IS NULL) LIMIT 1', [
      assigned_to,
    ]);
    if (!assigneeRows?.length) {
      return res.status(400).json({ error: 'Invalid assignee' });
    }

    let task_category = DEFAULT_TASK_WORK_CATEGORY;
    if (body.task_category !== undefined && body.task_category !== null && String(body.task_category).trim() !== '') {
      const n = normalizeTaskWorkCategory(body.task_category);
      if (!n) return res.status(400).json({ error: 'Invalid task_category' });
      task_category = n;
    }

    const id = uuidv4();
    const ts = nowSql();
    const reminder_at = normalizeDatetimeSql(body.reminder_at);
    if (body.reminder_at != null && !reminder_at) {
      return res.status(400).json({ error: 'Invalid reminder_at datetime' });
    }
    const row = {
      id,
      title: title.slice(0, 255),
      description: descVal,
      ticket_id: ticketId,
      assigned_to,
      assigned_by: req.user.id,
      priority: pr,
      status: 'pending',
      due_date,
      due_at: due_at ? String(due_at).slice(0, 19).replace('T', ' ') : null,
      completed_at: null,
      in_progress_started_at: null,
      reminder_at,
      reminder_sent_at: null,
      last_activity_at: ts,
      task_category,
      is_active: 1,
      created_at: ts,
      updated_at: ts,
    };

    try {
      await insert('tasks', row);
    } catch (insErr) {
      const im = String(insErr?.message || '');
      if (
        im.includes('task_category') ||
        im.includes('in_progress_started_at') ||
        im.includes('reminder_at') ||
        im.includes('reminder_sent_at')
      ) {
        delete row.task_category;
        delete row.in_progress_started_at;
        delete row.reminder_at;
        delete row.reminder_sent_at;
        await insert('tasks', row);
      } else {
        throw insErr;
      }
    }

    const ticketLabel = ticketRow && ticketRow.ticket_number ? ` [${ticketRow.ticket_number}]` : '';
    if (assigned_to !== req.user.id) {
      await createNotification(assigned_to, {
        title: 'New task assigned',
        message: ticketId ? `From service ticket${ticketLabel}: ${row.title}` : `You were assigned: ${row.title}`,
        type: 'task',
        link: '/tasks',
      });
    }

    await writeAudit(req, {
      entity_type: 'task',
      entity_id: id,
      action: 'create',
      previous_value: null,
      new_value: { title: row.title, assigned_to, ticket_id: ticketId },
    });

    const [created] = await query(
      `SELECT t.*, ua.name AS assignee_name, ub.name AS assigner_name, tk.ticket_number, tk.title AS ticket_title
       FROM tasks t
       LEFT JOIN users ua ON ua.id = t.assigned_to
       LEFT JOIN users ub ON ub.id = t.assigned_by
       LEFT JOIN tickets tk ON tk.id = t.ticket_id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
    res.status(201).json(mapTaskRow(created, 0));
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('Unknown column') && msg.includes('ticket_id')) {
      return res.status(503).json({ error: 'Run DB migration: tasks.ticket_id column missing (npm run migrate-tasks-ticket-id)' });
    }
    send500(res, 'Failed to create task', e);
  }
});

router.get('/', async (req, res) => {
  try {
    const manager = canViewAllTasksAndDiary(req.user.role);
    const where = ['t.is_active = 1'];
    const params = [];

    if (!manager) {
      where.push('t.assigned_to = ?');
      params.push(req.user.id);
    } else if (req.query.assigned_to && String(req.query.assigned_to).trim()) {
      where.push('t.assigned_to = ?');
      params.push(String(req.query.assigned_to).trim());
    }

    if (req.query.assigned_by && String(req.query.assigned_by).trim()) {
      where.push('t.assigned_by = ?');
      params.push(String(req.query.assigned_by).trim());
    }

    if (req.query.status && String(req.query.status).trim()) {
      const st = String(req.query.status).trim().toLowerCase();
      if (st === 'overdue') {
        where.push(`t.status != 'completed'`);
        where.push(
          `((t.due_at IS NOT NULL AND t.due_at < NOW()) OR (t.due_at IS NULL AND t.due_date < CURRENT_DATE))`
        );
      } else if (WORKFLOW_STATUS.has(st)) {
        where.push('t.status = ?');
        params.push(st);
      }
    }

    if (req.query.from && String(req.query.from).trim()) {
      where.push('t.due_date >= ?');
      params.push(String(req.query.from).trim().slice(0, 10));
    }
    if (req.query.to && String(req.query.to).trim()) {
      where.push('t.due_date <= ?');
      params.push(String(req.query.to).trim().slice(0, 10));
    }

    if (req.query.ticket_id && String(req.query.ticket_id).trim()) {
      where.push('t.ticket_id = ?');
      params.push(String(req.query.ticket_id).trim());
    }

    const sql = `
      SELECT t.*, ua.name AS assignee_name, ub.name AS assigner_name,
        tk.ticket_number, tk.title AS ticket_title,
        (SELECT COUNT(*) FROM task_logs tl WHERE tl.task_id = t.id) AS diary_count
      FROM tasks t
      LEFT JOIN users ua ON ua.id = t.assigned_to
      LEFT JOIN users ub ON ub.id = t.assigned_by
      LEFT JOIN tickets tk ON tk.id = t.ticket_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.due_date ASC, t.priority DESC, t.created_at DESC
    `;

    let rows;
    try {
      rows = await query(sql, params);
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.json([]);
      }
      if (msg.includes('Unknown column') && msg.includes('ticket_id')) {
        return res.status(503).json({
          error: 'Run DB migration: npm run migrate-tasks-ticket-id',
        });
      }
      throw dbErr;
    }

    const list = (Array.isArray(rows) ? rows : []).map((r) => mapTaskRow(r, r.diary_count));
    res.json(list);
  } catch (e) {
    send500(res, 'Failed to list tasks', e);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let rows;
    try {
      rows = await query('SELECT * FROM tasks WHERE id = ? AND is_active = 1 LIMIT 1', [id]);
    } catch (dbErr) {
      const msg = dbErr?.message || '';
      if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
        return res.status(503).json({ error: 'Tasks module not initialized' });
      }
      throw dbErr;
    }
    const task = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (!canUpdateTaskStatus(task, req.user.id)) {
      return res.status(403).json({ error: 'Only the assignee can update this task' });
    }

    const { status, task_category, reminder_at } = req.body || {};
    if (status === undefined && task_category === undefined && reminder_at === undefined) {
      return res.status(400).json({ error: 'Provide status and/or task_category and/or reminder_at' });
    }

    const ts = nowSql();
    const patch = {
      last_activity_at: ts,
      updated_at: ts,
    };

    let next = task.status;
    const startedAtBefore = task.in_progress_started_at || null;
    if (status !== undefined) {
      if (typeof status !== 'string') {
        return res.status(400).json({ error: 'status must be a string' });
      }
      next = status.toLowerCase();
      if (!WORKFLOW_STATUS.has(next)) {
        return res.status(400).json({ error: 'status must be pending, in_progress, or completed' });
      }
      patch.status = next;
      if (next === 'completed') {
        patch.completed_at = ts;
        patch.in_progress_started_at = null;
      } else if (next === 'in_progress') {
        patch.completed_at = null;
        // Start a new timing segment whenever task transitions into in_progress.
        if (task.status !== 'in_progress') {
          patch.in_progress_started_at = ts;
        }
      } else {
        patch.completed_at = null;
        patch.in_progress_started_at = null;
      }
    }

    if (task_category !== undefined) {
      if (task_category === null || String(task_category).trim() === '') {
        patch.task_category = DEFAULT_TASK_WORK_CATEGORY;
      } else {
        const n = normalizeTaskWorkCategory(task_category);
        if (!n) return res.status(400).json({ error: 'Invalid task_category' });
        patch.task_category = n;
      }
    }

    if (reminder_at !== undefined) {
      if (reminder_at === null || String(reminder_at).trim() === '') {
        patch.reminder_at = null;
        patch.reminder_sent_at = null;
      } else {
        const dt = normalizeDatetimeSql(reminder_at);
        if (!dt) return res.status(400).json({ error: 'Invalid reminder_at datetime' });
        patch.reminder_at = dt;
        // Changing reminder time resets one-shot delivery marker.
        patch.reminder_sent_at = null;
      }
    }

    const prev = task.status;

    try {
      await update('tasks', id, patch);
    } catch (updErr) {
      const im = String(updErr?.message || '');
      if (
        im.includes('task_category') ||
        im.includes('in_progress_started_at') ||
        im.includes('reminder_at') ||
        im.includes('reminder_sent_at')
      ) {
        delete patch.task_category;
        delete patch.in_progress_started_at;
        delete patch.reminder_at;
        delete patch.reminder_sent_at;
        await update('tasks', id, patch);
      } else {
        throw updErr;
      }
    }

    if (prev !== 'completed' && next === 'completed') {
      try {
        const snapshot = { ...task, ...patch, status: next };
        await insertAutoDiaryForCompletedTask({
          task: snapshot,
          completedAtSql: ts,
          startAtSql: startedAtBefore,
        });
      } catch (derr) {
        console.warn('[tasks] auto diary:', derr?.message || derr);
      }
    }

    if (prev !== 'in_progress' && next === 'in_progress') {
      try {
        const snapshot = { ...task, ...patch, status: next };
        await insertAutoDiaryForInProgressTask({ task: snapshot, startedAtSql: ts });
      } catch (derr) {
        console.warn('[tasks] auto diary in-progress:', derr?.message || derr);
      }
    }

    if (prev !== 'completed' && next === 'completed' && task.microsoft_todo_item_id) {
      await completeMicrosoftTodo(req.user.id, { ...task, ...patch });
    }

    await writeAudit(req, {
      entity_type: 'task',
      entity_id: id,
      action: 'status_change',
      previous_value: { status: prev },
      new_value: { status: next },
    });

    const [updated] = await query(
      `SELECT t.*, ua.name AS assignee_name, ub.name AS assigner_name,
        tk.ticket_number, tk.title AS ticket_title,
        (SELECT COUNT(*) FROM task_logs tl WHERE tl.task_id = t.id) AS diary_count
       FROM tasks t
       LEFT JOIN users ua ON ua.id = t.assigned_to
       LEFT JOIN users ub ON ub.id = t.assigned_by
       LEFT JOIN tickets tk ON tk.id = t.ticket_id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
    res.json(mapTaskRow(updated, updated.diary_count));
  } catch (e) {
    send500(res, 'Failed to update task', e);
  }
});

export const taskRoutes = router;
