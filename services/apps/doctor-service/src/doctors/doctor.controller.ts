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
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PROFILE_IMAGE_MAX_BYTES, type ProfileImageFile } from '@platform';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  CreateAvailabilityDto,
  AvailabilityQueryDto,
  CreateDoctorDto,
  CreateRoomDto,
  CreateScheduleDto,
  CreateSpecialtyDto,
  UpdateSpecialtyDto,
  ListQueryDto,
  ReasonDto,
  RoomListQueryDto,
  ScheduleListQueryDto,
  SpecialtyLinkDto,
  SpecialtyListQueryDto,
  UpdateDoctorDto,
  UpdateRoomDto,
  UpdateScheduleDto,
} from '../common/dto';
import { DoctorDomainService } from './doctor.service';
import { DoctorPhotoService } from './doctor-photo.service';

@Controller('doctors')
export class DoctorController {
  constructor(
    private readonly service: DoctorDomainService,
    private readonly photos: DoctorPhotoService,
  ) {}
  private identity(req: AuthenticatedRequest) {
    if (!req.identity) throw new Error('Missing identity');
    return req.identity;
  }
  private version(value?: string) {
    return value === undefined ? NaN : Number(value);
  }

  @Post()
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Public()
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
  @Public()
  @Get('specialties')
  specialties(
    @Query() query: SpecialtyListQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listSpecialties(query, req.identity);
  }
  @Patch('specialties/:specialtyId')
  @Roles('ADMIN')
  updateSpecialty(
    @Param('specialtyId', ParseUUIDPipe) specialtyId: string,
    @Body() dto: UpdateSpecialtyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSpecialty(specialtyId, dto, this.identity(req));
  }
  @Public()
  @Get('consultation-ranks')
  consultationRanks(@Req() req: AuthenticatedRequest) {
    return this.service.listConsultationRanks(req.identity);
  }

  @Post('rooms')
  @Roles('ADMIN', 'CLINIC_MANAGER')
  createRoom(
    @Body() dto: CreateRoomDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createRoom(dto, this.identity(req), key);
  }
  @Get('rooms')
  rooms(@Query() query: RoomListQueryDto, @Req() req: AuthenticatedRequest) {
    return this.service.listRooms(query, req.identity);
  }
  @Get('rooms/:roomId')
  getRoom(@Param('roomId') roomId: string, @Req() req: AuthenticatedRequest) {
    return this.service.getRoom(roomId, req.identity);
  }
  @Get('me')
  @Roles('DOCTOR')
  me(@Req() req: AuthenticatedRequest) {
    return this.service.getMyDoctor(this.identity(req));
  }
  @Patch('rooms/:roomId')
  @Roles('ADMIN', 'CLINIC_MANAGER')
  updateRoom(
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateRoom(roomId, dto, this.identity(req));
  }
  @Get(':doctorId')
  get(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getDoctor(id, req.identity);
  }
  @Post(':doctorId/photo')
  @Roles('ADMIN', 'CLINIC_MANAGER', 'DOCTOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PROFILE_IMAGE_MAX_BYTES, files: 1 } }))
  uploadPhoto(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @UploadedFile() file: ProfileImageFile,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.photos.upload(id, this.identity(req), file, req.requestId);
  }
  @Public()
  @Get(':doctorId/photo')
  async getPhoto(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const content = await this.photos.content(id);
    response.setHeader('Content-Type', 'image/webp');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'public, no-store');
    response.send(content);
  }
  @Delete(':doctorId/photo')
  @Roles('ADMIN', 'CLINIC_MANAGER', 'DOCTOR')
  deletePhoto(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.photos.delete(id, this.identity(req), req.requestId);
  }
  @Delete(':doctorId')
  @Roles('ADMIN')
  remove(
    @Param('doctorId', ParseUUIDPipe) id: string,
    @Headers('if-match') match: string,
    @Headers('authorization') authorization: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.deleteDoctor(id, this.identity(req), this.version(match), authorization, req.requestId);
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
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Roles('ADMIN', 'CLINIC_MANAGER')
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

  @Put(':doctorId/specialties/:specialtyId')
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Delete(':doctorId/specialties/:specialtyId')
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
