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
  UpdateSpecialtyDto,
  CreateConsultationRankDto,
  UpdateConsultationRankDto,
  ListQueryDto,
  ReasonDto,
  ScheduleListQueryDto,
  SpecialtyLinkDto,
  SpecialtyListQueryDto,
  UpdateDoctorDto,
  UpdateScheduleDto,
} from '../common/dto';
import { DoctorDomainService } from './doctor.service';

@Controller('doctors')
export class DoctorController {
  constructor(private readonly service: DoctorDomainService) {}
  private identity(req: AuthenticatedRequest) {
    if (!req.identity) throw new Error('Missing identity');
    return req.identity;
  }
  private version(value?: string) {
    return value === undefined ? NaN : Number(value);
  }

  @Post()
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
  @Get()
  list(@Query() query: ListQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.listDoctors(query, req.identity);
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
  @Patch('specialties/:specialtyId')
  @Roles('ADMIN')
  updateSpecialty(
    @Param('specialtyId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialtyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSpecialty(id, dto, this.identity(req));
  }
  @Delete('specialties/:specialtyId')
  @Roles('ADMIN')
  deleteSpecialty(
    @Param('specialtyId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.deleteSpecialty(id, this.identity(req));
  }
  @Get('consultation-ranks')
  listRanks(@Req() req: AuthenticatedRequest) {
    return this.service.listConsultationRanks(this.identity(req));
  }
  @Post('consultation-ranks')
  @Roles('ADMIN')
  createRank(
    @Body() dto: CreateConsultationRankDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createConsultationRank(dto, this.identity(req));
  }
  @Patch('consultation-ranks/:id')
  @Roles('ADMIN')
  updateRank(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsultationRankDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateConsultationRank(id, dto, this.identity(req));
  }
  @Delete('consultation-ranks/:id')
  @Roles('ADMIN')
  deleteRank(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.deleteConsultationRank(id, this.identity(req));
  }
  @Get(':doctorId')
  get(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getDoctor(id, req.identity);
  }
  @Patch(':doctorId')
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
  @Post(':doctorId/activate')
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
  @Post(':doctorId/deactivate')
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

  @Delete(':doctorId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.deleteDoctor(id, this.identity(req), req.requestId);
  }

  @Put(':doctorId/specialties/:specialtyId')
  @Roles('ADMIN')
  link(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Param('specialtyId', ParseUUIDPipe) specialtyId: string,
    @Body() dto: SpecialtyLinkDto,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log('PUT SPECIALTY BODY:', req.body);
    console.log('PUT SPECIALTY DTO:', dto);
    return this.service.linkSpecialty(
      doctorId,
      specialtyId,
      dto,
      this.identity(req),
      req.requestId,
    );
  }
  @Delete(':doctorId/specialties/:specialtyId')
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
  @Post(':doctorId/schedules')
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
  @Get(':doctorId/schedules')
  schedules(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Query() query: ScheduleListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listSchedules(id, query, this.identity(req));
  }
  @Patch(':doctorId/schedules/:scheduleId')
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
  @Post(':doctorId/schedules/:scheduleId/cancel')
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
  @Post(':doctorId/availability-overrides')
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
  @Get(':doctorId/availability')
  availability(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listAvailability(id, query, this.identity(req));
  }
  @Post(':doctorId/availability-overrides/:overrideId/cancel')
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
  // Deprecated compatibility endpoint. It is intentionally not routed by Kong.
  // New callers must use DoctorInternalService gRPC.
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

