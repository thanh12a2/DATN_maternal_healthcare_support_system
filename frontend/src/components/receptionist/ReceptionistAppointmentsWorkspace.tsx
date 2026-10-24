import { useEffect, useMemo, useState } from 'react';
import type { Requester } from '../../services/catalog';
import { ApiError } from '../../services/api';
import { navigate } from '../../app/navigation';
import { getReceptionPatient, listReceptionAppointments, saveReceptionSelection, type ReceptionAppointment, type ReceptionPatient } from '../../services/operations';
import '../../styles/receptionist-content.css';

type Row = ReceptionAppointment & { patient?: ReceptionPatient | null };
const dateText = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '—';
const timeText = (value?: string) => value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
const statusText = (value?: string) => ({ BOOKED: 'Chưa check-in', CHECKED_IN: 'Đã check-in', IN_CLINICAL_CARE: 'Đang khám', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng mặt' }[value ?? ''] ?? value ?? '—');

export function ReceptionistAppointmentsWorkspace({ request }: { request: Requester }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  async function load() {
    setBusy(true); setMessage('');
    try {
      const base = await listReceptionAppointments(request, undefined, { from: date + 'T00:00:00+07:00', to: date + 'T23:59:59+07:00', status: status || undefined });
      const detail = await Promise.all(base.map(async item => ({ ...item, patient: item.patientId ? await getReceptionPatient(request, String(item.patientId)).catch(() => null) : null })));
      setRows(detail); setSelected(detail[0] ?? null);
    } catch (reason) { setMessage(reason instanceof ApiError ? reason.message : 'Không thể tải lịch khám.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [date, status]);
  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('vi-VN');
    if (!text) return rows;
    return rows.filter(item => [item.patient?.fullName, item.patient?.phoneNumber, item.appointmentCode, item.pricing?.serviceName].some(value => String(value ?? '').toLocaleLowerCase('vi-VN').includes(text)));
  }, [rows, query]);
  function openReception() {
    if (!selected?.id || !selected.patientId) return;
    saveReceptionSelection({ patientId: String(selected.patientId ?? ''), appointmentId: String(selected.id) });
    navigate('/workspace/receptionist/reception');
  }
  return <>
    <header className="view-heading"><div><span className="view-kicker">Appointment book</span><h1>Lịch khám</h1></div><button className="quiet-action" type="button" disabled={!selected} onClick={openReception}>Mở tiếp nhận</button></header>
    <section className="surface-panel appointment-filter">
      <label className="filter-field">Ngày<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label className="filter-field">Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option><option value="BOOKED">Chưa check-in</option><option value="CHECKED_IN">Đã check-in</option><option value="IN_CLINICAL_CARE">Đang khám</option><option value="COMPLETED">Hoàn tất</option></select></label>
      <label className="filter-field filter-grow">Bệnh nhân / SĐT<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trong lịch khám" /></label>
    </section>
    {busy ? <div className="receptionist-schedule-skeleton" aria-busy="true"><i /><i /><i /></div> : message ? <p className="receptionist-inline-error" role="alert">{message}</p> : <div className="appointment-layout">
      <section className="surface-panel appointment-list"><header className="panel-title"><h2>{dateText(date + 'T00:00:00+07:00')}</h2><span>{visible.length.toString().padStart(2, '0')} lịch</span></header>{visible.length ? visible.map(item => <button className={'appointment-row ' + (selected?.id === item.id ? 'active' : '')} type="button" key={item.id ?? item.appointmentCode} onClick={() => setSelected(item)}><span className="appointment-time">{timeText(item.startAt)}<small>{item.endAt ? timeText(item.endAt) : ''}</small></span><span><strong>{item.patient?.fullName ?? 'Bệnh nhân'}</strong><small>{item.pricing?.serviceName ?? 'Dịch vụ'} · {item.appointmentCode ?? '—'}</small></span><span className="status-text">{statusText(item.status)}</span></button>) : <p className="receptionist-empty-row">Không có lịch khám phù hợp.</p>}</section>
      <aside className="surface-panel appointment-detail">{selected ? <><span className="view-kicker">LỊCH KHÁM</span><h2>{selected.patient?.fullName ?? 'Bệnh nhân'}</h2><p>{selected.pricing?.serviceName ?? 'Dịch vụ'} · {timeText(selected.startAt)} · {dateText(selected.startAt)}</p><dl className="detail-list"><div><dt>Mã lịch</dt><dd>{selected.appointmentCode ?? '—'}</dd></div><div><dt>Trạng thái</dt><dd>{statusText(selected.status)}</dd></div><div><dt>Điện thoại</dt><dd>{selected.patient?.phoneNumber ?? '—'}</dd></div></dl><button className="solid-action" type="button" onClick={openReception}>Mở tiếp nhận</button></> : <p>Chọn một lịch hẹn để xem chi tiết.</p>}</aside>
    </div>}
  </>;
}
