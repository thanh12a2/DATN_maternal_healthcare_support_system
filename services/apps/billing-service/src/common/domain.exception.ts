import { HttpException } from '@nestjs/common';
export class BillingDomainException extends HttpException {
  constructor(public readonly code: string, message: string, status: number, public readonly details?: unknown) { super(message, status); }
}
