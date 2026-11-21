import type { ChatBooking } from '../../../../services/chatbot';
import { useEffect, useRef, useState } from 'react';
import { isBookingHandoffUrl } from '../../../../services/bookingHandoff';

export function BookingConversationResult({ booking, fresh, onContinue }: { booking: ChatBooking; fresh: boolean;
  onContinue?: (signal: AbortSignal) => Promise<{ url: string }> }) {
  const available = booking.availability;
  const price = available?.estimate?.estimatedTotal;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { if (!fresh) { abort.current?.abort(); setBusy(false); } }, [fresh]);
  useEffect(() => () => abort.current?.abort(), []);
  async function proceed() {
    if (!onContinue || !fresh || busy) return;
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setError('');
    try {
      const result = await onContinue(controller.signal);
      if (!isBookingHandoffUrl(result.url)) throw new Error('Liên kết đặt khám không hợp lệ. Vui lòng tra lại lịch.');
      if (!controller.signal.aborted) window.location.assign(result.url);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Chưa xác minh được lựa chọn. Vui lòng tra lại lịch.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="chatbot-booking-conversation" aria-label="Lựa chọn tra cứu trong hội thoại">
    {booking.service && <p><strong>Dịch vụ:</strong> {booking.service.name}</p>}
    {booking.selectionMode && <p><strong>Cách chọn:</strong> {booking.selectionMode === 'RANK'
      ? 'Bệnh viện sắp xếp · Hạng cơ bản' : booking.doctor?.name}</p>}
    {booking.preferenceSources && Object.keys(booking.preferenceSources).length > 0 && <p>Lượt phản hồi này dùng sở thích bạn đã lưu. Bạn có thể đổi cách chọn bác sĩ hoặc buổi khám.</p>}
    {booking.date && <p><strong>Ngày:</strong> {booking.date}{booking.period && booking.period !== 'any'
      ? ` · ${{ morning: 'Buổi sáng', afternoon: 'Buổi chiều', evening: 'Buổi tối' }[booking.period]}` : ''}{booking.time ? ` · ${booking.time}` : ''}</p>}
    {available && (!fresh ? <p>Dữ liệu lần tra trước. Gửi “tra lại lịch” để đối chiếu lại dữ liệu hiện hành.</p> : <div aria-label="Kết quả lịch qua hội thoại">
      {price && <p>Giá dự kiến: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: price.currency }).format(price.amountMinor)}</p>}
      {available.checkedAt && <p>Đối chiếu: {new Date(available.checkedAt).toLocaleString('vi-VN')}</p>}
      {available.items && (available.items.length ? <ul className="chatbot-slot-list" aria-label="Khung giờ tham khảo">{available.items.map((slot) => <li key={`${slot.doctorId}:${slot.startAt}`}>
        <strong>{new Date(slot.startAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})} – {new Date(slot.endAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})}</strong>
        <span>{new Date(slot.startAt).toLocaleDateString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})}{slot.roomCode && ` · ${slot.roomCode}`}</span>
        {slot.doctorName && <span>{slot.doctorName}</span>}
      </li>)}</ul> : <p>Không có giờ phù hợp với lựa chọn hiện tại.</p>)}
      {available.moreAvailable && <p>Còn giờ khác; bạn có thể nhắn “tìm giờ khác”.</p>}
      {available.appointments && <>
        <p>Lịch hẹn của tài khoản đang đăng nhập:</p>
        {available.appointments.items.length ? <ul>{available.appointments.items.map((a) => <li key={a.id}>
          {a.appointmentCode} · {a.status} · {new Date(a.startAt).toLocaleString('vi-VN')}
        </li>)}</ul> : <p>Chưa có lịch hẹn trong trang kết quả này.</p>}
        {available.appointments.nextPageToken && <p>Đây là trang đầu; xem thêm tại Lịch hẹn của tôi.</p>}
      </>}
      <p>Kết quả tại thời điểm tra cứu. Chưa giữ chỗ hoặc xác nhận lịch.</p>
      {onContinue && booking.phase === 'ready' && !!available.items?.length && <>
        <button type="button" className="chatbot-continue-booking" disabled={busy} onClick={proceed}>
          {busy ? 'Đang kiểm tra lựa chọn…' : 'Tiếp tục đặt khám'}
        </button>
        <p>Bạn cần chọn lại ngày/giờ và xác nhận trên trang đặt khám.</p>
      </>}
      {error && <p role="alert">{error}</p>}
    </div>)}
  </section>;
}
