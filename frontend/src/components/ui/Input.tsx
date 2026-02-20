import { InputHTMLAttributes, forwardRef } from 'react';
import { sanitizeNumberInput } from '../../utils/validation';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Standard text input component
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {label}
            {props.required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
            error ? 'border-danger-500' : 'border-neutral-300'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-neutral-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  allowDecimal?: boolean;
  onValueChange?: (value: string) => void;
}

/**
 * Number input component that only allows numeric characters
 * Automatically sanitizes input to remove non-numeric characters
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, error, helperText, allowDecimal = true, onValueChange, className = '', value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = sanitizeNumberInput(e.target.value, allowDecimal);
      if (onValueChange) {
        onValueChange(sanitized);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {label}
            {props.required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
            error ? 'border-danger-500' : 'border-neutral-300'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-neutral-500">{helperText}</p>}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

interface PhoneInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  onValueChange?: (value: string) => void;
}

/**
 * Phone input component optimized for Malaysian phone numbers
 * Accepts: +60123456789, 0123456789, 012-345 6789, etc.
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, helperText, onValueChange, className = '', value, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow digits, +, spaces, and hyphens
      const sanitized = e.target.value.replace(/[^\d+\s-]/g, '');
      if (onValueChange) {
        onValueChange(sanitized);
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            {label}
            {props.required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          value={value}
          onChange={handleChange}
          placeholder="+60 12-345 6789"
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors ${
            error ? 'border-danger-500' : 'border-neutral-300'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-neutral-500">{helperText}</p>}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
