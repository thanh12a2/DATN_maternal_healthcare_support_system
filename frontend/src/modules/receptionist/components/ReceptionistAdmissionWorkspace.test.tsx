import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceptionistAdmissionWorkspace } from './ReceptionistAdmissionWorkspace';

const selectionKey = 'an-tam-receptionist-selection';
const caseKey = 'an-tam-receptionist-case';

afterEach(() => window.sessionStorage.clear());

describe('reception case selection', () => {
  it('does not let staff verify a case from a different appointment', async () => {
    window.sessionStorage.setItem(selectionKey, JSON.stringify({ patientId: 'patient', appointmentId: 'new-appointment' }));
    window.sessionStorage.setItem(caseKey, 'old-case');
    const request = vi.fn().mockImplementation((path: string) => {
      if (path === '/api/patients/patient') return Promise.resolve({ data: { id: 'patient', fullName: 'Bệnh nhân' } });
      if (path.startsWith('/api/appointment/appointments?')) return Promise.resolve({ data: [{ id: 'new-appointment', appointmentCode: 'LICH-MOI' }] });
      if (path === '/api/reception/cases/old-case') return Promise.resolve({ data: { id: 'old-case', patientId: 'patient', appointmentId: 'old-appointment', status: 'ADMITTED', version: 3 } });
      throw new Error('Unexpected request');
    });
    render(<ReceptionistAdmissionWorkspace section="check-in" request={request} />);
    expect(await screen.findByText(/Case trước không thuộc lịch hẹn đang chọn/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác minh danh tính' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Quay lại mở case' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(caseKey)).toBeNull();
    expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('shows an already admitted case as completed and does not allow verification again', async () => {
    window.sessionStorage.setItem(selectionKey, JSON.stringify({ patientId: 'patient', appointmentId: 'appointment' }));
    window.sessionStorage.setItem(caseKey, 'case');
    const request = vi.fn().mockImplementation((path: string) => {
      if (path === '/api/patients/patient') return Promise.resolve({ data: { id: 'patient', fullName: 'Bệnh nhân' } });
      if (path.startsWith('/api/appointment/appointments?')) return Promise.resolve({ data: [{ id: 'appointment', appointmentCode: 'LICH' }] });
      if (path === '/api/reception/cases/case') return Promise.resolve({ data: { id: 'case', patientId: 'patient', appointmentId: 'appointment', status: 'ADMITTED', version: 3 } });
      throw new Error('Unexpected request');
    });
    render(<ReceptionistAdmissionWorkspace section="check-in" request={request} />);
    await waitFor(() => expect(screen.getByText('Đã tiếp nhận')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Xác minh danh tính' })).toBeDisabled();
  });

  it('verifies a matching open case and allows the next step', async () => {
    window.sessionStorage.setItem(selectionKey, JSON.stringify({ patientId: 'patient', appointmentId: 'appointment' }));
    window.sessionStorage.setItem(caseKey, 'case');
    let status = 'OPEN';
    const request = vi.fn().mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/patients/patient') return Promise.resolve({ data: { id: 'patient', fullName: 'Bệnh nhân' } });
      if (path.startsWith('/api/appointment/appointments?')) return Promise.resolve({ data: [{ id: 'appointment', appointmentCode: 'LICH' }] });
      if (path === '/api/reception/cases/case') return Promise.resolve({ data: { id: 'case', patientId: 'patient', appointmentId: 'appointment', status, version: 1 } });
      if (path === '/api/reception/cases/case/identity-verifications' && init?.method === 'POST') { status = 'IDENTITY_VERIFIED'; return Promise.resolve({ data: { id: 'verification' } }); }
      throw new Error('Unexpected request');
    });
    render(<ReceptionistAdmissionWorkspace section="check-in" request={request} />);
    const verify = screen.getByRole('button', { name: 'Xác minh danh tính' });
    await waitFor(() => expect(verify).toBeEnabled());
    fireEvent.click(verify);
    await waitFor(() => expect(screen.getByText('Đã xác minh')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Admit / Check-in' })).toBeEnabled();
  });
});
