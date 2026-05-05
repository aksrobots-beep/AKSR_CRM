import { v4 as uuidv4 } from 'uuid';
import { insert } from '../db/index.js';

function clientIp(req) {
  if (!req) return null;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function toJson(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/**
 * Best-effort audit row. Does not throw on failure (except caller may see insert throw if strict).
 */
export async function writeAudit(req, { entity_type, entity_id, action, previous_value, new_value }) {
  try {
    await insert('audit_logs', {
      id: uuidv4(),
      entity_type: String(entity_type || 'unknown').slice(0, 50),
      entity_id: String(entity_id || '').slice(0, 36),
      action: String(action || 'unknown').slice(0, 50),
      previous_value: toJson(previous_value),
      new_value: toJson(new_value),
      user_id: req?.user?.id || null,
      timestamp: nowSql(),
      ip_address: clientIp(req),
    });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes("doesn't exist") || msg.includes('Unknown table')) return;
    console.warn('[audit_logs] write failed', msg);
  }
}
