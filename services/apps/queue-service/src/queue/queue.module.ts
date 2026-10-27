import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueGrpcController } from './queue-grpc.controller';
import { QueueDomainService } from './queue.service';
import { PatientDependencyGateway } from './patient-dependency.gateway';
@Module({
  controllers: [QueueController, QueueGrpcController],
  providers: [QueueDomainService, PatientDependencyGateway],
  exports: [QueueDomainService],
})
export class QueueModule {}
