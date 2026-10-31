import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class DeactivateReceptionistDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
