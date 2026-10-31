import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NationalIdCryptoService } from '../security/national-id-crypto.service';
import { InternalPatientsController } from './internal-patients.controller';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [AuthModule],
  // Deprecated compatibility route; it is never exposed through Kong.
  // New callers must use PatientInternalService gRPC.
  controllers: [PatientsController, InternalPatientsController],
  providers: [PatientsService, NationalIdCryptoService],
  exports: [PatientsService],
})
export class PatientsModule {}
