import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { SecurityModule } from '../security/security.module';
import { TokenModule } from '../tokens/token.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [AccountsModule, SecurityModule, TokenModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
