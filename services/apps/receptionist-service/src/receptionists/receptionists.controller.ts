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
  Delete,
  UploadedFile,
  UseInterceptors,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ProfileImageStorage, PROFILE_IMAGE_MAX_BYTES, type ProfileImageFile } from '@platform';
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
  constructor(
    private readonly receptionistsService: ReceptionistsService,
    private readonly images: ProfileImageStorage,
  ) {}

  @Post('me/avatar')
  @Roles('RECEPTIONIST')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PROFILE_IMAGE_MAX_BYTES, files: 1 } }))
  async uploadAvatar(@CurrentAuth() auth: AuthContext, @UploadedFile() file: ProfileImageFile) {
    await this.images.save('receptionists', auth.userId, file, true);
    return { data: { uploaded: true } };
  }

  @Get('me/avatar')
  @Roles('RECEPTIONIST')
  async getAvatar(@CurrentAuth() auth: AuthContext, @Res() response: Response) {
    const content = await this.images.read(this.images.fixedKey('receptionists', auth.userId));
    if (!content) throw new NotFoundException('RECEPTIONIST_AVATAR_NOT_FOUND');
    response.setHeader('Content-Type', 'image/webp');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(content);
  }

  @Delete('me/avatar')
  @Roles('RECEPTIONIST')
  async deleteAvatar(@CurrentAuth() auth: AuthContext) {
    await this.images.remove(this.images.fixedKey('receptionists', auth.userId));
    return { data: { deleted: true } };
  }

  @Get()
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Roles('ADMIN', 'CLINIC_MANAGER', 'RECEPTIONIST')
  getById(
    @Param('receptionistId', new ParseUUIDPipe()) receptionistId: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<object> {
    return this.receptionistsService.getById(receptionistId, auth);
  }

  @Patch(':receptionistId')
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
  @Roles('ADMIN', 'CLINIC_MANAGER')
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
