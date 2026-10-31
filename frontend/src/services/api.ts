const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

interface ErrorPayload {
  message?: string | string[];
  error?: string | { code?: string; message?: string; requestId?: string };
  statusCode?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  const payload = (contentType.includes('text/') || contentType.includes('csv'))
    ? await response.text()
    : await response.json().catch(() => null) as ErrorPayload | T | null;
  if (!response.ok) {
    const body = payload as ErrorPayload | null;
    const nested = typeof body?.error === 'object' ? body.error : undefined;
    const rawMessage = nested?.message ?? body?.message;
    const details = (nested as any)?.details;
    let message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;
    if (Array.isArray(details) && details.length > 0) {
      message = details.join('; ');
    }
    throw new ApiError(
      message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      response.status,
      nested?.code ?? (typeof body?.error === 'string' ? body.error : undefined),
      nested?.requestId,
    );
  }
  return payload as T;
}
