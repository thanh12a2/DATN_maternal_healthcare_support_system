import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ReceptionistsController } from './receptionists.controller';
import { ReceptionistsService } from './receptionists.service';
import { ProfileImageModule } from '@platform';

@Module({
  imports: [AuthModule, DatabaseModule, ProfileImageModule],
  controllers: [ReceptionistsController],
  providers: [ReceptionistsService],
  exports: [ReceptionistsService],
})
export class ReceptionistsModule {}
