import { Type } from 'class-transformer';import { IsDateString,IsEnum,IsInt,IsOptional,IsString,Length,Min } from 'class-validator';import { InvoiceStatus,InvoiceType,PaymentMethod } from '../../../../generated/billing-client';
export class InvoiceListDto{@IsOptional()@IsString()patientId?:string;@IsOptional()@IsString()appointmentId?:string;@IsOptional()@IsString()encounterId?:string;@IsOptional()@IsEnum(InvoiceType)type?:InvoiceType;@IsOptional()@IsEnum(InvoiceStatus)status?:InvoiceStatus;@IsOptional()@IsInt()@Min(1)@Type(()=>Number)limit?:number;@IsOptional()@IsString()cursor?:string;}
export class RecordPaymentDto{@IsEnum(PaymentMethod)method!:PaymentMethod;@IsInt()@Min(0)@Type(()=>Number)amountMinor!:number;@IsDateString()receivedAt!:string;@IsOptional()@IsString()@Length(3,100)reference?:string;@IsOptional()@IsString()@Length(3,100)manualTransferReference?:string;@IsInt()@Min(1)expectedInvoiceVersion!:number;}
export class VerifyPaymentDto{@IsInt()@Min(1)expectedInvoiceVersion!:number;}
export class ReasonInvoiceVersionDto{@IsString()@Length(3,500)reason!:string;@IsInt()@Min(1)expectedInvoiceVersion!:number;}
export class CreditDto{@IsString()@Length(1,80)reasonCode!:string;@IsString()@Length(3,500)reasonText!:string;@IsInt()@Min(1)expectedInvoiceVersion!:number;}
export class RevokeCreditDto{@IsString()@Length(3,500)reason!:string;@IsInt()@Min(1)expectedInvoiceVersion!:number;@IsInt()@Min(1)expectedCreditVersion!:number;}
export class CancelInvoiceDto{@IsString()@Length(3,500)reason!:string;@IsInt()@Min(1)expectedVersion!:number;}
