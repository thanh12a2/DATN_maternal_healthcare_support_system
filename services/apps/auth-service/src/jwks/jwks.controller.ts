import { Controller, Get } from '@nestjs/common';
import { JwksService } from './jwks.service';
import type { JsonWebKeySet } from './jwks.types';

@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwksService: JwksService) {}

  @Get('jwks.json')
  getJwks(): JsonWebKeySet {
    return this.jwksService.getJwks();
  }
}
