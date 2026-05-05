/**
 * Canonical role string for permission checks (lowercase, spaced labels → underscored).
 * Maps common aliases used in the field / legacy data.
 */
export function normalizeUserRole(role) {
  if (role == null || role === '') return '';
  let r = String(role).trim().toLowerCase().replace(/\s+/g, '_');
  if (r === 'manager') r = 'service_manager';
  return r;
}
