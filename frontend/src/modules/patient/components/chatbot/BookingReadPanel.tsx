import { useEffect, useRef, useState } from 'react';
import type { ChatRequest } from '../../../../services/chatbot';

export interface ReadDoctor {
  id: string; consultationRank: string; profile: { fullName: string };
}
interface ReadResult {
  items?: { doctorId: string; doctorName: string | null; roomCode: string | null; startAt: string; endAt: string }[];
  checkedAt: string;
  estimate?: { basePrice: { amountMinor: number }; doctorRankSurcharge: { amountMinor: number } | null;
    estimatedTotal: { amountMinor: number; currency: string } };
}
export function BookingReadPanel({ request, conversationId, serviceId, blocked }: {
  request: ChatRequest; conversationId: string; serviceId: string; blocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<ReadDoctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ slots: ReadResult; price: ReadResult } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { if (blocked) { abort.current?.abort(); setResult(null); setBusy(false); } }, [blocked]);
  useEffect(() => () => abort.current?.abort(), []);
  async function read<T>(body: object, signal: AbortSignal) {
    return request<T>(`/api/assistant/conversations/${encodeURIComponent(conversationId)}/tools`,
      { method: 'POST', body: JSON.stringify(body), signal });
  }
  async function loadDoctors() {
    const controller = new AbortController(); abort.current?.abort(); abort.current = controller;
    setBusy(true); setError(''); setResult(null);
    try {
      const value = await read<{ items: ReadDoctor[] }>({ name: 'list_doctors', serviceId }, controller.signal);
      if (!controller.signal.aborted) { setDoctors(value.items); setOpen(true); }
    } catch { if (!controller.signal.aborted) setError('Chưa tải được danh sách bác sĩ. Vui lòng thử lại.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function query() {
    const controller = new AbortController(); abort.current?.abort(); abort.current = controller;
    setBusy(true); setError(''); setResult(null);
    const args = { serviceId, date, selectionMode: doctorId ? 'DOCTOR' : 'RANK',
      ...(doctorId ? { requestedDoctorId: doctorId } : {}) };
    try {
      const [slots, price] = await Promise.all([
        read<ReadResult>({ ...args, name: 'query_bookable_slots' }, controller.signal),
        read<ReadResult>({ ...args, name: 'get_service_estimate' }, controller.signal),
      ]);
      if (!controller.signal.aborted) setResult({ slots, price });
    } catch { if (!controller.signal.aborted) setError('Chưa tra được lịch và giá hiện hành. Kiểm tra ngày/bác sĩ hoặc thử lại.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const format = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  return <section className="chatbot-booking-read" aria-label="Tra cứu bác sĩ, giá và lịch">
    <button type="button" disabled={blocked || busy} onClick={loadDoctors}>Tra bác sĩ và lịch</button>
    {open && <>
      <label>Ngày muốn khám<input type="date" value={date} disabled={blocked || busy}
        onChange={(e) => { setDate(e.target.value); setResult(null); }} /></label>
      <label>Cách chọn bác sĩ<select value={doctorId} disabled={blocked || busy}
        onChange={(e) => { setDoctorId(e.target.value); setResult(null); }}>
        <option value="">Bệnh viện sắp xếp — BASIC</option>
        {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.profile.fullName}</option>)}
      </select></label>
      <button type="button" disabled={blocked || busy || !date} onClick={query}>Tra lịch và giá tham khảo</button>
    </>}
    {busy && <p role="status">Đang tra dữ liệu hiện hành…</p>}
    {error && <p role="alert">{error}</p>}
    {result && !blocked && <div aria-label="Kết quả tra lịch">
      {result.price.estimate && <p>Giá dự kiến: {format(result.price.estimate.estimatedTotal.amountMinor)}
        {' '}(giá dịch vụ {format(result.price.estimate.basePrice.amountMinor)}, phụ phí hạng bác sĩ{' '}
        {format(result.price.estimate.doctorRankSurcharge?.amountMinor ?? 0)}).</p>}
      <p>Đối chiếu: {new Date(result.slots.checkedAt).toLocaleString('vi-VN')}</p>
      {!result.slots.items?.length ? <p>Chưa có giờ trống phù hợp. Vui lòng thử ngày hoặc bác sĩ khác.</p> : <ul>
        {result.slots.items.map((slot, index) => <li key={`${slot.doctorId}:${slot.startAt}:${index}`}>
          {new Date(slot.startAt).toLocaleString('vi-VN')} – {new Date(slot.endAt).toLocaleTimeString('vi-VN')}
          {slot.doctorName && ` · ${slot.doctorName}`}{slot.roomCode && ` · ${slot.roomCode}`}
        </li>)}
      </ul>}
      <p>Giờ trống có thể thay đổi. Chưa giữ chỗ hoặc xác nhận lịch. Đặt khám tại trang Đặt lịch khám hiện có.</p>
    </div>}
  </section>;
}
