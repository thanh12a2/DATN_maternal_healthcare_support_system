import { IsString, Length } from 'class-validator';

export class SearchReceptionPatientsDto {
  @IsString()
  @Length(7, 20)
  phoneNumber!: string;
}
