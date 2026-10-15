import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueGrpcController } from './queue-grpc.controller';
import { QueueDomainService } from './queue.service';
@Module({
  controllers: [QueueController, QueueGrpcController],
  providers: [QueueDomainService],
  exports: [QueueDomainService],
})
export class QueueModule {}
