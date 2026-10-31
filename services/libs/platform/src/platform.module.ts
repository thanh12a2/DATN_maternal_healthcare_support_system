import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceJwtGuard } from './grpc/service-jwt.guard';
import { ServiceTokenService } from './grpc/service-token.service';
import { GrpcClientFactory } from './grpc/grpc-client.factory';
import { PublicJwtGuard } from './http/public-jwt.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ServiceTokenService, ServiceJwtGuard, GrpcClientFactory, PublicJwtGuard],
  exports: [ServiceTokenService, ServiceJwtGuard, GrpcClientFactory, PublicJwtGuard],
})
export class PlatformModule {}
