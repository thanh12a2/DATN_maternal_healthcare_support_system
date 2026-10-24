import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { DatabaseModule } from './database/database.module';
import { JwksModule } from './jwks/jwks.module';
import { PasswordManagementModule } from './password-management/password-management.module';
import { SecurityModule } from './security/security.module';
import { AuthGrpcModule } from './grpc/auth-grpc.module';
import { AdminUsersModule } from './admin-users/admin-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AdminUsersModule,
    DatabaseModule,
    JwksModule,
    PasswordManagementModule,
    SecurityModule,
    AuthGrpcModule,
  ],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
})
export class AuthServiceModule {}
