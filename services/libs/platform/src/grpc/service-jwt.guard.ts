import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_GRPC_KEY, SERVICE_CALLERS_KEY, SERVICE_SCOPES_KEY } from './service-auth.decorators';
import { callMetadata, metadataValue, type AuthenticatedGrpcCall } from './grpc-context';
import { ServiceTokenService } from './service-token.service';

@Injectable()
export class ServiceJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: ServiceTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_GRPC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    if (context.getType() !== 'rpc') throw new UnauthorizedException('Service auth is gRPC-only');
    const call = context.switchToRpc().getContext<AuthenticatedGrpcCall>();
    const metadata = callMetadata(call);
    const parts = metadataValue(metadata, 'authorization')?.split(' ') ?? [];
    if (parts[0] !== 'Bearer' || !parts[1]) throw new UnauthorizedException('Missing internal bearer token');
    const auth = this.tokens.verify(parts[1]);
    const callers = this.reflector.getAllAndOverride<string[]>(SERVICE_CALLERS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const scopes = this.reflector.getAllAndOverride<string[]>(SERVICE_SCOPES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (callers.length && !callers.includes(auth.serviceId)) throw new ForbiddenException('Internal caller is not allowed');
    if (scopes.some((scope) => !auth.scopes.includes(scope))) throw new ForbiddenException('Internal scope is missing');
    call.serviceAuth = auth;
    return true;
  }
}
