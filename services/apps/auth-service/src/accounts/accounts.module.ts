import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AccountsRepository } from './accounts.repository';

@Module({
  imports: [DatabaseModule],
  providers: [AccountsRepository],
  exports: [AccountsRepository],
})
export class AccountsModule {}
