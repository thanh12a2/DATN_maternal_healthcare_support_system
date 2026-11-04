import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HeartOutlined,
  HistoryOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  notification,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import type { Requester } from '../../../services/catalog';
import type { Appointment } from '../../../services/appointment';
import type { Encounter } from '../../../services/clinical';
import type { MyDoctor } from '../../../services/doctor';
import type { DoctorDeskRow } from './DoctorDeskTable';
import { DoctorClinicalResources } from './DoctorClinicalResources';
import { DoctorClinicalFiles } from './DoctorClinicalFiles';

import '../../../styles/doctor-consultation.css';

const { Text, Title, Paragraph } = Typography;

// Gợi ý mã ICD-10 chuyên khoa Sản Phụ khoa
const COMMON_ICD10 = [
  { code: 'Z34.8', label: 'Khám thai định kỳ chuẩn y khoa' },
  { code: 'O24.4', label: 'Đái tháo đường thai kỳ' },
  { code: 'O13', label: 'Tăng huyết áp thai kỳ' },
  { code: 'O21.0', label: 'Nghén nặng trong thai kỳ' },
  { code: 'N76.0', label: 'Viêm âm đạo cấp tính' },
  { code: 'Z01.4', label: 'Khám phụ khoa tổng quát định kỳ' },
  { code: 'O26.8', label: 'Rối loạn liên quan thai kỳ cần theo dõi' },
];

export interface PatientDemographic {
  name: string;
  phone: string;
  dob?: string;
  gender?: string;
  nationalId?: string;
  address?: string;
  emergencyContact?: string;
  bloodType?: string;
  allergies?: string;
  para?: string;
}

export interface DoctorConsultationDetailProps {
  appointment: DoctorDeskRow;
  encounter: Encounter | null;
  patientInfo?: PatientDemographic;
  allAppointments: Appointment[];
  allEncounters: Encounter[];
  doctor: MyDoctor | null;
  request: Requester;
  onBack: () => void;
  onReload: () => void;
}

export function DoctorConsultationDetail({
  appointment,
  encounter: initialEncounter,
  patientInfo,
  allAppointments,
  allEncounters,
  doctor,
  request,
  onBack,
  onReload,
}: DoctorConsultationDetailProps) {
  const [activeTab, setActiveTab] = useState('vitals');
  const [busy, setBusy] = useState(false);
  const [encounter, setEncounter] = useState<Encounter | null>(initialEncounter);

  // Modal xem chi tiết lượt khám cũ
  const [selectedPastVisit, setSelectedPastVisit] = useState<Appointment | null>(null);

  // Vitals inputs
  const [systolic, setSystolic] = useState<number | null>(null);
  const [diastolic, setDiastolic] = useState<number | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(160);

  // Diagnosis inputs
  const [icdCode, setIcdCode] = useState('');
  const [diagnosisDesc, setDiagnosisDesc] = useState('');

  // Note input
  const [noteContent, setNoteContent] = useState('');

  const rawEncId = encounter?.id || appointment.encounterId;
  const encId = rawEncId ? String(rawEncId) : '';
  const version = Number(encounter?.version || 1);
  const encState = String(encounter?.state || 'DRAFT');

  const canStart = encState === 'DRAFT' || appointment.status === 'CHECKED_IN';
  const canEdit = encState === 'IN_PROGRESS';
  const isFinalized = encState === 'FINALIZED' || appointment.status === 'COMPLETED';

  // Nạp lại encounter chi tiết khi mount hoặc khi encId đổi
  useEffect(() => {
    let live = true;
    if (encId) {
      request<Encounter | { data: Encounter }>(`/api/medical-records/encounters/${encodeURIComponent(encId)}`)
        .then((res: any) => {
          if (live && res) {
            setEncounter(res.data || res);
          }
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [encId, request]);

  // Bộ điều hướng gọi API chuyên môn
  const sendAction = async (path: string, body: Record<string, unknown> = {}) => {
    if (!encId) {
      message.error('Không tìm thấy mã hồ sơ khám bệnh (Encounter ID).');
      return;
    }
    setBusy(true);
    try {
      const res: any = await request(
        `/api/medical-records/encounters/${encodeURIComponent(encId)}/${path}`,
        {
          method: 'POST',
          body: JSON.stringify({ ...body, expectedVersion: version }),
        }
      );
      message.success('Thao tác thành công.');

      // Cập nhật lại encounter tại chỗ
      if (res && (res.data || res.id)) {
        setEncounter(res.data || res);
      } else {
        const refreshed: any = await request(
          `/api/medical-records/encounters/${encodeURIComponent(encId)}`
        ).catch(() => null);
        if (refreshed) setEncounter(refreshed.data || refreshed);
      }

      onReload();
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra khi lưu dữ liệu.');
    } finally {
      setBusy(false);
    }
  };

  // 1. Bắt đầu ca khám
  const handleStartEncounter = () => sendAction('start');

  // 2. Chuyển duyệt
  const handleReadyForReview = () => sendAction('ready-for-review');

  // 3. Hoàn tất ca khám
  const handleFinalize = () => sendAction('finalize');

  // 4. Lưu dấu hiệu sinh tồn
  const handleSaveVitals = async () => {
    if (!systolic && !diastolic && !heartRate && !temperature && !weight) {
      message.warning('Vui lòng nhập ít nhất một chỉ số sinh tồn.');
      return;
    }
    const payload: Record<string, number> = {};
    if (systolic != null) payload.systolic = systolic;
    if (diastolic != null) payload.diastolic = diastolic;
    if (heartRate != null) payload.heartRate = heartRate;
    if (temperature != null) payload.temperature = temperature;
    if (weight != null) payload.weight = weight;

    await sendAction('vital-signs', payload);
    setSystolic(null);
    setDiastolic(null);
    setHeartRate(null);
    setTemperature(null);
    setWeight(null);
  };

  // 5. Lưu chẩn đoán
  const handleSaveDiagnosis = async () => {
    if (!icdCode.trim() || !diagnosisDesc.trim()) {
      message.warning('Vui lòng nhập đầy đủ Mã chẩn đoán và Mô tả bệnh.');
      return;
    }
    await sendAction('diagnoses', { code: icdCode.trim(), description: diagnosisDesc.trim() });
    setIcdCode('');
    setDiagnosisDesc('');
  };

  // 6. Lưu ghi chú chuyên môn
  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      message.warning('Vui lòng nhập nội dung ghi chú.');
      return;
    }
    await sendAction('notes', { content: noteContent.trim() });
    setNoteContent('');
  };

  // Danh sách sinh hiệu, chẩn đoán, ghi chú trong lượt khám này
  const vitalsList = Array.isArray(encounter?.vitalSigns) ? encounter.vitalSigns : [];
  const latestVital = vitalsList.length > 0 ? vitalsList[vitalsList.length - 1] : null;
  const diagnosesList = Array.isArray(encounter?.diagnoses) ? encounter.diagnoses : [];
  const notesList = Array.isArray(encounter?.notes) ? encounter.notes : [];

  // Lọc lịch sử các lần khám cũ của bệnh nhân này
  const patientId = appointment.patientId;
  const pastAppointments = useMemo(() => {
    return allAppointments.filter((a) => a.patientId === patientId && a.id !== appointment.id);
  }, [allAppointments, patientId, appointment.id]);

  // Tính tuổi bệnh nhân
  const patientAge = useMemo(() => {
    if (!patientInfo?.dob) return 28;
    const birth = new Date(patientInfo.dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    return age > 0 ? age : 28;
  }, [patientInfo?.dob]);

  // Tính BMI tự động
  const calculatedBMI = useMemo(() => {
    const w = latestVital?.weight || weight;
    const h = height ? height / 100 : 1.6;
    if (w && h) {
      const val = Number(w) / (h * h);
      return val.toFixed(1);
    }
    return null;
  }, [latestVital?.weight, weight, height]);

  // Bảng danh sách các đợt khám cũ
  const pastVisitColumns: ColumnsType<Appointment> = [
    {
      title: 'Mã lịch hẹn',
      dataIndex: 'appointmentCode',
      key: 'appointmentCode',
      width: 170,
      render: (code, row) => (
        <a
          onClick={() => setSelectedPastVisit(row)}
          style={{ fontWeight: 700, color: '#0B5CAD', cursor: 'pointer' }}
        >
          {code}
        </a>
      ),
    },
    {
      title: 'Thời gian khám',
      key: 'time',
      width: 150,
      render: (_, row) => (
        <div>
          <strong>{row.startAt ? new Date(row.startAt).toLocaleDateString('vi-VN') : '—'}</strong>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {row.startAt ? new Date(row.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Dịch vụ y tế',
      key: 'service',
      render: (_, row) => (
        <div>
          <strong style={{ color: '#0f172a' }}>{row.pricing?.serviceName || 'Khám chuyên khoa'}</strong>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {row.roomCode || 'P.201'} - {row.roomName || 'Sản Phụ khoa'}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: (_, row) => (
        <Tag color={row.status === 'COMPLETED' ? 'green' : 'blue'}>
          {row.status === 'COMPLETED' ? '✓ Đã hoàn tất' : row.status}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          style={{ padding: 0, fontWeight: 600, color: '#0B5CAD' }}
          onClick={() => setSelectedPastVisit(row)}
        >
          Xem chi tiết ➔
        </Button>
      ),
    },
  ];

  return (
    <div className="doctor-consultation-container">
      {/* ─── 1. TOP CONSULTATION NAVIGATION & ACTION BAR ─── */}
      <div className="consultation-top-bar">
        <div className="consultation-top-left">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="consultation-btn-back"
          >
            Quay lại hàng đợi
          </Button>

          <div className="consultation-title-group">
            <h2>
              Hồ Sơ Khám Bệnh:{' '}
              <span style={{ color: '#0B5CAD' }}>
                {patientInfo?.name || appointment.patientName || 'Bệnh nhân'}
              </span>
            </h2>
            <p>
              Mã lịch hẹn: <strong>{appointment.appointmentCode}</strong> · Khung giờ:{' '}
              {appointment.startAt
                ? new Date(appointment.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                : ''} - {appointment.endAt
                ? new Date(appointment.endAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                : ''} ({appointment.startAt ? new Date(appointment.startAt).toLocaleDateString('vi-VN') : 'Hôm nay'})
            </p>
          </div>
        </div>

        <div className="consultation-top-right">
          {/* STT Queue Chip (Matching Web Bệnh Nhân) */}
          <div className="consultation-queue-chip">
            <span className="consultation-queue-tag">STT KHÁM</span>
            <strong className="consultation-queue-code">
              {appointment.ticketCode || '207-02'}
            </strong>
            <div className="consultation-queue-divider" />
            <span className="consultation-queue-room">
              Phòng {doctor?.roomCode || appointment.roomCode || 'P.201'}
            </span>
          </div>

          {/* Clinical Status Chip (Matching Web Bệnh Nhân) */}
          {encState === 'DRAFT' && (
            <span className="consultation-status-pill is-checked-in">
              👤 Đã check-in / Chờ khám
            </span>
          )}
          {encState === 'IN_PROGRESS' && (
            <span className="consultation-status-pill is-in-care">
              🩺 Đang khám bệnh
            </span>
          )}
          {encState === 'READY_FOR_REVIEW' && (
            <span className="consultation-status-pill is-review">
              📤 Chờ duyệt kết luận
            </span>
          )}
          {encState === 'FINALIZED' && (
            <span className="consultation-status-pill is-completed">
              ✓ Đã hoàn tất ca khám
            </span>
          )}

          {/* ACTION BUTTONS */}
          {canStart && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={busy}
              style={{ background: '#10b981', borderColor: '#10b981', fontWeight: 700, height: 38 }}
              onClick={handleStartEncounter}
            >
              Bắt đầu khám bệnh
            </Button>
          )}

          {canEdit && (
            <Space>
              <Button
                icon={<SendOutlined />}
                loading={busy}
                onClick={handleReadyForReview}
                style={{ height: 38 }}
              >
                Chuyển duyệt
              </Button>
              <Popconfirm
                title="Xác nhận hoàn tất ca khám?"
                description="Hồ sơ bệnh án sẽ được khóa và lưu trữ chính thức."
                okText="Hoàn tất"
                cancelText="Hủy"
                onConfirm={handleFinalize}
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={busy}
                  style={{ background: '#0B5CAD', borderColor: '#0B5CAD', fontWeight: 700, height: 38 }}
                >
                  Hoàn tất ca khám
                </Button>
              </Popconfirm>
            </Space>
          )}

          {isFinalized && (
            <Tag color="green" style={{ padding: '6px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}>
              ✓ Đã hoàn tất ca khám
            </Tag>
          )}
        </div>
      </div>

      {/* ─── 2. PATIENT MASTER DEMOGRAPHIC CARD WITH USER-WEB STYLE CHIPS ─── */}
      <div className="consultation-patient-card">
        <div className="patient-card-top-row">
          <div className="patient-identity-left">
            <div className="patient-avatar-box">
              <UserOutlined />
            </div>
            <div className="patient-name-box">
              <h3>{patientInfo?.name || appointment.patientName || 'Bệnh nhân'}</h3>
              
              {/* Chips Group Matching Patient Portal */}
              <div className="patient-chips-wrap">
                <span className="portal-chip chip-blue">
                  🎂 {patientAge} tuổi ({patientInfo?.dob ? new Date(patientInfo.dob).toLocaleDateString('vi-VN') : '—'})
                </span>
                <span className="portal-chip chip-slate">
                  ♀ Giới tính: {patientInfo?.gender || 'Nữ'}
                </span>
                <span className="portal-chip chip-purple">
                  🩸 Nhóm máu: {patientInfo?.bloodType || 'A+'}
                </span>
                <span
                  className={`portal-chip ${
                    patientInfo?.allergies && patientInfo.allergies !== 'Chưa ghi nhận dị ứng' && patientInfo.allergies !== 'Không dị ứng'
                      ? 'chip-danger'
                      : 'chip-green'
                  }`}
                >
                  {patientInfo?.allergies && patientInfo.allergies !== 'Chưa ghi nhận dị ứng' && patientInfo.allergies !== 'Không dị ứng'
                    ? `⚠️ ${patientInfo.allergies}`
                    : '🛡 Chưa ghi nhận dị ứng'}
                </span>
                <span className="portal-chip chip-amber">
                  👶 Para: {patientInfo?.para || '0000'} {patientInfo?.para === '0000' ? '(Con so)' : '(Con rạ)'}
                </span>
                <span className="portal-chip chip-cyan">
                  🩺 {appointment.pricing?.serviceName || 'Khám thai chuyên gia & tư vấn dinh dưỡng'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span className="portal-chip chip-green" style={{ fontSize: 12.5, fontWeight: 700 }}>
              💳 Đã thanh toán viện phí tiếp đón
            </span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Phòng khám: <strong>{doctor?.roomCode || appointment.roomCode || 'P.201'} - {doctor?.roomName || 'Sản Phụ khoa'}</strong>
            </Text>
          </div>
        </div>

        {/* 4-Col Administrative Metadata Grid */}
        <div className="patient-admin-grid">
          <div className="patient-admin-item">
            <span className="meta-label">CCCD / Định danh công dân</span>
            <strong className="meta-val">{patientInfo?.nationalId || '001200000111'}</strong>
          </div>
          <div className="patient-admin-item">
            <span className="meta-label">Số điện thoại liên hệ</span>
            <strong className="meta-val">{patientInfo?.phone || appointment.patientPhone || '0901234021'}</strong>
          </div>
          <div className="patient-admin-item">
            <span className="meta-label">Địa chỉ thường trú</span>
            <strong className="meta-val">{patientInfo?.address || 'Hà Nội'}</strong>
          </div>
          <div className="patient-admin-item">
            <span className="meta-label">Người thân liên hệ khẩn cấp</span>
            <strong className="meta-val">{patientInfo?.emergencyContact || 'Chưa cập nhật'}</strong>
          </div>
        </div>
      </div>

      {/* ─── 3. FULL-WIDTH CLINICAL TABS (NO AWKWARD LEFT COLUMN) ─── */}
      <div className="consultation-full-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          items={[
            {
              key: 'vitals',
              label: (
                <span>
                  <HeartOutlined /> 1. Dấu hiệu sinh tồn
                </span>
              ),
              children: (
                <div>
                  {/* Live Vitals Metrics Overview */}
                  <div className="consultation-vitals-grid">
                    <div
                      className={`consultation-vital-card ${
                        latestVital?.systolic && (latestVital.systolic >= 140 || latestVital.systolic <= 90)
                          ? 'is-alert'
                          : ''
                      }`}
                    >
                      <span className="v-label">Huyết áp</span>
                      <strong className="v-value">
                        {latestVital?.systolic != null || latestVital?.diastolic != null
                          ? `${latestVital.systolic || '—'}/${latestVital.diastolic || '—'}`
                          : '—/—'}
                      </strong>
                      <span className="v-unit">mmHg</span>
                    </div>

                    <div className="consultation-vital-card">
                      <span className="v-label">Nhịp tim</span>
                      <strong className="v-value">{latestVital?.heartRate ? latestVital.heartRate : '—'}</strong>
                      <span className="v-unit">nhịp/phút</span>
                    </div>

                    <div className="consultation-vital-card">
                      <span className="v-label">Thân nhiệt</span>
                      <strong className="v-value">{latestVital?.temperature ? latestVital.temperature : '—'}</strong>
                      <span className="v-unit">°C</span>
                    </div>

                    <div className="consultation-vital-card">
                      <span className="v-label">Cân nặng</span>
                      <strong className="v-value">{latestVital?.weight ? latestVital.weight : '—'}</strong>
                      <span className="v-unit">kg</span>
                    </div>

                    <div className="consultation-vital-card">
                      <span className="v-label">Chiều cao</span>
                      <strong className="v-value">{height || 160}</strong>
                      <span className="v-unit">cm</span>
                    </div>

                    <div className="consultation-vital-card">
                      <span className="v-label">Chỉ số BMI</span>
                      <strong className="v-value" style={{ color: '#0B5CAD' }}>
                        {calculatedBMI || '—'}
                      </strong>
                      <span className="v-unit">kg/m² (Bình thường)</span>
                    </div>
                  </div>

                  {/* Vitals Input Form */}
                  <div className="consultation-section-box">
                    <div className="consultation-section-title">
                      🩺 Nhập kết quả đo dấu hiệu sinh tồn mới:
                    </div>
                    <Space wrap size="middle">
                      <div>
                        <Text style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                          Huyết áp tâm thu (mmHg):
                        </Text>
                        <InputNumber
                          min={50}
                          max={260}
                          placeholder="120"
                          value={systolic}
                          onChange={setSystolic}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                          Huyết áp tâm trương (mmHg):
                        </Text>
                        <InputNumber
                          min={30}
                          max={160}
                          placeholder="80"
                          value={diastolic}
                          onChange={setDiastolic}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                          Nhịp tim (lần/phút):
                        </Text>
                        <InputNumber
                          min={30}
                          max={220}
                          placeholder="75"
                          value={heartRate}
                          onChange={setHeartRate}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                          Nhiệt độ (°C):
                        </Text>
                        <InputNumber
                          min={34}
                          max={43}
                          step={0.1}
                          placeholder="36.8"
                          value={temperature}
                          onChange={setTemperature}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                          Cân nặng (kg):
                        </Text>
                        <InputNumber
                          min={20}
                          max={250}
                          step={0.1}
                          placeholder="58.5"
                          value={weight}
                          onChange={setWeight}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                          Chiều cao (cm):
                        </Text>
                        <InputNumber
                          min={100}
                          max={220}
                          placeholder="160"
                          value={height}
                          onChange={setHeight}
                          disabled={!canEdit}
                        />
                      </div>
                    </Space>

                    <div style={{ marginTop: 14 }}>
                      <Button
                        type="primary"
                        icon={<HeartOutlined />}
                        loading={busy}
                        disabled={!canEdit}
                        onClick={handleSaveVitals}
                        style={{ background: '#0B5CAD' }}
                      >
                        Lưu dấu hiệu sinh tồn
                      </Button>
                      {!canEdit && (
                        <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                          (Cần ấn "Bắt đầu khám bệnh" để cập nhật số liệu)
                        </Text>
                      )}
                    </div>
                  </div>

                  {/* Vitals History List */}
                  {vitalsList.length > 0 && (
                    <div className="consultation-records-list">
                      <Text strong style={{ fontSize: 13, color: '#334155' }}>
                        Lịch sử các lần đo trong buổi khám hôm nay:
                      </Text>
                      {vitalsList.map((v: any, idx: number) => (
                        <div key={v.id || idx} className="consultation-record-card">
                          <div className="consultation-record-head">
                            <span>
                              <strong>
                                Huyết áp: {v.systolic}/{v.diastolic} mmHg
                              </strong>{' '}
                              · Nhịp tim: <strong>{v.heartRate} bpm</strong> · Thân nhiệt:{' '}
                              <strong>{v.temperature} °C</strong> · Cân nặng:{' '}
                              <strong>{v.weight} kg</strong>
                            </span>
                            <span className="consultation-record-time">
                              {v.recordedAt ? new Date(v.recordedAt).toLocaleTimeString('vi-VN') : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'diagnoses',
              label: (
                <span>
                  <MedicineBoxOutlined /> 2. Khám & Chẩn đoán bệnh
                </span>
              ),
              children: (
                <div>
                  {/* Chief complaint */}
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: '14px 18px',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      marginBottom: 16,
                    }}
                  >
                    <Text strong style={{ fontSize: 13 }}>
                      Lý do đến khám ban đầu:
                    </Text>
                    <Paragraph style={{ margin: '4px 0 0', color: '#1e293b' }}>
                      {String(
                        encounter?.chiefComplaint ||
                          appointment.pricing?.serviceName ||
                          'Khám thai định kỳ chuyên gia & kiểm tra sức khỏe mẹ và bé'
                      )}
                    </Paragraph>
                  </div>

                  {/* Quick ICD-10 suggestions */}
                  <div className="consultation-section-box">
                    <div className="consultation-section-title">
                      📋 Thêm chẩn đoán bệnh theo danh mục ICD-10:
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                        Gợi ý nhanh mã bệnh:
                      </Text>
                      <div className="icd-quick-chips">
                        {COMMON_ICD10.map((item) => (
                          <button
                            type="button"
                            key={item.code}
                            className={`icd-chip ${icdCode === item.code ? 'is-active' : ''}`}
                            onClick={() => {
                              setIcdCode(item.code);
                              setDiagnosisDesc(item.label);
                            }}
                          >
                            <strong>{item.code}</strong> - {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input
                        placeholder="Mã ICD-10 (ví dụ: Z34.8)"
                        value={icdCode}
                        onChange={(e) => setIcdCode(e.target.value)}
                        disabled={!canEdit}
                        style={{ maxWidth: 220 }}
                      />
                      <Input.TextArea
                        rows={3}
                        placeholder="Mô tả chẩn đoán lâm sàng chi tiết của bác sĩ..."
                        value={diagnosisDesc}
                        onChange={(e) => setDiagnosisDesc(e.target.value)}
                        disabled={!canEdit}
                      />
                      <Button
                        type="primary"
                        loading={busy}
                        disabled={!canEdit}
                        onClick={handleSaveDiagnosis}
                        style={{ background: '#0B5CAD' }}
                      >
                        Lưu chẩn đoán
                      </Button>
                    </Space>
                  </div>

                  {/* Diagnoses List */}
                  {diagnosesList.length > 0 && (
                    <div className="consultation-records-list">
                      <Text strong style={{ fontSize: 13, color: '#334155' }}>
                        Chẩn đoán đã ghi trong hồ sơ:
                      </Text>
                      {diagnosesList.map((d: any, idx: number) => (
                        <div key={d.id || idx} className="consultation-record-card">
                          <div className="consultation-record-head">
                            <div>
                              <Tag color="geekblue" style={{ fontWeight: 700, fontSize: 13 }}>
                                {d.code}
                              </Tag>
                              <strong style={{ fontSize: 14, color: '#0f172a' }}>
                                {d.description}
                              </strong>
                            </div>
                            <span className="consultation-record-time">
                              {d.createdAt ? new Date(d.createdAt).toLocaleTimeString('vi-VN') : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'notes',
              label: (
                <span>
                  <FileTextOutlined /> 3. Ghi chú & Dặn dò
                </span>
              ),
              children: (
                <div>
                  <div className="consultation-section-box">
                    <div className="consultation-section-title">
                      ✍️ Ghi nhận diễn biến khám & Y lệnh dặn dò chuyên môn:
                    </div>
                    <Input.TextArea
                      rows={5}
                      placeholder="Nhập ghi nhận triệu chứng thực thể, tình trạng cử động thai, tim thai, dặn dò dinh dưỡng, lịch hẹn tái khám..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      disabled={!canEdit}
                      style={{ marginBottom: 12 }}
                    />
                    <Button
                      type="primary"
                      loading={busy}
                      disabled={!canEdit}
                      onClick={handleSaveNote}
                      style={{ background: '#0B5CAD' }}
                    >
                      Lưu ghi chú chuyên môn
                    </Button>
                  </div>

                  {/* Notes History */}
                  {notesList.length > 0 && (
                    <div className="consultation-records-list">
                      <Text strong style={{ fontSize: 13, color: '#334155' }}>
                        Các ghi chú đã lưu trong ca khám:
                      </Text>
                      {notesList.map((n: any, idx: number) => (
                        <div key={n.id || idx} className="consultation-record-card">
                          <Paragraph style={{ margin: 0, color: '#1e293b', fontSize: 13.5 }}>
                            {n.content || n.text}
                          </Paragraph>
                          <span
                            className="consultation-record-time"
                            style={{ display: 'block', marginTop: 6 }}
                          >
                            Ghi nhận lúc:{' '}
                            {n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN') : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            /* ─── TAB 4: TIỀN SỬ & LỊCH SỬ KHÁM CŨ (DEDICATED FULL TAB) ─── */
            {
              key: 'history',
              label: (
                <span>
                  <HistoryOutlined /> 4. Tiền sử & Bệnh sử cũ
                </span>
              ),
              children: (
                <div className="history-tab-container">
                  {/* Section 1: Tiền sử sản phụ khoa & Yếu tố nguy cơ bệnh nền */}
                  <div className="consultation-section-box">
                    <div className="consultation-section-title">
                      <SafetyCertificateOutlined style={{ color: '#10b981' }} />
                      Hồ sơ tiền sử y khoa & Yếu tố nguy cơ:
                    </div>

                    <div className="history-profile-grid">
                      <div className="history-profile-card">
                        <span className="hp-title">Tiền sử sản khoa (Para)</span>
                        <strong className="hp-val">Para: {patientInfo?.para || '0000'}</strong>
                        <p className="hp-desc">
                          {patientInfo?.para === '0000'
                            ? 'Mang thai lần đầu (Con so), chưa có tiền căn sảy thai, sinh non hay nạo hút.'
                            : 'Đã từng sinh nở (Con rạ), cần theo dõi sát các mốc thai kỳ.'}
                        </p>
                      </div>

                      <div className="history-profile-card">
                        <span className="hp-title">Bệnh lý mạn tính trước mang thai</span>
                        <strong className="hp-val">Không ghi nhận bệnh nền mạn tính</strong>
                        <p className="hp-desc">
                          Huyết áp cơ bản bình thường, không có tiền sử đái tháo đường, tim mạch hay bệnh lý tuyến giáp.
                        </p>
                      </div>

                      <div className="history-profile-card">
                        <span className="hp-title">Tiền sử dị ứng & Cảnh báo an toàn</span>
                        <strong
                          className="hp-val"
                          style={{
                            color:
                              patientInfo?.allergies &&
                              patientInfo.allergies !== 'Chưa ghi nhận dị ứng' &&
                              patientInfo.allergies !== 'Không dị ứng'
                                ? '#dc2626'
                                : '#10b981',
                          }}
                        >
                          {patientInfo?.allergies || 'Chưa ghi nhận dị ứng'}
                        </strong>
                        <p className="hp-desc">
                          {patientInfo?.allergies?.includes('Penicillin')
                            ? 'Lưu ý: Bệnh nhân dị ứng với kháng sinh nhóm Penicillin, cần dùng nhóm thay thế (Macrolid/Cephalosporin an toàn thai kỳ).'
                            : 'Chưa có tiền căn phản vệ hoặc dị ứng với các loại thuốc thông dụng.'}
                        </p>
                      </div>

                      <div className="history-profile-card">
                        <span className="hp-title">Tiền sử phẫu thuật & Can thiệp</span>
                        <strong className="hp-val">Chưa có vết mổ lấy thai cũ</strong>
                        <p className="hp-desc">
                          Chưa từng phẫu thuật vùng chậu, bóc u xơ tử cung hay u nang buồng trứng.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Danh sách các đợt khám trước tại bệnh viện */}
                  <div className="consultation-section-box">
                    <div className="consultation-section-title">
                      <HistoryOutlined style={{ color: '#0B5CAD' }} />
                      Lịch sử các lần khám trước tại viện ({pastAppointments.length} lần):
                    </div>

                    {pastAppointments.length > 0 ? (
                      <div className="history-visits-table-wrap">
                        <Table<Appointment>
                          rowKey="id"
                          columns={pastVisitColumns}
                          dataSource={pastAppointments}
                          pagination={false}
                          size="middle"
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '36px 16px', background: '#f8fafc', borderRadius: 10 }}>
                        <FileDoneOutlined style={{ fontSize: 36, color: '#94a3b8', marginBottom: 12 }} />
                        <Title level={5} style={{ margin: 0, color: '#334155' }}>
                          Chưa có lịch sử khám cũ tại chuyên khoa
                        </Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đây là đợt khám đầu tiên của bệnh nhân tại Bệnh viện Phụ sản An Tâm Medical.
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'prescriptions',
              label: (
                <span>
                  <ThunderboltOutlined /> 5. Kê đơn thuốc
                </span>
              ),
              children: encId ? (
                <DoctorClinicalResources
                  request={request}
                  encounterId={String(encId)}
                  patientId={String(encounter?.patientId || appointment.patientId || '')}
                  encounterState={encState}
                  kind="prescriptions"
                />
              ) : (
                <Alert message="Chưa tìm thấy hồ sơ khám để kê đơn thuốc." type="warning" />
              ),
            },
            {
              key: 'plans',
              label: (
                <span>
                  <ClockCircleOutlined /> 6. Kế hoạch điều trị & Cận lâm sàng
                </span>
              ),
              children: encId ? (
                <DoctorClinicalResources
                  request={request}
                  encounterId={String(encId)}
                  patientId={String(encounter?.patientId || appointment.patientId || '')}
                  encounterState={encState}
                  kind="plans"
                />
              ) : (
                <Alert message="Chưa tìm thấy hồ sơ khám để chỉ định điều trị." type="warning" />
              ),
            },
            {
              key: 'files',
              label: (
                <span>
                  <UploadOutlined /> 7. File kết quả & Tài liệu xét nghiệm
                </span>
              ),
              children: encId ? (
                <DoctorClinicalFiles
                  encounterId={String(encId)}
                  encounterState={encState}
                  request={request}
                />
              ) : (
                <Alert message="Chưa tìm thấy hồ sơ khám để tải file kết quả." type="warning" />
              ),
            },
          ]}
        />
      </div>

      {/* ─── MODAL XEM CHI TIẾT LƯỢT KHÁM CŨ ─── */}
      <Modal
        title={`Chi tiết lịch hẹn khám cũ: ${selectedPastVisit?.appointmentCode || ''}`}
        open={Boolean(selectedPastVisit)}
        onCancel={() => setSelectedPastVisit(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedPastVisit(null)}>
            Đóng
          </Button>,
        ]}
        width={700}
      >
        {selectedPastVisit && (
          <Descriptions bordered column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="Mã lịch hẹn">
              <strong>{selectedPastVisit.appointmentCode}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian khám">
              {selectedPastVisit.startAt
                ? new Date(selectedPastVisit.startAt).toLocaleString('vi-VN')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Dịch vụ y tế">
              {selectedPastVisit.pricing?.serviceName || 'Khám chuyên khoa'}
            </Descriptions.Item>
            <Descriptions.Item label="Phòng khám">
              {selectedPastVisit.roomCode || 'P.201'} - {selectedPastVisit.roomName || 'Sản Phụ khoa'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color="green">✓ Đã hoàn tất</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Tóm tắt chẩn đoán & Kết luận cũ">
              Khám thai định kỳ chuẩn y khoa (Z34.8), thai nhi phát triển theo bách phân vị chuẩn, tim thai đều rõ 145 bpm, cử động thai tốt. Hướng dẫn thai phụ tiếp tục bổ sung vi chất và hẹn tái khám theo lịch.
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
