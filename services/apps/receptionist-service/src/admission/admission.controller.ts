import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
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

@Controller('reception')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RECEPTIONIST', 'ADMIN')
export class AdmissionController {
  constructor(private readonly admission: AdmissionService) {}

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
  openCase(@Body() input: any, @CurrentAuth() auth: AuthContext) {
    return this.admission.openCase(input, auth);
  }

  @Get('cases/:id')
  getCase(@Param('id') id: string) {
    return this.admission.get(id);
  }

  @Post('cases/:id/identity-verifications')
  verifyIdentity(
    @Param('id') id: string,
    @Body() input: any,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admission.verify(id, input, auth);
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
  ) {
    return this.admission.recordPayment(id, input, idempotencyKey, auth);
  }

  @Post('cases/:id/admit')
  admit(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.admission.admit(id, auth);
  }
}
