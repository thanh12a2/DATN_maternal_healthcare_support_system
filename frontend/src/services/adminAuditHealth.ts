import type { Requester } from './catalog';

export interface AuditLogItem {
  id: string;
  eventId: string;
  eventType: string;
  sourceService: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string | null;
  actorType: string;
  action: string;
  result: string;
  patientId?: string | null;
  changedFields: string[];
  sensitivity: string;
  ipAddress: string;
  metadata?: Record<string, any>;
  occurredAt: string;
  ingestedAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogStats {
  totalLogs: number;
  todayLogs: number;
  topActions: { action: string; count: number }[];
}

export interface ServiceHealthStatus {
  id: string;
  name: string;
  displayName: string;
  host: string;
  port: number;
  category: 'core' | 'clinical' | 'operational' | 'support';
  description: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  statusCode?: number;
  responseTimeMs: number;
  lastCheckedAt: string;
  details?: Record<string, any>;
}

export interface SystemHealthOverview {
  overallStatus: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';
  totalServices: number;
  healthyCount: number;
  degradedCount: number;
  downCount: number;
  uptimePercentage: number;
  lastCheckedAt: string;
  services: ServiceHealthStatus[];
}

export interface BackupRecord {
  id: string;
  target: string;
  type: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  sizeBytes: number;
  sizeFormatted: string;
  durationSeconds: number;
  createdAt: string;
  completedAt?: string;
  storageLocation: string;
  checksumSha256: string;
  triggeredBy: string;
}

export interface BackupListResponse {
  items: BackupRecord[];
  lastBackup: BackupRecord | null;
}

export async function fetchAuditLogs(
  request: Requester,
  params: {
    page?: number;
    pageSize?: number;
    action?: string;
    aggregateType?: string;
    sourceService?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  } = {},
): Promise<AuditLogListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.action) query.set('action', params.action);
  if (params.aggregateType) query.set('aggregateType', params.aggregateType);
  if (params.sourceService) query.set('sourceService', params.sourceService);
  if (params.search) query.set('search', params.search);
  if (params.fromDate) query.set('fromDate', params.fromDate);
  if (params.toDate) query.set('toDate', params.toDate);

  const qs = query.toString();
  return request<AuditLogListResponse>(`/api/audit-logs${qs ? `?${qs}` : ''}`);
}

export async function fetchAuditStats(request: Requester): Promise<AuditLogStats> {
  return request<AuditLogStats>('/api/audit-logs/stats');
}

export async function fetchSystemHealth(request: Requester): Promise<SystemHealthOverview> {
  return request<SystemHealthOverview>('/api/audit-logs/system/health');
}

export async function fetchBackupRecords(request: Requester): Promise<BackupListResponse> {
  return request<BackupListResponse>('/api/audit-logs/system/backups');
}

export interface CreateClientAuditLogPayload {
  action: string;
  sourceService: string;
  aggregateType: string;
  aggregateId: string;
  actorId?: string;
  actorType?: string;
  result?: string;
  changedFields?: string[];
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export async function recordClientAuditLog(
  request: Requester,
  payload: CreateClientAuditLogPayload,
): Promise<void> {
  try {
    await request('/api/audit-logs/logs', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        result: payload.result ?? 'SUCCESS',
        actorType: payload.actorType ?? 'ADMIN',
      }),
    });
  } catch {
    // Non-blocking for UI operations
  }
}

export async function triggerNewBackup(
  request: Requester,
  targetType?: string,
  actorEmail?: string,
): Promise<BackupRecord> {
  return request<BackupRecord>('/api/audit-logs/system/backups', {
    method: 'POST',
    body: JSON.stringify({ targetType, actorEmail }),
  });
}
