import { beforeEach, describe, expect, it } from '@jest/globals';
import { generateKeyPairSync } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { AuthRole } from '../auth/dto/auth-role.enum';
import { AccessTokenService } from './access-token.service';
import { AccessTokenClaims } from './access-token.types';

describe('AccessTokenService', () => {
  let accessTokenService: AccessTokenService;
  let publicKey: string;
  let privateKey: string;

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
        AccessTokenService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                AUTH_JWT_PRIVATE_KEY: privateKey,
                AUTH_JWT_PUBLIC_KEY: publicKey,
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

  it('should verify a valid RS256 access token', () => {
    const signedToken = accessTokenService.signAccessToken({
      userId: 'account-id',
      role: AuthRole.Patient,
    });

    expect(accessTokenService.verifyAccessToken(signedToken.accessToken)).toEqual({
      userId: 'account-id',
      role: AuthRole.Patient,
      tokenId: expect.any(String),
    });
  });

  it('should reject invalid access token', () => {
    expect(() => accessTokenService.verifyAccessToken('invalid-token')).toThrow(UnauthorizedException);
  });

  it('should reject token signed with wrong audience', () => {
    const invalidAudienceToken = jwt.sign(
      {
        iss: 'test-issuer',
        aud: 'wrong-audience',
        sub: 'account-id',
        jti: 'token-id',
        role: AuthRole.Patient,
      },
      privateKey,
      {
        algorithm: 'RS256',
        expiresIn: 900,
      },
    );

    expect(() => accessTokenService.verifyAccessToken(invalidAudienceToken)).toThrow(
      UnauthorizedException,
    );
  });
});
