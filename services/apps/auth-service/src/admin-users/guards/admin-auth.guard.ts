import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRole } from '../../auth/dto/auth-role.enum';
import { AccessTokenService } from '../../tokens/access-token.service';

export interface AdminAuthRequestUser {
  userId: string;
  role: string;
  jti: string;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers['authorization'] as string | undefined;

    if (!authorization) {
      throw new UnauthorizedException('Thiếu bearer token xác thực');
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token không hợp lệ');
    }

    const verified = this.accessTokenService.verifyAccessToken(token);
    if (!verified || verified.role !== AuthRole.Admin) {
      throw new ForbiddenException('Chỉ quản trị viên (ADMIN) mới có quyền truy cập');
    }

    request.user = verified;
    return true;
  }
}
