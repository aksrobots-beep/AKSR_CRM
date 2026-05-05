/** Default end-of-day hour (UTC) when due_at is null — reminders use same anchor. */
export function defaultDueAtHourUtc() {
  const h = parseInt(process.env.TASK_DUE_AT_HOUR_UTC || '16', 10);
  return Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 16;
}

export function effectiveDueTimestamp(row) {
  if (row.due_at) return new Date(row.due_at).getTime();
  const d = row.due_date;
  if (!d) return null;
  const hour = defaultDueAtHourUtc();
  return new Date(`${d}T${String(hour).padStart(2, '0')}:00:00.000Z`).getTime();
}

export function isTaskOverdue(row) {
  if (!row || row.status === 'completed') return false;
  const dueTs = effectiveDueTimestamp(row);
  if (dueTs != null) return Date.now() > dueTs;
  return false;
}

export function effectiveStatus(row) {
  if (!row) return null;
  if (row.status === 'completed') return 'completed';
  if (isTaskOverdue(row)) return 'overdue';
  return row.status;
}

/** Open task, no diary rows, created more than `hours` ago. */
export function inactiveWarning(row, diaryCount, inactiveAfterHours = 24) {
  if (!row || row.status === 'completed') return false;
  if (diaryCount > 0) return false;
  const created = new Date(row.created_at).getTime();
  return Date.now() - created > inactiveAfterHours * 3600 * 1000;
}

export function completionSeconds(row) {
  if (row.status !== 'completed' || !row.completed_at) return null;
  const start = new Date(row.created_at).getTime();
  const end = new Date(row.completed_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function formatTotalTime(minutes) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
}
