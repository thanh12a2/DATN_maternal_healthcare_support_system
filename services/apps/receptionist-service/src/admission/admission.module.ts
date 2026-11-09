import { Module } from '@nestjs/common';
import { PlatformModule, RabbitMqModule } from '@platform';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdmissionController } from './admission.controller';
import { AdmissionGrpcGateway } from './admission-grpc.gateway';
import { AdmissionService } from './admission.service';
import { ReceptionWorkService } from './reception-work.service';
import { ReceptionWorkController } from './reception-work.controller';
import { ReceptionWorkRelayService } from './reception-work-relay.service';
import { ReceptionWorkGrpcController } from './reception-work-grpc.controller';
import { PaymentCompletedConsumer } from './payment-completed.consumer';

@Module({
  imports: [AuthModule, PlatformModule, RabbitMqModule, DatabaseModule],
  controllers: [AdmissionController, ReceptionWorkController, ReceptionWorkGrpcController],
  providers: [AdmissionGrpcGateway, AdmissionService, ReceptionWorkService, ReceptionWorkRelayService, PaymentCompletedConsumer],
  exports: [AdmissionService],
})
export class AdmissionModule {}
