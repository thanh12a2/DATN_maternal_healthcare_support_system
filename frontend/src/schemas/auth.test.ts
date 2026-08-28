import { describe, expect, it } from 'vitest';
import { validateEmail, validateLogin, validatePassword, validateRegister } from './auth';

describe('auth validation schemas', () => {
  it('validates login contract: email and password only', () => {
    const result = validateLogin({ email: 'patient@example.com', password: 'Password123!' });

    expect(result.email.valid).toBe(true);
    expect(result.password.valid).toBe(true);
    expect(validateLogin({ email: '0901234567', password: 'Password123!' }).email.valid).toBe(false);
  });

  it('validates password length', () => {
    expect(validatePassword('short').valid).toBe(false);
    expect(validatePassword('Password123!').valid).toBe(true);
  });

  it('validates public register contract: email and password only', () => {
    const result = validateRegister({
      email: 'patient@example.com',
      password: 'Password123!',
    });

    expect(Object.values(result).every((field) => field.valid)).toBe(true);
    expect(validateEmail('not-email').valid).toBe(false);
  });
});
