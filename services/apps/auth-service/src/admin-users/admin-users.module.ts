import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../security/security.module';
import { TokenModule } from '../tokens/token.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';

@Module({
  imports: [DatabaseModule, SecurityModule, TokenModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, AdminAuthGuard],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
