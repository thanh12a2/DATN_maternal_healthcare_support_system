import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingGrpcController } from './billing-grpc.controller';
import { BillingDomainService } from './billing.service';
import { VnpayIpnService } from './vnpay-ipn.service';
import { VnpayGatewayService } from './vnpay-gateway.service';
@Module({
  controllers: [BillingController, BillingGrpcController],
  providers: [BillingDomainService, VnpayGatewayService, VnpayIpnService],
  exports: [BillingDomainService],
})
export class BillingModule {}
