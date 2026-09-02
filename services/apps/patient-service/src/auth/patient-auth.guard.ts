import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { extractBearerToken } from './bearer-token.util';
import type { PatientAuthenticatedRequest } from './auth-context';
import { JwtVerifierService } from './jwt-verifier.service';

@Injectable()
export class PatientAuthGuard implements CanActivate {
  constructor(private readonly jwtVerifierService: JwtVerifierService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PatientAuthenticatedRequest>();
    const accessToken = extractBearerToken(request.headers.authorization);
    const authContext = this.jwtVerifierService.verifyAccessToken(accessToken);

    if (authContext.role !== 'PATIENT') {
      throw new ForbiddenException('Patient role is required');
    }

    request.patientAuth = authContext;
    return true;
  }
}
