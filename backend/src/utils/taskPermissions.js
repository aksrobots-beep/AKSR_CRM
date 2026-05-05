import { isManagerRole } from './visitAccess.js';
import { normalizeUserRole } from './userRole.js';

/** Roles that may create tasks and assign them to employees. */
const TASK_ASSIGN_ROLES = new Set(['ceo', 'admin', 'service_manager', 'hr_manager']);

/**
 * Managers (and CEO/admin) may list all tasks, all diaries, and full task reports.
 * Aligns with MANAGER_ROLES in visitAccess (includes finance as read-all).
 */
export function canAssignTasks(role) {
  const r = normalizeUserRole(role);
  if (!r) return false;
  if (r === 'ceo' || r === 'admin') return true;
  return TASK_ASSIGN_ROLES.has(r);
}

/** Technicians may create tasks for themselves only (mobile / field). */
export function canTechnicianCreateOwnTask(role) {
  return normalizeUserRole(role) === 'technician';
}

export function canViewAllTasksAndDiary(role) {
  const r = normalizeUserRole(role);
  return isManagerRole(r) || r === 'ceo' || r === 'admin';
}

/** Only the assignee may PATCH task status (managers do not change status via API per product rules). */
export function canUpdateTaskStatus(taskRow, userId) {
  return taskRow && userId && taskRow.assigned_to === userId;
}
