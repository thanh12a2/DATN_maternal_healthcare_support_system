import { IsIn } from 'class-validator';

export class ChangeStaffStatusDto {
  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}
