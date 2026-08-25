export type AuthMode = 'login' | 'register';

export type Gender = 'Nam' | 'Nữ' | 'Khác' | 'Không muốn cung cấp' | '';

export interface LoginFormValues {
  identity: string;
  password: string;
  remember: boolean;
}

export interface RegisterFormValues {
  fullName: string;
  birthDate: string;
  phone: string;
  gender: Gender;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

export type FieldState = 'idle' | 'success' | 'error';

export interface ValidationResult {
  valid: boolean;
  message: string;
}

const successMessages = {
  identity: 'Thông tin đăng nhập hợp lệ.',
  fullName: 'Họ và tên hợp lệ.',
  birthDate: 'Ngày sinh hợp lệ.',
  phone: 'Số điện thoại hợp lệ.',
  gender: 'Đã chọn giới tính.',
  email: 'Email hợp lệ.',
  password: 'Mật khẩu đủ độ dài.',
  confirmPassword: 'Mật khẩu trùng khớp.',
  terms: 'Đã đồng ý điều khoản.',
};

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isVietnamesePhone(value: string): boolean {
  return /^(?:\+?84|0)(?:\s?\d){9,10}$/.test(value.trim().replace(/[.-]/g, ''));
}

export function validateIdentity(value: string): ValidationResult {
  const clean = value.trim();
  if (!clean) return { valid: false, message: 'Vui lòng nhập số điện thoại hoặc email.' };
  if (!isEmail(clean) && !isVietnamesePhone(clean)) {
    return { valid: false, message: 'Email hoặc số điện thoại chưa đúng định dạng.' };
  }
  return { valid: true, message: successMessages.identity };
}

export function validateFullName(value: string): ValidationResult {
  return value.trim().length < 2
    ? { valid: false, message: 'Vui lòng nhập đầy đủ họ và tên.' }
    : { valid: true, message: successMessages.fullName };
}

export function validateBirthDate(value: string): ValidationResult {
  if (!value) return { valid: false, message: 'Vui lòng chọn ngày sinh.' };
  return new Date(value) >= new Date()
    ? { valid: false, message: 'Ngày sinh phải trước ngày hiện tại.' }
    : { valid: true, message: successMessages.birthDate };
}

export function validatePhone(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: 'Vui lòng nhập số điện thoại.' };
  return isVietnamesePhone(value)
    ? { valid: true, message: successMessages.phone }
    : { valid: false, message: 'Số điện thoại chưa đúng định dạng.' };
}

export function validateGender(value: Gender): ValidationResult {
  return value
    ? { valid: true, message: successMessages.gender }
    : { valid: false, message: 'Vui lòng chọn giới tính.' };
}

export function validateEmail(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: 'Vui lòng nhập email.' };
  return isEmail(value)
    ? { valid: true, message: successMessages.email }
    : { valid: false, message: 'Email không đúng định dạng.' };
}

export function validatePassword(value: string): ValidationResult {
  return value.length < 8
    ? { valid: false, message: 'Mật khẩu cần ít nhất 8 ký tự.' }
    : { valid: true, message: successMessages.password };
}

export function validateConfirmPassword(value: string, password: string): ValidationResult {
  if (!value) return { valid: false, message: 'Vui lòng xác nhận mật khẩu.' };
  return value === password
    ? { valid: true, message: successMessages.confirmPassword }
    : { valid: false, message: 'Mật khẩu xác nhận chưa trùng khớp.' };
}

export function validateTerms(value: boolean): ValidationResult {
  return value
    ? { valid: true, message: successMessages.terms }
    : { valid: false, message: 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật.' };
}

export function validateLogin(values: LoginFormValues) {
  return {
    identity: validateIdentity(values.identity),
    password: validatePassword(values.password),
  };
}

export function validateRegister(values: RegisterFormValues) {
  return {
    fullName: validateFullName(values.fullName),
    birthDate: validateBirthDate(values.birthDate),
    phone: validatePhone(values.phone),
    gender: validateGender(values.gender),
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    confirmPassword: validateConfirmPassword(values.confirmPassword, values.password),
    terms: validateTerms(values.terms),
  };
}

export function hasValidationErrors(results: Record<string, ValidationResult>): boolean {
  return Object.values(results).some((result) => !result.valid);
}
