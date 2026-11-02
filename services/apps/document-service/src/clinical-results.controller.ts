import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { CurrentAuth, PublicJwtGuard, type PublicAuthContext } from '@platform';
import type { Response } from 'express';
import { ClinicalResultsService } from './clinical-results.service';

@Controller('clinical-results')
@UseGuards(PublicJwtGuard)
export class ClinicalResultsController {
  constructor(private readonly results: ClinicalResultsService) {}
  @Get(':encounterId') list(@Param('encounterId', ParseUUIDPipe) id: string, @CurrentAuth() auth: PublicAuthContext) { return this.results.list(id, auth); }
  @Post(':encounterId') upload(@Param('encounterId', ParseUUIDPipe) id: string, @Body() body: any, @CurrentAuth() auth: PublicAuthContext) { return this.results.upload(id, body, auth); }
  @Get(':encounterId/:id/content') async content(@Param('encounterId', ParseUUIDPipe) encounterId: string, @Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: PublicAuthContext, @Res() response: Response) {
    const file = await this.results.content(encounterId, id, auth);
    response.setHeader('Content-Type', file.mediaType);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.content);
  }
}
