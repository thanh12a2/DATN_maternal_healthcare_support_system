import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { MedicalPrismaService } from '../database/prisma.service';
import { DoctorIdentityGateway } from './doctor-identity.gateway';

@Injectable()
export class AppointmentSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentSyncService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: MedicalPrismaService, private readonly gateway: DoctorIdentityGateway) {}

  onModuleInit() { this.timer = setInterval(() => { void this.flush(); }, 10000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.db.encounterAppointmentSync.findMany({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, orderBy: [{ createdAt: 'asc' }, { encounterVersion: 'asc' }], take: 50 });
      for (const job of jobs) {
        const earlier = await this.db.encounterAppointmentSync.findFirst({ where: { encounterId: job.encounterId, status: 'PENDING', encounterVersion: { lt: job.encounterVersion } }, orderBy: { encounterVersion: 'asc' }, select: { id: true, nextAttemptAt: true } });
        if (earlier) {
          const nextAttemptAt = new Date(Math.max(Date.now() + 10000, earlier.nextAttemptAt.getTime() + 1000));
          await this.db.encounterAppointmentSync.updateMany({ where: { id: job.id, status: 'PENDING' }, data: { nextAttemptAt } });
          continue;
        }
        try {
          await this.gateway.reconcileAppointment(job);
          await this.db.encounterAppointmentSync.updateMany({ where: { id: job.id, status: 'PENDING' }, data: { status: 'DONE', completedAt: new Date(), lastError: null } });
        } catch {
          const delay = Math.min(300000, 10000 * (2 ** Math.min(job.attempts, 5)));
          await this.db.encounterAppointmentSync.updateMany({ where: { id: job.id, status: 'PENDING' }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + delay), lastError: 'RECONCILIATION_FAILED' } });
        }
      }
    } catch (error) {
      this.logger.warn(`Appointment sync unavailable: ${error instanceof Error ? error.name : 'unknown error'}`);
    } finally { this.running = false; }
  }
}
