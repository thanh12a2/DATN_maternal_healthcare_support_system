import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DoctorConsultationDetail } from './DoctorConsultationDetail';

vi.mock('./DoctorClinicalResources', () => ({
  DoctorClinicalResources: () => null,
}));
vi.mock('./DoctorClinicalFiles', () => ({ DoctorClinicalFiles: () => null }));
vi.mock('./DoctorClinicalOrders', () => ({ DoctorClinicalOrders: () => null }));
vi.mock('./DoctorClinicalServiceOrders', () => ({
  DoctorClinicalServiceOrders: () => null,
}));
vi.mock('./MedicalReportModal', () => ({ MedicalReportModal: () => null }));
vi.mock('../../../shared/components/portal/ClinicalOrdersResultModal', () => ({
  ClinicalOrdersResultModal: () => null,
}));

const base = '/api/medical-records/encounters/encounter';
afterEach(cleanup);
function show(request: any, state = 'IN_PROGRESS') {
  return render(
    <DoctorConsultationDetail
      appointment={
        {
          id: 'appointment',
          encounterId: 'encounter',
          patientId: 'patient',
          status: 'IN_CLINICAL_CARE',
        } as any
      }
      encounter={{ id: 'encounter', patientId: 'patient', state, version: 3 }}
      allAppointments={[]}
      allEncounters={[]}
      doctor={null}
      request={request}
      onBack={vi.fn()}
      onReload={vi.fn()}
    />,
  );
}
function response(state = 'IN_PROGRESS', version = 3) {
  return { data: { id: 'encounter', patientId: 'patient', state, version } };
}
async function complete() {
  fireEvent.click(
    screen.getAllByRole('button', { name: /Hoàn tất ca khám/ })[0],
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tất' }));
}

it('keeps completion available in review and generates the report only after finalizing', async () => {
  const request = vi.fn().mockImplementation(async (path: string) => {
    if (path === `${base}/finalize`) return response('FINALIZED', 4);
    if (path === base) return response('READY_FOR_REVIEW');
    return { data: [] };
  });
  show(request, 'READY_FOR_REVIEW');
  await complete();
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      `${base}/finalize`,
      expect.objectContaining({ body: JSON.stringify({ expectedVersion: 3 }) }),
    ),
  );
  await waitFor(() =>
    expect(
      request.mock.calls.some(
        ([path]) => path === '/api/documents/encounter-reports',
      ),
    ).toBe(true),
  );
});

it('serializes autosaves and uses the refreshed version for the next clinical write', async () => {
  let version = 3;
  const request = vi
    .fn()
    .mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        expect(JSON.parse(options.body as string).expectedVersion).toBe(
          version,
        );
        version++;
        return { data: { id: 'item', version } };
      }
      return response('IN_PROGRESS', version);
    });
  show(request);
  fireEvent.change(screen.getByPlaceholderText('120/80'), {
    target: { value: '120/80' },
  });
  fireEvent.blur(screen.getByPlaceholderText('120/80'));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      `${base}/vital-signs`,
      expect.objectContaining({
        body: JSON.stringify({
          systolic: 120,
          diastolic: 80,
          expectedVersion: 3,
        }),
      }),
    ),
  );
  const diagnosis = screen.getByPlaceholderText(/Nhập chẩn đoán lâm sàng/);
  fireEvent.change(diagnosis, { target: { value: 'Kiểm tra' } });
  fireEvent.blur(diagnosis);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      `${base}/diagnoses`,
      expect.objectContaining({
        body: JSON.stringify({
          code: 'KCB',
          description: 'Kiểm tra',
          expectedVersion: 4,
        }),
      }),
    ),
  );
});

it('blocks further editing until a saved encounter can be refreshed', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce({ data: { id: 'item', version: 4 } })
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce(response('IN_PROGRESS', 4));
  show(request);
  fireEvent.change(screen.getByPlaceholderText('120/80'), {
    target: { value: '120/80' },
  });
  fireEvent.blur(screen.getByPlaceholderText('120/80'));
  const retry = await screen.findByRole('button', { name: 'Tải lại hồ sơ' });
  expect(screen.getByPlaceholderText('120/80')).toBeDisabled();
  fireEvent.click(retry);
  await waitFor(() =>
    expect(screen.getByPlaceholderText('120/80')).toBeEnabled(),
  );
});

it('does not finalize or announce completion while required clinical results are pending', async () => {
  const request = vi.fn().mockImplementation(async (path: string) => {
    if (path === `${base}/ready-for-review`)
      throw new Error('REQUIRED_RESULTS_PENDING');
    if (path === base) return response();
    return { data: [] };
  });
  show(request);
  await complete();
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      `${base}/ready-for-review`,
      expect.anything(),
    ),
  );
  await screen.findByText('Còn kết quả bắt buộc chưa được xác minh.');
  expect(request.mock.calls.some(([path]) => path === `${base}/finalize`)).toBe(
    false,
  );
  expect(
    request.mock.calls.some(
      ([path]) => path === '/api/appointment/desk/broadcast',
    ),
  ).toBe(false);
});
