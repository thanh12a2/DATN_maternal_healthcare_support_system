import { describe, expect, it } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, generateKeyPairSync, randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { JwtVerifierService } from './jwt-verifier.service';

function createKeyPair() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function createConfig(
  publicKey: string,
  overrides: Record<string, string | undefined> = {},
) {
  const values: Record<string, string | undefined> = {
    AUTH_JWT_PUBLIC_KEY: publicKey,
    AUTH_JWT_ISSUER: 'maternal-healthcare-auth',
    AUTH_JWT_AUDIENCE: 'maternal-healthcare-api',
    AUTH_JWT_KEY_ID: 'local-dev-key',
    ...overrides,
  };

  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('JwtVerifierService', () => {
  it('should verify valid RS256 access token and return auth context', async () => {
    const { privateKey, publicKey } = createKeyPair();
    const service = new JwtVerifierService(createConfig(publicKey));
    const tokenId = randomUUID();
    const token = sign({ role: 'PATIENT' }, privateKey, {
      algorithm: 'RS256',
      issuer: 'maternal-healthcare-auth',
      audience: 'maternal-healthcare-api',
      subject: 'account-id',
      jwtid: tokenId,
      keyid: 'local-dev-key',
      expiresIn: '15m',
    });

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      userId: 'account-id',
      role: 'PATIENT',
      tokenId,
    });
  });

  it('should reject token with wrong audience', async () => {
    const { privateKey, publicKey } = createKeyPair();
    const service = new JwtVerifierService(createConfig(publicKey));
    const token = sign({ role: 'PATIENT' }, privateKey, {
      algorithm: 'RS256',
      issuer: 'maternal-healthcare-auth',
      audience: 'other-api',
      subject: 'account-id',
      jwtid: randomUUID(),
      keyid: 'local-dev-key',
      expiresIn: '15m',
    });

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject token with wrong key id', async () => {
    const { privateKey, publicKey } = createKeyPair();
    const service = new JwtVerifierService(createConfig(publicKey));
    const token = sign({ role: 'PATIENT' }, privateKey, {
      algorithm: 'RS256',
      issuer: 'maternal-healthcare-auth',
      audience: 'maternal-healthcare-api',
      subject: 'account-id',
      jwtid: randomUUID(),
      keyid: 'different-key',
      expiresIn: '15m',
    });

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject token without supported role, subject, or jti', async () => {
    const { privateKey, publicKey } = createKeyPair();
    const service = new JwtVerifierService(createConfig(publicKey));
    const token = sign({ role: 'UNKNOWN' }, privateKey, {
      algorithm: 'RS256',
      issuer: 'maternal-healthcare-auth',
      audience: 'maternal-healthcare-api',
      subject: 'account-id',
      jwtid: randomUUID(),
      keyid: 'local-dev-key',
      expiresIn: '15m',
    });

    await expect(service.verifyAccessToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });


  it('refreshes an inline JWKS for a rotated unknown kid', async () => {
    const { privateKey, publicKey } = createKeyPair();
    const jwk = createPublicKey(publicKey).export({ format: 'jwk' });
    const service = new JwtVerifierService(
      createConfig('', {
        AUTH_JWT_KEY_ID: 'old-key',
        AUTH_JWKS_JSON: JSON.stringify({
          keys: [{ ...jwk, kid: 'new-key', alg: 'RS256', use: 'sig' }],
        }),
      }),
    );
    const token = sign({ role: 'PATIENT' }, privateKey, {
      algorithm: 'RS256', issuer: 'maternal-healthcare-auth', audience: 'maternal-healthcare-api',
      subject: 'account-id', jwtid: randomUUID(), keyid: 'new-key', expiresIn: '5m',
    });
    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      userId: 'account-id', role: 'PATIENT',
    });
  });

  it('should fail when public key config is missing', async () => {
    const service = new JwtVerifierService(
      createConfig('', { AUTH_JWT_PUBLIC_KEY: undefined }),
    );

    await expect(service.verifyAccessToken('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
