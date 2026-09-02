import {
  IsDefined,
  IsInt,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateOwnProfileDto {
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  avatarUrl!: string | null;

  @IsInt()
  @Min(1)
  version!: number;
}
