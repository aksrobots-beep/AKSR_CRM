/**
 * Validation utilities for form inputs
 */

/**
 * Validates and formats Malaysian phone numbers
 * Accepts formats: +60123456789, 0123456789, 012-345 6789, etc.
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string; formatted?: string } {
  if (!phone || phone.trim() === '') {
    return { valid: true, formatted: '' }; // Empty is valid (optional field)
  }

  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check if it's a valid format
  const phoneRegex = /^(\+?60|0)\d{8,10}$/;
  
  if (!phoneRegex.test(cleaned)) {
    return { 
      valid: false, 
      error: 'Invalid phone number. Use format: +60 12-345 6789 or 012-345 6789' 
    };
  }

  // Format the number
  let formatted = cleaned;
  if (cleaned.startsWith('0')) {
    // Convert 0123456789 to +60123456789
    formatted = '+60' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+')) {
    formatted = '+' + cleaned;
  }

  // Add formatting: +60 12-345 6789
  if (formatted.startsWith('+60') && formatted.length >= 12) {
    const prefix = formatted.substring(0, 3); // +60
    const part1 = formatted.substring(3, 5); // 12
    const part2 = formatted.substring(5, 8); // 345
    const part3 = formatted.substring(8); // 6789
    formatted = `${prefix} ${part1}-${part2} ${part3}`;
  }

  return { valid: true, formatted };
}

/**
 * Validates email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validates and formats numeric input
 * Ensures only numbers (and optional decimal point) are entered
 */
export function validateNumber(value: string, options?: {
  allowDecimal?: boolean;
  min?: number;
  max?: number;
  required?: boolean;
}): { valid: boolean; error?: string; value?: number } {
  const { allowDecimal = true, min, max, required = false } = options || {};

  if (!value || value.trim() === '') {
    if (required) {
      return { valid: false, error: 'This field is required' };
    }
    return { valid: true, value: 0 };
  }

  // Remove any non-numeric characters (except decimal point if allowed)
  const cleaned = allowDecimal 
    ? value.replace(/[^\d.]/g, '') 
    : value.replace(/[^\d]/g, '');

  // Check if it's a valid number
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid number' };
  }

  // Check min/max constraints
  if (min !== undefined && num < min) {
    return { valid: false, error: `Minimum value is ${min}` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, error: `Maximum value is ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Format number as currency (MYR)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Sanitize number input to allow only digits and optional decimal
 */
export function sanitizeNumberInput(value: string, allowDecimal: boolean = true): string {
  if (allowDecimal) {
    // Allow digits and one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      // Multiple decimal points, keep only first
      return parts[0] + '.' + parts.slice(1).join('');
    }
    return value.replace(/[^\d.]/g, '');
  }
  // Only digits
  return value.replace(/[^\d]/g, '');
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  const validation = validatePhoneNumber(phone);
  return validation.formatted || phone;
}
