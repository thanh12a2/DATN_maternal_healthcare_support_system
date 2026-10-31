import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RefreshTokenService } from './refresh-token.service';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

@Module({
  imports: [DatabaseModule],
  providers: [RefreshTokenService, SessionsRepository, SessionsService],
  exports: [RefreshTokenService, SessionsService],
})
export class SessionsModule {}
