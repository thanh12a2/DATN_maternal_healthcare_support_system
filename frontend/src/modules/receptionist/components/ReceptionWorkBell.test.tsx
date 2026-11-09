import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReceptionWorkBell } from './ReceptionWorkBell';

const request = vi.fn();
vi.mock('../../../app/AuthSessionProvider', () => ({ useAuthSession: () => ({ request }) }));

describe('reception notifications', () => {
  it('shows one reception list without the old work tabs', async () => {
    request.mockResolvedValue({ data: { items: [], availableCount: 0, nextCursor: null } });
    render(<ReceptionWorkBell />);
    fireEvent.click(screen.getByLabelText('Công việc tiếp nhận, 0 cần chú ý'));
    await waitFor(() => expect(screen.getByText('Không có case tiếp nhận cần xử lý.')).toBeTruthy());
    expect(screen.queryByRole('tab')).toBeNull();
  });
});
