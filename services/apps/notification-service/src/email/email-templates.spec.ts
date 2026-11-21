import { renderAppointmentEmail, renderClinicalEmail, renderResultsEmail } from './email-templates';

describe('patient email templates', () => {
  it('uses actual appointment fields and does not invent a queue number', () => {
    const result = renderAppointmentEmail({ patientName: 'Nguyễn An', appointmentCode: 'AP-1', serviceName: 'Khám thai', startAt: new Date('2026-11-09T01:00:00Z'), paidAmountMinor: 100000 });
    expect(result.text).toContain('AP-1');
    expect(result.text).toContain('100.000 VND');
    expect(result.text).not.toContain('Số thứ tự');
    expect(result.html).toContain('Khám thai');
  });
  it('formats available patient and visit details and escapes email content', () => {
    const result = renderAppointmentEmail({ patientName: 'An <Bình>', patientCode: 'PA-123', dateOfBirth: '1993-09-22', address: 'Hà Nội & tỉnh khác', appointmentCode: 'AP-3', serviceName: 'Khám thai', startAt: new Date('2026-11-09T01:00:00Z'), endAt: new Date('2026-11-09T01:30:00Z'), doctorName: 'Bác sĩ A', roomName: 'P.201' });
    expect(result.text).toContain('Ngày sinh: 22/09/1993');
    expect(result.text).toContain('Giờ khám dự kiến: 08:00 - 08:30');
    expect(result.text).toContain('Mã bệnh nhân: PA-123');
    expect(result.text).toContain('Thanh toán: Đã thanh toán');
    expect(result.text).not.toContain('Số tiền đã thanh toán');
    expect(result.html).toContain('An &lt;Bình&gt;');
    expect(result.html).toContain('Hà Nội &amp; tỉnh khác');
    expect(result.html).not.toContain('Số thứ tự khám');
  });
  it('includes medication and treatment details and escapes HTML', () => {
    const result = renderClinicalEmail({ patientName: '<script>', appointmentCode: 'AP-2', prescriptions: [{ items: [{ name: 'Thuốc A', dose: '1 viên', route: 'Uống', frequency: 'Sáng', durationDays: 3 }] }], treatmentPlans: [{ title: 'Theo dõi', summary: 'Tái khám', items: [{ title: 'Đo huyết áp' }] }] });
    expect(result.text).toContain('Thuốc A');
    expect(result.text).toContain('Đo huyết áp');
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('&lt;script&gt;');
  });
  it('introduces the attached results and escapes patient data', () => {
    const result = renderResultsEmail('An & Bình', 'AP-3');
    expect(result.text).toContain('đính kèm');
    expect(result.html).toContain('An &amp; Bình');
  });
});
