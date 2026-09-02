import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { ReceptionRequest } from '../common/request-context';
import { extractBearerToken } from './bearer-token.util';
import { JwtVerifierService } from './jwt-verifier.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtVerifierService: JwtVerifierService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ReceptionRequest>();
    const accessToken = extractBearerToken(request.headers.authorization);
    request.auth = this.jwtVerifierService.verifyAccessToken(accessToken);
    return true;
  }
}
