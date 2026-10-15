import {
  Body,
  Controller,
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
  async listEncounters(@Query() query: any) {
    return this.s.listEncounters(query);
  }

  @Get('encounters/:id')
  async getEncounter(@Param('id') id: string) {
    return this.s.getEncounter(id);
  }

  @Post('encounters')
  async createEncounterRest(@Body() b: any) {
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

  @Post('encounters/:id/ready-for-review')
  ready(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.ready(id, b.expectedVersion, a.userId);
  }

  @Post('encounters/:id/finalize')
  finalize(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.finalize(id, b.expectedVersion, a.userId);
  }

  @Post('encounters/:id/amendments')
  amend(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.amend(id, b, a.userId);
  }

  @Post('pregnancy-episodes')
  createPregnancy(@Body() b: any, @CurrentAuth() a: PublicAuthContext) {
    return this.s.createPregnancyEpisode(b, a.userId);
  }

  @Get('pregnancy-episodes')
  listPregnancy(@Query() query: any) {
    return this.s.listPregnancyEpisodes(query);
  }

  @Patch('pregnancy-episodes/:id')
  updatePregnancy(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.updatePregnancyEpisode(id, b, a.userId);
  }
}
