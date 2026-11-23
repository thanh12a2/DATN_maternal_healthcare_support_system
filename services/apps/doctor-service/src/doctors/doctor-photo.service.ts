import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProfileImageStorage, type ProfileImageFile } from '@platform';
import type { Identity } from '../auth/auth.types';

@Injectable()
export class DoctorPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ProfileImageStorage,
  ) {}

  private async doctor(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id }, include: { profile: true },
    });
    if (!doctor?.profile || doctor.deletedAt) throw new NotFoundException('DOCTOR_NOT_FOUND');
    return doctor;
  }

  private assertWrite(actor: Identity, accountId: string) {
    if (!['ADMIN', 'CLINIC_MANAGER'].includes(actor.role) &&
        (actor.role !== 'DOCTOR' || actor.userId !== accountId))
      throw new ForbiddenException('DOCTOR_PHOTO_ACCESS_DENIED');
  }

  async upload(id: string, actor: Identity, file?: ProfileImageFile, requestId?: string) {
    const doctor = await this.doctor(id);
    this.assertWrite(actor, doctor.accountId);
    const key = await this.storage.save('doctors', id, file);
    let version: number;
    try {
      version = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.doctor.updateMany({
          where: { id, version: doctor.version }, data: { version: { increment: 1 } },
        });
        if (changed.count !== 1) throw new ConflictException('VERSION_CONFLICT');
        await tx.doctorProfile.update({
          where: { doctorId: id },
          data: { photoStorageKey: key, photoUrl: null },
        });
        await tx.auditRecord.create({ data: {
          eventType: 'doctor.photo_uploaded', actorId: actor.userId,
          doctorId: id, requestId, details: { changedFields: ['profile.photoUrl'] },
        } });
        return doctor.version + 1;
      });
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
    await this.storage.remove(doctor.profile?.photoStorageKey);
    return { data: { doctorId: id, version, photoUrl: `/api/doctors/${id}/photo` } };
  }

  async content(id: string): Promise<Buffer> {
    const doctor = await this.doctor(id);
    const key = doctor.profile?.photoStorageKey;
    if (!key) throw new NotFoundException('DOCTOR_PHOTO_NOT_FOUND');
    const content = await this.storage.read(key);
    if (!content) throw new NotFoundException('DOCTOR_PHOTO_NOT_FOUND');
    return content;
  }

  async delete(id: string, actor: Identity, requestId?: string) {
    const doctor = await this.doctor(id);
    this.assertWrite(actor, doctor.accountId);
    if (!doctor.profile?.photoStorageKey && !doctor.profile?.photoUrl)
      return { data: { doctorId: id, deleted: false } };
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.doctor.updateMany({
        where: { id, version: doctor.version }, data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ConflictException('VERSION_CONFLICT');
      await tx.doctorProfile.update({
        where: { doctorId: id }, data: { photoStorageKey: null, photoUrl: null },
      });
      await tx.auditRecord.create({ data: {
        eventType: 'doctor.photo_deleted', actorId: actor.userId,
        doctorId: id, requestId, details: { changedFields: ['profile.photoUrl'] },
      } });
    });
    await this.storage.remove(doctor.profile.photoStorageKey);
    return { data: { doctorId: id, deleted: true } };
  }
}
