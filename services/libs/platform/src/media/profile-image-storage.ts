import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export type ProfileImageScope = 'doctors' | 'patients' | 'receptionists';
export type ProfileImageFile = { buffer: Buffer; size: number };

@Injectable()
export class ProfileImageStorage {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  private useFilesystem(): boolean {
    return this.config.get<string>('PROFILE_IMAGE_STORAGE_BACKEND') === 'filesystem';
  }

  private filePath(key: string): string {
    if (!/^profile-images\/(doctors|patients|receptionists)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$|^profile-images\/(patients|receptionists)\/[0-9a-f-]{36}\/avatar\.webp$/i.test(key))
      throw new BadRequestException('INVALID_IMAGE_KEY');
    const root = this.config.get<string>('PROFILE_IMAGE_DIRECTORY');
    if (!root) throw new ServiceUnavailableException('IMAGE_STORAGE_NOT_CONFIGURED');
    return join(root, key);
  }

  private bucket(): string {
    const bucket = this.config.get<string>('PROFILE_IMAGE_S3_BUCKET');
    if (!bucket) throw new ServiceUnavailableException('IMAGE_STORAGE_NOT_CONFIGURED');
    return bucket;
  }

  private s3(): S3Client {
    if (this.client) return this.client;
    const endpoint = this.config.get<string>('PROFILE_IMAGE_S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('PROFILE_IMAGE_S3_ACCESS_KEY');
    const secretAccessKey = this.config.get<string>('PROFILE_IMAGE_S3_SECRET_KEY');
    this.client = new S3Client({
      region: this.config.get<string>('PROFILE_IMAGE_S3_REGION') || 'us-east-1',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    return this.client;
  }

  fixedKey(scope: ProfileImageScope, ownerId: string): string {
    if (!/^[0-9a-f-]{36}$/i.test(ownerId))
      throw new BadRequestException('INVALID_IMAGE_OWNER');
    return `profile-images/${scope}/${ownerId}/avatar.webp`;
  }

  async save(scope: ProfileImageScope, ownerId: string, file?: ProfileImageFile, fixed = false): Promise<string> {
    if (!file?.buffer?.length || file.size < 1 || file.size > PROFILE_IMAGE_MAX_BYTES || file.buffer.length > PROFILE_IMAGE_MAX_BYTES)
      throw new BadRequestException('INVALID_IMAGE_SIZE');

    let content: Buffer;
    try {
      const source = sharp(file.buffer, { failOn: 'error', limitInputPixels: 20_000_000 });
      const metadata = await source.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? ''))
        throw new Error('UNSUPPORTED_IMAGE_TYPE');
      content = await source
        .rotate()
        .resize(512, 512, { fit: 'cover', position: 'centre' })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException('UNSUPPORTED_IMAGE_TYPE');
    }

    const key = fixed
      ? this.fixedKey(scope, ownerId)
      : `profile-images/${scope}/${ownerId}/${randomUUID()}.webp`;
    try {
      if (this.useFilesystem()) {
        const target = this.filePath(key);
        await mkdir(dirname(target), { recursive: true });
        const temporary = `${target}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, content, { flag: 'wx' });
          await rename(temporary, target);
        } catch (error) {
          await unlink(temporary).catch(() => undefined);
          throw error;
        }
      } else {
        await this.s3().send(new PutObjectCommand({
          Bucket: this.bucket(),
          Key: key,
          Body: content,
          ContentType: 'image/webp',
          CacheControl: 'private, no-store',
        }));
      }
    } catch {
      throw new ServiceUnavailableException('IMAGE_STORAGE_UNAVAILABLE');
    }
    return key;
  }

  async read(key: string): Promise<Buffer | null> {
    if (!key.startsWith('profile-images/')) return null;
    try {
      if (this.useFilesystem()) return await readFile(this.filePath(key));
      const response = await this.s3().send(new GetObjectCommand({
        Bucket: this.bucket(), Key: key,
      }));
      if (!response.Body) return null;
      return Buffer.from(await response.Body.transformToByteArray());
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404)
        return null;
      throw new ServiceUnavailableException('IMAGE_STORAGE_UNAVAILABLE');
    }
  }

  async remove(key: string | null | undefined): Promise<void> {
    if (!key?.startsWith('profile-images/')) return;
    try {
      if (this.useFilesystem()) await unlink(this.filePath(key));
      else await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
    } catch {
      // A failed cleanup is safe to retry separately and must not undo a saved profile.
    }
  }
}
