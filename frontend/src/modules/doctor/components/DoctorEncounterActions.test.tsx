import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorEncounterActions } from './DoctorEncounterActions';

describe('doctor encounter actions', () => {
  it('starts a checked-in, assigned encounter with its expected version', async () => {
    const request = vi.fn().mockResolvedValue({});
    const onSaved = vi.fn();
    render(<DoctorEncounterActions encounter={{ id: 'encounter', state: 'DRAFT', version: 2, appointmentSyncPending: false }} appointment={{ id: 'appointment', encounterId: 'encounter', status: 'CHECKED_IN' }} request={request} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu khám' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/medical-records/encounters/encounter/start', expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 2 }) })));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('blocks transitions while synchronization is pending', () => {
    render(<DoctorEncounterActions encounter={{ id: 'encounter', state: 'IN_PROGRESS', version: 3, appointmentSyncPending: true }} appointment={{ encounterId: 'encounter', status: 'IN_CLINICAL_CARE' }} request={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Chuyển duyệt' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('chờ đồng bộ');
  });

  it('does not start before check-in or when the appointment is not linked', () => {
    render(<DoctorEncounterActions encounter={{ id: 'encounter', state: 'DRAFT', version: 1, appointmentSyncPending: false }} appointment={{ encounterId: 'other', status: 'BOOKED' }} request={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Bắt đầu khám' })).toBeDisabled();
  });
});
