import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorClinicalResources } from './DoctorClinicalResources';

describe('doctor clinical resources', () => {
  it('creates a treatment plan for the selected encounter and patient', async () => {
    const request = vi.fn().mockResolvedValue({ data: [] });
    render(<DoctorClinicalResources request={request} encounterId="encounter" patientId="patient" encounterState="IN_PROGRESS" kind="plans" />);
    fireEvent.click(await screen.findByText('Tạo kế hoạch điều trị'));
    fireEvent.change(screen.getByLabelText('Tên kế hoạch'), { target: { value: 'Theo dõi' } });
    fireEvent.change(screen.getByLabelText('Tên nội dung'), { target: { value: 'Tái khám' } });
    fireEvent.change(screen.getByLabelText('Loại nội dung'), { target: { value: 'LAB_TEST' } });
    fireEvent.change(screen.getByLabelText('Thời hạn thực hiện'), { target: { value: '2026-11-01T09:30' } });
    fireEvent.click(screen.getByText('Lưu'));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/treatment-plans', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"encounterId":"encounter"') })));
    const body = JSON.parse(request.mock.calls.find(([path, options]) => path === '/api/treatment-plans' && options?.method === 'POST')?.[1].body);
    expect(body.items[0]).toMatchObject({ type: 'LAB_TEST', dueAt: new Date('2026-11-01T09:30').toISOString() });
  });

  it('uses the real medication catalog and submits the selected medication with explicit instructions', async () => {
    const request = vi.fn().mockImplementation((path: string) => {
      if (path.includes('/medications?')) return Promise.resolve({ data: [{ code: 'MED_1', name: 'Thuốc A', activeIngredient: 'Hoạt chất A', strength: '10 mg', dosageForm: 'Viên', route: 'Uống', pregnancyCategory: 'C', pregnancyWarning: 'Cần cân nhắc', isActive: true }], meta: { total: 1, limit: 100 } });
      return Promise.resolve({ data: [] });
    });
    render(<DoctorClinicalResources request={request} encounterId="encounter" patientId="patient" encounterState="IN_PROGRESS" kind="prescriptions" />);
    fireEvent.click(await screen.findByText('Tạo đơn thuốc'));
    fireEvent.click(screen.getByRole('button', { name: /Tìm và chọn thuốc/ }));
    fireEvent.change(screen.getByLabelText('Tìm thuốc trong danh mục'), { target: { value: 'Hoạt chất A' } });
    fireEvent.click(await screen.findByRole('button', { name: /Thuốc A/ }));
    expect(screen.getByText('Cần cân nhắc')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Liều dùng 1'), { target: { value: '1 viên' } });
    fireEvent.change(screen.getByLabelText('Tần suất 1'), { target: { value: 'Mỗi ngày' } });
    fireEvent.click(screen.getByText('Lưu'));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/prescriptions', expect.objectContaining({ method: 'POST', body: expect.stringContaining('"medicationCode":"MED_1"') })));
  });

  it('completes a treatment item using the plan version', async () => {
    const request = vi.fn().mockResolvedValue({ data: [{ id: 'plan', title: 'Theo dõi', status: 'ACTIVE', version: 4, items: [{ id: 'item', title: 'Tái khám', status: 'IN_PROGRESS' }] }] });
    render(<DoctorClinicalResources request={request} encounterId="encounter" patientId="patient" encounterState="FINALIZED" kind="plans" />);
    fireEvent.click(await screen.findByText('Đánh dấu hoàn thành'));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/treatment-plans/plan/items/item/complete', expect.objectContaining({ method: 'POST', body: '{"version":4}' })));
  });

  it('keeps active plan items and requires a reason when adjusting a plan', async () => {
    const request = vi.fn().mockResolvedValue({ data: [{ id: 'plan', title: 'Theo dõi', summary: 'Tóm tắt', status: 'ACTIVE', version: 4, items: [{ id: 'item', title: 'Tái khám', status: 'PENDING' }] }] });
    render(<DoctorClinicalResources request={request} encounterId="encounter" patientId="patient" encounterState="FINALIZED" kind="plans" />);
    fireEvent.click(await screen.findByText('Điều chỉnh kế hoạch'));
    fireEvent.click(screen.getByText('Lưu'));
    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng nhập lý do');
    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Điều chỉnh theo kết quả khám' } });
    fireEvent.click(screen.getByText('Lưu'));
    await waitFor(() => expect(request).toHaveBeenCalledWith('/api/treatment-plans/plan', expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('"reason":"Điều chỉnh theo kết quả khám"') })));
    expect(request.mock.calls.find(([path, options]) => path === '/api/treatment-plans/plan' && options?.method === 'PATCH')?.[1].body).toContain('"id":"item"');
  });
});
