/**
 * Date validation for forms.
 * Accepts only YYYY-MM-DD; rejects numbers and invalid dates.
 */

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface DateValidationResult {
  valid: boolean;
  value: string | null;
  error?: string;
}

export function validateDate(
  value: unknown,
  options: { required?: boolean; fieldName?: string } = {}
): DateValidationResult {
  const { required = false, fieldName = 'Date' } = options;

  if (value === null || value === undefined || value === '') {
    if (required) return { valid: false, value: null, error: `${fieldName} is required` };
    return { valid: true, value: null };
  }

  if (typeof value === 'number') {
    return { valid: false, value: null, error: `${fieldName} must be a valid date (YYYY-MM-DD), not a number` };
  }
  const str = String(value).trim();
  if (/^\d+$/.test(str)) {
    return { valid: false, value: null, error: `${fieldName} must be a valid date (YYYY-MM-DD), not a number` };
  }

  const dateOnly = str.length >= 10 ? str.slice(0, 10) : str;
  if (!DATE_ONLY_REGEX.test(dateOnly)) {
    return { valid: false, value: null, error: `${fieldName} must be in YYYY-MM-DD format` };
  }

  const [y, m, d] = dateOnly.split('-').map(Number);
  const year = y;
  const month = m;
  const day = d;

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

/** Min/max for HTML date inputs (YYYY-MM-DD) */
export const DATE_INPUT_MIN = `${MIN_YEAR}-01-01`;
export const DATE_INPUT_MAX = `${MAX_YEAR}-12-31`;
