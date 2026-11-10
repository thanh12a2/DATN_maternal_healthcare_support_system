import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Ip,
  NotFoundException,
  Optional,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentAuth,
  PublicHttp,
  PublicJwtGuard,
  ReceptionWorkAccess,
  type PublicAuthContext,
} from '@platform';
import { BillingPrismaService } from '../database/prisma.service';
import { BillingAccessService } from './billing-access.service';
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
    private readonly db: BillingPrismaService,
    private readonly work: ReceptionWorkAccess,
    @Optional() private readonly access?: BillingAccessService,
  ) {}

  private async invoiceAction<T>(
    id: string,
    auth: PublicAuthContext,
    action: () => Promise<T>,
  ) {
    const invoice = await this.db.invoice.findUnique({
      where: { id },
      select: {
        appointmentId: true,
        encounterId: true,
        patientId: true,
        type: true,
      },
    });
    if (!invoice) throw new NotFoundException('INVOICE_NOT_FOUND');
    if (auth.role === 'DOCTOR') {
      if (invoice.type !== 'SUPPLEMENTARY' || !this.access)
        throw new ForbiddenException('FORBIDDEN');
      await this.access.assertDoctorInvoice(auth, invoice);
      return action();
    }
    return invoice.appointmentId
      ? this.work.run(invoice.appointmentId, auth.userId, action)
      : action();
  }
  private async paymentAction<T>(
    id: string,
    auth: PublicAuthContext,
    action: () => Promise<T>,
  ) {
    const payment = await this.db.payment.findUnique({
      where: { id },
      select: { invoiceId: true },
    });
    if (!payment) throw new NotFoundException('PAYMENT_NOT_FOUND');
    return this.invoiceAction(payment.invoiceId, auth, action);
  }
  @PublicHttp() @Get('ipn') ipn(@Query() q: Record<string, unknown>) {
    return this.vnpayIpn.handle(q);
  }
  @PublicHttp() @Get('return') vnpayReturn(
    @Query() q: Record<string, unknown>,
  ) {
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
  @Post('invoices/service-order') addServiceOrder(
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.addServiceOrderCharge(b, a);
  }
  @Delete('invoices/service-order/:orderId') removeServiceOrder(
    @Param('orderId') orderId: string,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.removeServiceOrderCharge(orderId, a);
  }
  @Post('invoices/:id/payments') pay(
    @Param('id') id: string,
    @Body() d: RecordPaymentDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.invoiceAction(id, a, () => this.s.recordPayment(id, d, a, k));
  }
  @Post('invoices/:id/vnpay-attempts') createVnpayAttempt(
    @Param('id') id: string,
    @Body() d: CreateVnpayAttemptDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k: string | undefined,
    @Ip() ip: string,
  ) {
    return this.invoiceAction(id, a, () =>
      this.s.createVnpayAttempt(id, d, a, k, ip),
    );
  }
  @Post('payments/:id/verify') verify(
    @Param('id') id: string,
    @Body() d: VerifyPaymentDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.paymentAction(id, a, () =>
      this.s.decideTransfer(id, true, d, a, k),
    );
  }
  @Post('payments/:id/reject') reject(
    @Param('id') id: string,
    @Body() d: ReasonInvoiceVersionDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.paymentAction(id, a, () =>
      this.s.decideTransfer(id, false, d, a, k),
    );
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
