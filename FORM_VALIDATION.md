# Form Validation Documentation

## Overview

This document describes the comprehensive form validation system implemented across the CRM application. The system ensures data integrity by validating phone numbers, email addresses, numeric inputs, and dates before submission.

## Table of Contents

1. [Validation Utilities](#validation-utilities)
2. [Input Components](#input-components)
3. [Forms with Validation](#forms-with-validation)
4. [Usage Examples](#usage-examples)
5. [Validation Rules](#validation-rules)

## Validation Utilities

**Location:** `frontend/src/utils/validation.ts`

### Available Functions

#### 1. `validatePhoneNumber(phone: string)`

Validates Malaysian phone numbers in various formats.

**Accepts:**
- `+60123456789`
- `0123456789`
- `012-345 6789`
- `+60 12-345 6789`

**Returns:**
```typescript
{
  valid: boolean;
  error?: string;
  formatted?: string; // e.g., "+60 12-345 6789"
}
```

**Example:**
```typescript
const result = validatePhoneNumber('+60123456789');
if (result.valid) {
  console.log(result.formatted); // "+60 12-345 6789"
}
```

#### 2. `validateEmail(email: string)`

Validates email format using regex.

**Returns:**
```typescript
{
  valid: boolean;
  error?: string;
}
```

#### 3. `validateNumber(value: string, options?)`

Validates and parses numeric input with optional constraints.

**Options:**
```typescript
{
  allowDecimal?: boolean;  // Default: true
  min?: number;            // Minimum value
  max?: number;            // Maximum value
  required?: boolean;      // Default: false
}
```

**Returns:**
```typescript
{
  valid: boolean;
  error?: string;
  value?: number;
}
```

**Example:**
```typescript
const result = validateNumber('1500.50', {
  allowDecimal: true,
  min: 0,
  max: 10000,
  required: true
});
```

#### 4. Helper Functions

- `formatCurrency(amount: number)` - Formats as MYR: `RM 1,500.00`
- `formatNumber(num: number, decimals: number)` - Adds thousand separators
- `sanitizeNumberInput(value: string, allowDecimal: boolean)` - Strips non-numeric chars
- `formatPhoneNumber(phone: string)` - Formats for display

## Input Components

**Location:** `frontend/src/components/ui/Input.tsx`

### 1. Standard Input

```tsx
<Input
  label="Name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={nameError}
  helperText="Enter your full name"
  required
/>
```

### 2. NumberInput

Automatically sanitizes non-numeric characters as user types.

```tsx
<NumberInput
  label="Quantity"
  value={quantity}
  onValueChange={(value) => setQuantity(value)}
  allowDecimal={false}
  error={quantityError}
  required
/>
```

**Features:**
- Only allows digits (and decimal point if `allowDecimal={true}`)
- Shows numeric keyboard on mobile (`inputMode="decimal"`)
- Real-time input sanitization

### 3. PhoneInput

Optimized for Malaysian phone numbers.

```tsx
<PhoneInput
  label="Phone"
  value={phone}
  onValueChange={(value) => setPhone(value)}
  error={phoneError}
  placeholder="+60 12-345 6789"
/>
```

**Features:**
- Allows: digits, `+`, spaces, hyphens
- Shows telephone keyboard on mobile (`type="tel"`)
- Real-time input sanitization

## Forms with Validation

### 1. User Management (`frontend/src/pages/Users.tsx`)

**Validated Fields:**
- ✅ Phone number (edit user modal)

**Validation:**
```typescript
if (editFormData.phone && editFormData.phone.trim() !== '') {
  const phoneValidation = validatePhoneNumber(editFormData.phone);
  if (!phoneValidation.valid) {
    setError(phoneValidation.error || 'Invalid phone number');
    return;
  }
}
```

### 2. Client Management (`frontend/src/pages/Clients.tsx`)

**Validated Fields:**
- ✅ Email address
- ✅ Phone number

**Validation Applied:**
- Add client form
- Edit client form

### 3. Inventory Management (`frontend/src/pages/Inventory.tsx`)

**Validated Fields:**
- ✅ Quantity (integer, min: 0)
- ✅ Minimum quantity (integer, min: 0)
- ✅ Unit price (decimal, min: 0)
- ✅ Take quantity (max: available stock)
- ✅ Add stock quantity (min: 1)

**Example:**
```typescript
const qtyValidation = validateNumber(String(formData.quantity), { 
  allowDecimal: false, 
  min: 0, 
  required: true 
});
if (!qtyValidation.valid) {
  alert('Quantity: ' + qtyValidation.error);
  return;
}
```

### 4. Employee Management (`frontend/src/pages/Employees.tsx`)

**Validated Fields:**
- ✅ Salary (decimal, min: 0)
- ✅ Annual leave balance (integer, 0-365)
- ✅ Sick leave balance (integer, 0-365)

### 5. Accounts & Invoices (`frontend/src/pages/Accounts.tsx`)

**Validated Fields:**
- ✅ Line item quantities (integer, min: 1)
- ✅ Line item unit prices (decimal, min: 0)
- ✅ Payment amounts (decimal, min: 0.01, max: outstanding + 10%)

**Invoice Creation:**
```typescript
for (let i = 0; i < formData.items.length; i++) {
  const item = formData.items[i];
  
  // Validate quantity
  const qtyValidation = validateNumber(String(item.quantity), { 
    allowDecimal: false, 
    min: 1, 
    required: true 
  });
  if (!qtyValidation.valid) {
    alert(`Line item ${i + 1} - Quantity: ${qtyValidation.error}`);
    return;
  }
}
```

## Validation Rules

### Phone Numbers

| Format | Valid | Notes |
|--------|-------|-------|
| `+60123456789` | ✅ | International format |
| `0123456789` | ✅ | Local format |
| `012-345 6789` | ✅ | With separators |
| `+60 12-345 6789` | ✅ | Formatted |
| `123456789` | ❌ | Missing prefix |
| `abc12345678` | ❌ | Contains letters |

### Email Addresses

Must match pattern: `[user]@[domain].[tld]`

Examples:
- ✅ `user@example.com`
- ✅ `user.name+tag@example.co.uk`
- ❌ `user@example`
- ❌ `@example.com`

### Numbers

#### Integers (allowDecimal: false)
- Only digits allowed
- No decimal points
- Can have min/max constraints

#### Decimals (allowDecimal: true)
- Digits and one decimal point
- Multiple decimals auto-corrected
- Can have min/max constraints

### Constraints Examples

```typescript
// Inventory quantity: positive integers only
validateNumber(value, { allowDecimal: false, min: 0, required: true })

// Price: decimals, must be positive
validateNumber(value, { allowDecimal: true, min: 0, required: true })

// Leave balance: 0-365 days
validateNumber(value, { allowDecimal: false, min: 0, max: 365, required: true })

// Payment: must be positive, allow slight overpayment
validateNumber(value, { 
  allowDecimal: true, 
  min: 0.01,
  max: outstanding * 1.1,
  required: true 
})
```

## Usage Examples

### Example 1: Add Phone Validation to a Form

```typescript
import { validatePhoneNumber } from '../utils/validation';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate phone
  if (formData.phone) {
    const phoneValidation = validatePhoneNumber(formData.phone);
    if (!phoneValidation.valid) {
      alert(phoneValidation.error);
      return;
    }
    // Use formatted version
    formData.phone = phoneValidation.formatted || formData.phone;
  }
  
  // Submit form...
};
```

### Example 2: Add Number Validation

```typescript
import { validateNumber } from '../utils/validation';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate quantity
  const qtyValidation = validateNumber(String(quantity), { 
    allowDecimal: false, 
    min: 1,
    max: 1000,
    required: true 
  });
  
  if (!qtyValidation.valid) {
    alert('Quantity: ' + qtyValidation.error);
    return;
  }
  
  // Use validated number
  const validatedQty = qtyValidation.value;
};
```

### Example 3: Use Input Components

```tsx
import { PhoneInput, NumberInput } from '../components/ui';

function MyForm() {
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState('');
  const [phoneError, setPhoneError] = useState('');
  
  return (
    <form onSubmit={handleSubmit}>
      <PhoneInput
        label="Contact Phone"
        value={phone}
        onValueChange={setPhone}
        error={phoneError}
        required
      />
      
      <NumberInput
        label="Quantity"
        value={quantity}
        onValueChange={setQuantity}
        allowDecimal={false}
        required
      />
    </form>
  );
}
```

## Error Messages

All validation functions return user-friendly error messages:

- **Phone:** `"Invalid phone number. Use format: +60 12-345 6789 or 012-345 6789"`
- **Email:** `"Invalid email format"`
- **Number (required):** `"This field is required"`
- **Number (invalid):** `"Invalid number"`
- **Number (min):** `"Minimum value is [min]"`
- **Number (max):** `"Maximum value is [max]"`

## Best Practices

1. **Always validate before submission**
   - Never trust client-side input
   - Backend should also validate (defense in depth)

2. **Use formatted values**
   - Store phone numbers in consistent format
   - Use `validatePhoneNumber().formatted`

3. **Provide clear feedback**
   - Show errors inline below fields
   - Use alert() for form-level errors on submit

4. **Use appropriate input types**
   - `PhoneInput` for phone numbers (mobile keyboard)
   - `NumberInput` for quantities/prices (numeric keyboard)
   - Standard `Input` for text

5. **Set appropriate constraints**
   ```typescript
   // Good: prevents negative stock
   validateNumber(qty, { min: 0, allowDecimal: false })
   
   // Good: prevents unrealistic leave days
   validateNumber(days, { min: 0, max: 365 })
   ```

## Testing Validation

### Manual Testing Checklist

- [ ] Try entering letters in number fields
- [ ] Try entering multiple decimal points
- [ ] Try negative numbers where not allowed
- [ ] Try values below/above min/max
- [ ] Try invalid phone formats
- [ ] Try invalid email formats
- [ ] Test with empty fields (required vs optional)
- [ ] Test formatted output (phone numbers)

### Test Cases

```typescript
// Phone validation
validatePhoneNumber('+60123456789').valid === true
validatePhoneNumber('0123456789').valid === true
validatePhoneNumber('abc').valid === false
validatePhoneNumber('').valid === true // optional

// Number validation
validateNumber('100', { min: 0, max: 200 }).valid === true
validateNumber('-5', { min: 0 }).valid === false
validateNumber('abc', {}).valid === false
validateNumber('12.34', { allowDecimal: false }).valid === false

// Email validation
validateEmail('user@example.com').valid === true
validateEmail('invalid').valid === false
validateEmail('').valid === false
```

## Future Enhancements

Potential improvements for future versions:

1. **Real-time inline validation**
   - Show errors as user types (after blur)
   - Green checkmark for valid fields

2. **More input types**
   - DateInput with date validation
   - CurrencyInput with formatting
   - PercentageInput

3. **Backend validation integration**
   - Match frontend validation rules
   - Return structured validation errors from API

4. **Form-level validation library**
   - Consider react-hook-form or Formik
   - Centralized validation schema (Zod/Yup)

5. **International phone support**
   - Support multiple country codes
   - Auto-detect country from input

## Summary

The validation system provides:

✅ **Comprehensive validation** for phone, email, and numeric fields  
✅ **Reusable components** (`PhoneInput`, `NumberInput`)  
✅ **Real-time input sanitization** (remove invalid characters)  
✅ **User-friendly error messages**  
✅ **Consistent formatting** (phone numbers, currency)  
✅ **Applied across all forms** (Users, Clients, Inventory, Employees, Invoices)

All forms now validate input before submission, ensuring data integrity and better user experience.
