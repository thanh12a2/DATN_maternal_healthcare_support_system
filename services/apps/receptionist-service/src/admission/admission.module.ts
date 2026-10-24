import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdmissionController } from './admission.controller';
import { AdmissionGrpcGateway } from './admission-grpc.gateway';
import { AdmissionService } from './admission.service';

@Module({
  imports: [AuthModule, PlatformModule, DatabaseModule],
  controllers: [AdmissionController],
  providers: [AdmissionGrpcGateway, AdmissionService],
  exports: [AdmissionService],
})
export class AdmissionModule {}
