import type { Metadata, ServerUnaryCall } from '@grpc/grpc-js';

export interface ServiceAuthContext {
  serviceId: string;
  scopes: string[];
  tokenId: string;
  audience: string | string[];
}

export interface GrpcRequestContext {
  requestId?: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  actorAccountId?: string;
  actorRole?: string;
}

export type AuthenticatedGrpcCall = ServerUnaryCall<unknown, unknown> & {
  serviceAuth?: ServiceAuthContext;
};

export function callMetadata(context: unknown): Metadata {
  if (context && typeof context === 'object' && 'metadata' in context) {
    return (context as { metadata: Metadata }).metadata;
  }
  return context as Metadata;
}

export function metadataValue(metadata: Metadata, key: string): string | undefined {
  const value = metadata.get(key)[0];
  return typeof value === 'string' ? value : value?.toString('utf8');
}

export function timestampToDate(value?: { seconds?: string | number; nanos?: number } | null): Date | undefined {
  if (value?.seconds === undefined) return undefined;
  return new Date(Number(value.seconds) * 1000 + Math.floor((value.nanos ?? 0) / 1_000_000));
}

export function dateToTimestamp(value?: Date | null): { seconds: string; nanos: number } | undefined {
  if (!value) return undefined;
  return { seconds: Math.floor(value.getTime() / 1000).toString(), nanos: (value.getTime() % 1000) * 1_000_000 };
}
