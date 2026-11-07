import { Injectable, Logger } from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../../../generated/billing-client';
import { BillingPrismaService } from '../database/prisma.service';
import { VnpayGatewayService } from './vnpay-gateway.service';

type IpnReply = {
  RspCode: '00' | '01' | '02' | '04' | '97' | '99';
  Message: string;
};

@Injectable()
export class VnpayIpnService {
  private readonly logger = new Logger(VnpayIpnService.name);

  constructor(
    private readonly db: BillingPrismaService,
    private readonly vnpay: VnpayGatewayService,
  ) {}

  async handle(query: Record<string, unknown>): Promise<IpnReply> {
    const fields = this.vnpay.callbackFields(query);
    if (!fields) return this.reply('99', 'Invalid request');

    try {
      if (
        !this.vnpay.verifyCallbackSignature(fields) ||
        fields.vnp_TmnCode !== this.vnpay.merchantCode()
      ) {
        return this.reply('97', 'Invalid signature');
      }
    } catch {
      return this.reply('99', 'Merchant configuration unavailable');
    }

    if (!/^\d{1,12}$/.test(fields.vnp_Amount ?? ''))
      return this.reply('04', 'Invalid amount');
    if (!fields.vnp_ResponseCode || !fields.vnp_TransactionStatus)
      return this.reply('99', 'Missing transaction result');

    try {
      return await this.db.$transaction(async (tx) => {
        const initial = await tx.paymentAttempt.findUnique({
          where: { txnRef: fields.vnp_TxnRef },
        });
        if (!initial) return this.reply('01', 'Order not found');

        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "public"."invoices" WHERE "id" = ${initial.invoiceId}::uuid FOR UPDATE`,
        );
        const attempt = await tx.paymentAttempt.findUnique({
          where: { id: initial.id },
        });
        if (!attempt) return this.reply('01', 'Order not found');

        const callbackAmount = BigInt(fields.vnp_Amount);
        if (callbackAmount !== attempt.amountMinor * 100n)
          return this.reply('04', 'Invalid amount');

        if (attempt.status === PaymentAttemptStatus.SUCCEEDED)
          return this.reply('02', 'Order already confirmed');
        if (attempt.status === PaymentAttemptStatus.RECONCILIATION_REQUIRED)
          return this.reply('00', 'Result recorded for reconciliation');

        const isSuccess =
          fields.vnp_ResponseCode === '00' &&
          fields.vnp_TransactionStatus === '00';
        if (!isSuccess) {
          const needsReview =
            fields.vnp_ResponseCode === '07' ||
            fields.vnp_TransactionStatus === '07' ||
            fields.vnp_TransactionStatus === '04';
          if (
            attempt.status === PaymentAttemptStatus.PENDING ||
            (needsReview && attempt.status === PaymentAttemptStatus.EXPIRED)
          ) {
            const now = new Date();
            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: {
                status: needsReview
                  ? PaymentAttemptStatus.RECONCILIATION_REQUIRED
                  : fields.vnp_ResponseCode === '24'
                    ? PaymentAttemptStatus.CANCELLED
                    : PaymentAttemptStatus.FAILED,
                responseCode:
                  `${fields.vnp_ResponseCode}/${fields.vnp_TransactionStatus}`.slice(
                    0,
                    10,
                  ),
                gatewayTransactionNo: this.optional(fields.vnp_TransactionNo),
                bankTransactionNo: this.optional(fields.vnp_BankTranNo),
                completedAt: now,
              },
            });
            await tx.billingAuditLog.create({
              data: {
                eventType: needsReview
                  ? 'billing.payment_reconciliation_required.v1'
                  : 'billing.vnpay_attempt_failed.v1',
                actorId: attempt.createdBy,
                invoiceId: attempt.invoiceId,
              },
            });
            if (needsReview) {
              await tx.billingOutboxEvent.create({
                data: {
                  eventType: 'billing.payment_reconciliation_required.v1',
                  aggregateId: attempt.invoiceId,
                  aggregateVersion: 0,
                  payload: {
                    eventVersion: 1,
                    aggregateType: 'invoice',
                    aggregateId: attempt.invoiceId,
                    data: {
                      invoiceId: attempt.invoiceId,
                      paymentAttemptId: attempt.id,
                      reasonCode: 'PROVIDER_DEBIT_OR_RISK_REVIEW',
                    },
                  },
                },
              });
            }
          }
          return this.reply(
            '00',
            needsReview
              ? 'Result recorded for reconciliation'
              : 'Result recorded',
          );
        }

        const invoice = await tx.invoice.findUnique({
          where: { id: attempt.invoiceId },
          include: { payment: true },
        });
        const canSettle =
          (attempt.status === PaymentAttemptStatus.PENDING ||
            attempt.status === PaymentAttemptStatus.EXPIRED) &&
          invoice !== null &&
          !invoice.payment &&
          (invoice.status === InvoiceStatus.OPEN ||
            invoice.status === InvoiceStatus.OUTSTANDING) &&
          invoice.currency.trim() === attempt.currency.trim() &&
          invoice.totalMinor === attempt.amountMinor &&
          invoice.balanceMinor === attempt.amountMinor &&
          invoice.paidMinor === 0n;

        if (!canSettle || !invoice) {
          const now = new Date();
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: PaymentAttemptStatus.RECONCILIATION_REQUIRED,
              responseCode: 'CONFLICT',
              gatewayTransactionNo: this.optional(fields.vnp_TransactionNo),
              bankTransactionNo: this.optional(fields.vnp_BankTranNo),
              completedAt: now,
            },
          });
          await tx.billingAuditLog.create({
            data: {
              eventType: 'billing.payment_reconciliation_required.v1',
              actorId: attempt.createdBy,
              invoiceId: attempt.invoiceId,
            },
          });
          await tx.billingOutboxEvent.create({
            data: {
              eventType: 'billing.payment_reconciliation_required.v1',
              aggregateId: attempt.invoiceId,
              aggregateVersion: invoice?.version ?? 0,
              payload: {
                eventVersion: 1,
                aggregateType: 'invoice',
                aggregateId: attempt.invoiceId,
                data: {
                  invoiceId: attempt.invoiceId,
                  paymentAttemptId: attempt.id,
                  reasonCode: 'INVOICE_STATE_OR_AMOUNT_MISMATCH',
                },
              },
            },
          });
          return this.reply('00', 'Result recorded for reconciliation');
        }

        const now = new Date();
        const paidAt = this.parsePayDate(fields.vnp_PayDate) ?? now;
        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            method: PaymentMethod.VNPAY,
            status: PaymentStatus.VERIFIED,
            amountMinor: attempt.amountMinor,
            currency: attempt.currency,
            receivedAt: paidAt,
            verifiedAt: now,
            reference: attempt.txnRef,
            recordedBy: attempt.createdBy,
          },
        });
        const settled = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidMinor: invoice.totalMinor,
            balanceMinor: 0n,
            paidAt,
            version: { increment: 1 },
          },
        });
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: PaymentAttemptStatus.SUCCEEDED,
            responseCode: fields.vnp_ResponseCode,
            gatewayTransactionNo: this.optional(fields.vnp_TransactionNo),
            bankTransactionNo: this.optional(fields.vnp_BankTranNo),
            completedAt: now,
          },
        });
        await tx.paymentAttempt.updateMany({
          where: {
            invoiceId: invoice.id,
            id: { not: attempt.id },
            status: PaymentAttemptStatus.PENDING,
          },
          data: {
            status: PaymentAttemptStatus.EXPIRED,
            responseCode: 'OTHER_PAID',
            completedAt: now,
          },
        });
        await tx.billingAuditLog.create({
          data: {
            eventType: 'billing.payment_recorded.v1',
            actorId: attempt.createdBy,
            invoiceId: invoice.id,
          },
        });
        await tx.billingOutboxEvent.create({
          data: {
            eventType: 'billing.payment_recorded.v1',
            aggregateId: invoice.id,
            aggregateVersion: settled.version,
            payload: {
              eventVersion: 1,
              aggregateType: 'invoice',
              aggregateId: invoice.id,
              data: {
                invoiceId: invoice.id,
                appointmentId: invoice.appointmentId,
                paymentId: payment.id,
                method: PaymentMethod.VNPAY,
                status: PaymentStatus.VERIFIED,
                amountMinor: attempt.amountMinor.toString(),
                totalMinor: invoice.totalMinor.toString(),
                currency: invoice.currency.trim(),
                paidAt: paidAt.toISOString(),
              },
            },
          },
        });
        return this.reply('00', 'Confirm Success');
      });
    } catch (error) {
      this.logger.error('VNPay IPN persistence failed');
      return this.reply('99', 'System error');
    }
  }

  private optional(value?: string): string | undefined {
    return value ? value.slice(0, 100) : undefined;
  }

  private parsePayDate(value?: string): Date | null {
    if (!value || !/^\d{14}$/.test(value)) return null;
    const date = new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}+07:00`,
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private reply(code: IpnReply['RspCode'], message: string): IpnReply {
    return { RspCode: code, Message: message };
  }
}
