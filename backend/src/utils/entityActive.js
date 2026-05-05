import { normalizeUserRole } from './userRole.js';

/**
 * Treat missing is_active as active (legacy rows).
 */
export function isEntityActive(row) {
  if (!row) return false;
  const a = row.is_active;
  if (a === undefined || a === null) return true;
  return a === 1 || a === true || String(a) === '1';
}

export function filterActiveRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isEntityActive);
}

export function canIncludeInactiveRows(req) {
  const q = String(req.query?.include_inactive || '').toLowerCase();
  if (q !== '1' && q !== 'true') return false;
  const r = normalizeUserRole(req.user?.role) || req.user?.role;
  return ['ceo', 'admin', 'service_manager', 'hr_manager', 'finance', 'sales', 'operations'].includes(r);
}
