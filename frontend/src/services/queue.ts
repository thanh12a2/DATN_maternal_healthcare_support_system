import type { Requester } from './catalog';
export interface QueueTicket { ticketCode?: string; stageName?: string; stageCode?: string; roomCode?: string | null; state?: string; [key: string]: unknown; }
export interface QueueJourney { tickets?: QueueTicket[]; [key: string]: unknown; }
export async function getActiveJourney(request: Requester): Promise<QueueJourney | null> { const raw = await request<unknown>('/api/queue/me/journeys/active'); if (raw == null) return null; return ((raw as {data?: QueueJourney})?.data ?? raw) as QueueJourney; }
export function getJourney(request: Requester, id: string) { return request<QueueJourney>('/api/queue/journeys/' + encodeURIComponent(id)); }
export function listActiveStages(request: Requester) { return request<unknown>('/api/queue/stages'); }
