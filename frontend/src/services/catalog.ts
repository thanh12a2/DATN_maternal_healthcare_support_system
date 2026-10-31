export interface CatalogCategory { id?: string; code?: string; slug?: string; name?: string; description?: string; isPrimary?: boolean; [key: string]: unknown; }
export interface CatalogPrice { id?: string; amountMinor?: number; currency?: string; status?: string; [key: string]: unknown; }
export interface CatalogService { id?: string; slug?: string; name?: string; displayName?: string; summary?: string; description?: string; kind?: string; thumbnailUrl?: string; durationMinutes?: number; bookingEnabled?: boolean; categories?: CatalogCategory[]; tags?: Array<Record<string, unknown>>; prices?: CatalogPrice[]; [key: string]: unknown; }
export type Requester = <T>(path: string, init?: RequestInit) => Promise<T>;
function items<T>(raw: unknown): T[] { if (Array.isArray(raw)) return raw as T[]; const v = raw as {data?: unknown; items?: unknown}; return Array.isArray(v?.data) ? v.data as T[] : Array.isArray(v?.items) ? v.items as T[] : []; }
export async function listCatalogServices(request: Requester): Promise<CatalogService[]> { return items<CatalogService>(await request<unknown>('/api/catalog/services')); }
export async function getCatalogService(request: Requester, idOrSlug: string): Promise<CatalogService> {
  const raw = await request<unknown>('/api/catalog/services/' + encodeURIComponent(idOrSlug));
  const value = raw as { data?: unknown };
  return (value?.data ?? raw) as CatalogService;
}
export async function listCatalogCategories(request: Requester): Promise<Array<{ id?: string; name?: string; slug?: string }>> { return items(await request<unknown>('/api/catalog/categories')); }
export async function listCatalogFilters(request: Requester): Promise<unknown[]> { return items(await request<unknown>('/api/catalog/filters')); }
