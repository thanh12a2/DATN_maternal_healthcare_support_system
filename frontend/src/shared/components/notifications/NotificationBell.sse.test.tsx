import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';

const mocks = vi.hoisted(() => ({ request: vi.fn(), stream: vi.fn(), subscribe: vi.fn(), user: { userId: 'patient-a' } }));
vi.mock('../../../app/AuthSessionProvider', () => ({ useAuthSession: () => ({ request: mocks.request, stream: mocks.stream, user: mocks.user }) }));
vi.mock('../../../services/realtimeStream', () => ({ subscribeToRealtimeStream: mocks.subscribe }));

describe('personal notification SSE', () => {
  it('refreshes after an event and reconnect without 15-second polling', async () => {
    mocks.request.mockImplementation(async (path: string) => path.includes('unread-count') ? { count: 0 } : { items: [] });
    mocks.subscribe.mockReturnValue(() => undefined);
    const interval = vi.spyOn(window, 'setInterval');
    const view = render(<NotificationBell />);
    await waitFor(() => expect(mocks.subscribe).toHaveBeenCalled());
    const options = mocks.subscribe.mock.calls[0][0];
    await waitFor(() => expect(mocks.request.mock.calls.length).toBeGreaterThanOrEqual(2));
    const count = mocks.request.mock.calls.length;
    act(() => options.onEvent({ eventType: 'notification.inbox.changed' }));
    await waitFor(() => expect(mocks.request.mock.calls.length).toBeGreaterThan(count));
    const after = mocks.request.mock.calls.length;
    act(() => options.onStatusChange('CONNECTED'));
    await waitFor(() => expect(mocks.request.mock.calls.length).toBeGreaterThan(after));
    expect(interval.mock.calls.some(([, delay]) => delay === 15000)).toBe(false);
    view.unmount(); interval.mockRestore();
  });

  it('closes the previous stream when the signed-in account changes', async () => {
    mocks.subscribe.mockClear();
    const disconnect = vi.fn(); mocks.subscribe.mockReturnValue(disconnect);
    mocks.request.mockImplementation(async (path: string) => path.includes('unread-count') ? { count: 0 } : { items: [] });
    mocks.user.userId = 'patient-a';
    const view = render(<NotificationBell />);
    await waitFor(() => expect(mocks.subscribe).toHaveBeenCalledTimes(1));
    mocks.user.userId = 'patient-b';
    view.rerender(<NotificationBell />);
    await waitFor(() => expect(mocks.subscribe).toHaveBeenCalledTimes(2));
    expect(disconnect).toHaveBeenCalled();
    view.unmount();
  });
});
