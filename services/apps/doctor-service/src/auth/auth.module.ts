import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [
    AuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
  exports: [AuthGuard, RolesGuard],
})
export class DoctorAuthModule {}
