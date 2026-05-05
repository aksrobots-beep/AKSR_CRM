import { v4 as uuidv4 } from 'uuid';
import { insert, query } from '../db/index.js';
import {
  TASK_WORK_CATEGORY_LABELS,
  DEFAULT_TASK_WORK_CATEGORY,
} from '../constants/taskWorkCategories.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function utcTimeParts(d) {
  return {
    h: d.getUTCHours(),
    m: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
  };
}

function formatUtcTime(d) {
  const { h, m, s } = utcTimeParts(d);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function parseSqlOrDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampWindowToCompletionDay(startDate, endDate) {
  const end = endDate;
  const dayStartMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0);
  const startMs = Math.max(dayStartMs, startDate.getTime());
  const total_minutes = Math.max(1, Math.round((end.getTime() - startMs) / 60000));
  const start = new Date(startMs);
  return {
    work_date: end.toISOString().slice(0, 10),
    start_time: formatUtcTime(start),
    end_time: formatUtcTime(end),
    total_minutes,
  };
}

/**
 * Build diary row times on the completion calendar day (UTC), capped so start/end fit same DATE + TIME.
 * total_minutes matches (end - start); if lifetime was longer, it's noted in notes.
 */
export function computeDiaryWindowForCompletion(taskRow, completedAtSql) {
  const completed = new Date(String(completedAtSql).replace(' ', 'T') + 'Z');
  const created = taskRow.created_at instanceof Date ? taskRow.created_at : new Date(taskRow.created_at);
  const rawMin = Math.max(1, Math.round((completed.getTime() - created.getTime()) / 60000));

  const y = completed.getUTCFullYear();
  const mo = completed.getUTCMonth();
  const da = completed.getUTCDate();
  const dayStartMs = Date.UTC(y, mo, da, 0, 0, 0);
  const startMs = Math.max(dayStartMs, completed.getTime() - rawMin * 60000);
  const total_minutes = Math.max(1, Math.round((completed.getTime() - startMs) / 60000));

  const work_date = completed.toISOString().slice(0, 10);
  const start = new Date(startMs);
  const start_time = formatUtcTime(start);
  const end_time = formatUtcTime(completed);

  let notesExtra = '';
  if (rawMin > total_minutes) {
    const h = Math.floor(rawMin / 60);
    const m = rawMin % 60;
    notesExtra = ` Full task lifetime ~${h}h ${m}m (created → completed).`;
  }

  return { work_date, start_time, end_time, total_minutes, notesExtra };
}

/**
 * Build diary row from explicit status cycle start/end timestamps.
 * Capped to completion day to keep DATE+TIME valid in task_logs.
 */
export function computeDiaryWindowFromStatusCycle(startAtSql, completedAtSql) {
  const completed = parseSqlOrDate(completedAtSql);
  const started = parseSqlOrDate(startAtSql);
  if (!completed || !started) return null;
  if (completed.getTime() <= started.getTime()) return null;
  return clampWindowToCompletionDay(started, completed);
}

/**
 * Inserts a zero-minute marker row when task moves to in_progress
 * so the user can immediately see an auto diary entry.
 */
export async function insertAutoDiaryForInProgressTask({ task, startedAtSql }) {
  const started = parseSqlOrDate(startedAtSql);
  if (!started) return;
  const cat = task.task_category || DEFAULT_TASK_WORK_CATEGORY;
  const label = TASK_WORK_CATEGORY_LABELS[cat] || cat;
  const title = String(task.title || '').slice(0, 200);
  const start_time = formatUtcTime(started);
  const row = {
    id: uuidv4(),
    user_id: task.assigned_to,
    task_id: task.id,
    work_date: started.toISOString().slice(0, 10),
    start_time,
    end_time: start_time,
    total_minutes: 0,
    notes: `[Auto] Task in-progress started — ${label} — ${title}.`,
    work_category: cat,
    created_at: startedAtSql,
  };
  try {
    await insert('task_logs', row);
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.includes('work_category')) {
      const { work_category: _wc, ...rest } = row;
      await insert('task_logs', rest);
    } else {
      throw e;
    }
  }
}

/**
 * Inserts a task_logs row when a task moves to completed. Safe to swallow errors from caller.
 */
export async function insertAutoDiaryForCompletedTask({ task, completedAtSql, startAtSql = null }) {
  const userId = task.assigned_to;
  const cat = task.task_category || DEFAULT_TASK_WORK_CATEGORY;
  const label = TASK_WORK_CATEGORY_LABELS[cat] || cat;
  const cycleWindow = startAtSql ? computeDiaryWindowFromStatusCycle(startAtSql, completedAtSql) : null;
  const { work_date, start_time, end_time, total_minutes, notesExtra } = cycleWindow
    ? { ...cycleWindow, notesExtra: '' }
    : computeDiaryWindowForCompletion(task, completedAtSql);
  const title = String(task.title || '').slice(0, 200);
  const notes = startAtSql
    ? `[Auto] Task completed from in-progress — ${label} — ${title}.${notesExtra}`
    : `[Auto] Task completed — ${label} — ${title}.${notesExtra}`;

  const id = uuidv4();
  const row = {
    id,
    user_id: userId,
    task_id: task.id,
    work_date,
    start_time,
    end_time,
    total_minutes,
    notes,
    work_category: cat,
    created_at: completedAtSql,
  };

  try {
    // Update the latest in-progress marker row for this task-cycle instead of creating a duplicate.
    if (startAtSql) {
      const marker = await query(
        `SELECT id FROM task_logs
         WHERE task_id = ? AND user_id = ?
           AND total_minutes = 0
           AND notes LIKE ?
           AND created_at <= ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [task.id, userId, '[Auto] Task in-progress started%', completedAtSql]
      );
      const markerId = Array.isArray(marker) && marker[0] ? marker[0].id : null;
      if (markerId) {
        await query(
          `UPDATE task_logs
           SET work_date = ?, start_time = ?, end_time = ?, total_minutes = ?, notes = ?, work_category = ?
           WHERE id = ?`,
          [work_date, start_time, end_time, total_minutes, notes, cat, markerId]
        );
        return;
      }
    }

    await insert('task_logs', row);
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.includes('work_category')) {
      const { work_category: _wc, ...rest } = row;
      await insert('task_logs', rest);
    } else {
      throw e;
    }
  }
}
