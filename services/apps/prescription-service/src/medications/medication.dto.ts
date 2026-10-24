import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const PREGNANCY_SAFETY_CATEGORIES = [
  'CATEGORY_A',
  'CATEGORY_B',
  'CATEGORY_C',
  'CATEGORY_D',
  'CATEGORY_X',
] as const;

export type PregnancySafetyCategory = (typeof PREGNANCY_SAFETY_CATEGORIES)[number];

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListMedicationsQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  q?: string;

  @IsOptional()
  @IsIn(PREGNANCY_SAFETY_CATEGORIES)
  pregnancyCategory?: PregnancySafetyCategory;

  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateMedicationDto {
  @IsString()
  @Length(2, 100)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._ -]*$/)
  code!: string;

  @IsString()
  @Length(2, 200)
  name!: string;

  @IsString()
  @Length(2, 500)
  activeIngredient!: string;

  @IsString()
  @Length(1, 100)
  strength!: string;

  @IsString()
  @Length(1, 100)
  dosageForm!: string;

  @IsString()
  @Length(1, 80)
  route!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultDose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultFrequency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  defaultInstruction?: string;

  @IsIn(PREGNANCY_SAFETY_CATEGORIES)
  pregnancyCategory!: PregnancySafetyCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pregnancyWarning?: string;
}

export class UpdateMedicationDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 500)
  activeIngredient?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  strength?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  dosageForm?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  defaultDose?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultFrequency?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  defaultInstruction?: string | null;

  @IsOptional()
  @IsIn(PREGNANCY_SAFETY_CATEGORIES)
  pregnancyCategory?: PregnancySafetyCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pregnancyWarning?: string | null;
}

export class ChangeMedicationStatusDto {
  @IsInt()
  @Min(1)
  version!: number;
}
