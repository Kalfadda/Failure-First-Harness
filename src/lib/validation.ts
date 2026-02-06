import { z } from 'zod';

// F006: Password strength validation
// Minimum 12 chars, requires mix of character types
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character');

// Common passwords list (subset - in production use full list)
const COMMON_PASSWORDS = new Set([
  'password123456', 'password12345', 'password1234', 'password123',
  'qwerty123456', '123456789012', 'letmein123456', 'welcome12345',
  'admin1234567', 'password!234', 'Password1234', 'Password123!',
  'Qwerty123456', 'iloveyou1234', 'sunshine1234', 'princess1234',
  'football1234', 'baseball1234', 'dragon123456', 'master123456'
]);

// F022: Email validation (prevents injection via malformed input)
const emailSchema = z.string()
  .email('Invalid email address')
  .max(254, 'Email too long')
  .transform(email => email.toLowerCase().trim());

// F022: Username validation (alphanumeric only - prevents injection)
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(64, 'Username too long')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, dashes, and underscores')
  .transform(username => username.toLowerCase().trim());

// F020/F021: MFA code validation
const mfaCodeSchema = z.string()
  .length(6, 'MFA code must be 6 digits')
  .regex(/^\d{6}$/, 'MFA code must be 6 digits');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password too long')
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const mfaSchema = z.object({
  code: mfaCodeSchema
});

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check against schema
  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    errors.push(...result.error.errors.map(e => e.message));
  }

  // F006: Check against common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common');
  }

  // Check for sequential/repeated patterns
  if (/(.)\1{3,}/.test(password)) {
    errors.push('Password cannot contain 4 or more repeated characters');
  }

  if (/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password)) {
    errors.push('Password cannot contain sequential characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// F023: Sanitize output to prevent XSS in error messages
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// F003: Generic error message to prevent username enumeration
export const GENERIC_AUTH_ERROR = 'Invalid email or password';
export const GENERIC_MFA_ERROR = 'Invalid or expired code';
