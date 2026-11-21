import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { EmailVerificationService } from './email-verification.service';

class ConfirmEmailDto { @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string; }

@Controller('auth/email-verification')
export class EmailVerificationController {
  constructor(private readonly service: EmailVerificationService) {}
  @Get() status(@Headers('authorization') header?: string) { return this.service.status(header); }
  @Post('request') @HttpCode(200) request(@Headers('authorization') header?: string) { return this.service.request(header); }
  @Post('confirm') @HttpCode(200) confirm(@Headers('authorization') header: string | undefined, @Body() body: ConfirmEmailDto) { return this.service.confirm(header, body.token); }
}
