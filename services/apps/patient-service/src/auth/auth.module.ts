import { Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service';
import { PatientAuthGuard } from './patient-auth.guard';

@Module({
  providers: [JwtVerifierService, PatientAuthGuard],
  exports: [JwtVerifierService, PatientAuthGuard],
})
export class AuthModule {}
