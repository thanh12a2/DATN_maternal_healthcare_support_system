import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  CreateAvailabilityDto,
  AvailabilityQueryDto,
  CreateDoctorDto,
  CreateScheduleDto,
  CreateSpecialtyDto,
  ListQueryDto,
  ReasonDto,
  ScheduleListQueryDto,
  SpecialtyLinkDto,
  SpecialtyListQueryDto,
  UpdateDoctorDto,
  UpdateScheduleDto,
} from '../common/dto';
import { DoctorDomainService } from './doctor.service';

@Controller()
export class DoctorController {
  constructor(private readonly service: DoctorDomainService) {}
  private identity(req: AuthenticatedRequest) {
    if (!req.identity) throw new Error('Missing identity');
    return req.identity;
  }
  private version(value?: string) {
    return value === undefined ? NaN : Number(value);
  }

  @Post('doctors')
  @Roles('ADMIN')
  create(
    @Body() dto: CreateDoctorDto,
    @Headers('idempotency-key') key: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createDoctor(
      dto,
      this.identity(req),
      key,
      req.requestId,
    );
  }
  @Get('doctors')
  list(@Query() query: ListQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.listDoctors(query, req.identity);
  }
  @Get('doctors/:doctorId')
  get(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getDoctor(id, req.identity);
  }
  @Patch('doctors/:doctorId')
  update(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDoctorDto,
    @Headers('if-match') match: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateDoctor(
      id,
      dto,
      this.identity(req),
      this.version(match),
      req.requestId,
    );
  }
  @Post('doctors/:doctorId/activate')
  @Roles('ADMIN')
  activate(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Headers('if-match') match: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.changeStatus(
      id,
      true,
      this.identity(req),
      this.version(match),
      undefined,
      req.requestId,
    );
  }
  @Post('doctors/:doctorId/deactivate')
  @Roles('ADMIN')
  deactivate(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Headers('if-match') match: string,
    @Body() dto: ReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.changeStatus(
      id,
      false,
      this.identity(req),
      this.version(match),
      dto.reason,
      req.requestId,
    );
  }
  @Post('specialties')
  @Roles('ADMIN')
  createSpecialty(
    @Body() dto: CreateSpecialtyDto,
    @Headers('idempotency-key') key: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createSpecialty(
      dto,
      this.identity(req),
      key,
      req.requestId,
    );
  }
  @Get('specialties')
  specialties(
    @Query() query: SpecialtyListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listSpecialties(query, this.identity(req));
  }
  @Put('doctors/:doctorId/specialties/:specialtyId')
  @Roles('ADMIN')
  link(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Param('specialtyId', ParseUUIDPipe) specialtyId: string,
    @Body() dto: SpecialtyLinkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.linkSpecialty(
      doctorId,
      specialtyId,
      dto,
      this.identity(req),
      req.requestId,
    );
  }
  @Delete('doctors/:doctorId/specialties/:specialtyId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlink(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Param('specialtyId', ParseUUIDPipe) specialtyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.unlinkSpecialty(
      doctorId,
      specialtyId,
      this.identity(req),
      req.requestId,
    );
  }
  @Post('doctors/:doctorId/schedules')
  @Roles('ADMIN')
  createSchedule(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Body() dto: CreateScheduleDto,
    @Headers('idempotency-key') key: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createSchedule(
      id,
      dto,
      this.identity(req),
      key,
      req.requestId,
    );
  }
  @Get('doctors/:doctorId/schedules')
  schedules(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Query() query: ScheduleListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listSchedules(id, query, this.identity(req));
  }
  @Patch('doctors/:doctorId/schedules/:scheduleId')
  @Roles('ADMIN')
  updateSchedule(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
    @Headers('if-match') match: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSchedule(
      id,
      scheduleId,
      dto,
      this.identity(req),
      this.version(match),
      req.requestId,
    );
  }
  @Post('doctors/:doctorId/schedules/:scheduleId/cancel')
  @Roles('ADMIN')
  cancelSchedule(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Headers('if-match') match: string,
    @Body() dto: ReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelSchedule(
      id,
      scheduleId,
      this.identity(req),
      this.version(match),
      dto,
      req.requestId,
    );
  }
  @Post('doctors/:doctorId/availability-overrides')
  createAvailability(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Body() dto: CreateAvailabilityDto,
    @Headers('idempotency-key') key: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createAvailability(
      id,
      dto,
      this.identity(req),
      key,
      req.requestId,
    );
  }
  @Get('doctors/:doctorId/availability')
  availability(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listAvailability(id, query, this.identity(req));
  }
  @Post('doctors/:doctorId/availability-overrides/:overrideId/cancel')
  cancelAvailability(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
    @Headers('if-match') match: string,
    @Body() dto: ReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelAvailability(
      id,
      overrideId,
      this.identity(req),
      this.version(match),
      dto,
      req.requestId,
    );
  }
  @Get('internal/doctors/:doctorId/eligibility')
  eligibility(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Query('specialtyId', ParseUUIDPipe) specialtyId: string,
    @Query('startAt') startAt: string,
    @Query('endAt') endAt: string,
  ) {
    return this.service.eligibility(id, specialtyId, startAt, endAt);
  }
}
