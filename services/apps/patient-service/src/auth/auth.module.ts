import { Module } from '@nestjs/common';
import { InternalAuthGuard } from './internal-auth.guard';
import { InternalJwtVerifierService } from './internal-jwt-verifier.service';
import { JwtVerifierService } from './jwt-verifier.service';
import { PatientAuthGuard } from './patient-auth.guard';

@Module({
  providers: [
    JwtVerifierService,
    PatientAuthGuard,
    InternalJwtVerifierService,
    InternalAuthGuard,
  ],
  exports: [
    JwtVerifierService,
    PatientAuthGuard,
    InternalJwtVerifierService,
    InternalAuthGuard,
  ],
})
export class AuthModule {}
