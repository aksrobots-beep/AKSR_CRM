import { query } from '../db/index.js';
import { createNotification } from '../routes/notifications.js';
import { effectiveDueTimestamp, isTaskOverdue } from './taskHelpers.js';

function todayUtcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return null;
}

/**
 * Sends due-soon, overdue, and stale-task reminders with dedup columns on tasks.
 */
export async function runTaskReminderSweep() {
  let rows;
  try {
    rows = await query(
      `SELECT * FROM tasks
       WHERE is_active = 1 AND status IN ('pending', 'in_progress')`
    );
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) {
      return { skipped: true, reason: 'tables_missing' };
    }
    throw e;
  }

  const list = Array.isArray(rows) ? rows : [];
  const today = todayUtcDateString();
  let sent = 0;

  for (const t of list) {
    const dueDateStr = dateOnly(t.due_date);
    const dueTs = effectiveDueTimestamp(t);
    const now = Date.now();

    const overdue = dueTs != null ? isTaskOverdue(t) : false;
    const msToDue = dueTs != null ? dueTs - now : Number.POSITIVE_INFINITY;

    // --- User-set one-shot reminder datetime ---
    if (t.reminder_at && !t.reminder_sent_at) {
      const reminderTs = new Date(t.reminder_at).getTime();
      if (Number.isFinite(reminderTs) && reminderTs <= now) {
        await createNotification(t.assigned_to, {
          title: 'Task reminder',
          message: `Reminder for: ${t.title}`,
          type: 'task_reminder',
          link: '/tasks',
        });
        const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await query('UPDATE tasks SET reminder_sent_at = ? WHERE id = ?', [ts, t.id]);
        sent++;
      }
    }

    // Remaining reminder strategies require due date/time.
    if (dueTs == null) continue;

    // --- Due tomorrow (calendar): notify assignee once per due_date ---
    if (!overdue && dueDateStr) {
      const dueD = new Date(dueDateStr + 'T12:00:00.000Z');
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      if (tomorrowStr === dueDateStr && t.reminder_due_day_sent_for !== dueDateStr) {
        await createNotification(t.assigned_to, {
          title: 'Task due tomorrow',
          message: `Reminder: "${t.title}" is due on ${dueDateStr}.`,
          type: 'task_reminder',
          link: '/tasks',
        });
        await query('UPDATE tasks SET reminder_due_day_sent_for = ? WHERE id = ?', [dueDateStr, t.id]);
        sent++;
      }
    }

    // --- Within 1 hour of due (one shot per task once we enter that window) ---
    if (!overdue && msToDue > 0 && msToDue <= 60 * 60 * 1000 && !t.reminder_due_hour_sent_at) {
      await createNotification(t.assigned_to, {
        title: 'Task due soon',
        message: `Less than an hour left for: ${t.title}`,
        type: 'task_reminder',
        link: '/tasks',
      });
      const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query('UPDATE tasks SET reminder_due_hour_sent_at = ? WHERE id = ?', [ts, t.id]);
      sent++;
    }

    // --- Overdue: assignee + manager (assigner), once per UTC day ---
    if (overdue) {
      if (t.manager_overdue_notified_at !== today) {
        await createNotification(t.assigned_to, {
          title: 'Task overdue',
          message: `Overdue: ${t.title}`,
          type: 'task_overdue',
          link: '/tasks',
        });
        if (t.assigned_by && t.assigned_by !== t.assigned_to) {
          await createNotification(t.assigned_by, {
            title: 'Team task overdue',
            message: `Task "${t.title}" is overdue for your team member.`,
            type: 'task_overdue',
            link: '/tasks',
          });
        }
        await query('UPDATE tasks SET manager_overdue_notified_at = ? WHERE id = ?', [today, t.id]);
        sent++;
      }
    }

    // --- No activity 24h ---
    const activityTs = t.last_activity_at ? new Date(t.last_activity_at).getTime() : new Date(t.created_at).getTime();
    const stale = Date.now() - activityTs >= 24 * 60 * 60 * 1000;
    if (stale && t.assigned_by && t.manager_stale_notified_at !== today) {
      await createNotification(t.assigned_by, {
        title: 'Task inactive',
        message: `No update in 24h on: ${t.title}`,
        type: 'task_stale',
        link: '/tasks',
      });
      await query('UPDATE tasks SET manager_stale_notified_at = ? WHERE id = ?', [today, t.id]);
      sent++;
    }
  }

  return { tasksScanned: list.length, notificationsSent: sent };
}
