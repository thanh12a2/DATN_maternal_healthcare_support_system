import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorEncounterActions } from './DoctorEncounterActions';

describe('doctor encounter actions', () => {
  it('starts a checked-in, assigned encounter with its expected version', async () => {
    const request = vi.fn().mockResolvedValue({});
    const onSaved = vi.fn();
    render(
      <DoctorEncounterActions
        encounter={{
          id: 'encounter',
          state: 'DRAFT',
          version: 2,
          appointmentSyncPending: false,
        }}
        appointment={{
          id: 'appointment',
          encounterId: 'encounter',
          status: 'CHECKED_IN',
        }}
        request={request}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu khám' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/medical-records/encounters/encounter/start',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ expectedVersion: 2 }),
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('blocks transitions while synchronization is pending', () => {
    render(
      <DoctorEncounterActions
        encounter={{
          id: 'encounter',
          state: 'IN_PROGRESS',
          version: 3,
          appointmentSyncPending: true,
        }}
        appointment={{ encounterId: 'encounter', status: 'IN_CLINICAL_CARE' }}
        request={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Hoàn tất' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('chờ đồng bộ');
  });

  it('does not start before check-in or when the appointment is not linked', () => {
    render(
      <DoctorEncounterActions
        encounter={{
          id: 'encounter',
          state: 'DRAFT',
          version: 1,
          appointmentSyncPending: false,
        }}
        appointment={{ encounterId: 'other', status: 'BOOKED' }}
        request={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Bắt đầu khám' })).toBeDisabled();
  });

  it('completes an in-progress encounter using the version returned by the review step', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: { state: 'READY_FOR_REVIEW', version: 4 },
      })
      .mockResolvedValueOnce({ data: { state: 'FINALIZED', version: 5 } });
    const onSaved = vi.fn();
    render(
      <DoctorEncounterActions
        encounter={{
          id: 'encounter',
          state: 'IN_PROGRESS',
          version: 3,
          appointmentSyncPending: false,
        }}
        appointment={{ encounterId: 'encounter', status: 'IN_CLINICAL_CARE' }}
        request={request}
        onSaved={onSaved}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'Chuyển duyệt' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/api/medical-records/encounters/encounter/ready-for-review',
      expect.objectContaining({ body: JSON.stringify({ expectedVersion: 3 }) }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/api/medical-records/encounters/encounter/finalize',
      expect.objectContaining({ body: JSON.stringify({ expectedVersion: 4 }) }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('does not finalize when required results are pending', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new Error('REQUIRED_RESULTS_PENDING'));
    render(
      <DoctorEncounterActions
        encounter={{
          id: 'encounter',
          state: 'IN_PROGRESS',
          version: 3,
          appointmentSyncPending: false,
        }}
        appointment={{ encounterId: 'encounter', status: 'IN_CLINICAL_CARE' }}
        request={request}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Còn kết quả bắt buộc chưa được xác minh',
      ),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('continues from ready status without repeating the review step', async () => {
    const request = vi.fn().mockResolvedValue({});
    render(
      <DoctorEncounterActions
        encounter={{
          id: 'encounter',
          state: 'READY_FOR_REVIEW',
          version: 4,
          appointmentSyncPending: false,
        }}
        appointment={{ encounterId: 'encounter', status: 'IN_CLINICAL_CARE' }}
        request={request}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/medical-records/encounters/encounter/finalize',
        expect.objectContaining({
          body: JSON.stringify({ expectedVersion: 4 }),
        }),
      ),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reloads the encounter when finalization fails after the review step', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: { state: 'READY_FOR_REVIEW', version: 4 },
      })
      .mockRejectedValueOnce(new Error('Lỗi kết nối'));
    const onSaved = vi.fn();
    render(
      <DoctorEncounterActions
        encounter={{
          id: 'encounter',
          state: 'IN_PROGRESS',
          version: 3,
          appointmentSyncPending: false,
        }}
        appointment={{ encounterId: 'encounter', status: 'IN_CLINICAL_CARE' }}
        request={request}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'chưa xác nhận hoàn tất',
      ),
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
