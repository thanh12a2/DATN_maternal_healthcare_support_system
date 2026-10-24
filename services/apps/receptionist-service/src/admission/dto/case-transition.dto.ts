import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CaseTransitionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @Length(1, 100)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}
