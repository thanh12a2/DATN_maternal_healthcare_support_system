import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DoctorAuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DoctorServiceController } from './doctor-service.controller';
import { DoctorServiceService } from './doctor-service.service';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { DoctorsModule } from './doctors/doctors.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    DoctorAuthModule,
    DoctorsModule,
  ],
  controllers: [DoctorServiceController],
  providers: [DoctorServiceService],
})
export class DoctorServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
