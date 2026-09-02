import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateContactDto {
  @IsString() @MinLength(2) @MaxLength(150) fullName!: string;
  @IsString() @MinLength(1) @MaxLength(50) relationship!: string;
  @IsString() phoneNumber!: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
export class UpdateContactDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50) relationship?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
