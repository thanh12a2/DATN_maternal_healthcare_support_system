import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ReceptionRequest } from '../common/request-context';
import type { AuthRole } from './auth-context';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AuthRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ReceptionRequest>();
    if (!request.auth || !roles.includes(request.auth.role)) {
      throw new ForbiddenException(
        'The authenticated role cannot perform this action',
      );
    }
    return true;
  }
}
