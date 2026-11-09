import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceJwtGuard } from './grpc/service-jwt.guard';
import { ServiceTokenService } from './grpc/service-token.service';
import { GrpcClientFactory } from './grpc/grpc-client.factory';
import { PublicJwtGuard } from './http/public-jwt.guard';
import { ReceptionWorkAccess } from './grpc/reception-work-access';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ServiceTokenService, ServiceJwtGuard, GrpcClientFactory, PublicJwtGuard, ReceptionWorkAccess],
  exports: [ServiceTokenService, ServiceJwtGuard, GrpcClientFactory, PublicJwtGuard, ReceptionWorkAccess],
})
export class PlatformModule {}
