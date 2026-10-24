import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AdmissionService } from './admission.service';
import { SearchAppointmentsDto } from './dto/search-appointments.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { SearchBookableSlotsDto } from './dto/search-bookable-slots.dto';
import { RecordAdmissionPaymentDto } from './dto/record-admission-payment.dto';
import { OpenReceptionCaseDto } from './dto/open-reception-case.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { ListReceptionCasesDto } from './dto/list-reception-cases.dto';
import { CaseTransitionDto } from './dto/case-transition.dto';
import { RetryAdmissionDto } from './dto/retry-admission.dto';
import { SearchReceptionPatientsDto } from './dto/search-reception-patients.dto';
import { CreateWalkInPatientDto } from './dto/create-walk-in-patient.dto';
import { CurrentRequestId } from '../common/current-request.decorator';

@Controller('reception')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RECEPTIONIST', 'ADMIN')
export class AdmissionController {
  constructor(private readonly admission: AdmissionService) {}

  @Post('patients/search')
  searchPatients(
    @Body() input: SearchReceptionPatientsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admission.searchPatientsForReception(input, auth);
  }

  @Post('patients')
  createWalkInPatient(
    @Body() input: CreateWalkInPatientDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admission.createWalkInPatient(input, idempotencyKey, auth);
  }

  @Post('appointments/search')
  searchAppointments(
    @Body() input: SearchAppointmentsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admission.searchAppointments(input, auth);
  }

  @Get('appointments/slots')
  searchBookableSlots(
    @Query() input: SearchBookableSlotsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admission.searchBookableSlots(input, auth);
  }

  @Post('appointments')
  bookAppointment(
    @Body() input: BookAppointmentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admission.bookAppointment(input, idempotencyKey, auth);
  }

  @Post('cases')
  openCase(
    @Body() input: OpenReceptionCaseDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentAuth() auth: AuthContext,
    @CurrentRequestId() requestId: string,
  ) {
    return this.admission.openCase(input, idempotencyKey, auth, requestId);
  }

  @Get('cases')
  listCases(@Query() input: ListReceptionCasesDto, @CurrentAuth() auth: AuthContext) {
    return this.admission.listCases(input, auth);
  }

  @Get('cases/:id')
  getCase(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.admission.getCaseDetail(id, auth);
  }

  @Get('cases/:id/queue')
  queueStatus(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.admission.queueStatus(id, auth);
  }

  @Post('cases/:id/identity-verifications')
  verifyIdentity(
    @Param('id') id: string,
    @Body() input: VerifyIdentityDto,
    @CurrentAuth() auth: AuthContext,
    @CurrentRequestId() requestId: string,
  ) {
    return this.admission.verify(id, input, auth, requestId);
  }

  @Get('cases/:id/invoice')
  prepareInvoice(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.admission.prepareInvoice(id, auth);
  }

  @Post('cases/:id/payments')
  recordPayment(
    @Param('id') id: string,
    @Body() input: RecordAdmissionPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentAuth() auth: AuthContext,
    @CurrentRequestId() requestId: string,
  ) {
    return this.admission.recordPayment(id, input, idempotencyKey, auth, requestId);
  }

  @Post('cases/:id/admit')
  admit(
    @Param('id') id: string,
    @Body() input: RetryAdmissionDto,
    @CurrentAuth() auth: AuthContext,
    @CurrentRequestId() requestId: string,
  ) {
    return this.admission.admit(id, input.expectedVersion, auth, requestId);
  }

  @Post('cases/:id/retry')
  @HttpCode(200)
  retry(
    @Param('id') id: string,
    @Body() input: RetryAdmissionDto,
    @CurrentAuth() auth: AuthContext,
    @CurrentRequestId() requestId: string,
  ) {
    return this.admission.retry(id, input.expectedVersion, auth, requestId);
  }

  @Post('cases/:id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id') id: string,
    @Body() input: CaseTransitionDto,
    @CurrentAuth() auth: AuthContext,
    @CurrentRequestId() requestId: string,
  ) {
    return this.admission.cancel(id, input, auth, requestId);
  }

  @Post('cases/:id/manual-review')
  @HttpCode(200)
  manualReview(
    @Param('id') id: string,
    @Body() input: CaseTransitionDto,
    @CurrentAuth() auth: AuthContext,
    @CurrentRequestId() requestId: string,
  ) {
    return this.admission.manualReview(id, input, auth, requestId);
  }
}
