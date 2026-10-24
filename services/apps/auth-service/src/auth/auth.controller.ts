import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsRepository } from '../accounts/accounts.repository';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { LoginResponseDto } from './dto/login-response.dto';
import type { MeResponseDto } from './dto/me-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import type { RegisterResponseDto } from './dto/register-response.dto';
import type { TokenResponseDto } from './dto/token-response.dto';
import type { InternalAccountLookup } from '../accounts/accounts.types';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountsRepository: AccountsRepository,
    private readonly config: ConfigService,
  ) {}

  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refresh(refreshTokenDto);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<void> {
    return this.authService.logout(refreshTokenDto);
  }

  @Get('auth/me')
  @HttpCode(HttpStatus.OK)
  getMe(
    @Headers('authorization') authorizationHeader?: string,
  ): Promise<MeResponseDto> {
    return this.authService.getMe(this.extractBearerToken(authorizationHeader));
  }

  @Get('internal/accounts/:accountId')
  @HttpCode(HttpStatus.OK)
  async getInternalAccount(
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Headers('x-internal-service-secret') secret?: string,
  ): Promise<InternalAccountLookup> {
    const expected = this.config.get<string>('INTERNAL_SERVICE_AUTH_SECRET');
    if (!expected || !secret || secret !== expected) {
      throw new ForbiddenException('INTERNAL_SERVICE_UNAUTHORIZED');
    }
    const account =
      await this.accountsRepository.findInternalAccountById(accountId);
    if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
    return account;
  }

  private extractBearerToken(authorizationHeader?: string): string {
    if (!authorizationHeader)
      throw new UnauthorizedException('Missing bearer token');
    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token)
      throw new UnauthorizedException('Invalid bearer token');
    return token;
  }
}
