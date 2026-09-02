import { describe, expect, it, jest } from '@jest/globals';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { extractBearerToken } from './bearer-token.util';
import { PatientAuthGuard } from './patient-auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('PatientAuthGuard', () => {
  it('should attach auth context for PATIENT token', async () => {
    const request = { headers: { authorization: 'Bearer valid-token' } };
    const jwtVerifierService = {
      verifyAccessToken: jest.fn(() => ({
        userId: 'account-id',
        role: 'PATIENT',
        tokenId: 'token-id',
      })),
    } as unknown as JwtVerifierService;
    const guard = new PatientAuthGuard(jwtVerifierService);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(jwtVerifierService.verifyAccessToken).toHaveBeenCalledWith(
      'valid-token',
    );
    expect(request).toMatchObject({
      patientAuth: {
        userId: 'account-id',
        role: 'PATIENT',
        tokenId: 'token-id',
      },
    });
  });

  it('should reject missing bearer token', async () => {
    const guard = new PatientAuthGuard({
      verifyAccessToken: jest.fn(),
    } as unknown as JwtVerifierService);

    await expect(guard.canActivate(createContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject unsupported role', async () => {
    const jwtVerifierService = {
      verifyAccessToken: jest.fn(() => ({
        userId: 'account-id',
        role: 'ADMIN',
        tokenId: 'token-id',
      })),
    } as unknown as JwtVerifierService;
    const guard = new PatientAuthGuard(jwtVerifierService);

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Bearer valid-token' } }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('extractBearerToken integration import', () => {
  it('keeps utility import executable', () => {
    expect(extractBearerToken('Bearer token')).toBe('token');
  });
});
