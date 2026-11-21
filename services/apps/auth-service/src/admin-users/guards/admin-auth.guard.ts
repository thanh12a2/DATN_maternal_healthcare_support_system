import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthRole } from '../../auth/dto/auth-role.enum';
import { AccessTokenService } from '../../tokens/access-token.service';
import { PrismaService } from '../../database/prisma.service';
import { AccountStatus, AuthRoleCode } from '@prisma/client';

export interface AdminAuthRequestUser {
  userId: string;
  role: string;
  tokenId: string;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers['authorization'] as
      string | undefined;

    if (!authorization) {
      throw new UnauthorizedException('Thiếu bearer token xác thực');
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token không hợp lệ');
    }

    const verified = this.accessTokenService.verifyAccessToken(token);
    if (!verified || verified.role !== AuthRole.Admin) {
      throw new ForbiddenException(
        'Chỉ quản trị viên (ADMIN) mới có quyền truy cập',
      );
    }

    const account = await this.prisma.account.findUnique({
      where: { id: verified.userId },
      select: {
        status: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    });
    if (
      !account ||
      account.status !== AccountStatus.ACTIVE ||
      !account.roles.some((item) => item.role.code === AuthRoleCode.ADMIN)
    ) {
      throw new ForbiddenException('Tài khoản quản trị không còn hoạt động');
    }

    request.user = verified;
    return true;
  }
}
