import { beforeEach, describe, expect, it } from '@jest/globals';
import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { AuthRole } from '../auth/dto/auth-role.enum';
import { AccessTokenService } from './access-token.service';
import { AccessTokenClaims } from './access-token.types';

describe('AccessTokenService', () => {
  let accessTokenService: AccessTokenService;
  let publicKey: string;

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

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                AUTH_JWT_PRIVATE_KEY: keyPair.privateKey,
                AUTH_JWT_ISSUER: 'test-issuer',
                AUTH_JWT_AUDIENCE: 'test-audience',
                AUTH_JWT_KEY_ID: 'test-key-id',
                AUTH_ACCESS_TOKEN_TTL_SECONDS: '900',
              })[key],
          },
        },
      ],
    }).compile();

    accessTokenService = moduleRef.get<AccessTokenService>(AccessTokenService);
  });

  it('should sign RS256 access token with minimal auth claims', () => {
    const signedToken = accessTokenService.signAccessToken({
      userId: 'account-id',
      role: AuthRole.Patient,
    });

    expect(signedToken.tokenType).toBe('Bearer');
    expect(signedToken.expiresIn).toBe(900);

    const decoded = jwt.verify(signedToken.accessToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'test-issuer',
      audience: 'test-audience',
    }) as AccessTokenClaims;

    expect(decoded.iss).toBe('test-issuer');
    expect(decoded.aud).toBe('test-audience');
    expect(decoded.sub).toBe('account-id');
    expect(decoded.role).toBe(AuthRole.Patient);
    expect(decoded.jti).toEqual(expect.any(String));
    expect(decoded.iat).toEqual(expect.any(Number));
    expect(decoded.exp - decoded.iat).toBe(900);
    expect(decoded).not.toHaveProperty('password');
    expect(decoded).not.toHaveProperty('refreshToken');
    expect(decoded).not.toHaveProperty('medicalRecord');
  });
});
