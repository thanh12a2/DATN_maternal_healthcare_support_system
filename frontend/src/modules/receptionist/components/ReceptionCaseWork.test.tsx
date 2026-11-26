import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReceptionCaseWork } from './ReceptionCaseWork';

const request = vi.fn();
vi.mock('../../../app/AuthSessionProvider', () => ({ useAuthSession: () => ({ request }) }));
const onOpen = vi.fn();
const noop = () => undefined;
function Work() { return useReceptionCaseWork(noop, onOpen).panel; }

describe('reception case work', () => {
  it('opens the selected patient and appointment directly', async () => {
    const item = { id: 'case', caseCode: 'TN-TEST', patientId: 'patient', appointmentId: 'appointment', type: 'WALK_IN', arrivalAt: new Date().toISOString(), status: 'OPEN', claim: 'MINE' };
    request.mockImplementation(async (path: string) => {
      if (path === '/api/reception/work') return { data: { items: [item], availableCount: 0, nextCursor: null } };
      if (path === '/api/patients/patient') return { data: { id: 'patient', fullName: 'Nguyễn An' } };
      if (path === '/api/appointment/appointments/appointment') return { appointmentCode: 'AP123' };
      return {};
    });
    render(<Work />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục xử lý' }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(item));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
