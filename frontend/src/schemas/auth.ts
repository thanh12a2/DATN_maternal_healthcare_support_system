export type AuthMode = 'login' | 'register';

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  email: string;
  password: string;
}

export type FieldState = 'idle' | 'success' | 'error';

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateEmail(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: 'Vui lòng nhập email.' };
  return isEmail(value)
    ? { valid: true, message: 'Email hợp lệ.' }
    : { valid: false, message: 'Email không đúng định dạng.' };
}

export function validatePassword(value: string): ValidationResult {
  return value.length < 8
    ? { valid: false, message: 'Mật khẩu cần ít nhất 8 ký tự.' }
    : { valid: true, message: 'Mật khẩu đủ độ dài.' };
}

export function validateLogin(values: LoginFormValues) {
  return {
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  };
}

export function validateRegister(values: RegisterFormValues) {
  return {
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  };
}

export function hasValidationErrors(results: Record<string, ValidationResult>): boolean {
  return Object.values(results).some((result) => !result.valid);
}
