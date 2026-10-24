import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class VerifyIdentityDto {
  @IsIn(['APPOINTMENT_CODE', 'PHONE_AND_DOB', 'NATIONAL_ID_DOCUMENT', 'OTHER_DOCUMENT'])
  method!: 'APPOINTMENT_CODE' | 'PHONE_AND_DOB' | 'NATIONAL_ID_DOCUMENT' | 'OTHER_DOCUMENT';

  @IsIn(['VERIFIED', 'MISMATCH', 'INCONCLUSIVE'])
  result!: 'VERIFIED' | 'MISMATCH' | 'INCONCLUSIVE';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  verifiedFields?: string[];

  @ValidateIf((value: VerifyIdentityDto) => value.result !== 'VERIFIED')
  @IsString()
  @Length(1, 50)
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
