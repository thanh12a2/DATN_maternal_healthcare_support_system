import { Injectable, NotFoundException } from '@nestjs/common';
import { AppPrismaService } from './database/prisma.service';

@Injectable()
export class InboxService {
  constructor(private readonly db: AppPrismaService) {}
  async list(recipientAccountId: string, rawPage?: string) {
    const parsed = Number(rawPage ?? 1);
    const page = Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 10000 ? parsed : 1;
    const pageSize = 20;
    const where = { recipientAccountId };
    const [items, total] = await Promise.all([
      this.db.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize, select: { id: true, category: true, title: true, body: true, resourceType: true, resourceId: true, readAt: true, createdAt: true } }),
      this.db.notification.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }
  async unreadCount(recipientAccountId: string) { return { count: await this.db.notification.count({ where: { recipientAccountId, readAt: null } }) }; }
  async read(recipientAccountId: string, id: string) {
    const exists = await this.db.notification.findFirst({ where: { id, recipientAccountId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Notification not found');
    await this.db.notification.updateMany({ where: { id, recipientAccountId, readAt: null }, data: { readAt: new Date() } });
    return { success: true };
  }
  async readAll(recipientAccountId: string) {
    const cutoff = new Date();
    const result = await this.db.notification.updateMany({ where: { recipientAccountId, readAt: null, createdAt: { lte: cutoff } }, data: { readAt: cutoff } });
    return { updated: result.count };
  }
}
