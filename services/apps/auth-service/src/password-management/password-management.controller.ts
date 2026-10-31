import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordManagementService } from './password-management.service';

const FORGOT_PASSWORD_MESSAGE =
  'If an eligible account exists, password reset instructions will be sent.';

@Controller('auth')
export class PasswordManagementController {
  constructor(
    private readonly passwordManagementService: PasswordManagementService,
  ) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.passwordManagementService.forgotPassword(dto);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.passwordManagementService.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Headers('authorization') authorizationHeader: string | undefined,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.passwordManagementService.changePassword(
      this.extractBearerToken(authorizationHeader),
      dto,
    );
  }

  private extractBearerToken(authorizationHeader?: string): string {
    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid bearer token');
    }
    return token;
  }
}
