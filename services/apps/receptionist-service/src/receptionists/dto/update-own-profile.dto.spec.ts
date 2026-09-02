import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateOwnProfileDto } from './update-own-profile.dto';

describe('UpdateOwnProfileDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata = {
    type: 'body' as const,
    metatype: UpdateOwnProfileDto,
    data: '',
  };

  it('accepts an HTTPS avatar URL and version', async () => {
    await expect(
      pipe.transform(
        {
          avatarUrl: 'https://cdn.example.com/receptionists/avatar.jpg',
          version: 1,
        },
        metadata,
      ),
    ).resolves.toBeInstanceOf(UpdateOwnProfileDto);
  });

  it('accepts null to clear the avatar', async () => {
    await expect(
      pipe.transform({ avatarUrl: null, version: 1 }, metadata),
    ).resolves.toBeInstanceOf(UpdateOwnProfileDto);
  });

  it('rejects attempts to update other profile fields', async () => {
    await expect(
      pipe.transform(
        {
          avatarUrl: 'https://cdn.example.com/receptionists/avatar.jpg',
          fullName: 'Not allowed',
          version: 1,
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
