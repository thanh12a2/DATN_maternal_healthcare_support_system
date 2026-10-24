import { IsInt, Min } from 'class-validator';

export class RetryAdmissionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
