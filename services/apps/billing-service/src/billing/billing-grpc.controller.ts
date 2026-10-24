import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  ServiceCallers,
  ServiceJwtGuard,
  ServiceScopes,
  dateToTimestamp,
  timestampToDate,
} from '@platform';
import { BillingDomainService } from './billing.service';

@Controller()
@UseGuards(ServiceJwtGuard)
export class BillingGrpcController {
  constructor(private readonly service: BillingDomainService) {}

  @GrpcMethod('BillingInternalService', 'CreateOrGetBaseInvoice')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('billing:invoice:write')
  async create(request: any) {
    const result: any = await this.service.createOrGetBase(
      request,
      request.context?.idempotencyKey,
    );
    return {
      invoice: this.invoice(result.invoice),
      created: result.created,
      idempotentReplay: result.idempotentReplay,
    };
  }

  @GrpcMethod('BillingInternalService', 'RecordAdmissionPayment')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('billing:payment:write')
  async recordAdmissionPayment(request: any) {
    const result: any = await this.service.recordPayment(
      request.invoiceId,
      {
        method: this.paymentMethod(request.method),
        amountMinor: Number(request.amount?.amountMinor ?? 0),
        receivedAt: timestampToDate(request.receivedAt)?.toISOString() ?? '',
        reference: request.reference || undefined,
        manualTransferReference: request.manualTransferReference || undefined,
        expectedInvoiceVersion: Number(request.expectedInvoiceVersion),
      } as any,
      {
        userId: request.context?.actorAccountId ?? '',
        role: request.context?.actorRole ?? 'RECEPTIONIST',
      } as any,
      request.context?.idempotencyKey,
    );
    return {
      invoice: this.invoice(result.invoice),
      payment: this.payment(result.payment),
      idempotentReplay: false,
    };
  }

  @GrpcMethod('BillingInternalService', 'GetInvoice')
  @ServiceCallers('receptionist-service', 'appointment-service', 'medical-record-service')
  @ServiceScopes('billing:read')
  async get(request: any) {
    return { invoice: this.invoice(await this.service.get(request.invoiceId)) };
  }

  @GrpcMethod('BillingInternalService', 'GetInvoiceByAppointment')
  @ServiceCallers('receptionist-service', 'appointment-service')
  @ServiceScopes('billing:read')
  async byAppointment(request: any) {
    const invoice = await (this.service as any).db.invoice.findFirst({
      where: {
        appointmentId: request.appointmentId,
        type: String(request.type).replace('INVOICE_TYPE_', ''),
      },
      include: { lines: true, payment: true, credits: true },
    });
    return { invoice: invoice ? this.invoice(await this.service.get(invoice.id)) : null };
  }

  @GrpcMethod('BillingInternalService', 'GetAdmissionPaymentCondition')
  @ServiceCallers('receptionist-service', 'appointment-service')
  @ServiceScopes('billing:read')
  condition(request: any) {
    return this.service.condition(request.invoiceId, request.appointmentId);
  }

  @GrpcMethod('BillingInternalService', 'AddPerformedServiceCharge')
  @ServiceCallers('medical-record-service')
  @ServiceScopes('billing:supplementary:write')
  async add(request: any) {
    const result: any = await this.service.addPerformed(
      request,
      request.context?.idempotencyKey,
    );
    return {
      invoice: this.invoice(result.invoice),
      line: this.line(result.line),
      created: result.created,
      idempotentReplay: result.idempotentReplay,
    };
  }

  @GrpcMethod('BillingInternalService', 'FinalizeSupplementaryInvoice')
  @ServiceCallers('medical-record-service')
  @ServiceScopes('billing:supplementary:write')
  async finalize(request: any) {
    const result: any = await this.service.finalizeSupplementary(request);
    return {
      invoice: this.invoice(result.invoice),
      outstandingBalance: result.outstandingBalance,
      clinicalCompletionAllowed: result.clinicalCompletionAllowed,
      idempotentReplay: result.idempotentReplay,
    };
  }

  private invoice(value: any) {
    if (!value) return null;
    return {
      invoiceId: value.invoiceId ?? value.id,
      invoiceNumber: value.invoiceNumber,
      patientId: value.patientId,
      appointmentId: value.appointmentId,
      encounterId: value.encounterId ?? '',
      type: `INVOICE_TYPE_${String(value.type).replace('INVOICE_TYPE_', '')}`,
      status: `INVOICE_STATUS_${String(value.status).replace('INVOICE_STATUS_', '')}`,
      subtotal: this.money(value.subtotalMinor, value.currency),
      total: this.money(value.totalMinor, value.currency),
      paid: this.money(value.paidMinor, value.currency),
      balance: this.money(value.balanceMinor, value.currency),
      sourceVersion: String(value.sourceVersion ?? 0),
      lines: (value.lines ?? []).map((line: any) => this.line(line)),
      payment: this.payment(value.payment),
      creditApprovalId: value.credits?.find((item: any) => item.status === 'APPROVED')?.id ?? '',
      dueAt: dateToTimestamp(value.dueAt),
      paidAt: dateToTimestamp(value.paidAt),
      version: String(value.version ?? 0),
      createdAt: dateToTimestamp(value.createdAt),
      updatedAt: dateToTimestamp(value.updatedAt),
    };
  }

  private line(value: any) {
    if (!value) return null;
    return {
      lineId: value.lineId ?? value.id,
      lineNo: Number(value.lineNo),
      source: `LINE_SOURCE_${String(value.source).replace('LINE_SOURCE_', '')}`,
      sourceReferenceId: value.sourceReferenceId,
      serviceId: value.serviceId,
      descriptionSnapshot: value.descriptionSnapshot,
      quantity: String(value.quantity),
      unitAmount: this.money(value.unitAmountMinor, 'VND'),
      lineAmount: this.money(value.lineAmountMinor, 'VND'),
      priceReferenceId: value.priceReferenceId ?? '',
      performedAt: dateToTimestamp(value.performedAt),
    };
  }

  private payment(value: any) {
    if (!value) return null;
    return {
      paymentId: value.paymentId ?? value.id,
      invoiceId: value.invoiceId,
      method: `PAYMENT_METHOD_${String(value.method).replace('PAYMENT_METHOD_', '')}`,
      status: `PAYMENT_STATUS_${String(value.status).replace('PAYMENT_STATUS_', '')}`,
      amount: this.money(value.amountMinor, 'VND'),
      receivedAt: dateToTimestamp(value.receivedAt),
      verifiedAt: dateToTimestamp(value.verifiedAt),
    };
  }

  private money(amountMinor: unknown, currencyCode = 'VND') {
    return { amountMinor: String(amountMinor ?? 0), currencyCode };
  }

  private paymentMethod(value: unknown) {
    return String(value).replace('PAYMENT_METHOD_', '');
  }
}
