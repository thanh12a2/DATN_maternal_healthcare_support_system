import {
  createPublicKey,
  type KeyObject,
} from 'crypto';
import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decode, verify } from 'jsonwebtoken';
import type { PatientAuthContext, PatientAuthRole } from './auth-context';

const SUPPORTED_ROLES: PatientAuthRole[] = [
  'PATIENT',
  'RECEPTIONIST',
  'DOCTOR',
  'NURSE',
  'ADMIN',
];

type PublicJwk = {
  kty: string;
  kid: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
};

@Injectable()
export class JwtVerifierService {
  private readonly jwksCache = new Map<string, KeyObject>();
  private jwksExpiresAt = 0;
  private refreshPromise?: Promise<void>;

  constructor(private readonly configService: ConfigService) {}

  async verifyAccessToken(accessToken: string): Promise<PatientAuthContext> {
    try {
      const unverified = decode(accessToken, { complete: true });
      const kid = unverified?.header.kid;
      if (!kid || unverified.header.alg !== 'RS256') {
        throw new UnauthorizedException('Invalid access token');
      }

      const key = await this.resolveKey(kid);
      const decoded = verify(accessToken, key, {
        algorithms: ['RS256'],
        issuer: this.getRequiredConfig('AUTH_JWT_ISSUER'),
        audience: this.getRequiredConfig('AUTH_JWT_AUDIENCE'),
        complete: true,
      });
      if (typeof decoded === 'string' || typeof decoded.payload === 'string') {
        throw new UnauthorizedException('Invalid access token');
      }

      const payload = decoded.payload as Record<string, unknown>;
      const userId = payload.sub;
      const tokenId = payload.jti;
      const role = payload.role;
      if (
        typeof userId !== 'string' ||
        typeof tokenId !== 'string' ||
        !this.isSupportedRole(role)
      ) {
        throw new UnauthorizedException('Invalid access token');
      }
      return { userId, role, tokenId };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async resolveKey(kid: string): Promise<KeyObject | string> {
    const configuredKid = this.getRequiredConfig('AUTH_JWT_KEY_ID');
    const staticKey = this.configService.get<string>('AUTH_JWT_PUBLIC_KEY');
    if (kid === configuredKid && staticKey) return this.normalizePem(staticKey);

    const cached = this.jwksCache.get(kid);
    if (cached && Date.now() < this.jwksExpiresAt) return cached;
    await this.refreshJwks();
    const refreshed = this.jwksCache.get(kid);
    if (!refreshed) throw new UnauthorizedException('Invalid access token');
    return refreshed;
  }

  private async refreshJwks(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.loadJwks().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  private async loadJwks(): Promise<void> {
    const inline = this.configService.get<string>('AUTH_JWKS_JSON');
    let document: unknown;
    if (inline) {
      try {
        document = JSON.parse(inline) as unknown;
      } catch {
        throw new InternalServerErrorException('Invalid AUTH_JWKS_JSON');
      }
    } else {
      const url = this.configService.get<string>('AUTH_JWKS_URL');
      if (!url) throw new UnauthorizedException('Invalid access token');
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new InternalServerErrorException('Invalid AUTH_JWKS_URL');
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new InternalServerErrorException('Invalid AUTH_JWKS_URL');
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const response = await fetch(parsed, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });
        if (!response.ok) throw new Error('JWKS request failed');
        document = (await response.json()) as unknown;
      } catch {
        throw new UnauthorizedException('Invalid access token');
      } finally {
        clearTimeout(timeout);
      }
    }

    const keys = this.parseJwks(document);
    this.jwksCache.clear();
    for (const key of keys) {
      this.jwksCache.set(
        key.kid,
        createPublicKey({ key, format: 'jwk' }),
      );
    }
    const configuredTtl = Number(
      this.configService.get<string>('AUTH_JWKS_CACHE_TTL_SECONDS') ?? '300',
    );
    const ttl = Number.isFinite(configuredTtl) && configuredTtl > 0
      ? configuredTtl
      : 300;
    this.jwksExpiresAt = Date.now() + ttl * 1000;
  }

  private parseJwks(value: unknown): PublicJwk[] {
    if (!value || typeof value !== 'object') {
      throw new InternalServerErrorException('Invalid JWKS response');
    }
    const keys = (value as { keys?: unknown }).keys;
    if (!Array.isArray(keys)) {
      throw new InternalServerErrorException('Invalid JWKS response');
    }
    const result = keys.filter((candidate): candidate is PublicJwk => {
      if (!candidate || typeof candidate !== 'object') return false;
      const key = candidate as Record<string, unknown>;
      return (
        key.kty === 'RSA' &&
        typeof key.kid === 'string' &&
        typeof key.n === 'string' &&
        typeof key.e === 'string' &&
        (key.alg === undefined || key.alg === 'RS256') &&
        (key.use === undefined || key.use === 'sig')
      );
    });
    if (!result.length) {
      throw new InternalServerErrorException('Invalid JWKS response');
    }
    return result;
  }

  private isSupportedRole(role: unknown): role is PatientAuthRole {
    return (
      typeof role === 'string' &&
      SUPPORTED_ROLES.includes(role as PatientAuthRole)
    );
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(
        `Missing required configuration: ${key}`,
      );
    }
    return value;
  }

  private normalizePem(value: string): string {
    let normalized = value.trim();
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1);
    }
    return normalized
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  }
}
