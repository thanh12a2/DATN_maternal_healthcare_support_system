import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReceptionCaseWork } from './ReceptionCaseWork';

const request = vi.fn();
vi.mock('../../../app/AuthSessionProvider', () => ({ useAuthSession: () => ({ request }) }));
const noop = () => undefined;
function Work() { return useReceptionCaseWork(noop, noop).panel; }

describe('reception case work', () => {
  it('shows patient details and opens the claimed case for verification', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    request.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/reception/work') return { data: { items: [{ id, caseCode: 'TN-TEST', patientId: 'patient', appointmentId: 'appointment', type: 'WALK_IN', arrivalAt: new Date().toISOString(), status: 'OPEN', claim: 'MINE' }], availableCount: 0, nextCursor: null } };
      if (path === '/api/patients/patient') return { data: { id: 'patient', fullName: 'Nguyễn An' } };
      if (path === '/api/appointment/appointments/appointment') return { appointmentCode: 'AP123' };
      if (path === `/api/reception/cases/${id}`) return { data: { id, status: 'OPEN', version: 1 } };
      if (init?.method === 'POST') return {};
      return {};
    });
    render(<Work />);
    expect(await screen.findByText('Nguyễn An', {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText(/Vãng lai/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mở case' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Đã kiểm tra và xác minh danh tính' })).not.toBeDisabled());
  });
  it('confirms a transfer in the owned case and continues admission', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    let admitted = false;
    request.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/reception/work') return { data: { items: [{ id, caseCode: 'TN-TEST', patientId: 'patient', appointmentId: 'appointment', type: 'SCHEDULED', arrivalAt: new Date().toISOString(), status: admitted ? 'ADMITTED' : 'ADMISSION_IN_PROGRESS', claim: 'MINE', admissionStatus: admitted ? 'COMPLETED' : 'AWAITING_PAYMENT' }], availableCount: 0, nextCursor: null } };
      if (path === '/api/patients/patient') return { data: { fullName: 'Nguyễn An' } };
      if (path === '/api/appointment/appointments/appointment') return { appointmentCode: 'AP123' };
      if (path === `/api/reception/cases/${id}`) return { data: { id, status: admitted ? 'ADMITTED' : 'ADMISSION_IN_PROGRESS', version: 1, admission: { status: admitted ? 'COMPLETED' : 'AWAITING_PAYMENT', invoiceId: 'invoice' } } };
      if (path === '/api/billing/invoices/invoice') return { id: 'invoice', invoiceNumber: 'INV1', totalMinor: 1000, status: 'PAYMENT_PENDING_VERIFICATION', version: 2, payment: { id: 'payment', status: 'RECORDED', method: 'MANUAL_BANK_TRANSFER' } };
      if (path === '/api/billing/payments/payment/verify' && init?.method === 'POST') return {};
      if (path === `/api/reception/cases/${id}/admit`) { admitted = true; return {}; }
      return {};
    });
    render(<Work />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở case' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận chuyển khoản' }));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/billing/payments/payment/verify', expect.objectContaining({ method: 'POST' })));
    await waitFor(() => expect(screen.getByText('Đã xác nhận thanh toán và hoàn tất tiếp nhận.')).toBeTruthy());
  });
});
