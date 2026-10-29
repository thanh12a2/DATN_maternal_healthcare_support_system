import { useEffect, useMemo, useState } from 'react';
import type { Requester } from '../../../services/catalog';
import { listAllDoctorAppointments, type Appointment } from '../../../services/appointment';
import { listAllDoctorEncounters, type Encounter } from '../../../services/clinical';

export function DoctorPatients({ request }: { request: Requester }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void Promise.all([listAllDoctorAppointments(request), listAllDoctorEncounters(request)]).then(([a, e]) => {
      if (active) { setAppointments(a); setEncounters(e); setLoading(false); }
    }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : 'Không thể tải bệnh nhân'); setLoading(false); } });
    return () => { active = false; };
  }, [request, revision]);
  const patients = useMemo(() => {
    const groups = new Map<string, Appointment>();
    for (const appointment of appointments) {
      if (!appointment.patientId) continue;
      const current = groups.get(appointment.patientId);
      const distance = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Math.abs(Date.parse(value) - Date.now()) : Infinity;
      if (!current || distance(appointment.startAt) < distance(current.startAt)) groups.set(appointment.patientId, appointment);
    }
    return [...groups.values()].filter((a) => `${a.patientName ?? ''} ${a.appointmentCode ?? ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
  }, [appointments, query]);
  if (loading) return <div className="doctor-loading" role="status" aria-label="Đang tải bệnh nhân"><i /><i /><i /></div>;
  if (error) return <section className="doctor-error" role="alert"><strong>Không thể tải bệnh nhân</strong><p>{error}</p><button className="doctor-primary-button" onClick={() => setRevision((v) => v + 1)}>Thử lại</button></section>;
  return <><header className="doctor-heading"><div><span className="doctor-kicker">Bệnh nhân</span><h1>Bệnh nhân phân công</h1><p>Bệnh nhân có lịch hẹn được phân công cho bạn.</p></div></header><div className="doctor-filters"><label>Tìm bệnh nhân hoặc mã lịch hẹn<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên bệnh nhân hoặc mã lịch" /></label></div><section className="doctor-surface doctor-list">{patients.length ? patients.map((a) => { const encounter = encounters.find((e) => e.appointmentId === a.id); return <div className="doctor-list-row" key={a.patientId}><strong>{a.patientName || 'Chưa có tên bệnh nhân'}</strong><span>Lịch gần nhất: {a.appointmentCode || 'Chưa có mã'} · {a.startAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(a.startAt)) : 'Chưa có ngày'}</span><small>Hồ sơ khám: {encounter ? String(encounter.state ?? 'Chưa cập nhật') : 'Chưa có hồ sơ được giao'}</small></div>; }) : <div className="doctor-empty"><strong>Chưa có bệnh nhân phù hợp</strong><p>Thử đổi từ khóa hoặc quay lại khi có lịch khám được phân công.</p></div>}</section></>;
}
