import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfileImageStorage } from './profile-image-storage';

@Module({
  imports: [ConfigModule],
  providers: [ProfileImageStorage],
  exports: [ProfileImageStorage],
})
export class ProfileImageModule {}
