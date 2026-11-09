import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentAuth } from '../auth/current-auth.decorator';
import type { AuthContext } from '../auth/auth-context';
import { ReceptionWorkService } from './reception-work.service';

@Controller('reception/work')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('RECEPTIONIST', 'ADMIN')
export class ReceptionWorkController {
  constructor(private readonly work: ReceptionWorkService) {}
  @Get() list(@CurrentAuth() auth: AuthContext, @Query('cursor', new ParseUUIDPipe({ optional: true })) cursor?: string) { return this.work.list(auth, cursor); }
  @Post(':id/claim') claim(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) { return this.work.claim(id, auth); }
  @Post(':id/release') release(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) { return this.work.release(id, auth); }
  @Post(':id/dismiss') dismiss(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) { return this.work.dismiss(id, auth); }
}
