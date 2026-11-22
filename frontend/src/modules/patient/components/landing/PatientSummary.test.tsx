import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { PatientSummary } from './PatientSummary';
import { ApiError } from '../../../../services/api';

const session = vi.hoisted(() => ({
  status: 'authenticated',
  user: { userId: 'patient-1', role: 'PATIENT', email: 'patient@example.com' },
  request: vi.fn(),
}));
vi.mock('../../../../app/AuthSessionProvider', () => ({
  useAuthSession: () => session,
}));

beforeEach(() => {
  cleanup();
  session.status = 'authenticated';
  session.request.mockReset();
});

describe('patient summary', () => {
  it('does not request private data for guests', () => {
    session.status = 'anonymous';
    const { container } = render(<PatientSummary doctors={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(session.request).not.toHaveBeenCalled();
  });

  it('shows real pregnancy data and the closest eligible appointment', async () => {
    const dueDate = new Date(Date.now() + 20 * 7 * 86400000).toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    session.request.mockImplementation(async (path: string) => {
      if (path === '/api/patients/me')
        return { data: { id: 'p1', fullName: 'Nguyễn An' } };
      if (path.includes('pregnancy-episodes'))
        return { data: [{ status: 'ACTIVE', estimatedDueDate: dueDate }] };
      return {
        items: [
          { id: 'cancelled', status: 'CANCELLED', startAt: tomorrow },
          {
            id: 'later',
            status: 'BOOKED',
            startAt: new Date(Date.now() + 3 * 86400000).toISOString(),
          },
          {
            id: 'next',
            status: 'BOOKED',
            startAt: tomorrow,
            assignedDoctorId: 'd1',
            roomName: 'Phòng 2',
            serviceNameSnapshot: 'Khám thai',
          },
        ],
      };
    });
    render(
      <PatientSummary
        doctors={[{ id: 'd1', profile: { fullName: 'Bác sĩ An' } }]}
      />,
    );
    expect(
      await screen.findByRole('heading', { name: 'Xin chào, Nguyễn An!' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Bạn đang ở tuần thai thứ 20.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Xem phiếu khám' }),
    ).toHaveAttribute('href', '/lich-hen/next');
    expect(screen.getByText('Phòng 2')).toBeInTheDocument();
    expect(screen.getByText(/Bác sĩ An/)).toBeInTheDocument();
  });

  it('handles missing profile without requesting a pregnancy episode', async () => {
    session.request.mockImplementation(async (path: string) => {
      if (path === '/api/patients/me') throw new ApiError('Not found', 404);
      return { items: [] };
    });
    render(<PatientSummary doctors={[]} />);
    expect(
      await screen.findByText(
        'Hoàn thiện hồ sơ để bắt đầu hành trình chăm sóc.',
      ),
    ).toBeInTheDocument();
    expect(
      session.request.mock.calls.some(([path]) =>
        path.includes('pregnancy-episodes'),
      ),
    ).toBe(false);
  });

  it('distinguishes API failures from an empty appointment or pregnancy record', async () => {
    session.request.mockImplementation(async (path: string) => {
      if (path === '/api/patients/me')
        return { data: { id: 'p1', fullName: 'An' } };
      throw new Error('Offline');
    });
    render(<PatientSummary doctors={[]} />);
    expect(
      await screen.findByText(/Một số thông tin thai kỳ/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Bạn chưa có lịch hẹn sắp tới.')).toBeNull();
    expect(
      screen.queryByText('Chưa có thông tin thai kỳ đang theo dõi.'),
    ).toBeNull();
  });

  it('aborts pending private requests when leaving the page', async () => {
    session.request.mockImplementation(() => new Promise(() => {}));
    const view = render(<PatientSummary doctors={[]} />);
    await waitFor(() => expect(session.request).toHaveBeenCalled());
    const signal = session.request.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
