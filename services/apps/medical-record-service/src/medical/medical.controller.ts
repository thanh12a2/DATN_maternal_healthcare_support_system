import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentAuth,
  PublicHttp,
  PublicJwtGuard,
  type PublicAuthContext,
} from '@platform';
import { MedicalDomainService } from './medical.service';

@Controller()
@UseGuards(PublicJwtGuard)
export class MedicalController {
  constructor(private readonly s: MedicalDomainService) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('encounters')
  async listEncounters(
    @Query() query: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    const doctorId =
      auth.role === 'DOCTOR'
        ? await this.s.doctorIdForAccount(auth.userId)
        : undefined;
    return this.s.listEncounters(await this.s.scopeReadQuery(query, auth), doctorId);
  }

  @Get('encounters/:id')
  async getEncounter(
    @Param('id') id: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    await this.s.assertReadAccess(id, auth);
    return this.s.getEncounter(id);
  }

  @Patch('encounters/:id')
  async updateEncounter(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    if (!['DOCTOR', 'ADMIN', 'NURSE'].includes(auth.role)) throw new ForbiddenException('CLINICAL_WRITE_REQUIRED');
    return this.s.updateEncounterRest(id, b, auth);
  }

  @Post('encounters')
  async createEncounterRest(
    @Body() b: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    if (auth.role === 'DOCTOR')
      throw new ForbiddenException('ADMISSION_REQUIRED');
    if (!['ADMIN', 'NURSE', 'RECEPTIONIST'].includes(auth.role)) throw new ForbiddenException('CLINICAL_WRITE_REQUIRED');
    const res = await this.s.open(b);
    return { data: res.encounter };
  }

  @Post('encounters/:id/start')
  start(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.start(id, b.expectedVersion, a.userId, a.role);
  }

  @Post('encounters/:id/vital-signs')
  vital(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.addVital(id, b, a.userId, a.role);
  }

  @Post('encounters/:id/notes')
  note(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.addNote(id, b, a.userId, a.role);
  }

  @Post('encounters/:id/diagnoses')
  diagnosis(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.addDiagnosis(id, b, a.userId, a.role);
  }

  @Post('encounters/:id/orders')
  order(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.order(id, b, a.userId, a.role);
  }

  @Post('orders/:id/start')
  orderStart(@Param('id') id: string) {
    return this.s.orderState(id, 'IN_PROGRESS');
  }

  @Post('orders/:id/performed')
  performed(@Param('id') id: string) {
    return this.s.orderState(id, 'PERFORMED');
  }

  @Post('orders/:id/results')
  result(@Param('id') id: string, @Body() b: any) {
    return this.s.orderState(id, 'RESULT_AVAILABLE', b.structuredResult);
  }

  @Post('orders/:id/verify')
  verify(@Param('id') id: string) {
    return this.s.orderState(id, 'VERIFIED');
  }

  @Delete('orders/:id')
  deleteOrder(
    @Param('id') id: string,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.deleteOrder(id, a.userId, a.role);
  }

  @Post('encounters/:id/ready-for-review')
  ready(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.ready(id, b.expectedVersion, a.userId, a.role);
  }

  @Post('encounters/:id/finalize')
  finalize(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.finalize(id, b.expectedVersion, a.userId, a.role);
  }

  @Post('encounters/:id/amendments')
  amend(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.amend(id, b, a.userId, a.role);
  }

  @Post('pregnancy-episodes')
  createPregnancy(@Body() b: any, @CurrentAuth() a: PublicAuthContext) {
    if (!['DOCTOR', 'ADMIN', 'NURSE'].includes(a.role)) throw new ForbiddenException('CLINICAL_WRITE_REQUIRED');
    return this.s.createPregnancyEpisode(b, a.userId);
  }

  @Get('pregnancy-episodes')
  async listPregnancy(@Query() query: any, @CurrentAuth() auth: PublicAuthContext) {
    return this.s.listPregnancyEpisodes(await this.s.scopeReadQuery(query, auth));
  }

  @Patch('pregnancy-episodes/:id')
  updatePregnancy(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (!['DOCTOR', 'ADMIN', 'NURSE'].includes(a.role)) throw new ForbiddenException('CLINICAL_WRITE_REQUIRED');
    return this.s.updatePregnancyEpisode(id, b, a.userId);
  }
}
