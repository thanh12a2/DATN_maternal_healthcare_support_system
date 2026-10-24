import type { Requester } from './catalog';

export type CatalogStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type MedicalServiceKind =
  | 'CONSULTATION'
  | 'DIAGNOSTIC'
  | 'PROCEDURE'
  | 'PACKAGE'
  | 'VACCINATION'
  | 'OTHER';

export type DoctorRankSelectionPolicy =
  | 'NOT_REQUIRED'
  | 'BASIC_INCLUDED'
  | 'RANK_UPGRADE_ALLOWED';

export type TagGroup =
  | 'AUDIENCE'
  | 'FEATURE'
  | 'LABEL'
  | 'AGE'
  | 'GENDER';

export type PriceStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface BasePriceItem {
  id: string;
  amountMinor: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: PriceStatus;
  version: number;
}

export interface ServiceCategoryItem {
  id: string;
  code: string;
  slug: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string; code: string } | null;
  status: CatalogStatus;
  sortOrder: number;
  servicesCount?: number;
  childrenCount?: number;
  isPrimary?: boolean;
}

export interface CatalogTagItem {
  id: string;
  code: string;
  slug: string;
  name: string;
  group: TagGroup;
  description?: string | null;
  status: CatalogStatus;
  sortOrder: number;
  servicesCount?: number;
}

export interface MedicalServiceItem {
  id: string;
  code: string;
  slug: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  kind: MedicalServiceKind;
  specialtyId?: string | null;
  thumbnailUrl?: string | null;
  durationMinutes?: number | null;
  bookingEnabled: boolean;
  doctorRankSelectionPolicy: DoctorRankSelectionPolicy;
  status: CatalogStatus;
  version: number;
  publishedAt?: string | null;
  categories: ServiceCategoryItem[];
  tags: CatalogTagItem[];
  prices: BasePriceItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DoctorRankSurchargeItem {
  id: string;
  rankCode: string;
  amountMinor: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: PriceStatus;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListAdminServicesParams {
  q?: string;
  kind?: MedicalServiceKind;
  status?: CatalogStatus;
  specialtyId?: string;
  category?: string;
  tag?: string;
  bookingEnabled?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateServicePayload {
  code: string;
  slug?: string;
  name: string;
  summary?: string;
  description?: string;
  kind: MedicalServiceKind;
  specialtyId?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  bookingEnabled?: boolean;
  doctorRankSelectionPolicy?: DoctorRankSelectionPolicy;
  primaryCategoryId?: string;
  categoryIds?: string[];
  tagIds?: string[];
  status?: CatalogStatus;
  initialPriceMinor?: number;
}

export interface UpdateServicePayload {
  code?: string;
  slug?: string;
  name?: string;
  summary?: string;
  description?: string;
  kind?: MedicalServiceKind;
  specialtyId?: string;
  thumbnailUrl?: string;
  durationMinutes?: number;
  bookingEnabled?: boolean;
  doctorRankSelectionPolicy?: DoctorRankSelectionPolicy;
  primaryCategoryId?: string;
  categoryIds?: string[];
  tagIds?: string[];
  status?: CatalogStatus;
}

export interface CreateCategoryPayload {
  code: string;
  slug?: string;
  name: string;
  description?: string;
  parentId?: string;
  status?: CatalogStatus;
  sortOrder?: number;
}

export interface UpdateCategoryPayload {
  code?: string;
  slug?: string;
  name?: string;
  description?: string;
  parentId?: string;
  status?: CatalogStatus;
  sortOrder?: number;
}

export interface CreateTagPayload {
  code: string;
  slug?: string;
  name: string;
  group: TagGroup;
  description?: string;
  status?: CatalogStatus;
  sortOrder?: number;
}

export interface UpdateTagPayload {
  code?: string;
  slug?: string;
  name?: string;
  group?: TagGroup;
  description?: string;
  status?: CatalogStatus;
  sortOrder?: number;
}

export interface ScheduleBasePricePayload {
  amountMinor: number;
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status?: PriceStatus;
}

export interface ScheduleRankSurchargePayload {
  rankCode: string;
  amountMinor: number;
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status?: PriceStatus;
}

function extractData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

// -------------------------------------------------------------
// Dịch vụ Y tế (Medical Services)
// -------------------------------------------------------------

export async function listAdminServices(
  request: Requester,
  params: ListAdminServicesParams = {},
): Promise<{ items: MedicalServiceItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.kind) query.set('kind', params.kind);
  if (params.status) query.set('status', params.status);
  if (params.specialtyId) query.set('specialtyId', params.specialtyId);
  if (params.category) query.set('category', params.category);
  if (params.tag) query.set('tag', params.tag);
  if (params.bookingEnabled !== undefined) query.set('bookingEnabled', String(params.bookingEnabled));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const url = `/api/catalog/admin/services${qs ? `?${qs}` : ''}`;
  const res = await request<{ data: MedicalServiceItem[]; meta?: { total: number } }>(url);
  return {
    items: res.data ?? [],
    total: res.meta?.total ?? res.data?.length ?? 0,
  };
}

export async function getAdminService(
  request: Requester,
  serviceId: string,
): Promise<MedicalServiceItem> {
  const res = await request<{ data: MedicalServiceItem }>(`/api/catalog/admin/services/${serviceId}`);
  return extractData<MedicalServiceItem>(res);
}

export async function createService(
  request: Requester,
  payload: CreateServicePayload,
): Promise<MedicalServiceItem> {
  const res = await request<{ data: MedicalServiceItem }>('/api/catalog/admin/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return extractData<MedicalServiceItem>(res);
}

export async function updateService(
  request: Requester,
  serviceId: string,
  payload: UpdateServicePayload,
): Promise<MedicalServiceItem> {
  const res = await request<{ data: MedicalServiceItem }>(`/api/catalog/admin/services/${serviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return extractData<MedicalServiceItem>(res);
}

export async function deleteService(
  request: Requester,
  serviceId: string,
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/catalog/admin/services/${serviceId}`, {
    method: 'DELETE',
  });
}

export async function activateService(
  request: Requester,
  serviceId: string,
): Promise<MedicalServiceItem> {
  const res = await request<{ data: MedicalServiceItem }>(`/api/catalog/admin/services/${serviceId}/activate`, {
    method: 'POST',
  });
  return extractData<MedicalServiceItem>(res);
}

export async function deactivateService(
  request: Requester,
  serviceId: string,
): Promise<MedicalServiceItem> {
  const res = await request<{ data: MedicalServiceItem }>(`/api/catalog/admin/services/${serviceId}/deactivate`, {
    method: 'POST',
  });
  return extractData<MedicalServiceItem>(res);
}

export async function listServicePrices(
  request: Requester,
  serviceId: string,
): Promise<BasePriceItem[]> {
  const res = await request<{ data: BasePriceItem[] }>(`/api/catalog/admin/services/${serviceId}/prices`);
  return extractData<BasePriceItem[]>(res) ?? [];
}

export async function scheduleBasePrice(
  request: Requester,
  serviceId: string,
  payload: ScheduleBasePricePayload,
): Promise<BasePriceItem> {
  const res = await request<{ data: BasePriceItem }>(`/api/catalog/admin/services/${serviceId}/prices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return extractData<BasePriceItem>(res);
}

export async function cancelPrice(
  request: Requester,
  priceId: string,
): Promise<BasePriceItem> {
  const res = await request<{ data: BasePriceItem }>(`/api/catalog/admin/prices/${priceId}/cancel`, {
    method: 'POST',
  });
  return extractData<BasePriceItem>(res);
}

// -------------------------------------------------------------
// Nhóm Dịch vụ (Categories)
// -------------------------------------------------------------

export async function listAdminCategories(
  request: Requester,
): Promise<ServiceCategoryItem[]> {
  const res = await request<{ data: ServiceCategoryItem[] }>('/api/catalog/admin/categories');
  return extractData<ServiceCategoryItem[]>(res) ?? [];
}

export async function createCategory(
  request: Requester,
  payload: CreateCategoryPayload,
): Promise<ServiceCategoryItem> {
  const res = await request<{ data: ServiceCategoryItem }>('/api/catalog/admin/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return extractData<ServiceCategoryItem>(res);
}

export async function updateCategory(
  request: Requester,
  categoryId: string,
  payload: UpdateCategoryPayload,
): Promise<ServiceCategoryItem> {
  const res = await request<{ data: ServiceCategoryItem }>(`/api/catalog/admin/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return extractData<ServiceCategoryItem>(res);
}

export async function deleteCategory(
  request: Requester,
  categoryId: string,
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/catalog/admin/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

export async function activateCategory(
  request: Requester,
  categoryId: string,
): Promise<ServiceCategoryItem> {
  const res = await request<{ data: ServiceCategoryItem }>(`/api/catalog/admin/categories/${categoryId}/activate`, {
    method: 'POST',
  });
  return extractData<ServiceCategoryItem>(res);
}

export async function deactivateCategory(
  request: Requester,
  categoryId: string,
): Promise<ServiceCategoryItem> {
  const res = await request<{ data: ServiceCategoryItem }>(`/api/catalog/admin/categories/${categoryId}/deactivate`, {
    method: 'POST',
  });
  return extractData<ServiceCategoryItem>(res);
}

// -------------------------------------------------------------
// Thẻ tag (Catalog Tags)
// -------------------------------------------------------------

export async function listAdminTags(
  request: Requester,
): Promise<CatalogTagItem[]> {
  const res = await request<{ data: CatalogTagItem[] }>('/api/catalog/admin/tags');
  return extractData<CatalogTagItem[]>(res) ?? [];
}

export async function createTag(
  request: Requester,
  payload: CreateTagPayload,
): Promise<CatalogTagItem> {
  const res = await request<{ data: CatalogTagItem }>('/api/catalog/admin/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return extractData<CatalogTagItem>(res);
}

export async function updateTag(
  request: Requester,
  tagId: string,
  payload: UpdateTagPayload,
): Promise<CatalogTagItem> {
  const res = await request<{ data: CatalogTagItem }>(`/api/catalog/admin/tags/${tagId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return extractData<CatalogTagItem>(res);
}

export async function deleteTag(
  request: Requester,
  tagId: string,
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/catalog/admin/tags/${tagId}`, {
    method: 'DELETE',
  });
}

export async function activateTag(
  request: Requester,
  tagId: string,
): Promise<CatalogTagItem> {
  const res = await request<{ data: CatalogTagItem }>(`/api/catalog/admin/tags/${tagId}/activate`, {
    method: 'POST',
  });
  return extractData<CatalogTagItem>(res);
}

export async function deactivateTag(
  request: Requester,
  tagId: string,
): Promise<CatalogTagItem> {
  const res = await request<{ data: CatalogTagItem }>(`/api/catalog/admin/tags/${tagId}/deactivate`, {
    method: 'POST',
  });
  return extractData<CatalogTagItem>(res);
}

// -------------------------------------------------------------
// Phụ thu theo Hạng Bác sĩ (Doctor Rank Surcharges)
// -------------------------------------------------------------

export async function listRankSurcharges(
  request: Requester,
): Promise<DoctorRankSurchargeItem[]> {
  const res = await request<{ data: DoctorRankSurchargeItem[] }>('/api/catalog/admin/doctor-rank-surcharges');
  return extractData<DoctorRankSurchargeItem[]>(res) ?? [];
}

export async function scheduleRankSurcharge(
  request: Requester,
  payload: ScheduleRankSurchargePayload,
): Promise<DoctorRankSurchargeItem> {
  const res = await request<{ data: DoctorRankSurchargeItem }>('/api/catalog/admin/doctor-rank-surcharges', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return extractData<DoctorRankSurchargeItem>(res);
}

export async function cancelRankSurcharge(
  request: Requester,
  surchargeId: string,
): Promise<DoctorRankSurchargeItem> {
  const res = await request<{ data: DoctorRankSurchargeItem }>(`/api/catalog/admin/doctor-rank-surcharges/${surchargeId}/cancel`, {
    method: 'POST',
  });
  return extractData<DoctorRankSurchargeItem>(res);
}
