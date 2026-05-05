import path from 'path';
import os from 'os';
import { existsSync, mkdirSync } from 'fs';

export const TASK_DIARY_MAX_BYTES = 10 * 1024 * 1024;

/** Allowed extensions for diary attachments (lowercase, with dot). */
export const TASK_DIARY_ALLOWED_EXT = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

export function getTaskDiaryUploadsRoot() {
  const defaultRoot = process.env.VERCEL
    ? path.join(os.tmpdir(), 'crm-task-diary')
    : path.join(process.cwd(), 'uploads', 'task-diary');
  const root = process.env.TASK_DIARY_UPLOADS_DIR || defaultRoot;
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

/** Resolve a stored basename under the diary uploads root (prevents path traversal). */
export function resolveTaskDiaryStoredFile(basenameOnly) {
  const base = path.basename(String(basenameOnly || ''));
  if (!base || base === '.' || base === '..') {
    throw new Error('Invalid attachment path');
  }
  const root = path.resolve(getTaskDiaryUploadsRoot());
  const full = path.resolve(path.join(root, base));
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error('Invalid attachment path');
  }
  return full;
}
