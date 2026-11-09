import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceptionWorkBell } from './ReceptionWorkBell';

const mocks = vi.hoisted(() => ({ request: vi.fn(), stream: vi.fn(), subscribe: vi.fn() }));
vi.mock('../../../app/AuthSessionProvider', () => ({ useAuthSession: () => ({ request: mocks.request, stream: mocks.stream }) }));
vi.mock('../../../services/realtimeStream', () => ({ subscribeToRealtimeStream: mocks.subscribe }));

describe('reception SSE', () => {
  it('refreshes reception cases on a case event and after reconnect', async () => {
    const intervals = vi.spyOn(window, 'setInterval');
    mocks.request.mockImplementation(async (path: string) => path.startsWith('/api/reception/work')
      ? { data: { items: [], availableCount: 0, nextCursor: null } }
      : { items: [], availableCount: 0, nextCursor: null });
    mocks.subscribe.mockReturnValue(() => undefined);
    render(<ReceptionWorkBell />);
    await waitFor(() => expect(mocks.subscribe).toHaveBeenCalled());
    await waitFor(() => expect(mocks.request.mock.calls.length).toBeGreaterThanOrEqual(1));
    expect(intervals.mock.calls.some(([, delay]) => delay === 15000)).toBe(false);
    const options = mocks.subscribe.mock.calls[0][0];
    const count = (prefix: string) => mocks.request.mock.calls.filter(call => String(call[0]).startsWith(prefix)).length;
    const previous = count('/api/reception/work');
    act(() => options.onEvent({ category: 'case' }));
    await waitFor(() => expect(count('/api/reception/work')).toBeGreaterThan(previous));
    const caseCount = count('/api/reception/work');
    act(() => options.onStatusChange('CONNECTED'));
    await waitFor(() => expect(count('/api/reception/work')).toBeGreaterThan(caseCount));
    intervals.mockRestore();
  });
});
