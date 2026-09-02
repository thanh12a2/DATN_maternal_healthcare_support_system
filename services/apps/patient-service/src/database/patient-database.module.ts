import { Global, Module } from '@nestjs/common';
import { PatientDatabaseService } from './patient-database.service';
@Global()
@Module({
  providers: [PatientDatabaseService],
  exports: [PatientDatabaseService],
})
export class PatientDatabaseModule {}
