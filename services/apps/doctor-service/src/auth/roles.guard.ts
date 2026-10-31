import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest, DoctorRole } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<DoctorRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const identity = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().identity;
    if (!identity || !roles.includes(identity.role))
      throw new ForbiddenException('FORBIDDEN');
    return true;
  }
}
