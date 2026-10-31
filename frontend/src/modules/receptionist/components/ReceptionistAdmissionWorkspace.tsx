import { useEffect, useState } from 'react';
import type { Requester } from '../../../services/catalog';
import { ApiError } from '../../../services/api';
import { admitReceptionCase, getReceptionCase, getReceptionPatient, listReceptionAppointments, openReceptionCase, readReceptionSelection, saveReceptionSelection, searchReceptionPatients, verifyReceptionIdentity, type ReceptionAppointment, type ReceptionCase, type ReceptionPatient } from '../../../services/operations';
import { navigate } from '../../../app/navigation';
import '../../../styles/receptionist-content.css';

type AppointmentRow = ReceptionAppointment;
type CaseData = ReceptionCase & { identity?: ReceptionPatient };
const CASE_KEY = 'an-tam-receptionist-case';
const stamp = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const statusText = (value?: string) => ({ BOOKED: 'Chưa check-in', CHECKED_IN: 'Đã check-in', IN_CLINICAL_CARE: 'Đang khám', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy' }[value ?? ''] ?? value ?? '—');
const messageOf = (error: unknown) => error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.';

export function ReceptionistAdmissionWorkspace({ section, request }: { section: string; request: Requester }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [patients, setPatients] = useState<ReceptionPatient[]>([]);
  const [patient, setPatient] = useState<ReceptionPatient | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [caseId, setCaseId] = useState('');
  const [caseData, setCaseData] = useState<ReceptionCase | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    const selection = readReceptionSelection();
    const storedCase = window.sessionStorage.getItem(CASE_KEY) ?? '';
    if (!selection) { setCaseId(''); setCaseData(null); return; }
    let live = true;
    void Promise.all([
      getReceptionPatient(request, selection.patientId),
      listReceptionAppointments(request, selection.patientId),
      storedCase ? getReceptionCase(request, storedCase).catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.statusCode === 404) return null;
        throw reason;
      }) : Promise.resolve(null),
    ]).then(([nextPatient, nextAppointments, storedCaseData]) => {
      if (!live) return;
      const nextAppointment = nextAppointments.find(item => item.id === selection.appointmentId) ?? null;
      setPatient(nextPatient); setAppointments(nextAppointments); setAppointment(nextAppointment);
      if (storedCase && storedCaseData?.id === storedCase && storedCaseData.patientId === selection.patientId && storedCaseData.appointmentId === selection.appointmentId && nextAppointment) {
        setCaseId(storedCase); setCaseData(storedCaseData);
      } else if (storedCase) {
        window.sessionStorage.removeItem(CASE_KEY); setCaseId(''); setCaseData(null);
        setMessage('Case trước không thuộc lịch hẹn đang chọn. Hãy mở case cho lịch này trước khi check-in.');
      }
    }).catch(reason => { if (live) setMessage(messageOf(reason)); });
    return () => { live = false; };
  }, [request]);

  async function findPatients() {
    if (!name.trim() && !phone.trim() && !nationalId.trim()) { setMessage('Nhập họ tên, số điện thoại hoặc CCCD để tìm kiếm.'); return; }
    setBusy(true); setMessage('');
    try {
      const rows = await searchReceptionPatients(request, { fullName: name.trim() || undefined, phoneNumber: phone.trim() || undefined, nationalId: nationalId.trim() || undefined });
      setPatients(rows); setPatient(null); setAppointments([]); setAppointment(null); setMessage(rows.length ? 'Đã tìm thấy ' + rows.length + ' bệnh nhân.' : 'Không tìm thấy bệnh nhân phù hợp.');
    } catch (reason) { setMessage(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function choosePatient(next: ReceptionPatient) {
    if (next.id !== patient?.id) clearCase();
    setBusy(true); setMessage(''); setPatient(next); setAppointment(null); setAppointments([]);
    try { setAppointments(await listReceptionAppointments(request, next.id)); setMessage('Đã chọn bệnh nhân. Chọn lịch hẹn để tiếp tục.'); }
    catch (reason) { setMessage(messageOf(reason)); }
    finally { setBusy(false); }
  }
  function chooseAppointment(next: AppointmentRow) {
    if (next.id !== appointment?.id) clearCase();
    setAppointment(next);
    if (patient?.id && next.id) saveReceptionSelection({ patientId: patient.id, appointmentId: String(next.id) });
  }
  function clearCase() {
    setCaseId(''); setCaseData(null); setResult(null); window.sessionStorage.removeItem(CASE_KEY);
  }
  async function action(run: () => Promise<unknown>, success: string, captureCaseId = false) {
    setBusy(true); setMessage('');
    try {
      const value = await run(); setResult(value); setMessage(success);
      if (captureCaseId) {
        const response = value as (CaseData & { data?: CaseData }) | null;
        const caseData = response?.data ?? response ?? undefined;
        const id = String(caseData?.id ?? '');
        if (id && caseData && caseData.appointmentId === appointment?.id && caseData.patientId === patient?.id) {
          setCaseId(id); setCaseData(caseData); window.sessionStorage.setItem(CASE_KEY, id);
        } else {
          clearCase(); setMessage('Không thể xác nhận case thuộc lịch hẹn đang chọn. Vui lòng mở lại case.');
        }
      } else if (caseId) {
        const response = value as (ReceptionCase & { data?: ReceptionCase }) | null;
        const updated = response?.data ?? response;
        if (updated?.id === caseId && updated.appointmentId === appointment?.id && updated.patientId === patient?.id) setCaseData(updated);
        else setCaseData(await getReceptionCase(request, caseId));
      }
    } catch (reason) { setMessage(messageOf(reason)); }
    finally { setBusy(false); }
  }
  function openCase() {
    if (!patient?.id || !appointment?.id) return;
    void action(() => openReceptionCase(request, { appointmentId: appointment.id, patientId: patient.id, arrivalAt: new Date().toISOString() }), 'Đã mở hồ sơ tiếp nhận.', true);
  }
  function selectForReception() { if (patient?.id && appointment?.id) { saveReceptionSelection({ patientId: patient.id, appointmentId: String(appointment.id) }); navigate('/workspace/receptionist/reception'); } }
  async function runCaseAction(actionName: 'verify' | 'admit') {
    if (!caseId || !patient?.id || !appointment?.id) return;
    await action(async () => {
      const current = await getReceptionCase(request, caseId);
      if (current.id !== caseId || current.patientId !== patient.id || current.appointmentId !== appointment.id) {
        clearCase();
        throw new Error('Case không thuộc bệnh nhân và lịch hẹn đang chọn. Vui lòng mở case cho lịch này.');
      }
      setCaseData(current);
      if (actionName === 'verify') {
        if (current.status !== 'OPEN') throw new Error('Case không còn ở trạng thái chờ xác minh. Vui lòng kiểm tra trạng thái tiếp nhận.');
        return verifyReceptionIdentity(request, caseId, { method: 'APPOINTMENT_CODE', result: 'VERIFIED', verifiedFields: ['fullName', 'appointmentId'] });
      }
      if (!['IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS'].includes(String(current.status))) throw new Error('Cần xác minh danh tính và kiểm tra trạng thái case trước khi tiếp nhận.');
      return admitReceptionCase(request, caseId);
    }, actionName === 'verify' ? 'Đã xác minh danh tính.' : 'Đã gửi yêu cầu Admit / Check-in.');
  }
  const lookup = <section className="surface-panel search-panel"><div className="patient-search"><label className="search-field"><span>Họ và tên</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Nguyễn Minh Anh" /></label><label className="search-field"><span>Số điện thoại</span><input value={phone} onChange={event => setPhone(event.target.value)} placeholder="090 123 4567" /></label><label className="search-field"><span>CCCD</span><input value={nationalId} onChange={event => setNationalId(event.target.value)} placeholder="0792 •••• 021" /></label><button className="solid-action" type="button" disabled={busy} onClick={() => void findPatients()}>Tìm kiếm</button></div><p className="inline-status" role="status">{message || 'Nhập thông tin để tìm kiếm bệnh nhân.'}</p></section>;
  const patientList = <section className="surface-panel result-panel"><header className="panel-title"><h2>Kết quả</h2><span>{patients.length.toString().padStart(2, '0')}</span></header>{patients.length ? patients.map(item => <button className={'patient-result ' + (patient?.id === item.id ? 'active' : '')} type="button" key={item.id} onClick={() => void choosePatient(item)}><span className="patient-initial">{item.fullName?.split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase() || 'BN'}</span><span><strong>{item.fullName ?? 'Bệnh nhân'}</strong><small>{item.phoneNumber ?? 'Không có SĐT'} · CCCD {item.nationalIdMasked ?? 'Chưa có'}</small></span></button>) : <p className="panel-empty">Chưa có kết quả tìm kiếm.</p>}</section>;
  const patientDetail = <aside className="surface-panel detail-panel">{patient ? <><span className="view-kicker">HỒ SƠ</span><h2>{patient.fullName}</h2><dl className="detail-list"><div><dt>Điện thoại</dt><dd>{patient.phoneNumber ?? '—'}</dd></div><div><dt>CCCD</dt><dd>{patient.nationalIdMasked ?? '—'}</dd></div></dl><div className="detail-actions"><button className="solid-action" type="button" disabled={!appointment} onClick={selectForReception}>Xem lịch hẹn</button><button className="quiet-action" type="button" disabled={!appointment} onClick={selectForReception}>Tiếp nhận</button></div></> : <p className="panel-empty">Chọn một bệnh nhân để xem thông tin.</p>}</aside>;
  const appointmentList = patient ? <section className="surface-panel appointment-list reception-appointment-list"><header className="panel-title"><h2>Lịch hẹn của {patient.fullName}</h2><span>{appointments.length.toString().padStart(2, '0')} lịch</span></header>{appointments.length ? appointments.map(item => <button className={'appointment-row ' + (appointment?.id === item.id ? 'active' : '')} type="button" key={item.id ?? item.appointmentCode} onClick={() => chooseAppointment(item)}><span className="appointment-time">{item.startAt ? new Date(item.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}<small>{item.startAt ? new Date(item.startAt).toLocaleDateString('vi-VN') : ''}</small></span><span><strong>{item.pricing?.serviceName ?? 'Dịch vụ'}</strong><small>{item.appointmentCode ?? '—'}</small></span><span className="status-text">{statusText(item.status)}</span></button>) : <p className="panel-empty">Bệnh nhân chưa có lịch hẹn phù hợp.</p>}</section> : null;

  if (section === 'patients') return <><header className="view-heading"><div><span className="view-kicker">Patient directory</span><h1>Bệnh nhân</h1></div><button className="quiet-action" type="button" onClick={() => navigate('/workspace/receptionist/reception')}>Mở tiếp nhận</button></header>{lookup}<div className="result-layout">{patientList}{patientDetail}</div></>;
  if (section === 'appointments') return <><header className="view-heading"><div><span className="view-kicker">Appointment lookup</span><h1>Tra cứu lịch hẹn</h1></div></header>{lookup}<div className="result-layout">{patientList}{patientDetail}</div>{appointmentList}</>;
  if (section === 'check-in') {
    const state = caseData?.status;
    const identityText = !caseId ? 'Chưa có case' : state === 'OPEN' ? 'Sẵn sàng xác minh' : ['IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS', 'ADMITTED'].includes(String(state)) ? 'Đã xác minh' : state === 'MANUAL_REVIEW' ? 'Cần kiểm tra thủ công' : state === 'CANCELLED' ? 'Case đã hủy' : 'Chưa xác định';
    const admissionText = !caseId ? 'Chưa mở' : state === 'ADMITTED' ? 'Đã tiếp nhận' : state === 'ADMISSION_IN_PROGRESS' ? 'Đang tiếp nhận' : state === 'MANUAL_REVIEW' ? 'Cần kiểm tra thủ công' : state === 'CANCELLED' ? 'Case đã hủy' : 'Chờ admit';
    return <><header className="view-heading"><div><span className="view-kicker">Admission</span><h1>Check-in</h1></div><span className="case-state">{caseId ? 'Đang xử lý' : 'Chưa mở case'}</span></header><div className="stepper"><div className={'step ' + (state && state !== 'OPEN' ? 'done' : 'active')}><b>01</b><span>Xác minh danh tính</span></div><div className={'step ' + (['IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS'].includes(String(state)) ? 'active' : state === 'ADMITTED' ? 'done' : '')}><b>02</b><span>Admit / Check-in</span></div><div className={'step ' + (state === 'ADMITTED' ? 'done' : '')}><b>03</b><span>Queue ticket</span></div></div><div className="checkin-grid"><section className="surface-panel checkin-patient">{patient ? <><span className="patient-initial large">{patient.fullName?.slice(0, 2).toUpperCase()}</span><h2>{patient.fullName}</h2><p>{appointment?.pricing?.serviceName ?? 'Chưa chọn lịch hẹn'} · {appointment ? stamp(appointment.startAt) : '—'}</p><dl className="detail-list"><div><dt>CCCD</dt><dd>{patient.nationalIdMasked ?? '—'}</dd></div><div><dt>Mã lịch</dt><dd>{appointment?.appointmentCode ?? '—'}</dd></div></dl></> : <p className="panel-empty">Chọn bệnh nhân và lịch hẹn từ tab Tiếp nhận.</p>}</section><section className="surface-panel checkin-state"><div className="state-row"><span>Danh tính</span><strong>{identityText}</strong></div><div className="state-row"><span>Admission</span><strong>{admissionText}</strong></div><button className="solid-action" type="button" disabled={busy || state !== 'OPEN'} title={state !== 'OPEN' ? 'Chỉ xác minh khi case đang chờ xác minh.' : undefined} onClick={() => void runCaseAction('verify')}>Xác minh danh tính</button><button className="quiet-action checkin-admit" type="button" disabled={busy || !['IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS'].includes(String(state))} title={!['IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS'].includes(String(state)) ? 'Cần xác minh danh tính trước khi tiếp nhận.' : undefined} onClick={() => void runCaseAction('admit')}>Admit / Check-in</button>{!caseId && <button className="quiet-action" type="button" onClick={() => navigate('/workspace/receptionist/reception')}>Quay lại mở case</button>}</section></div><p className="inline-status" role="status">{message}</p>{result !== null && <pre className="reception-result">{JSON.stringify(result, null, 2)}</pre>}</>;
  }
  return <><header className="view-heading"><div><span className="view-kicker">Reception case</span><h1>Tiếp nhận</h1></div><span className="case-state">{caseId ? 'Đang mở' : 'Chưa có case'}</span></header><div className="stepper"><div className="step active"><b>01</b><span>Tìm patient</span></div><div className={'step ' + (appointment ? 'active' : '')}><b>02</b><span>Chọn lịch hẹn</span></div><div className={'step ' + (caseId ? 'done' : '')}><b>03</b><span>Mở case</span></div></div>{lookup}<div className="case-layout"><div>{patientList}{appointmentList}</div><aside className="surface-panel case-appointment">{patient && appointment ? <><span className="view-kicker">LỊCH HẸN ĐƯỢC CHỌN</span><h2>{patient.fullName}</h2><p>{appointment.pricing?.serviceName ?? 'Dịch vụ'}</p><small>{appointment.appointmentCode} · {stamp(appointment.startAt)}</small><button className="solid-action" type="button" disabled={busy || Boolean(caseId)} onClick={openCase}>{caseId ? 'Case đã mở' : 'Mở case'}</button>{message && <p className="inline-status" role="status">{message}</p>}<button className="quiet-action continue-checkin" type="button" disabled={!caseId} onClick={() => navigate('/workspace/receptionist/check-in')}>Tiếp tục check-in</button></> : <p className="panel-empty">Chọn bệnh nhân và lịch hẹn để mở case.</p>}</aside></div><p className="inline-status" role="status">{message}</p>{result !== null && <pre className="reception-result">{JSON.stringify(result, null, 2)}</pre>}</>;
}
