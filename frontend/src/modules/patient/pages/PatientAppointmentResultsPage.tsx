import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Spin, Tag, message } from 'antd';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileDown,
  FileImage,
  FileText,
  FlaskConical,
  HeartPulse,
  Hospital,
  Image as ImageIcon,
  LoaderCircle,
  Pill,
  Printer,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink } from '../../../app/navigation';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { getMyPatient, type PatientProfile } from '../../../services/patient';
import { getAppointment, type Appointment } from '../../../services/appointment';
import { listDoctors, listSpecialties } from '../../../services/doctor';
import { getEncounter, listPrescriptions, listTreatmentPlans } from '../../../services/clinical';
import { getEncounterReport } from '../../../services/clinicalReport';
import '../../../styles/patient-appointment-results.css';

type ClinicalFile = {
  id?: string;
  fileName: string;
  mediaType?: string;
  sizeBytes?: number;
  createdAt?: string;
};

type OrderFileRow = {
  order: any;
  fileName: string;
  mediaType: string;
  path: string;
  sizeBytes?: number;
  uploadedAt?: string;
};

const value = (raw: unknown, fallback = 'Chưa cập nhật') => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return fallback;
  return String(raw);
};

const formatDate = (raw: unknown) => {
  if (!raw) return 'Chưa cập nhật';
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN');
};

const formatDateTime = (raw: unknown) => {
  if (!raw) return 'Chưa cập nhật';
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN');
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const doctorNameOf = (appointment: Appointment, doctors: any[]) => {
  const doctor = doctors.find((item) => String(item.doctorId || item.id) === String(appointment.assignedDoctorId || ''));
  const name = appointment.assignedDoctorName || doctor?.displayName || doctor?.fullName || doctor?.profile?.fullName || doctor?.name;
  if (name) return String(name).replace(/^BS\.\s*/i, '');
  return appointment.selectionMode === 'RANK' ? 'Bác sĩ do bệnh viện sắp xếp' : 'Bác sĩ chuyên khoa Tâm An';
};

const statusLabel = (status?: string) => {
  const labels: Record<string, string> = {
    VERIFIED: 'Đã xác minh',
    RESULT_AVAILABLE: 'Đã có kết quả',
    COMPLETED: 'Đã hoàn tất',
    FINALIZED: 'Đã hoàn tất hồ sơ',
    ISSUED: 'Đã kê đơn',
    ACTIVE: 'Đang thực hiện',
    DONE: 'Đã hoàn thành',
    PENDING: 'Đang chờ',
  };
  return labels[String(status || '')] || value(status, 'Chưa cập nhật');
};

function InlineDocument({
  path,
  fileName,
  mediaType = '',
  stream,
  large = false,
}: {
  path: string;
  fileName: string;
  mediaType?: string;
  stream: (path: string) => Promise<Response>;
  large?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setLoading(true);
    setError(false);
    stream(path)
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được file');
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: mediaType || blob.type }));
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, mediaType, stream]);

  const isPdf = mediaType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
  const isImage = mediaType.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);

  if (loading) {
    return <div className={`par-file-loading ${large ? 'is-large' : ''}`}><Spin indicator={<LoaderCircle className="par-spin" size={22} />} /> Đang tải {fileName}...</div>;
  }
  if (error || !url) {
    return <div className="par-file-error">Không thể hiển thị file trực tiếp. Vui lòng tải file về máy.</div>;
  }

  return (
    <div className={`par-inline-document ${large ? 'is-large' : ''}`}>
      {isPdf ? <iframe src={url} title={fileName} /> : isImage ? <img src={url} alt={fileName} /> : <div className="par-document-download"><FileText size={34} /><strong>{fileName}</strong><a href={url} download={fileName}>Tải file về máy</a></div>}
      <a className="par-file-download" href={url} download={fileName}><Download size={15} /> Tải file</a>
    </div>
  );
}

export function PatientAppointmentResultsPage({ appointmentId }: { appointmentId: string }) {
  const auth = useAuthSession();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [encounter, setEncounter] = useState<any | null>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [clinicalFiles, setClinicalFiles] = useState<ClinicalFile[]>([]);
  const [reportDocumentId, setReportDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const apt = await getAppointment(auth.request, appointmentId);
        const encounterId = apt.encounterId ? String(apt.encounterId) : '';
        const [patient, doctorRows, specialtyRows, enc, prescriptionRows, planRows, files, report] = await Promise.all([
          getMyPatient(auth.request).catch(() => null),
          listDoctors(auth.request).catch(() => []),
          listSpecialties(auth.request).catch(() => []),
          encounterId ? getEncounter(auth.request, encounterId) : Promise.resolve(null),
          encounterId ? listPrescriptions(auth.request, `encounterId=${encodeURIComponent(encounterId)}`).catch(() => []) : Promise.resolve([]),
          encounterId ? listTreatmentPlans(auth.request, `encounterId=${encodeURIComponent(encounterId)}`).catch(() => []) : Promise.resolve([]),
          encounterId ? auth.request<{ data: ClinicalFile[] }>(`/api/documents/clinical-results/${encodeURIComponent(encounterId)}`).then((res) => Array.isArray(res?.data) ? res.data : []).catch(() => []) : Promise.resolve([]),
          encounterId ? getEncounterReport(auth.request, encounterId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setAppointment(apt);
        setProfile(patient);
        setDoctors(doctorRows || []);
        setSpecialties(specialtyRows || []);
        setEncounter((enc as any)?.data || enc);
        setPrescriptions(prescriptionRows || []);
        setPlans(planRows || []);
        setClinicalFiles(files || []);
        setReportDocumentId(report?.documentId || null);
      } catch (reason: any) {
        if (active) setError(reason?.message || 'Không thể tải đầy đủ hồ sơ kết quả khám.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [auth.request, appointmentId]);

  const encounterId = appointment?.encounterId ? String(appointment.encounterId) : '';
  const doctorName = appointment ? doctorNameOf(appointment, doctors) : 'Bác sĩ phụ trách';
  const specialtyName = appointment?.specialtyId ? specialties.find((item) => item.id === appointment.specialtyId)?.name : 'Sản Phụ khoa';
  const orders = Array.isArray(encounter?.orders) ? encounter.orders : [];
  const vitals = Array.isArray(encounter?.vitalSigns) ? encounter.vitalSigns : [];
  const diagnoses = Array.isArray(encounter?.diagnoses) ? encounter.diagnoses : [];
  const notes = Array.isArray(encounter?.notes) ? encounter.notes : [];
  const latestVital = vitals[vitals.length - 1];
  const reportPath = reportDocumentId ? `/api/documents/${encodeURIComponent(reportDocumentId)}/content?format=pdf` : '';

  const orderFiles = useMemo<OrderFileRow[]>(() => {
    return orders.map((order: any) => {
      const result = order.structuredResult || {};
      const matchingFile = clinicalFiles.find((file) => file.fileName === result.fileName);
      return {
        order,
        fileName: result.fileName || matchingFile?.fileName || '',
        mediaType: result.mediaType || matchingFile?.mediaType || '',
        path: result.fileUrl || (matchingFile?.id && encounterId ? `/api/documents/clinical-results/${encodeURIComponent(encounterId)}/${encodeURIComponent(matchingFile.id)}/content` : ''),
        sizeBytes: result.sizeBytes || matchingFile?.sizeBytes,
        uploadedAt: result.uploadedAt || matchingFile?.createdAt,
      };
    });
  }, [orders, clinicalFiles, encounterId]);

  if (loading) {
    return <div className="patient-modern-portal-shell"><PublicPortalHeader /><main className="patient-modern-portal-main par-page"><div className="par-loading-page"><Spin size="large" /><h2>Đang tải đầy đủ kết quả khám...</h2><p>Đang đồng bộ hồ sơ, chỉ định và tệp kết quả.</p></div></main><PublicPortalFooter /></div>;
  }

  if (error || !appointment) {
    return <div className="patient-modern-portal-shell"><PublicPortalHeader /><main className="patient-modern-portal-main par-page"><div className="par-error-page"><Alert type="error" showIcon message="Không thể mở kết quả khám" description={error || 'Không tìm thấy lịch hẹn.'} /><AppLink href="/lich-hen" className="par-back-link"><ArrowLeft size={16} /> Quay lại lịch hẹn</AppLink></div></main><PublicPortalFooter /></div>;
  }

  return (
    <div className="patient-modern-portal-shell">
      <PublicPortalHeader />
      <main className="patient-modern-portal-main par-page">
        <div className="portal-container par-container">
          <div className="par-breadcrumbs"><AppLink href="/lich-hen" className="par-back-link"><ArrowLeft size={16} /> Lịch hẹn của tôi</AppLink><span>/</span><strong>Kết quả khám</strong></div>

          <header className="par-page-header">
            <div className="par-header-icon"><HeartPulse size={30} /></div>
            <div className="par-header-copy"><span className="par-eyebrow">HỒ SƠ KẾT QUẢ KHÁM</span><h1>Kết quả khám của tôi</h1><p>{profile?.fullName || appointment.patientName || 'Bệnh nhân'} <span>•</span> Mã lịch: <strong>{appointment.appointmentCode || appointment.id}</strong></p></div>
            <div className="par-header-actions"><Button icon={<Printer size={16} />} onClick={() => window.print()}>In trang kết quả</Button><Tag color="success" icon={<CheckCircle2 size={14} />}>{statusLabel(appointment.status)}</Tag></div>
          </header>

          <section className="par-visit-banner">
            <div className="par-visit-main"><span>DỊCH VỤ KHÁM</span><strong>{appointment.pricing?.serviceName || 'Lịch khám sản phụ khoa'}</strong><small><Stethoscope size={15} /> {specialtyName || 'Sản Phụ khoa'}</small></div>
            <div className="par-visit-stat"><span><CalendarDays size={15} /> Ngày khám</span><strong>{formatDate(appointment.startAt || appointment.completedAt)}</strong></div>
            <div className="par-visit-stat"><span><Clock3 size={15} /> Thời gian</span><strong>{appointment.startAt ? new Date(appointment.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
            <div className="par-visit-stat"><span><Stethoscope size={15} /> Bác sĩ</span><strong>{doctorName}</strong></div>
            <div className="par-visit-stat"><span><Hospital size={15} /> Phòng khám</span><strong>{value(appointment.roomName || appointment.roomCode)}</strong></div>
          </section>

          <div className="par-layout">
            <div className="par-main-column">
              <section className="par-card par-section par-patient-inline">
                <div className="par-section-title"><div className="par-section-icon par-blue"><UserRound size={21} /></div><div><h2>Thông tin hành chính bệnh nhân</h2><p>Thông tin được đối chiếu theo hồ sơ bệnh nhân tại thời điểm khám.</p></div></div>
                <div className="par-info-grid"><div className="par-info-item"><span>Họ và tên</span><strong>{profile?.fullName || appointment.patientName || 'Bệnh nhân'}</strong></div><div className="par-info-item"><span>Số điện thoại</span><strong>{value(profile?.phoneNumber)}</strong></div><div className="par-info-item"><span>Ngày sinh</span><strong>{formatDate(profile?.dateOfBirth)}</strong></div><div className="par-info-item"><span>Mã lịch hẹn</span><strong className="par-code">{appointment.appointmentCode || appointment.id}</strong></div><div className="par-info-item par-wide"><span>Địa chỉ</span><strong>{value(profile?.address)}</strong></div></div>
              </section>
              <section id="tom-tat" className="par-card par-section">
                <div className="par-section-title"><div className="par-section-icon par-green"><Stethoscope size={21} /></div><div><h2>Tóm tắt lần khám</h2><p>Thông tin được bác sĩ ghi nhận trong hồ sơ khám.</p></div></div>
                <div className="par-info-grid">
                  <div className="par-info-item par-wide"><span>Lý do khám / triệu chứng ban đầu</span><strong>{value(encounter?.chiefComplaint || appointment.doctorNotes)}</strong></div>
                  <div className="par-info-item"><span>Bác sĩ phụ trách</span><strong>{doctorName}</strong></div>
                  <div className="par-info-item"><span>Trạng thái hồ sơ</span><strong>{statusLabel(encounter?.state || encounter?.status || appointment.status)}</strong></div>
                  <div className="par-info-item par-wide"><span>Khám lâm sàng / ghi chú bác sĩ</span><strong>{value(encounter?.clinicalExamination || encounter?.doctorNotes || notes[notes.length - 1]?.content)}</strong></div>
                </div>
              </section>

              <section id="sinh-hieu" className="par-card par-section">
                <div className="par-section-title"><div className="par-section-icon par-red"><HeartPulse size={21} /></div><div><h2>Dấu hiệu sinh tồn</h2><p>Số liệu được ghi nhận trong lần khám.</p></div></div>
                {latestVital ? <div className="par-vitals-grid">{[['Huyết áp', latestVital.bloodPressure || (latestVital.systolic && latestVital.diastolic ? `${latestVital.systolic}/${latestVital.diastolic}` : '—'), 'mmHg'], ['Nhịp tim', latestVital.heartRate, 'bpm'], ['Nhiệt độ', latestVital.temperature, '°C'], ['Cân nặng', latestVital.weightKg || latestVital.weight, 'kg'], ['Chiều cao', latestVital.heightCm || latestVital.height, 'cm'], ['BMI', latestVital.bmi, '']].map(([label, val, unit]) => <div className="par-vital" key={String(label)}><span>{label}</span><strong>{value(val, '—')} <small>{unit}</small></strong></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa ghi nhận dấu hiệu sinh tồn." />}
              </section>

              <section id="chan-doan" className="par-card par-section">
                <div className="par-section-title"><div className="par-section-icon par-purple"><FileText size={21} /></div><div><h2>Chẩn đoán và kết luận</h2><p>Kết luận chuyên môn được lưu trong hồ sơ khám.</p></div></div>
                {diagnoses.length ? <div className="par-diagnosis-list">{diagnoses.map((item: any, index: number) => <div className="par-diagnosis" key={item.id || index}><span>{item.code || `CĐ ${index + 1}`}</span><div><strong>{item.description || item.name || item.diagnosis || 'Chưa cập nhật'}</strong>{item.isPrimary && <Tag color="purple">Chẩn đoán chính</Tag>}<small>{item.createdAt ? formatDateTime(item.createdAt) : ''}</small></div></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có chẩn đoán được ghi nhận." />}
                {encounter?.primaryDiagnosis && <div className="par-conclusion"><strong>Kết luận tổng quát</strong><p>{String(encounter.primaryDiagnosis)}</p></div>}
              </section>

              <section id="chi-dinh" className="par-card par-section">
                <div className="par-section-title"><div className="par-section-icon par-blue"><FlaskConical size={21} /></div><div><h2>Kết quả chỉ định cận lâm sàng</h2><p>Hiển thị đầy đủ trạng thái, ghi chú và file kết quả của từng chỉ định.</p></div><Tag color="blue">{orders.length} chỉ định</Tag></div>
                {orders.length ? <div className="par-order-list">{orderFiles.map(({ order, fileName, mediaType, path, sizeBytes, uploadedAt }, index) => { const result = order.structuredResult || {}; const hasResult = Boolean(fileName || result.result || order.resultNotes || order.status === 'VERIFIED' || order.status === 'RESULT_AVAILABLE'); return <article className="par-order-card" key={order.id || index}><div className="par-order-heading"><div className="par-order-index">{String(index + 1).padStart(2, '0')}</div><div><h3>{order.catalogServiceName || order.serviceName || 'Dịch vụ cận lâm sàng'}</h3><span>{order.category || order.stageCode || 'Cận lâm sàng'}</span></div><Tag color={hasResult ? 'success' : 'warning'} icon={hasResult ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}>{hasResult ? 'Đã có kết quả' : 'Chờ kết quả'}</Tag></div>{order.clinicalNotes && <div className="par-order-note"><strong>Ghi chú chỉ định:</strong> {order.clinicalNotes}</div>}{(order.resultNotes || result.notes) && <div className="par-order-result"><strong>Nhận xét / kết luận:</strong> {order.resultNotes || result.notes}</div>}{fileName && path ? <div className="par-result-file"><div className="par-file-meta"><FileDown size={19} /><div><strong>{fileName}</strong><span>{formatFileSize(sizeBytes)} {uploadedAt ? `• Tải lên ${formatDateTime(uploadedAt)}` : ''}</span></div></div><InlineDocument path={path} fileName={fileName} mediaType={mediaType} stream={auth.stream} /></div> : <div className="par-no-file">Chưa có file kết quả đính kèm.</div>}</article>; })}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lần khám này chưa có chỉ định cận lâm sàng." />}
              </section>

              {clinicalFiles.filter((file) => !orderFiles.some((row) => row.fileName === file.fileName)).length > 0 && <section className="par-card par-section"><div className="par-section-title"><div className="par-section-icon par-orange"><FileImage size={21} /></div><div><h2>Tệp hồ sơ đính kèm</h2><p>Các file khác được lưu trong hồ sơ lần khám.</p></div></div><div className="par-attachment-list">{clinicalFiles.filter((file) => !orderFiles.some((row) => row.fileName === file.fileName)).map((file) => <div className="par-attachment" key={file.id || file.fileName}><div><FileText size={19} /><strong>{file.fileName}</strong><span>{formatFileSize(file.sizeBytes)} • {formatDateTime(file.createdAt)}</span></div><InlineDocument path={`/api/documents/clinical-results/${encodeURIComponent(encounterId)}/${encodeURIComponent(String(file.id))}/content`} fileName={file.fileName} mediaType={file.mediaType} stream={auth.stream} /></div>)}</div></section>}

              {prescriptions.length > 0 && <section className="par-card par-section"><div className="par-section-title"><div className="par-section-icon par-pink"><Pill size={21} /></div><div><h2>Đơn thuốc</h2><p>Thuốc và hướng dẫn sử dụng được kê trong lần khám.</p></div></div><div className="par-table-wrap"><table className="par-table"><thead><tr><th>Thuốc</th><th>Liều dùng</th><th>Tần suất</th><th>Hướng dẫn</th><th>Trạng thái</th></tr></thead><tbody>{prescriptions.map((item: any, index) => <tr key={item.id || index}><td><strong>{item.medicationName || item.name || 'Thuốc chưa cập nhật'}</strong><small>{item.strength || item.dosageForm || ''}</small></td><td>{value(item.dose || item.quantity, '—')}</td><td>{value(item.frequency, '—')}</td><td>{value(item.instruction, '—')}</td><td><Tag color="green">{statusLabel(item.status)}</Tag></td></tr>)}</tbody></table></div></section>}

              {plans.length > 0 && <section className="par-card par-section"><div className="par-section-title"><div className="par-section-icon par-teal"><FileText size={21} /></div><div><h2>Kế hoạch điều trị và chăm sóc</h2><p>Hướng dẫn theo dõi, chăm sóc và tái khám.</p></div></div><div className="par-plan-list">{plans.map((item: any, index) => <div className="par-plan" key={item.id || index}><strong>{item.title || item.name || 'Kế hoạch chăm sóc'}</strong><Tag color="cyan">{statusLabel(item.status)}</Tag><p>{item.description || item.content || item.note || 'Chưa có mô tả.'}</p>{item.dueAt && <small>Dự kiến: {formatDate(item.dueAt)}</small>}</div>)}</div></section>}

              {reportPath && <section className="par-card par-section par-pdf-section"><div className="par-section-title"><div className="par-section-icon par-red"><FileText size={21} /></div><div><h2>Phiếu kết quả khám bệnh</h2><p>Bản PDF đầy đủ được lưu trong hồ sơ khám.</p></div><Tag color="success">PDF chính thức</Tag></div><InlineDocument path={reportPath} fileName={`Phieu_ket_qua_${appointment.appointmentCode || appointment.id}.pdf`} mediaType="application/pdf" stream={auth.stream} large /></section>}
            </div>

            <aside className="par-side-column">
              <section className="par-card par-patient-card"><div className="par-patient-avatar"><UserRound size={25} /></div><span className="par-side-label">THÔNG TIN BỆNH NHÂN</span><h2>{profile?.fullName || appointment.patientName || 'Bệnh nhân'}</h2><div className="par-side-fields"><div><span>Số điện thoại</span><strong>{value(profile?.phoneNumber)}</strong></div><div><span>Ngày sinh</span><strong>{formatDate(profile?.dateOfBirth)}</strong></div><div><span>Địa chỉ</span><strong>{value(profile?.address)}</strong></div><div><span>Mã lịch hẹn</span><strong className="par-code">{appointment.appointmentCode || appointment.id}</strong></div></div></section>
              <section className="par-card par-toc"><h3>NỘI DUNG KẾT QUẢ</h3><a href="#tom-tat"><Stethoscope size={15} /> Tóm tắt lần khám</a><a href="#sinh-hieu"><HeartPulse size={15} /> Dấu hiệu sinh tồn</a><a href="#chan-doan"><FileText size={15} /> Chẩn đoán và kết luận</a><a href="#chi-dinh"><FlaskConical size={15} /> Kết quả chỉ định</a>{prescriptions.length > 0 && <a href="#don-thuoc"><Pill size={15} /> Đơn thuốc</a>}{reportPath && <a href="#phieu-pdf"><FileText size={15} /> Phiếu PDF</a>}</section>
              <section className="par-card par-help-card"><ImageIcon size={22} /><strong>Cần hỗ trợ?</strong><p>Nếu thông tin chưa chính xác, vui lòng liên hệ quầy tiếp đón hoặc bệnh viện.</p><AppLink href="/lich-hen">Quay lại lịch hẹn</AppLink></section>
            </aside>
          </div>
        </div>
      </main>
      <PublicPortalFooter />
    </div>
  );
}

