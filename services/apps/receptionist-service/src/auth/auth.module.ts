import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { RolesGuard } from './roles.guard';

@Module({
  providers: [JwtVerifierService, JwtAuthGuard, RolesGuard],
  exports: [JwtVerifierService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
