import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CatalogStatus,
  DoctorRankSelectionPolicy,
  MedicalServiceKind,
  PriceStatus,
  TagGroup,
} from '../../../../generated/catalog-client';

export class ListServicesQueryDto {
  @IsOptional() @IsString() @Length(1, 100) q?: string;
  @IsOptional() @IsEnum(MedicalServiceKind) kind?: MedicalServiceKind;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsString() @Length(1, 160) category?: string;
  @IsOptional() @IsString() @Length(1, 160) tag?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) bookingEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
}

export class CreateServiceDto {
  @IsString() @Length(2, 50) code!: string;
  @IsOptional() @IsString() @Length(2, 160) slug?: string;
  @IsString() @Length(2, 200) name!: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsEnum(MedicalServiceKind) kind!: MedicalServiceKind;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) thumbnailUrl?: string;
  @IsOptional() @IsInt() @Min(5) @Max(600) @Type(() => Number) durationMinutes?: number;
  @IsOptional() @IsBoolean() bookingEnabled?: boolean;
  @IsOptional() @IsEnum(DoctorRankSelectionPolicy) doctorRankSelectionPolicy?: DoctorRankSelectionPolicy;
  @IsOptional() @IsUUID() primaryCategoryId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) categoryIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID('4', { each: true }) tagIds?: string[];
}

export class UpdateServiceDto {
  @IsOptional() @IsString() @Length(2, 50) code?: string;
  @IsOptional() @IsString() @Length(2, 160) slug?: string;
  @IsOptional() @IsString() @Length(2, 200) name?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsEnum(MedicalServiceKind) kind?: MedicalServiceKind;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) thumbnailUrl?: string;
  @IsOptional() @IsInt() @Min(5) @Max(600) @Type(() => Number) durationMinutes?: number;
  @IsOptional() @IsBoolean() bookingEnabled?: boolean;
  @IsOptional() @IsEnum(DoctorRankSelectionPolicy) doctorRankSelectionPolicy?: DoctorRankSelectionPolicy;
  @IsOptional() @IsUUID() primaryCategoryId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) categoryIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsUUID('4', { each: true }) tagIds?: string[];
}

export class CreateCategoryDto {
  @IsString() @Length(2, 50) code!: string;
  @IsOptional() @IsString() @Length(2, 160) slug?: string;
  @IsString() @Length(2, 160) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsEnum(CatalogStatus) status?: CatalogStatus;
  @IsOptional() @IsInt() @Min(0) @Max(100000) @Type(() => Number) sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @Length(2, 50) code?: string;
  @IsOptional() @IsString() @Length(2, 160) slug?: string;
  @IsOptional() @IsString() @Length(2, 160) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsEnum(CatalogStatus) status?: CatalogStatus;
  @IsOptional() @IsInt() @Min(0) @Max(100000) @Type(() => Number) sortOrder?: number;
}

export class CreateTagDto {
  @IsString() @Length(2, 50) code!: string;
  @IsOptional() @IsString() @Length(2, 160) slug?: string;
  @IsString() @Length(2, 120) name!: string;
  @IsEnum(TagGroup) group!: TagGroup;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsEnum(CatalogStatus) status?: CatalogStatus;
  @IsOptional() @IsInt() @Min(0) @Max(100000) @Type(() => Number) sortOrder?: number;
}

export class UpdateTagDto {
  @IsOptional() @IsString() @Length(2, 50) code?: string;
  @IsOptional() @IsString() @Length(2, 160) slug?: string;
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsEnum(TagGroup) group?: TagGroup;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsEnum(CatalogStatus) status?: CatalogStatus;
  @IsOptional() @IsInt() @Min(0) @Max(100000) @Type(() => Number) sortOrder?: number;
}

export class ScheduleBasePriceDto {
  @IsInt() @Min(0) @Type(() => Number) amountMinor!: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsEnum(PriceStatus) status?: PriceStatus;
}

export class ScheduleRankSurchargeDto {
  @IsString() @Length(2, 50) rankCode!: string;
  @IsInt() @Min(0) @Type(() => Number) amountMinor!: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsEnum(PriceStatus) status?: PriceStatus;
}

export class EligibilityQueryDto {
  @IsOptional() @IsString() @Length(2, 50) doctorRankCode?: string;
  @IsOptional() @IsISO8601() at?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
}

export class ResolveServicesDto {
  @IsArray() @ArrayMaxSize(50) @IsUUID('4', { each: true }) serviceIds!: string[];
  @IsOptional() @IsString() @Length(2, 50) doctorRankCode?: string;
  @IsOptional() @IsISO8601() at?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
}
