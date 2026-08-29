import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PatientServiceController } from './patient-service.controller';
import { PatientServiceService } from './patient-service.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
  ],
  controllers: [PatientServiceController],
  providers: [PatientServiceService],
})
export class PatientServiceModule {}
