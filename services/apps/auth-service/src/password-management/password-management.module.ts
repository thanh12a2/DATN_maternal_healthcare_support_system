import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../security/security.module';
import { TokenModule } from '../tokens/token.module';
import { PasswordManagementController } from './password-management.controller';
import { PasswordManagementRepository } from './password-management.repository';
import { PasswordManagementService } from './password-management.service';
import { PasswordResetEmailService } from './password-reset-email.service';
import { PasswordResetTokenService } from './password-reset-token.service';

@Module({
  imports: [DatabaseModule, SecurityModule, TokenModule],
  controllers: [PasswordManagementController],
  providers: [
    PasswordManagementRepository,
    PasswordManagementService,
    PasswordResetEmailService,
    PasswordResetTokenService,
  ],
})
export class PasswordManagementModule {}
