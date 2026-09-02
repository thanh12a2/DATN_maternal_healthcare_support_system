import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { ReceptionRequest } from '../common/request-context';
import type { AuthContext } from './auth-context';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const auth = context.switchToHttp().getRequest<ReceptionRequest>().auth;
    if (!auth) {
      throw new UnauthorizedException('Missing authentication context');
    }
    return auth;
  },
);
