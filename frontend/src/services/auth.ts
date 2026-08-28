import type { LoginFormValues, RegisterFormValues } from '../schemas/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

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

interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | T | null;

  if (!response.ok) {
    const rawMessage = (payload as ApiErrorPayload | null)?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(' ') : rawMessage;

    throw new AuthApiError(message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.', response.status);
  }

  return payload as T;
}

export async function login(values: LoginFormValues): Promise<LoginResponse> {
  return requestJson<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
  });
}

export async function register(values: RegisterFormValues): Promise<RegisterResponse> {
  return requestJson<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
  });
}
