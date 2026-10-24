import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { extractBearerToken } from './bearer-token.util';
import type { PatientAuthenticatedRequest } from './auth-context';
import { JwtVerifierService } from './jwt-verifier.service';

@Injectable()
export class PatientAuthGuard implements CanActivate {
  constructor(private readonly jwtVerifierService: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<PatientAuthenticatedRequest>();
    const accessToken = extractBearerToken(request.headers.authorization);
    const authContext = await this.jwtVerifierService.verifyAccessToken(accessToken);

    if (!['PATIENT', 'RECEPTIONIST', 'ADMIN'].includes(authContext.role)) {
      throw new ForbiddenException(
        'Patient, receptionist, or admin role is required',
      );
    }

    request.patientAuth = authContext;
    return true;
  }
}
