import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DoctorConsultationDetail } from './DoctorConsultationDetail';

vi.mock('./DoctorClinicalResources', () => ({ DoctorClinicalResources: () => null }));
vi.mock('./DoctorClinicalFiles', () => ({ DoctorClinicalFiles: () => null }));

it('keeps the completion action available after an encounter enters review', async () => {
  const encounter = { id: 'encounter', patientId: 'patient', state: 'READY_FOR_REVIEW', version: 4 };
  const request = vi.fn().mockResolvedValue({ data: encounter });
  render(<DoctorConsultationDetail appointment={{ id: 'appointment', encounterId: 'encounter', patientId: 'patient', status: 'IN_CLINICAL_CARE' } as any} encounter={encounter} allAppointments={[]} allEncounters={[]} doctor={null} request={request} onBack={vi.fn()} onReload={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: /Hoàn tất ca khám/ })).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: /Chuyển duyệt/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Bắt đầu khám bệnh/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Hoàn tất ca khám/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Hoàn tất' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/medical-records/encounters/encounter/finalize', expect.objectContaining({ body: JSON.stringify({ expectedVersion: 4 }) })));
  cleanup();
});

it('reloads the encounter after a clinical save and keeps other tabs editable with the new version', async () => {
  let version = 3;
  const encounter = () => ({ id: 'encounter', patientId: 'patient', state: 'IN_PROGRESS', version });
  const request = vi.fn().mockImplementation(async (_path: string, options?: RequestInit) => {
    if (options?.method === 'POST') { version++; return { data: { id: 'new-clinical-item', version } }; }
    return { data: encounter() };
  });
  render(<DoctorConsultationDetail appointment={{ id: 'appointment', encounterId: 'encounter', patientId: 'patient', status: 'IN_CLINICAL_CARE' } as any} encounter={encounter()} allAppointments={[]} allEncounters={[]} doctor={null} request={request} onBack={vi.fn()} onReload={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('120'), { target: { value: '120' } });
  fireEvent.click(screen.getByRole('button', { name: /Lưu dấu hiệu sinh tồn/ }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/medical-records/encounters/encounter/vital-signs', expect.objectContaining({ body: JSON.stringify({ systolic: 120, expectedVersion: 3 }) })));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  fireEvent.click(screen.getByRole('tab', { name: /Khám & Chẩn đoán bệnh/ }));
  const code = await screen.findByPlaceholderText('Mã ICD-10 (ví dụ: Z34.8)');
  expect(code).toBeEnabled();
  fireEvent.change(code, { target: { value: 'Z34.8' } });
  fireEvent.change(screen.getByPlaceholderText('Mô tả chẩn đoán lâm sàng chi tiết của bác sĩ...'), { target: { value: 'Kiểm tra' } });
  fireEvent.click(screen.getByRole('button', { name: /Lưu chẩn đoán/ }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/medical-records/encounters/encounter/diagnoses', expect.objectContaining({ body: JSON.stringify({ code: 'Z34.8', description: 'Kiểm tra', expectedVersion: 4 }) })));
  cleanup();
});

it('lets the doctor retry loading if a saved encounter cannot be refreshed', async () => {
  const encounter = { id: 'encounter', patientId: 'patient', state: 'IN_PROGRESS', version: 3 };
  const request = vi.fn().mockResolvedValueOnce({ data: encounter }).mockResolvedValueOnce({ data: { id: 'item', version: 4 } }).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ data: { ...encounter, version: 4 } });
  render(<DoctorConsultationDetail appointment={{ id: 'appointment', encounterId: 'encounter', patientId: 'patient', status: 'IN_CLINICAL_CARE' } as any} encounter={encounter} allAppointments={[]} allEncounters={[]} doctor={null} request={request} onBack={vi.fn()} onReload={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('120'), { target: { value: '120' } });
  fireEvent.click(screen.getByRole('button', { name: /Lưu dấu hiệu sinh tồn/ }));
  const retry = await screen.findByRole('button', { name: 'Tải lại hồ sơ' });
  expect(screen.getByPlaceholderText('120')).toBeDisabled();
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByPlaceholderText('120')).toBeEnabled());
  cleanup();
});
