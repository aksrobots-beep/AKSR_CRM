/**
 * Date validation for API inputs.
 * Accepts only YYYY-MM-DD format; rejects numbers, invalid dates, and out-of-range years.
 */

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** YYYY-MM-DD regex (allows optional time part for ISO strings; we use date part only) */
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a date value for storage (DATE column).
 * @param {*} value - User input (string, number, or null/undefined)
 * @param {{ required?: boolean, fieldName?: string }} options - required: if true, empty is invalid; fieldName for error message
 * @returns {{ valid: boolean, value: string|null, error?: string }}
 */
export function validateDate(value, options = {}) {
  const { required = false, fieldName = 'Date' } = options;

  if (value === null || value === undefined || value === '') {
    if (required) return { valid: false, value: null, error: `${fieldName} is required` };
    return { valid: true, value: null };
  }

  // Reject pure numbers (e.g. 999999, 123)
  if (typeof value === 'number') {
    return { valid: false, value: null, error: `${fieldName} must be a valid date (YYYY-MM-DD), not a number` };
  }
  const str = String(value).trim();
  if (/^\d+$/.test(str)) {
    return { valid: false, value: null, error: `${fieldName} must be a valid date (YYYY-MM-DD), not a number` };
  }

  // Accept only YYYY-MM-DD
  const dateOnly = str.length >= 10 ? str.slice(0, 10) : str;
  if (!DATE_ONLY_REGEX.test(dateOnly)) {
    return { valid: false, value: null, error: `${fieldName} must be in YYYY-MM-DD format` };
  }

  const [y, m, d] = dateOnly.split('-').map(Number);
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return { valid: false, value: null, error: `${fieldName} year must be between ${MIN_YEAR} and ${MAX_YEAR}` };
  }
  if (month < 1 || month > 12) {
    return { valid: false, value: null, error: `${fieldName} must be a valid date (invalid month)` };
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { valid: false, value: null, error: `${fieldName} must be a valid calendar date` };
  }

  return { valid: true, value: dateOnly };
}

/**
 * Validate multiple date fields; returns first error or null.
 * @param {Record<string, { value: *, required?: boolean }>} fields - e.g. { due_date: { value: req.body.due_date, required: false } }
 * @returns {{ valid: boolean, values: Record<string, string|null>, error?: string }}
 */
export function validateDates(fields) {
  const values = {};
  for (const [key, opts] of Object.entries(fields)) {
    const name = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const result = validateDate(opts.value, { required: opts.required ?? false, fieldName: name });
    if (!result.valid) return { valid: false, values: {}, error: result.error };
    values[key] = result.value;
  }
  return { valid: true, values };
}
