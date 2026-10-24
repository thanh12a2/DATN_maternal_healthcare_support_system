import type { Requester } from './catalog';

export type UserRole = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE' | 'PATIENT';
export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'PENDING_VERIFICATION';

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAdminUserPayload {
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
}

export interface UpdateAdminUserPayload {
  email?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface QueryUsersParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

import { registerUserBatchToCache, registerUserEmailToCache } from './auditInterceptor';

export async function listAdminUsers(
  request: Requester,
  params: QueryUsersParams = {},
): Promise<AdminUserListResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const path = `/auth/admin/users${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await request<AdminUserListResponse>(path);
  if (response?.items) {
    registerUserBatchToCache(response.items);
  }
  return response;
}

export async function createAdminUser(
  request: Requester,
  body: CreateAdminUserPayload,
): Promise<AdminUser> {
  const res = await request<AdminUser>('/auth/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res?.id && res?.email) {
    registerUserEmailToCache(res.id, res.email);
  }
  return res;
}

export function updateAdminUser(
  request: Requester,
  id: string,
  body: UpdateAdminUserPayload,
  options?: { suppressAudit?: boolean },
): Promise<AdminUser> {
  const query = options?.suppressAudit ? '?suppressAudit=true' : '';
  return request<AdminUser>(`/auth/admin/users/${encodeURIComponent(id)}${query}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAdminUser(
  request: Requester,
  id: string,
  options?: { suppressAudit?: boolean },
): Promise<{ success: boolean; message: string }> {
  const query = options?.suppressAudit ? '?suppressAudit=true' : '';
  return request<{ success: boolean; message: string }>(
    `/auth/admin/users/${encodeURIComponent(id)}${query}`,
    {
      method: 'DELETE',
    },
  );
}

export function getAdminUser(
  request: Requester,
  id: string,
): Promise<AdminUser> {
  return request<AdminUser>(`/auth/admin/users/${encodeURIComponent(id)}`);
}
