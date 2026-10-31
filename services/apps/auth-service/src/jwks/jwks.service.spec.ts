import { beforeEach, describe, expect, it } from '@jest/globals';
import { generateKeyPairSync } from 'crypto';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwksService } from './jwks.service';

describe('JwksService', () => {
  let publicKey: string;
  let privateKey: string;
  let jwksService: JwksService;

  beforeEach(async () => {
    const keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        JwksService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                AUTH_JWT_PUBLIC_KEY: publicKey,
                AUTH_JWT_PRIVATE_KEY: privateKey,
                AUTH_JWT_KEY_ID: 'test-key-id',
              })[key],
          },
        },
      ],
    }).compile();

    jwksService = moduleRef.get<JwksService>(JwksService);
  });

  it('should expose public JWKS with kid, alg and use', () => {
    const jwks = jwksService.getJwks();

    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toEqual(
      expect.objectContaining({
        kty: 'RSA',
        kid: 'test-key-id',
        alg: 'RS256',
        use: 'sig',
        n: expect.any(String),
        e: expect.any(String),
      }),
    );
  });

  it('should not expose private key material', () => {
    const jwks = jwksService.getJwks();
    const serializedJwks = JSON.stringify(jwks);

    expect(jwks.keys[0]).not.toHaveProperty('d');
    expect(jwks.keys[0]).not.toHaveProperty('p');
    expect(jwks.keys[0]).not.toHaveProperty('q');
    expect(jwks.keys[0]).not.toHaveProperty('dp');
    expect(jwks.keys[0]).not.toHaveProperty('dq');
    expect(jwks.keys[0]).not.toHaveProperty('qi');
    expect(serializedJwks).not.toContain('PRIVATE KEY');
    expect(serializedJwks).not.toContain(privateKey);
  });

  it('should throw when public key config is missing', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwksService,
        {
          provide: ConfigService,
          useValue: { get: () => undefined },
        },
      ],
    }).compile();

    const service = moduleRef.get<JwksService>(JwksService);

    expect(() => service.getJwks()).toThrow(InternalServerErrorException);
  });
});
