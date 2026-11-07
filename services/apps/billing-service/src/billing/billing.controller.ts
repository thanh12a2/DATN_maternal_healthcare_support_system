import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentAuth,
  PublicHttp,
  PublicJwtGuard,
  type PublicAuthContext,
} from '@platform';
import { BillingDomainService } from './billing.service';
import { VnpayIpnService } from './vnpay-ipn.service';
import {
  CancelInvoiceDto,
  CreateVnpayAttemptDto,
  CreditDto,
  InvoiceListDto,
  RecordPaymentDto,
  ReasonInvoiceVersionDto,
  RevokeCreditDto,
  VerifyPaymentDto,
} from './dto';
@Controller()
@UseGuards(PublicJwtGuard)
export class BillingController {
  constructor(
    private readonly s: BillingDomainService,
    private readonly vnpayIpn: VnpayIpnService,
  ) {}
  @PublicHttp() @Get('ipn') ipn(@Query() q: Record<string, unknown>) {
    return this.vnpayIpn.handle(q);
  }
  @PublicHttp() @Get('return') vnpayReturn(@Query() q: Record<string, unknown>) {
    // VNPay may send a signed browser return for a canceled payment without
    // sending an IPN. Process the same signed result so the pending attempt is
    // closed and another attempt can be created for this invoice.
    return this.vnpayIpn.handle(q);
  }
  @Get('invoices') list(
    @Query() q: InvoiceListDto,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.list(q, a);
  }
  @Get('invoices/:id') get(
    @Param('id') id: string,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.get(id, a);
  }
  @Post('invoices/:id/payments') pay(
    @Param('id') id: string,
    @Body() d: RecordPaymentDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.s.recordPayment(id, d, a, k);
  }
  @Post('invoices/:id/vnpay-attempts') createVnpayAttempt(
    @Param('id') id: string,
    @Body() d: CreateVnpayAttemptDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k: string | undefined,
    @Ip() ip: string,
  ) {
    return this.s.createVnpayAttempt(id, d, a, k, ip);
  }
  @Post('payments/:id/verify') verify(
    @Param('id') id: string,
    @Body() d: VerifyPaymentDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.s.decideTransfer(id, true, d, a, k);
  }
  @Post('payments/:id/reject') reject(
    @Param('id') id: string,
    @Body() d: ReasonInvoiceVersionDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.s.decideTransfer(id, false, d, a, k);
  }
  @Post('invoices/:id/credit-approvals') credit(
    @Param('id') id: string,
    @Body() d: CreditDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.s.approveCredit(id, d, a, k);
  }
  @Post('invoices/:id/credit-approvals/:creditId/revoke') revoke(
    @Param('id') id: string,
    @Param('creditId') c: string,
    @Body() d: RevokeCreditDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.s.revokeCredit(id, c, d, a, k);
  }
  @Post('invoices/:id/cancel') cancel(
    @Param('id') id: string,
    @Body() d: CancelInvoiceDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.s.cancel(id, d, a, k);
  }
}
