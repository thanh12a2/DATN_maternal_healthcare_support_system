import { useState, type FormEvent } from 'react';
import type { Requester } from '../../../services/catalog';
import type { Appointment } from '../../../services/appointment';
import type { Encounter } from '../../../services/clinical';

export function DoctorEncounterActions({ encounter, appointment, request, onSaved }: { encounter: Encounter; appointment?: Appointment; request: Requester; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [weight, setWeight] = useState('');
  const state = String(encounter.state ?? '');
  const version = Number(encounter.version);
  const versionValid = Number.isInteger(version) && version > 0;
  const checkedIn = appointment?.status === 'CHECKED_IN' || appointment?.status === 'IN_CLINICAL_CARE';
  const editable = state === 'IN_PROGRESS' && versionValid;
  const send = async (path: string, body: Record<string, unknown> = {}) => {
    if (!encounter.id || busy || !versionValid) return;
    setBusy(true); setError('');
    try {
      await request(`/api/medical-records/encounters/${encodeURIComponent(encounter.id)}/${path}`, { method: 'POST', body: JSON.stringify({ ...body, expectedVersion: version }) });
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu dữ liệu.'); }
    finally { setBusy(false); }
  };
  const submit = (action: () => void) => (event: FormEvent) => { event.preventDefault(); action(); };
  return <div className="doctor-clinical-actions">
    {error && <p role="alert">{error} Hãy tải lại hồ sơ trước khi thử lại nếu dữ liệu đã thay đổi.</p>}
    <div className="doctor-shortcuts">
      <button className="doctor-secondary-button" disabled>Bắt đầu khám</button>
      <button className="doctor-secondary-button" disabled>Chuyển duyệt</button>
      <button className="doctor-primary-button" disabled>Hoàn tất</button>
    </div>
    <p>{!versionValid ? 'Chưa có phiên bản hồ sơ hợp lệ.' : state === 'DRAFT' && !checkedIn ? 'Lịch chưa check-in hoặc chưa có lịch tương ứng.' : state === 'DRAFT' ? 'Bắt đầu khám trước khi ghi thông tin.' : state === 'IN_PROGRESS' ? 'Có thể ghi thông tin khi hồ sơ đang khám.' : state === 'READY_FOR_REVIEW' ? 'Hồ sơ đang chờ xác nhận hoàn tất.' : 'Trạng thái hiện tại không cho phép ghi khám.'}</p>
    <p>Chuyển trạng thái chưa khả dụng vì hệ thống chưa đồng bộ trạng thái lịch hẹn với hồ sơ khám.</p>
    {editable && <>
      <form className="doctor-profile-form" onSubmit={submit(() => void send('notes', { content: note }))}><label>Ghi chú<textarea required maxLength={10000} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="doctor-secondary-button" disabled={busy || !note.trim()}>Lưu ghi chú</button></form>
      <form className="doctor-profile-form" onSubmit={submit(() => void send('diagnoses', { code, description: diagnosis }))}><label>Mã chẩn đoán<input required maxLength={50} value={code} onChange={(e) => setCode(e.target.value)} /></label><label>Chẩn đoán<input required maxLength={2000} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></label><button className="doctor-secondary-button" disabled={busy || !code.trim() || !diagnosis.trim()}>Lưu chẩn đoán</button></form>
      <form className="doctor-profile-form" onSubmit={submit(() => void send('vital-signs', Object.fromEntries(Object.entries({ systolic, diastolic, heartRate, temperature, weight }).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)]))))}>
        {([['Huyết áp tâm thu', systolic, setSystolic, 40, 300, '1'], ['Huyết áp tâm trương', diastolic, setDiastolic, 20, 200, '1'], ['Nhịp tim', heartRate, setHeartRate, 20, 250, '1'], ['Nhiệt độ °C', temperature, setTemperature, 30, 45, '0.1'], ['Cân nặng kg', weight, setWeight, 1, 500, '0.1']] as const).map(([label, value, set, min, max, step]) => <label key={label}>{label}<input type="number" min={min} max={max} step={step} value={value} onChange={(e) => set(e.target.value)} /></label>)}
        <button className="doctor-secondary-button" disabled={busy || ![systolic, diastolic, heartRate, temperature, weight].some(Boolean)}>Lưu dấu hiệu sinh tồn</button>
      </form>
    </>}
  </div>;
}
