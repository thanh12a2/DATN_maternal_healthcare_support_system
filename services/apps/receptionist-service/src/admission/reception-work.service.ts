import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ReceptionCaseStatus } from '../../../../generated/receptionist-client';
import type { AuthContext } from '../auth/auth-context';
import { PrismaService } from '../database/prisma.service';

const active = [ReceptionCaseStatus.OPEN, ReceptionCaseStatus.IDENTITY_VERIFIED, ReceptionCaseStatus.ADMISSION_IN_PROGRESS];
export const receptionCaseCode = (id: string) => `TN-${BigInt(`0x${id.replace(/-/g, '')}`).toString(36).toUpperCase()}`;

@Injectable()
export class ReceptionWorkService {
  constructor(private readonly db: PrismaService) {}
  async getAppointmentOwner(appointmentId: string) {
    const row = await this.db.receptionCase.findFirst({ where: { appointmentId, status: { in: active } }, select: { workClaimedBy: true } });
    return { hasActiveCase: Boolean(row), ownerAccountId: row?.workClaimedBy ?? '' };
  }
  async beginOperation(appointmentId: string, accountId: string) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${appointmentId}, 0))::text`;
      const row = await tx.receptionCase.findFirst({ where: { appointmentId, status: { in: active } }, select: { id: true } });
      const existing = await tx.receptionAppointmentOperation.findUnique({ where: { appointmentId } });
      if (existing) return { allowed: false, hasActiveCase: Boolean(row), token: '' };
      const token = randomUUID();
      if (row) {
        const acquired = await tx.receptionCase.updateMany({ where: { id: row.id, status: { in: active }, workClaimedBy: accountId, workRunningToken: null }, data: { workRunningToken: token, workRunningAt: new Date() } });
        if (!acquired.count) return { allowed: false, hasActiveCase: true, token: '' };
      }
      await tx.receptionAppointmentOperation.create({ data: { appointmentId, token, accountId } });
      return { allowed: true, hasActiveCase: Boolean(row), token };
    });
  }
  async endOperation(token: string) {
    if (!token) return { released: false };
    return this.db.$transaction(async tx => {
      await tx.receptionCase.updateMany({ where: { workRunningToken: token }, data: { workRunningToken: null, workRunningAt: null } });
      const result = await tx.receptionAppointmentOperation.deleteMany({ where: { token } });
      return { released: result.count === 1 };
    });
  }
  async list(auth: AuthContext, cursor?: string) {
    const where = { OR: [{ status: { in: active } }, { status: ReceptionCaseStatus.ADMITTED, workClaimedBy: auth.userId, admission: { is: { notificationDismissedAt: null } } }] };
    const [rows, availableCount, completedCount] = await Promise.all([
      this.db.receptionCase.findMany({ where, include: { admission: { select: { status: true, currentStep: true, lastErrorCode: true, queueTicketCode: true, queueRoomCode: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 21, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }),
      this.db.receptionCase.count({ where: { status: { in: active }, workClaimedBy: null, workRunningToken: null } }),
      this.db.receptionCase.count({ where: { status: ReceptionCaseStatus.ADMITTED, workClaimedBy: auth.userId, admission: { is: { notificationDismissedAt: null } } } }),
    ]);
    return { availableCount: availableCount + completedCount, nextCursor: rows.length > 20 ? rows[19].id : null, items: rows.slice(0, 20).map(row => ({
      id: row.id, caseCode: receptionCaseCode(row.id), patientId: row.patientId, type: row.type, appointmentId: row.appointmentId, arrivalAt: row.arrivalAt, status: row.status,
      admissionStatus: row.admission?.status ?? null, step: row.admission?.currentStep ?? null, queueTicketCode: row.admission?.queueTicketCode ?? null, queueRoomCode: row.admission?.queueRoomCode ?? null,
      claim: row.workClaimedBy ? row.workClaimedBy === auth.userId ? 'MINE' : 'OTHER' : row.workRunningToken ? 'OTHER' : 'AVAILABLE',
    })) };
  }
  async dismiss(id: string, auth: AuthContext) {
    const result = await this.db.admission.updateMany({ where: { receptionCaseId: id, notificationDismissedAt: null, receptionCase: { status: ReceptionCaseStatus.ADMITTED, workClaimedBy: auth.userId } }, data: { notificationDismissedAt: new Date() } });
    if (!result.count) throw new ConflictException('Không tìm thấy thông báo của bạn.');
    return { success: true };
  }
  async claim(id: string, auth: AuthContext) {
    return this.db.$transaction(async tx => {
      const result = await tx.receptionCase.updateMany({ where: { id, status: { in: active },
        AND: [{ OR: [{ workClaimedBy: null }, { workClaimedBy: auth.userId }] }, { workRunningToken: null }] },
        data: { workClaimedBy: auth.userId, workClaimExpiresAt: null } });
      if (!result.count) throw new ConflictException('Case đã có người nhận hoặc đang xử lý.');
      await tx.receptionAuditLog.create({ data: { eventType: 'reception.work_claimed.v1', actorId: auth.userId, caseId: id, requestId: randomUUID() } });
      return { success: true };
    });
  }
  async release(id: string, auth: AuthContext) {
    const result = await this.db.$transaction(async tx => {
      const updated = await tx.receptionCase.updateMany({ where: { id, status: { in: active }, ...(auth.role === 'ADMIN' ? { workClaimedBy: { not: null } } : { workClaimedBy: auth.userId }), workRunningToken: null }, data: { workClaimedBy: null, workClaimExpiresAt: null } });
      if (!updated.count) throw new ConflictException('Bạn không còn giữ case hoặc case đang được xử lý.');
      await tx.receptionAuditLog.create({ data: { eventType: 'reception.work_released.v1', actorId: auth.userId, caseId: id, requestId: randomUUID() } });
      return { success: true };
    });
    return result;
  }
}
