import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TokenModule } from '../tokens/token.module';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationService } from './email-verification.service';

@Module({ imports: [DatabaseModule, TokenModule], controllers: [EmailVerificationController], providers: [EmailVerificationService] })
export class EmailVerificationModule {}
