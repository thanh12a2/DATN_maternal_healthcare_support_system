import { useState, type FormEvent } from 'react';
import type { Requester } from '../../../services/catalog';
import type { DoctorItem } from '../../../services/adminDoctors';
import type { MedicalServiceItem } from '../../../services/adminCatalog';
import {
  createManagerAppointment, listManagerBookableSlots, searchManagerPatients,
  type ManagerBookableSlot, type ManagerPatient,
} from '../../../services/clinicManager';

export function CreateAppointmentPanel({ request, doctors, services, refresh }: {
  request: Requester; doctors: DoctorItem[]; services: MedicalServiceItem[]; refresh: () => Promise<void>;
}) {
  const [patientQuery, setPatientQuery] = useState('');
  const [patients, setPatients] = useState<ManagerPatient[]>([]);
  const [patient, setPatient] = useState<ManagerPatient | null>(null);
  const [serviceId, setService] = useState('');
  const [doctorId, setDoctor] = useState('');
  const [day, setDay] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [slots, setSlots] = useState<ManagerBookableSlot[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (patientQuery.trim().length < 2) return;
    setBusy(true); setNotice('');
    try { setPatients(await searchManagerPatients(request, patientQuery.trim())); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tìm bệnh nhân.'); }
    finally { setBusy(false); }
  }
  async function findSlots() {
    if (!serviceId || !doctorId) return;
    setBusy(true); setNotice('');
    try { setSlots(await listManagerBookableSlots(request, serviceId, doctorId, day)); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tìm giờ trống.'); }
    finally { setBusy(false); }
  }
  async function book(slot: ManagerBookableSlot) {
    if (!patient) return;
    setBusy(true); setNotice('');
    try {
      await createManagerAppointment(request, patient.id, slot, reason.trim());
      await refresh(); setSlots([]); setNotice('Đã tạo lịch hẹn.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể tạo lịch hẹn.'); }
    finally { setBusy(false); }
  }
  return <article className="clinic-card clinic-create-appointment"><h2>Đặt lịch cho bệnh nhân</h2>
    <div className="clinic-create-grid"><form className="clinic-form" onSubmit={e => void search(e)}><strong>1. Bệnh nhân</strong><input required minLength={2} value={patientQuery} onChange={e => setPatientQuery(e.target.value)} placeholder="Tìm theo họ tên" /><button disabled={busy}>Tìm bệnh nhân</button><div className="clinic-patient-results">{patients.map(p => <button type="button" className="clinic-patient-result" key={p.id} onClick={() => setPatient(p)} aria-pressed={patient?.id === p.id}>{p.fullName} · {p.phoneNumber}</button>)}</div>{patient && <small>Đã chọn: {patient.fullName}</small>}</form>
      <div className="clinic-form"><strong>2. Dịch vụ và bác sĩ</strong><label>Dịch vụ<select value={serviceId} onChange={e => { setService(e.target.value); setSlots([]); }}><option value="">Chọn dịch vụ</option>{services.filter(s => s.status === 'ACTIVE' && s.bookingEnabled).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Bác sĩ<select value={doctorId} onChange={e => { setDoctor(e.target.value); setSlots([]); }}><option value="">Chọn bác sĩ</option>{doctors.filter(d => d.status === 'ACTIVE').map(d => <option key={d.id} value={d.id}>{d.profile?.fullName}</option>)}</select></label><label>Ngày khám<input type="date" min={new Date().toISOString().slice(0, 10)} value={day} onChange={e => { setDay(e.target.value); setSlots([]); }} /></label><label>Lý do khám<input value={reason} onChange={e => setReason(e.target.value)} /></label><button type="button" disabled={busy || !serviceId || !doctorId} onClick={() => void findSlots()}>Tìm giờ trống</button></div>
      <div className="clinic-form"><strong>3. Chọn giờ</strong>{slots.length ? <div className="clinic-slot-grid">{slots.slice(0, 40).map(s => <button type="button" key={`${s.doctorId}-${s.startAt}`} disabled={busy || !patient} onClick={() => { if (window.confirm(`Đặt lịch ${new Date(s.startAt).toLocaleString('vi-VN')} cho ${patient?.fullName}?`)) void book(s); }}>{new Date(s.startAt).toLocaleString('vi-VN')} · {s.roomCode ?? 'Phòng sẽ xác định'}</button>)}</div> : <small>Chọn dịch vụ, bác sĩ và ngày để tìm giờ trống.</small>}</div></div>
    {notice && <p className="clinic-note" role="status">{notice}</p>}
  </article>;
}
