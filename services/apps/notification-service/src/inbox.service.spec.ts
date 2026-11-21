import { NotFoundException } from '@nestjs/common';
import { InboxService } from './inbox.service';

describe('notification inbox ownership', () => {
  const notification = { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), updateMany: jest.fn() };
  const inbox = new InboxService({ notification } as any);
  beforeEach(() => jest.resetAllMocks());
  it('filters inbox and unread count by the account', async () => {
    notification.findMany.mockResolvedValue([]); notification.count.mockResolvedValue(0);
    await inbox.list('account-a'); await inbox.unreadCount('account-a');
    expect(notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientAccountId: 'account-a' } }));
    expect(notification.count).toHaveBeenLastCalledWith({ where: { recipientAccountId: 'account-a', readAt: null } });
  });
  it('cannot mark another account notification as read', async () => {
    notification.findFirst.mockResolvedValue(null);
    await expect(inbox.read('account-a', 'other-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(notification.updateMany).not.toHaveBeenCalled();
  });
  it('limits read-all to notifications already created for the account', async () => {
    notification.updateMany.mockResolvedValue({ count: 2 });
    await expect(inbox.readAll('account-a')).resolves.toEqual({ updated: 2 });
    expect(notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ recipientAccountId: 'account-a', readAt: null, createdAt: { lte: expect.any(Date) } }) }));
  });
});
