import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';
import { validatePatientConfig } from './config/patient-config';
import { PatientDatabaseModule } from './database/patient-database.module';
import { PatientServiceController } from './patient-service.controller';
import { PatientServiceService } from './patient-service.service';
import { PatientsModule } from './patients/patients.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validatePatientConfig }),
    AuthModule,
    PatientDatabaseModule,
    PatientsModule,
  ],
  controllers: [PatientServiceController],
  providers: [PatientServiceService],
})
export class PatientServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
