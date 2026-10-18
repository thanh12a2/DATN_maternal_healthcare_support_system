import type { Requester } from './catalog';

export interface DocumentRecord { id?: string; fileName?: string; contentType?: string; status?: string; [key: string]: unknown; }
export interface UploadSession { id?: string; uploadUrl?: string; [key: string]: unknown; }

export function createUploadSession(request: Requester, body: unknown) { return request<UploadSession>('/api/documents/uploads', { method: 'POST', body: JSON.stringify(body) }); }
export function completeUpload(request: Requester, sessionId: string, body?: unknown) { return request<DocumentRecord>(`/api/documents/uploads/${encodeURIComponent(sessionId)}/complete`, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
export function getDocument(request: Requester, id: string) { return request<DocumentRecord>(`/api/documents/${encodeURIComponent(id)}`); }
export function createDownloadUrl(request: Requester, id: string) { return request<{ url?: string; downloadUrl?: string }>(`/api/documents/${encodeURIComponent(id)}/download`); }
export function archiveDocument(request: Requester, id: string, body?: unknown) { return request<void>(`/api/documents/${encodeURIComponent(id)}/archive`, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
