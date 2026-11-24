import { useEffect, useState, type FormEvent } from 'react';
import type { Requester } from '../../../services/catalog';
import {
  cancelDoctorAvailabilityOverride,
  cancelManagedDoctorSchedule,
  createDoctorAvailabilityOverride,
  createManagedDoctorSchedule,
  createClinicRoom,
  updateClinicRoom,
  updateManagedDoctorSchedule,
  listManagerBookableSlots,
  type ClinicRoom,
  type ManagedDoctorSchedule,
  type ManagerBookableSlot,
} from '../../../services/clinicManager';
import type { DoctorAvailabilityItem } from '../../../services/adminDoctors';
import type { MedicalServiceItem } from '../../../services/adminCatalog';

const days = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const tomorrow = () => {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const scheduleStatus = (value?: string) => ({ ACTIVE: 'Đang hiệu lực', CANCELLED: 'Đã hủy' } as Record<string, string>)[value ?? ''] ?? value ?? 'Chưa rõ';

export function DoctorScheduling({ request, doctorId, schedules, rooms, overrides, services, refresh }: {
  request: Requester; doctorId: string; schedules: ManagedDoctorSchedule[];
  rooms: ClinicRoom[]; overrides: DoctorAvailabilityItem[]; services: MedicalServiceItem[]; refresh: () => Promise<void>;
}) {
  const [dayOfWeek, setDay] = useState(1);
  const [startTime, setStart] = useState('08:00');
  const [endTime, setEnd] = useState('12:00');
  const [slotDurationMinutes, setDuration] = useState(30);
  const [effectiveFrom, setFrom] = useState(tomorrow);
  const [effectiveTo, setTo] = useState('');
  const [roomId, setRoom] = useState('');
  const [editing, setEditing] = useState<ManagedDoctorSchedule | null>(null);
  const [overrideType, setOverrideType] = useState<'UNAVAILABLE' | 'EXTRA_AVAILABLE'>('UNAVAILABLE');
  const [overrideStart, setOverrideStart] = useState('');
  const [overrideEnd, setOverrideEnd] = useState('');
  const [reasonCode, setReasonCode] = useState<'PERSONAL_LEAVE' | 'SICK_LEAVE' | 'TRAINING' | 'EMERGENCY' | 'EXTRA_SHIFT' | 'OTHER'>('PERSONAL_LEAVE');
  const [note, setNote] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [previewDate, setPreviewDate] = useState(tomorrow);
  const [previewServiceId, setPreviewServiceId] = useState('');
  const [previewSlots, setPreviewSlots] = useState<ManagerBookableSlot[] | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [cancelTarget, setCancelTarget] = useState<
    { type: 'schedule'; item: ManagedDoctorSchedule } | { type: 'override'; item: DoctorAvailabilityItem } | null
  >(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!cancelTarget) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCancelTarget(null);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [cancelTarget]);

  async function previewPatientSlots() {
    if (!previewServiceId) return;
    setPreviewBusy(true); setPreviewError('');
    try { setPreviewSlots(await listManagerBookableSlots(request, previewServiceId, doctorId, previewDate)); }
    catch (error) { setPreviewSlots(null); setPreviewError(error instanceof Error ? error.message : 'Không tải được giờ đặt.'); }
    finally { setPreviewBusy(false); }
  }

  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setBusy(true);
    setNotice('');
    try {
      await action();
      await refresh();
      setNotice(success);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể thực hiện thao tác.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget || cancelReason.trim().length < 3) return;
    const target = cancelTarget;
    const success = await run(
      target.type === 'schedule'
        ? () => cancelManagedDoctorSchedule(request, doctorId, target.item, cancelReason.trim())
        : () => cancelDoctorAvailabilityOverride(request, doctorId, target.item, cancelReason.trim()),
      target.type === 'schedule' ? 'Đã hủy lịch làm việc.' : 'Đã hủy ca bổ sung/nghỉ.',
    );
    if (success) { setCancelTarget(null); setCancelReason(''); }
  }

  function edit(item: ManagedDoctorSchedule) {
    setEditing(item);
    setDay(item.dayOfWeek);
    setStart(item.startTime);
    setEnd(item.endTime);
    setDuration(item.slotDurationMinutes ?? 30);
    setFrom(item.effectiveFrom?.slice(0, 10) ?? tomorrow());
    setTo(item.effectiveTo?.slice(0, 10) ?? '');
    setRoom(item.roomId ?? '');
  }

  async function submitSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startTime >= endTime) return setNotice('Giờ kết thúc phải sau giờ bắt đầu.');
    if (effectiveTo && effectiveTo < effectiveFrom) return setNotice('Ngày kết thúc phải sau ngày bắt đầu.');
    const shared = { startTime, endTime, slotDurationMinutes, effectiveFrom,
      ...(effectiveTo ? { effectiveTo } : {}), ...(roomId ? { roomId } : {}) };
    await run(async () => {
      if (editing) await updateManagedDoctorSchedule(request, doctorId, editing, shared);
      else await createManagedDoctorSchedule(request, doctorId, { dayOfWeek, ...shared });
      setEditing(null);
    }, editing ? 'Đã cập nhật lịch làm việc.' : 'Đã tạo lịch làm việc.');
  }

  async function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (overrideStart >= overrideEnd) return setNotice('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
    await run(() => createDoctorAvailabilityOverride(request, doctorId, {
      type: overrideType, startAt: new Date(overrideStart).toISOString(), endAt: new Date(overrideEnd).toISOString(),
      reasonCode: overrideType === 'EXTRA_AVAILABLE' ? 'EXTRA_SHIFT' : reasonCode,
      ...(note ? { note } : {}), ...(roomId ? { roomId } : {}),
    }), 'Đã ghi nhận ca bổ sung/nghỉ.');
  }

  return <div className="clinic-scheduling">
    <section className="clinic-form clinic-compact-form clinic-slot-preview">
      <strong>Giờ bệnh nhân có thể đặt</strong>
      <p>Hiển thị từ lịch ca đang hiệu lực, sau khi tính đơn nghỉ đã duyệt và lịch hẹn đã có.</p>
      <div className="clinic-form-pair"><label>Ngày khám<input type="date" min={tomorrow()} value={previewDate} onChange={e => { setPreviewDate(e.target.value); setPreviewSlots(null); }} /></label>
        <label>Dịch vụ<select value={previewServiceId} onChange={e => { setPreviewServiceId(e.target.value); setPreviewSlots(null); }}><option value="">Chọn dịch vụ</option>{services.filter(s => s.status === 'ACTIVE' && s.bookingEnabled).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
      <button type="button" disabled={previewBusy || !previewServiceId} onClick={() => void previewPatientSlots()}>{previewBusy ? 'Đang tải…' : 'Xem giờ đặt'}</button>
      {previewError && <p role="alert">{previewError}</p>}
      {previewSlots && <div className="clinic-slot-results">{previewSlots.length ? previewSlots.map(slot => <span key={`${slot.startAt}-${slot.endAt}`}>{new Date(slot.startAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})}–{new Date(slot.endAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})} · {slot.roomCode || 'Chưa gán phòng'}</span>) : <small>Không có giờ đặt khả dụng cho dịch vụ và ngày đã chọn.</small>}</div>}
    </section>
    <section className="clinic-schedule-list">
      <strong>Lịch làm việc hiện có <span>({schedules.length})</span></strong>
      {schedules.length ? schedules.map(item => <div className="clinic-schedule-row" key={item.id}>
        <span>{days[item.dayOfWeek - 1]} · {item.startTime}–{item.endTime} · {item.slotDurationMinutes} phút/lượt<br />
          <small>{item.effectiveFrom?.slice(0, 10)}{item.effectiveTo ? ` → ${item.effectiveTo.slice(0, 10)}` : ''} · {item.roomCode ?? rooms.find(r => r.id === item.roomId)?.code ?? 'Chưa gán phòng'} · {scheduleStatus(item.status)}</small>
        </span>
        {item.status !== 'CANCELLED' && <span className="clinic-row-actions">
          <button type="button" className="clinic-link" onClick={() => edit(item)}>Sửa</button>
          <button type="button" className="clinic-link" disabled={busy} onClick={() => { setCancelTarget({ type: 'schedule', item }); setCancelReason(''); }}>Hủy</button>
        </span>}
      </div>) : <small>Chưa có lịch làm việc.</small>}
    </section>
    <form className="clinic-form clinic-compact-form" onSubmit={e => void submitSchedule(e)}>
      <strong>{editing ? 'Sửa lịch làm việc' : 'Tạo lịch làm việc hàng tuần'}</strong>
      <label>Thứ trong tuần <select value={dayOfWeek} disabled={!!editing} onChange={e => setDay(Number(e.target.value))}>{days.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
      <div className="clinic-form-pair"><label>Giờ bắt đầu <input type="time" required value={startTime} onChange={e => setStart(e.target.value)} /></label><label>Giờ kết thúc <input type="time" required value={endTime} onChange={e => setEnd(e.target.value)} /></label></div>
      <div className="clinic-form-pair"><label>Từ ngày <input type="date" required value={effectiveFrom} onChange={e => setFrom(e.target.value)} /></label><label>Đến ngày <input type="date" value={effectiveTo} onChange={e => setTo(e.target.value)} /></label></div>
      <div className="clinic-form-pair"><label>Phút/lượt <select value={slotDurationMinutes} onChange={e => setDuration(Number(e.target.value))}>{[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v}</option>)}</select></label><label>Phòng <select value={roomId} onChange={e => setRoom(e.target.value)}><option value="">Chưa gán</option>{rooms.filter(r => r.status === 'ACTIVE').map(r => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</select></label></div>
      <div className="clinic-actions"><button disabled={busy}>{editing ? 'Lưu lịch' : 'Tạo lịch'}</button>{editing && <button type="button" onClick={() => setEditing(null)}>Bỏ sửa</button>}</div>
    </form>
    <details className="clinic-scheduling-extra"><summary>Ca bổ sung / ngày nghỉ <span>{overrides.filter(item => item.status === 'ACTIVE').length} ca đang hiệu lực</span></summary>
    <form className="clinic-form clinic-compact-form" onSubmit={e => void submitOverride(e)}>
      <strong>Ca bổ sung / nghỉ</strong>
      {overrides.map(item => <div className="clinic-schedule-row" key={item.id}><span>{item.type === 'UNAVAILABLE' ? 'Nghỉ' : 'Ca bổ sung'} · {new Date(item.startAt).toLocaleString('vi-VN')} – {new Date(item.endAt).toLocaleString('vi-VN')} · {scheduleStatus(item.status)}</span>{item.status === 'ACTIVE' && <button type="button" className="clinic-link" disabled={busy} onClick={() => { setCancelTarget({ type: 'override', item }); setCancelReason(''); }}>Hủy</button>}</div>)}
      <select value={overrideType} onChange={e => setOverrideType(e.target.value as typeof overrideType)}><option value="UNAVAILABLE">Nghỉ / không sẵn sàng</option><option value="EXTRA_AVAILABLE">Ca bổ sung</option></select>
      <div className="clinic-form-pair"><label>Từ <input type="datetime-local" required value={overrideStart} onChange={e => setOverrideStart(e.target.value)} /></label><label>Đến <input type="datetime-local" required value={overrideEnd} onChange={e => setOverrideEnd(e.target.value)} /></label></div>
      {overrideType === 'UNAVAILABLE' && <select value={reasonCode} onChange={e => setReasonCode(e.target.value as typeof reasonCode)}><option value="PERSONAL_LEAVE">Nghỉ cá nhân</option><option value="SICK_LEAVE">Nghỉ ốm</option><option value="TRAINING">Đào tạo</option><option value="EMERGENCY">Khẩn cấp</option><option value="OTHER">Khác</option></select>}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú" />
      <button disabled={busy}>Lưu thay đổi ca</button>
    </form></details>
    <details className="clinic-scheduling-extra"><summary>Quản lý phòng khám <span>{rooms.length} phòng</span></summary>
    <form className="clinic-form clinic-compact-form" onSubmit={e => { e.preventDefault(); void run(() => createClinicRoom(request, { code: roomCode.trim(), name: roomName.trim() }), 'Đã tạo phòng.'); setRoomCode(''); setRoomName(''); }}>
      <strong>Phòng khám ({rooms.length})</strong>
      {rooms.map(r => <div className="clinic-schedule-row" key={r.id}><span>{r.code} · {r.name} · {r.status}</span><button type="button" className="clinic-link" disabled={busy} onClick={() => void run(() => updateClinicRoom(request, r.id, { status: r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }), 'Đã cập nhật phòng.')}>{r.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button></div>)}
      <div className="clinic-form-pair"><input required minLength={2} value={roomCode} onChange={e => setRoomCode(e.target.value)} placeholder="Mã phòng" /><input required minLength={2} value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Tên phòng" /></div>
      <button disabled={busy}>Thêm phòng</button>
    </form></details>
    {notice && <p className="clinic-note" role="status">{notice}</p>}
    {cancelTarget && <div className="clinic-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCancelTarget(null); }}><div className="clinic-confirm" role="dialog" aria-modal="true" aria-label="Xác nhận hủy ca làm"><h2>{cancelTarget.type === 'schedule' ? 'Hủy lịch làm việc?' : 'Hủy ca bổ sung / nghỉ?'}</h2><p>Thay đổi này có thể ảnh hưởng đến giờ bệnh nhân được phép đặt lịch. Vui lòng ghi rõ lý do.</p><label>Lý do hủy<input autoFocus value={cancelReason} minLength={3} maxLength={500} onChange={event => setCancelReason(event.target.value)} placeholder="Nhập ít nhất 3 ký tự" /></label><div className="clinic-actions"><button type="button" className="clinic-secondary-button" onClick={() => setCancelTarget(null)}>Quay lại</button><button type="button" className="is-danger" disabled={busy || cancelReason.trim().length < 3} onClick={() => void confirmCancel()}>{busy ? 'Đang xử lý…' : 'Xác nhận hủy'}</button></div></div></div>}
  </div>;
}
