import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuthServiceController } from './auth-service.controller';
import { AuthServiceService } from './auth-service.service';
import { DatabaseModule } from './database/database.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, DatabaseModule, SecurityModule],
  controllers: [AuthServiceController],
  providers: [AuthServiceService],
})
export class AuthServiceModule {}
