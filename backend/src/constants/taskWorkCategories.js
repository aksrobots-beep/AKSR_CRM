/** Work categories for tasks and diary (stored as snake_case). */
export const TASK_WORK_CATEGORIES = [
  'rnd',
  'troubleshoot',
  'training',
  'documentation',
  'billing',
  'site_visit',
  'meeting',
];

export const TASK_WORK_CATEGORY_LABELS = {
  rnd: 'R&D',
  troubleshoot: 'Troubleshoot',
  training: 'Training',
  documentation: 'Documentation',
  billing: 'Billing',
  site_visit: 'Site Visit',
  meeting: 'Meeting',
};

export const DEFAULT_TASK_WORK_CATEGORY = 'meeting';

export function normalizeTaskWorkCategory(raw) {
  if (raw == null || raw === '') return DEFAULT_TASK_WORK_CATEGORY;
  const s = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (TASK_WORK_CATEGORIES.includes(s)) return s;
  const aliases = {
    rnd: 'rnd',
    r_d: 'rnd',
    research: 'rnd',
    ts: 'troubleshoot',
    troubleshoot: 'troubleshoot',
    documentation: 'documentation',
    docs: 'documentation',
    sitevisit: 'site_visit',
    site_visit: 'site_visit',
  };
  return aliases[s] || null;
}
