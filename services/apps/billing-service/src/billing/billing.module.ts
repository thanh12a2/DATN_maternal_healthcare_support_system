import { NotificationOutboxService } from './notification-outbox.service';
import { ReceptionWorkRelayService } from './reception-work-relay.service';
import { Module } from '@nestjs/common';
import { ClinicalDoctorAccess } from '@platform';
import { BillingAccessService } from './billing-access.service';
import { BillingController } from './billing.controller';
import { BillingGrpcController } from './billing-grpc.controller';
import { BillingDomainService } from './billing.service';
import { VnpayIpnService } from './vnpay-ipn.service';
import { VnpayGatewayService } from './vnpay-gateway.service';
@Module({
  controllers: [BillingController, BillingGrpcController],
  providers: [
    ClinicalDoctorAccess,
    BillingAccessService,
    BillingDomainService,
    VnpayGatewayService,
    VnpayIpnService,
    NotificationOutboxService,
    ReceptionWorkRelayService,
  ],
  exports: [BillingDomainService],
})
export class BillingModule {}
