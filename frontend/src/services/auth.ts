import type { LoginFormValues, RegisterFormValues } from '../schemas/auth';
import { apiRequest, ApiError } from './api';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface RegisterResponse {
  user: AuthUser;
}
export interface MeResponse {
  user: AuthUser;
}

export { ApiError as AuthApiError };

export function login(values: LoginFormValues): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
  });
}

export function register(
  values: RegisterFormValues,
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
  });
}

export function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<void> {
  return apiRequest<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function getCurrentUser(accessToken: string): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me', {}, accessToken);
}

export function refresh(refreshToken: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function logout(refreshToken: string): Promise<void> {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
