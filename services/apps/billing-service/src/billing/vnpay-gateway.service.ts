import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingDomainException } from '../common/domain.exception';

interface CreateVnpayUrlInput {
  txnRef: string;
  invoiceNumber: string;
  amountMinor: bigint;
  clientIp: string;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class VnpayGatewayService {
  constructor(private readonly config: ConfigService) {}

  expiryMinutes(): number {
    const minutes = Number(this.config.get<string>('VNPAY_EXPIRE_MINUTES', '15'));
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 30) {
      this.fail('VNPAY_CONFIGURATION_INVALID', 'VNPay expiry must be between 5 and 30 minutes');
    }
    return minutes;
  }

  createPaymentUrl(input: CreateVnpayUrlInput): string {
    const paymentUrl = this.required('VNPAY_PAYMENT_URL');
    const tmnCode = this.required('VNPAY_TMN_CODE');
    const hashSecret = this.required('VNPAY_HASH_SECRET');
    const returnUrl = this.required('VNPAY_RETURN_URL');

    let endpoint: URL;
    let callback: URL;
    try {
      endpoint = new URL(paymentUrl);
      callback = new URL(returnUrl);
    } catch {
      this.fail('VNPAY_CONFIGURATION_INVALID', 'VNPay URL configuration is invalid');
    }
    const callbackSecure = callback.protocol === 'https:' || (callback.protocol === 'http:' && callback.hostname === 'localhost');
    if (endpoint.protocol !== 'https:' || !callbackSecure) {
      this.fail('VNPAY_CONFIGURATION_INVALID', 'VNPay URLs must use HTTPS');
    }
    if (input.amountMinor <= 0n) {
      this.fail('INVALID_PAYMENT_AMOUNT', 'Payment amount must be positive');
    }

    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Amount: (input.amountMinor * 100n).toString(),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.txnRef,
      vnp_OrderInfo: `Thanh toan hoa don ${input.invoiceNumber}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: callback.toString(),
      vnp_IpAddr: this.validIp(input.clientIp),
      vnp_CreateDate: this.formatVnpayDate(input.createdAt),
      vnp_ExpireDate: this.formatVnpayDate(input.expiresAt),
    };

    const canonical = this.canonical(params);
    const signature = createHmac('sha512', hashSecret).update(canonical, 'utf8').digest('hex');
    const signedUrl = new URL(endpoint);
    for (const [key, value] of Object.entries(params)) signedUrl.searchParams.set(key, value);
    signedUrl.searchParams.set('vnp_SecureHash', signature);
    return signedUrl.toString();
  }

  callbackFields(query: Record<string, unknown>): Record<string, string> | null {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (!key.startsWith('vnp_')) continue;
      if (typeof value !== 'string') return null;
      fields[key] = value;
    }
    return fields.vnp_SecureHash && fields.vnp_TxnRef ? fields : null;
  }

  verifyCallbackSignature(fields: Record<string, string>): boolean {
    const supplied = fields.vnp_SecureHash;
    if (!supplied || !/^[a-f\d]{128}$/i.test(supplied)) return false;
    const signedFields = { ...fields };
    delete signedFields.vnp_SecureHash;
    delete signedFields.vnp_SecureHashType;
    const expected = createHmac('sha512', this.required('VNPAY_HASH_SECRET'))
      .update(this.canonical(signedFields), 'utf8')
      .digest();
    const received = Buffer.from(supplied, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  merchantCode(): string {
    return this.required('VNPAY_TMN_CODE');
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) this.fail('VNPAY_NOT_CONFIGURED', 'VNPay payment configuration is incomplete');
    return value;
  }

  private validIp(value: string): string {
    const candidate = (value || '').replace(/^::ffff:/i, '');
    return isIP(candidate) ? candidate : '127.0.0.1';
  }

  private canonical(params: Record<string, string>): string {
    return Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
  }

  private formatVnpayDate(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}${part('month')}${part('day')}${part('hour')}${part('minute')}${part('second')}`;
  }

  private fail(code: string, message: string): never {
    throw new BillingDomainException(code, message, 503);
  }
}
