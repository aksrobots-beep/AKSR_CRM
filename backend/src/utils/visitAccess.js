import { findById } from '../db/index.js';

export const MANAGER_ROLES = new Set(['ceo', 'admin', 'service_manager', 'finance', 'hr_manager']);

export function isManagerRole(role) {
  return MANAGER_ROLES.has(role);
}

/** Any authenticated CRM user may use client site data for visits; geofence is enforced server-side. */
export async function userCanAccessClient(user, clientId) {
  if (!clientId || !user?.id) return false;
  const client = await findById('clients', clientId);
  return !!client;
}
