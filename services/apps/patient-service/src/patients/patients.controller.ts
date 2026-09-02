import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PatientAuthGuard } from '../auth/patient-auth.guard';
import type { PatientRequest } from '../common/request-context';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import {
  CreatePatientDto,
  PatchPatientDto,
  SearchPatientsDto,
} from './dto/staff-patient.dto';
import { UpsertMyPatientDto } from './dto/upsert-my-patient.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(PatientAuthGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Put('me')
  async upsert(
    @Body() dto: UpsertMyPatientDto,
    @Req() request: PatientRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.patients.upsertMe(
      dto,
      request.patientAuth!,
      request.requestId,
    );
    response.status(result.created ? 201 : 200);
    return { data: result.data };
  }

  @Get('me')
  async me(@Req() request: PatientRequest) {
    return { data: await this.patients.getMe(request.patientAuth!) };
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchPatientsDto, @Req() request: PatientRequest) {
    return {
      data: await this.patients.search(
        dto,
        request.patientAuth!,
        request.requestId,
      ),
    };
  }

  @Post()
  async create(
    @Body() dto: CreatePatientDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: PatientRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.patients.createByReceptionist(
      dto,
      idempotencyKey,
      request.patientAuth!,
      request.requestId,
    );
    response.status(result.created ? 201 : 200);
    return { data: result.data };
  }

  @Get(':patientId')
  @Header('Cache-Control', 'no-store')
  async detail(
    @Param('patientId') patientId: string,
    @Req() request: PatientRequest,
  ) {
    return {
      data: await this.patients.getById(
        patientId,
        request.patientAuth!,
        request.requestId,
      ),
    };
  }

  @Patch(':patientId')
  async patchPatient(
    @Param('patientId') patientId: string,
    @Body() dto: PatchPatientDto,
    @Req() request: PatientRequest,
  ) {
    return {
      data: await this.patients.patchByReceptionist(
        patientId,
        dto,
        request.patientAuth!,
        request.requestId,
      ),
    };
  }

  @Post(':patientId/emergency-contacts')
  async add(
    @Param('patientId') patientId: string,
    @Body() dto: CreateContactDto,
    @Req() request: PatientRequest,
  ) {
    return {
      data: await this.patients.addContact(
        patientId,
        dto,
        request.patientAuth!,
        request.requestId,
      ),
    };
  }

  @Patch(':patientId/emergency-contacts/:contactId')
  async patchContact(
    @Param('patientId') patientId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
    @Req() request: PatientRequest,
  ) {
    return {
      data: await this.patients.updateContact(
        patientId,
        contactId,
        dto,
        request.patientAuth!,
        request.requestId,
      ),
    };
  }

  @Delete(':patientId/emergency-contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContact(
    @Param('patientId') patientId: string,
    @Param('contactId') contactId: string,
    @Req() request: PatientRequest,
  ) {
    await this.patients.deleteContact(
      patientId,
      contactId,
      request.patientAuth!,
      request.requestId,
    );
  }
}
