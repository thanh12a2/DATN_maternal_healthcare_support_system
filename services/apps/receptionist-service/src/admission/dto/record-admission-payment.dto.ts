import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class RecordAdmissionPaymentDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  expectedCaseVersion!: number;

  @IsIn(['CASH', 'MANUAL_BANK_TRANSFER'])
  method!: 'CASH' | 'MANUAL_BANK_TRANSFER';

  @IsInt()
  @Min(1)
  @Type(() => Number)
  amountMinor!: number;

  @IsDateString()
  receivedAt!: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  reference?: string;

  @IsOptional()
  @IsString()
  @Length(3, 100)
  manualTransferReference?: string;
}
