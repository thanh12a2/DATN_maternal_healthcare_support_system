import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const configured = this.config.get<string>('INTERNAL_SERVICE_AUTH_SECRET');
    const provided = request.headers['x-internal-service-secret'];
    const value = Array.isArray(provided) ? provided[0] : provided;
    if (!configured || value !== configured) throw new UnauthorizedException('UNAUTHENTICATED');
    return true;
  }
}
