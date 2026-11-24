import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Requester } from '../../../services/catalog';
import {
  cancelDoctorLeave, listDoctorLeaveRequests, listMyDoctorShifts, requestDoctorLeave,
  type DoctorLeaveRequest, type DoctorShift,
} from '../../../services/doctor';

const localToday = () => {
  const day = new Date();
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
};

export function DoctorLeaveRequestPanel({ request, doctorId }: {
  request: Requester; doctorId: string;
}) {
  const [shifts, setShifts] = useState<DoctorShift[]>([]);
  const [requests, setRequests] = useState<DoctorLeaveRequest[]>([]);
  const [workDate, setWorkDate] = useState(localToday);
  const [scheduleId, setScheduleId] = useState('');
  const [reasonCode, setReasonCode] = useState('PERSONAL_LEAVE');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const eligible = useMemo(() => shifts.filter(s => {
    const weekday = new Date(`${workDate}T00:00:00Z`).getUTCDay() || 7;
    return s.status === 'ACTIVE' && s.dayOfWeek === weekday &&
      workDate >= s.effectiveFrom.slice(0, 10) && (!s.effectiveTo || workDate <= s.effectiveTo.slice(0, 10));
  }), [shifts, workDate]);
  async function reload() {
    const [scheduleRows, leaveRows] = await Promise.all([
      listMyDoctorShifts(request, doctorId), listDoctorLeaveRequests(request, true),
    ]);
    setShifts(scheduleRows); setRequests(leaveRows);
  }
  useEffect(() => { void reload().catch(error => setNotice(error instanceof Error ? error.message : 'Không tải được đơn xin nghỉ.')); }, [request, doctorId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      await requestDoctorLeave(request, { scheduleId, workDate, reasonCode, ...(note.trim() ? { note: note.trim() } : {}) });
      await reload(); setNote(''); setScheduleId(''); setNotice('Đã gửi yêu cầu nghỉ ca. Ca vẫn khả dụng đến khi quản lý duyệt.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể gửi yêu cầu nghỉ ca.'); }
    finally { setBusy(false); }
  }
  async function withdraw(item: DoctorLeaveRequest) {
    setBusy(true); setNotice('');
    try { await cancelDoctorLeave(request, item); await reload(); setNotice('Đã rút yêu cầu nghỉ ca.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể rút yêu cầu.'); }
    finally { setBusy(false); }
  }
  return <section className="doctor-surface doctor-leave-panel"><h2>Xin nghỉ ca làm</h2>
    <p>Chọn một ca đã được quản lý xếp. Yêu cầu chỉ có hiệu lực sau khi Clinic Manager duyệt.</p>
    <form className="doctor-leave-form" onSubmit={e => void submit(e)}>
      <label>Ngày nghỉ<input type="date" min={localToday()} required value={workDate} onChange={e => { setWorkDate(e.target.value); setScheduleId(''); }} /></label>
      <label>Ca làm<select required value={scheduleId} onChange={e => setScheduleId(e.target.value)}><option value="">Chọn ca trong ngày</option>{eligible.map(s => <option key={s.id} value={s.id}>{s.startTime}–{s.endTime} · {s.roomCode ?? 'Chưa gán phòng'}</option>)}</select></label>
      <label>Lý do<select value={reasonCode} onChange={e => setReasonCode(e.target.value)}><option value="PERSONAL_LEAVE">Việc cá nhân</option><option value="SICK_LEAVE">Nghỉ ốm</option><option value="TRAINING">Đào tạo</option><option value="EMERGENCY">Khẩn cấp</option><option value="OTHER">Khác</option></select></label>
      <label>Ghi chú<input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Thông tin thêm cho quản lý" /></label>
      <button className="doctor-primary-button" disabled={busy || !scheduleId}>Gửi yêu cầu</button>
    </form>
    {notice && <p role="status" className="doctor-leave-notice">{notice}</p>}
    <h3>Yêu cầu của tôi</h3>
    {requests.length ? <div className="doctor-leave-list">{requests.map(item => <div className="doctor-schedule-row" key={item.id}><strong>{item.workDate.slice(0, 10)} · {new Date(item.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}–{new Date(item.endAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong><span>{item.status === 'PENDING' ? 'Chờ duyệt' : item.status === 'APPROVED' ? 'Đã duyệt' : item.status === 'REJECTED' ? 'Từ chối' : 'Đã hủy'}{item.reviewReason ? ` · ${item.reviewReason}` : ''}</span>{item.status === 'PENDING' && <button disabled={busy} onClick={() => void withdraw(item)}>Rút đơn</button>}</div>)}</div> : <p>Chưa có yêu cầu nghỉ ca.</p>}
  </section>;
}
