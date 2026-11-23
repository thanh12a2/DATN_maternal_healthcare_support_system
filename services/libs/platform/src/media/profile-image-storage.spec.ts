import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { ProfileImageStorage } from './profile-image-storage';

describe('ProfileImageStorage filesystem backend', () => {
  let root: string;
  let storage: ProfileImageStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'profile-image-test-'));
    const values: Record<string, string> = {
      PROFILE_IMAGE_STORAGE_BACKEND: 'filesystem',
      PROFILE_IMAGE_DIRECTORY: root,
    };
    storage = new ProfileImageStorage({ get: (key: string) => values[key] } as ConfigService);
  });

  afterEach(async () => {
    if (resolve(root).startsWith(`${resolve(tmpdir())}${sep}`))
      await rm(root, { recursive: true, force: true });
  });

  it('stores a normalized WebP image and reads it after creating a new storage instance', async () => {
    const original = await sharp({ create: {
      width: 900, height: 600, channels: 3, background: '#0066aa',
    } }).png().toBuffer();
    const owner = '4a480ed3-94c1-4946-a8b0-0fd3903d51c1';
    const key = await storage.save('patients', owner, { buffer: original, size: original.length }, true);
    const bytes = await storage.read(key);
    expect(bytes).not.toBeNull();
    expect(await sharp(bytes!).metadata()).toMatchObject({ format: 'webp', width: 512, height: 512 });
    await storage.remove(key);
    expect(await storage.read(key)).toBeNull();
  });

  it('rejects unsupported image content even when a file was submitted', async () => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await expect(storage.save('patients', '4a480ed3-94c1-4946-a8b0-0fd3903d51c1', {
      buffer: bytes, size: bytes.length,
    })).rejects.toMatchObject({ status: 400 });
  });
});
