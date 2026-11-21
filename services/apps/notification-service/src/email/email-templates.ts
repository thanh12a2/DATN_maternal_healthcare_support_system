/** Data shown in emails is supplied by the owning services, never by the browser. */
export interface AppointmentEmailData {
  patientName: string;
  patientCode?: string;
  dateOfBirth?: string;
  address?: string;
  appointmentCode: string;
  serviceName: string;
  startAt: Date;
  endAt?: Date;
  doctorName?: string;
  roomName?: string;
  ticketCode?: string;
  paidAmountMinor?: number;
}

export interface ClinicalEmailData {
  patientName: string;
  appointmentCode: string;
  prescriptions: { items: { name: string; strength?: string; dose: string; route: string; frequency: string; durationDays?: number; instruction?: string }[] }[];
  treatmentPlans: { title: string; summary: string; items: { title: string; description?: string }[] }[];
}

export interface RenderedEmail { subject: string; text: string; html: string }

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const line = (label: string, value: string) => `<tr><td style="width:38%;padding:12px 8px;border-bottom:1px solid #e7edf2;color:#687f90;font-size:13px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:12px 8px;border-bottom:1px solid #e7edf2;color:#173651;font-size:14px;font-weight:600;line-height:1.5;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`;
const shell = (title: string, content: string) => `<!doctype html><html lang="vi"><body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#173651"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#eef4f8"><tr><td align="center" style="padding:28px 12px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#fff;border:1px solid #dfeaf1;border-radius:14px"><tr><td style="padding:26px 28px;border-bottom:1px solid #e5edf2"><div style="font-size:19px;letter-spacing:1px;font-weight:700;color:#07599d">TÂM AN <span style="font-size:11px;letter-spacing:2px;color:#57829f">HOSPITAL</span></div><div style="margin-top:5px;font-size:12px;color:#7790a1">Chăm sóc sức khỏe mẹ và bé</div></td></tr><tr><td style="padding:30px 28px"><div style="font-size:11px;letter-spacing:1.5px;font-weight:700;color:#1a8d81">THÔNG TIN DÀNH CHO NGƯỜI BỆNH</div><h1 style="font-size:22px;line-height:1.4;color:#103b61;margin:10px 0 22px">${escapeHtml(title)}</h1>${content}</td></tr><tr><td style="padding:20px 28px;background:#f7fafc;border-top:1px solid #e5edf2;color:#708797;font-size:12px;line-height:1.7">TÂM AN HOSPITAL<br>Vui lòng liên hệ cơ sở khám nếu cần hỗ trợ thông tin.</td></tr></table></td></tr></table></body></html>`;
const sectionTitle = (title: string) => `<h2 style="margin:26px 0 10px;padding-left:10px;border-left:3px solid #159885;color:#164d72;font-size:15px;line-height:1.5">${escapeHtml(title)}</h2>`;

export function renderAppointmentEmail(data: AppointmentEmailData): RenderedEmail {
  const date = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'full' }).format(data.startAt);
  const clock = (value: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(value);
  const person: [string, string][] = [['Họ và tên', data.patientName]];
  if (data.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) person.push(['Ngày sinh', data.dateOfBirth.split('-').reverse().join('/')]);
  if (data.address) person.push(['Địa chỉ', data.address]);
  if (data.patientCode) person.push(['Mã bệnh nhân', data.patientCode]);
  const visit: [string, string][] = [['Mã lịch hẹn', data.appointmentCode], ['Ngày khám', date], ['Giờ khám dự kiến', `${clock(data.startAt)}${data.endAt ? ` - ${clock(data.endAt)}` : ''}`], ['Dịch vụ', data.serviceName]];
  if (data.doctorName) visit.push(['Bác sĩ phụ trách', data.doctorName]);
  if (data.roomName) visit.push(['Phòng khám dự kiến', data.roomName]);
  if (data.ticketCode) visit.push(['Số thứ tự khám', data.ticketCode]);
  const payment: [string, string][] = [['Thanh toán', 'Đã thanh toán']];
  if (data.paidAmountMinor !== undefined) payment.push(['Số tiền đã thanh toán', `${new Intl.NumberFormat('vi-VN').format(data.paidAmountMinor)} VND`]);
  const table = (rows: [string, string][]) => `<table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([k, v]) => line(k, v)).join('')}</table>`;
  const text = ['Kính gửi ' + data.patientName + ',', 'Bệnh viện đã ghi nhận thanh toán cho lịch khám của bạn.', '', 'THÔNG TIN NGƯỜI BỆNH', ...person.map(([k, v]) => `${k}: ${v}`), '', 'THÔNG TIN LỊCH KHÁM', ...visit.map(([k, v]) => `${k}: ${v}`), '', ...payment.map(([k, v]) => `${k}: ${v}`)].join('\n');
  const html = `<p style="font-size:14px;line-height:1.7">Kính gửi <strong>${escapeHtml(data.patientName)}</strong>,<br>Bệnh viện đã ghi nhận thanh toán cho lịch khám của bạn. Thông tin đăng ký như sau:</p>${sectionTitle('Thông tin người bệnh')}${table(person)}${sectionTitle('Thông tin lịch khám')}${table(visit)}${sectionTitle('Thanh toán')}${table(payment)}<p style="margin:24px 0 0;padding:14px 16px;background:#f0f8fc;color:#456b80;font-size:13px;line-height:1.6;border-radius:8px">Vui lòng mang theo giấy tờ tùy thân và cung cấp mã lịch hẹn khi đến tiếp đón.</p>`;
  return { subject: 'Xác nhận thanh toán và thông tin lịch khám', text, html: shell('PHIẾU ĐĂNG KÝ KHÁM BỆNH', html) };
}

export function renderClinicalEmail(data: ClinicalEmailData): RenderedEmail {
  const parts: string[] = [`Người bệnh: ${data.patientName}`, `Mã lịch hẹn: ${data.appointmentCode}`, '', 'ĐƠN THUỐC'];
  const prescriptions = data.prescriptions.flatMap(p => p.items).map(item => {
    const description = [item.name, item.strength, item.dose, item.route, item.frequency, item.durationDays ? `${item.durationDays} ngày` : '', item.instruction].filter(Boolean).join(' · ');
    parts.push(description); return `<li style="padding:7px 0;line-height:1.7;color:#284b62">${escapeHtml(description)}</li>`;
  });
  if (!prescriptions.length) parts.push('Không có đơn thuốc đã phát hành.');
  parts.push('', 'KẾ HOẠCH ĐIỀU TRỊ');
  const plans = data.treatmentPlans.map(plan => {
    parts.push(plan.title, plan.summary, ...plan.items.map(item => [item.title, item.description].filter(Boolean).join(': ')));
    return `<div style="margin:12px 0;padding:16px;background:#f5fafc;border:1px solid #e0edf2;border-radius:8px"><h3 style="margin:0 0 8px;font-size:14px;color:#174e70">${escapeHtml(plan.title)}</h3><p style="margin:0;line-height:1.7;color:#496779">${escapeHtml(plan.summary)}</p><ul style="margin:8px 0 0;padding-left:20px;line-height:1.7;color:#284b62">${plan.items.map(item => `<li>${escapeHtml([item.title, item.description].filter(Boolean).join(': '))}</li>`).join('')}</ul></div>`;
  });
  if (!plans.length) parts.push('Không có kế hoạch điều trị có hiệu lực.');
  const content = `<p style="font-size:14px;line-height:1.7">Kính gửi <strong>${escapeHtml(data.patientName)}</strong>,<br>Bệnh viện gửi bạn thông tin sau lượt khám đã hoàn tất.</p><table role="presentation" style="width:100%;border-collapse:collapse">${line('Người bệnh', data.patientName)}${line('Mã lịch hẹn', data.appointmentCode)}</table>${sectionTitle('Đơn thuốc')}${prescriptions.length ? `<ol style="padding-left:20px;margin:8px 0">${prescriptions.join('')}</ol>` : '<p style="color:#708797;font-size:13px">Không có đơn thuốc đã phát hành.</p>'}${sectionTitle('Kế hoạch điều trị')}${plans.length ? plans.join('') : '<p style="color:#708797;font-size:13px">Không có kế hoạch điều trị có hiệu lực.</p>'}`;
  return { subject: 'Thông tin đơn thuốc và kế hoạch điều trị', text: parts.join('\n'), html: shell('THÔNG TIN SAU KHÁM', content) };
}

export function renderResultsEmail(patientName: string, appointmentCode: string): RenderedEmail {
  const text = `Kính gửi ${patientName},\n\nBệnh viện gửi bạn các file kết quả xét nghiệm của lịch khám ${appointmentCode} trong phần đính kèm. Vui lòng liên hệ cơ sở khám nếu cần hỗ trợ đọc kết quả.`;
  return { subject: 'Kết quả xét nghiệm', text, html: shell('KẾT QUẢ XÉT NGHIỆM', `<p>Kính gửi ${escapeHtml(patientName)},</p><p>Bệnh viện gửi bạn các file kết quả xét nghiệm của lịch khám <strong>${escapeHtml(appointmentCode)}</strong> trong phần đính kèm.</p><p>Vui lòng liên hệ cơ sở khám nếu cần hỗ trợ đọc kết quả.</p>`) };
}
