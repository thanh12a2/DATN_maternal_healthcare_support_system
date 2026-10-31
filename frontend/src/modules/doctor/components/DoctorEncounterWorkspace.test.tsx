import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorEncounterWorkspace } from './DoctorEncounterWorkspace';

describe('DoctorEncounterWorkspace', () => {
  it('shows the selected patient and renders clinical information in the relevant tab', () => {
    const encounter = { id: 'enc-1', patientId: 'p-1', appointmentId: 'a-1', state: 'IN_PROGRESS', version: 2, appointmentSyncPending: false, vitalSigns: [{ id: 'v-1', systolic: 120, diastolic: 80, heartRate: 75 }] };
    const appointment = { id: 'a-1', encounterId: 'enc-1', patientName: 'Nguyễn An', appointmentCode: 'APT-01', status: 'IN_CLINICAL_CARE' as const };
    render(<DoctorEncounterWorkspace appointments={[appointment]} encounters={[encounter]} selected="enc-1" onSelect={vi.fn()} onReload={vi.fn()} request={vi.fn()} />);
    expect(screen.getAllByText('Nguyễn An')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Dấu hiệu sinh tồn' }));
    expect(screen.getByText('120/80 mmHg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu dấu hiệu sinh tồn' })).toBeTruthy();
  });

  it('shows guidance when no encounter is available', () => {
    render(<DoctorEncounterWorkspace appointments={[]} encounters={[]} selected="" onSelect={vi.fn()} onReload={vi.fn()} request={vi.fn()} />);
    expect(screen.getByText('Chưa có hồ sơ phù hợp')).toBeTruthy();
  });
});
