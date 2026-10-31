import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, randomUUID } from 'crypto';
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
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('JwtVerifierService', () => {
  it('verifies a Receptionist token issued by Auth Service', () => {
    const { privateKey, publicKey } = createKeyPair();
    const service = new JwtVerifierService(createConfig(publicKey));
    const tokenId = randomUUID();
    const token = sign({ role: 'RECEPTIONIST' }, privateKey, {
      algorithm: 'RS256',
      issuer: 'maternal-healthcare-auth',
      audience: 'maternal-healthcare-api',
      subject: randomUUID(),
      jwtid: tokenId,
      keyid: 'local-dev-key',
      expiresIn: '15m',
    });

    expect(service.verifyAccessToken(token)).toMatchObject({
      role: 'RECEPTIONIST',
      tokenId,
    });
  });

  it('rejects a token with a different key id', () => {
    const { privateKey, publicKey } = createKeyPair();
    const service = new JwtVerifierService(createConfig(publicKey));
    const token = sign({ role: 'RECEPTIONIST' }, privateKey, {
      algorithm: 'RS256',
      issuer: 'maternal-healthcare-auth',
      audience: 'maternal-healthcare-api',
      subject: randomUUID(),
      jwtid: randomUUID(),
      keyid: 'unexpected-key',
      expiresIn: '15m',
    });

    expect(() => service.verifyAccessToken(token)).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when JWT configuration is incomplete', () => {
    const service = new JwtVerifierService(
      createConfig('', { AUTH_JWT_PUBLIC_KEY: undefined }),
    );
    expect(() => service.verifyAccessToken('not-a-token')).toThrow(
      InternalServerErrorException,
    );
  });
});
