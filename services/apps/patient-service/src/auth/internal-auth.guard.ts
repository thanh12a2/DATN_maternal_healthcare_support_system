import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { extractBearerToken } from './bearer-token.util';
import type { InternalAuthenticatedRequest } from './internal-auth';
import { InternalJwtVerifierService } from './internal-jwt-verifier.service';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly verifier: InternalJwtVerifierService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<InternalAuthenticatedRequest>();
    request.internalAuth = this.verifier.verify(
      extractBearerToken(request.headers.authorization),
    );
    return true;
  }
}
