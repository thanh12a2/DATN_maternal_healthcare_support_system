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
import { EmailVerificationModule } from './email-verification/email-verification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    DatabaseModule,
    JwksModule,
    PasswordManagementModule,
    SecurityModule,
    AuthGrpcModule,
    EmailVerificationModule,
  ],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
})
export class AuthServiceModule {}
