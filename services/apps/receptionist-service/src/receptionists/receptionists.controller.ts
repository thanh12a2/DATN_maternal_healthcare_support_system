import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthContext } from '../auth/auth-context';
import { CurrentRequestId } from '../common/current-request.decorator';
import { DeactivateReceptionistDto } from './dto/deactivate-receptionist.dto';
import { ListReceptionistsQuery } from './dto/list-receptionists.query';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { UpdateReceptionistDto } from './dto/update-receptionist.dto';
import { ReceptionistsService } from './receptionists.service';

@Controller('receptionists')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceptionistsController {
  constructor(private readonly receptionistsService: ReceptionistsService) {}

  @Get()
  @Roles('ADMIN')
  list(@Query() query: ListReceptionistsQuery): Promise<object> {
    return this.receptionistsService.list(query);
  }

  @Get('me')
  @Roles('RECEPTIONIST')
  getOwn(@CurrentAuth() auth: AuthContext): Promise<object> {
    return this.receptionistsService.getOwn(auth);
  }

  @Patch('me')
  @Roles('RECEPTIONIST')
  updateOwn(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateOwnProfileDto,
    @CurrentRequestId() requestId: string,
  ): Promise<object> {
    return this.receptionistsService.updateOwn(auth, dto, requestId);
  }

  @Get(':receptionistId')
  @Roles('ADMIN', 'RECEPTIONIST')
  getById(
    @Param('receptionistId', new ParseUUIDPipe()) receptionistId: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<object> {
    return this.receptionistsService.getById(receptionistId, auth);
  }

  @Patch(':receptionistId')
  @Roles('ADMIN')
  updateByAdmin(
    @Param('receptionistId', new ParseUUIDPipe()) receptionistId: string,
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UpdateReceptionistDto,
    @CurrentRequestId() requestId: string,
  ): Promise<object> {
    return this.receptionistsService.updateByAdmin(
      receptionistId,
      auth,
      dto,
      requestId,
    );
  }

  @Post(':receptionistId/deactivate')
  @HttpCode(200)
  @Roles('ADMIN')
  deactivate(
    @Param('receptionistId', new ParseUUIDPipe()) receptionistId: string,
    @CurrentAuth() auth: AuthContext,
    @Body() dto: DeactivateReceptionistDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentRequestId() requestId: string,
  ): Promise<object> {
    return this.receptionistsService.deactivate(
      receptionistId,
      auth,
      dto,
      idempotencyKey,
      requestId,
    );
  }
}
