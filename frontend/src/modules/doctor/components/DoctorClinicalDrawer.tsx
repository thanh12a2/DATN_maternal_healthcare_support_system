import { useState } from 'react';
import {
  CheckCircleOutlined,
  CloseOutlined,
  FileTextOutlined,
  HeartOutlined,
  MedicineBoxOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Radio,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { Requester } from '../../../services/catalog';
import type { Appointment } from '../../../services/appointment';
import type { Encounter } from '../../../services/clinical';
import { DoctorClinicalResources } from './DoctorClinicalResources';

const { Text, Title, Paragraph } = Typography;

export interface DoctorClinicalDrawerProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  encounter: Encounter | null;
  patientName?: string;
  patientPhone?: string;
  request: Requester;
  onReload: () => void;
}

const COMMON_ICD10 = [
  { code: 'Z34.8', label: 'Khám thai định kỳ chuẩn' },
  { code: 'O24.4', label: 'ĐTĐ thai kỳ' },
  { code: 'O13', label: 'Tăng huyết áp thai kỳ' },
  { code: 'O21.0', label: 'Nghén nặng' },
  { code: 'N76.0', label: 'Viêm âm đạo cấp' },
  { code: 'Z01.4', label: 'Khám phụ khoa định kỳ' },
];

export function DoctorClinicalDrawer({
  open,
  onClose,
  appointment,
  encounter,
  patientName,
  patientPhone,
  request,
  onReload,
}: DoctorClinicalDrawerProps) {
  const [activeTab, setActiveTab] = useState('vitals');
  const [busy, setBusy] = useState(false);

  // Form states
  const [systolic, setSystolic] = useState<number | null>(null);
  const [diastolic, setDiastolic] = useState<number | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);

  const [icdCode, setIcdCode] = useState('');
  const [diagnosisDesc, setDiagnosisDesc] = useState('');
  const [noteContent, setNoteContent] = useState('');

  if (!appointment) return null;

  const rawEncId = encounter?.id || appointment.encounterId;
  const encId = rawEncId ? String(rawEncId) : '';
  const version = Number(encounter?.version || 1);
  const encState = String(encounter?.state || 'DRAFT');

  const canStart = encState === 'DRAFT' || appointment.status === 'CHECKED_IN';
  const canEdit = encState === 'IN_PROGRESS';
  const isFinalized =
    encState === 'FINALIZED' || appointment.status === 'COMPLETED';

  // API Action Sender
  const sendAction = async (
    path: string,
    body: Record<string, unknown> = {},
  ) => {
    if (!encId) {
      message.error('Không tìm thấy mã hồ sơ khám (Encounter ID).');
      return;
    }
    setBusy(true);
    try {
      await request(
        `/api/medical-records/encounters/${encodeURIComponent(encId)}/${path}`,
        {
          method: 'POST',
          body: JSON.stringify({ ...body, expectedVersion: version }),
        },
      );
      message.success('Thao tác thành công.');
      onReload();
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra khi lưu dữ liệu.');
    } finally {
      setBusy(false);
    }
  };

  // 1. Lưu Dấu hiệu sinh tồn
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

  // 2. Lưu Chẩn đoán
  const handleSaveDiagnosis = async () => {
    if (!icdCode.trim() || !diagnosisDesc.trim()) {
      message.warning('Vui lòng nhập đầy đủ Mã chẩn đoán và Mô tả bệnh.');
      return;
    }
    await sendAction('diagnoses', {
      code: icdCode.trim(),
      description: diagnosisDesc.trim(),
    });
    setIcdCode('');
    setDiagnosisDesc('');
  };

  // 3. Lưu Ghi chú khám
  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      message.warning('Vui lòng nhập nội dung ghi chú.');
      return;
    }
    await sendAction('notes', { content: noteContent.trim() });
    setNoteContent('');
  };

  // Dữ liệu sinh hiệu gần nhất
  const vitalsList = Array.isArray(encounter?.vitalSigns)
    ? encounter.vitalSigns
    : [];
  const latestVital =
    vitalsList.length > 0 ? vitalsList[vitalsList.length - 1] : null;

  // Danh sách chẩn đoán & ghi chú
  const diagnosesList = Array.isArray(encounter?.diagnoses)
    ? encounter.diagnoses
    : [];
  const notesList = Array.isArray(encounter?.notes) ? encounter.notes : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={840}
      destroyOnClose={false}
      styles={{
        header: { padding: '16px 24px', borderBottom: '1px solid #e2e8f0' },
        body: { padding: '20px 24px', background: '#f8fafc' },
      }}
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, color: '#0B5CAD' }}>
              HỒ SƠ BỆNH ÁN KHÁM BỆNH
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Mã lịch:{' '}
              <strong style={{ color: '#0f172a' }}>
                {appointment.appointmentCode}
              </strong>
            </Text>
          </div>
          <div>
            {encState === 'DRAFT' && <Tag color="orange">CHỜ BẮT ĐẦU</Tag>}
            {encState === 'IN_PROGRESS' && <Tag color="green">ĐANG KHÁM</Tag>}
            {encState === 'READY_FOR_REVIEW' && (
              <Tag color="blue">CHỜ DUYỆT</Tag>
            )}
            {encState === 'FINALIZED' && <Tag color="purple">ĐÃ HOÀN TẤT</Tag>}
          </div>
        </div>
      }
    >
      {/* 1. Patient Summary Card */}
      <div className="clinical-drawer-patient-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar
            size={52}
            style={{
              backgroundColor: '#0B5CAD',
              fontSize: 20,
              fontWeight: 700,
            }}
            icon={<UserOutlined />}
          >
            {patientName ? patientName.slice(-1) : 'BN'}
          </Avatar>
          <div>
            <Title level={5} style={{ margin: 0, color: '#0f172a' }}>
              {patientName || appointment.patientName || 'Bệnh nhân'}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              SĐT: <strong>{patientPhone || 'Chưa cập nhật'}</strong> · Dịch vụ:{' '}
              <strong>
                {appointment.pricing?.serviceName || 'Khám thai định kỳ'}
              </strong>
            </Text>
            <div style={{ marginTop: 4 }}>
              <Tag color="cyan">Phòng: {appointment.roomCode || 'P.201'}</Tag>
              {appointment.queueCode && (
                <Tag color="blue" style={{ fontWeight: 700 }}>
                  STT: {appointment.queueCode}
                </Tag>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Workflow Action Controls */}
      <div className="clinical-action-bar">
        <Text
          strong
          style={{ marginRight: 'auto', fontSize: 13, color: '#334155' }}
        >
          Tiến trình buổi khám:
        </Text>

        {canStart && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={busy}
            style={{ background: '#10b981', borderColor: '#10b981' }}
            onClick={() => sendAction('start')}
          >
            Bắt đầu khám bệnh
          </Button>
        )}

        {canEdit && (
          <>
            <Button
              icon={<SendOutlined />}
              loading={busy}
              onClick={() => sendAction('ready-for-review')}
            >
              Chuyển duyệt
            </Button>

            <Popconfirm
              title="Xác nhận hoàn tất ca khám?"
              description="Sau khi hoàn tất, hồ sơ bệnh án sẽ được khóa và gửi tới bệnh nhân."
              okText="Hoàn tất"
              cancelText="Hủy"
              onConfirm={() => sendAction('finalize')}
            >
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={busy}
                style={{ background: '#0B5CAD', borderColor: '#0B5CAD' }}
              >
                Hoàn tất & Đóng bệnh án
              </Button>
            </Popconfirm>
          </>
        )}

        {encState === 'READY_FOR_REVIEW' && (
          <Popconfirm
            title="Xác nhận hoàn tất ca khám?"
            onConfirm={() => sendAction('finalize')}
            okText="Hoàn tất"
            cancelText="Hủy"
          >
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={busy}
              style={{ background: '#0B5CAD' }}
            >
              Hoàn tất ca khám
            </Button>
          </Popconfirm>
        )}

        {isFinalized && (
          <Tag color="green" style={{ fontSize: 13, padding: '4px 10px' }}>
            ✓ Buổi khám đã hoàn tất
          </Tag>
        )}
      </div>

      {/* 3. Clinical Tabs */}
      <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'vitals',
              label: '1. Dấu hiệu sinh tồn',
              children: (
                <div>
                  {/* Latest Vitals Summary */}
                  <div className="vitals-grid">
                    <div className="vital-metric-card">
                      <span>Huyết áp</span>
                      <strong>
                        {latestVital?.systolic != null ||
                        latestVital?.diastolic != null
                          ? `${latestVital.systolic || '—'}/${latestVital.diastolic || '—'} mmHg`
                          : '—'}
                      </strong>
                    </div>
                    <div className="vital-metric-card">
                      <span>Nhịp tim</span>
                      <strong>
                        {latestVital?.heartRate
                          ? `${latestVital.heartRate} bpm`
                          : '—'}
                      </strong>
                    </div>
                    <div className="vital-metric-card">
                      <span>Thân nhiệt</span>
                      <strong>
                        {latestVital?.temperature
                          ? `${latestVital.temperature} °C`
                          : '—'}
                      </strong>
                    </div>
                    <div className="vital-metric-card">
                      <span>Cân nặng</span>
                      <strong>
                        {latestVital?.weight ? `${latestVital.weight} kg` : '—'}
                      </strong>
                    </div>
                  </div>

                  {/* Vitals Input Form */}
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      marginBottom: 16,
                    }}
                  >
                    <Title level={5} style={{ marginBottom: 12, fontSize: 14 }}>
                      Nhập kết quả đo sinh hiệu mới:
                    </Title>
                    <Space wrap size="middle">
                      <div>
                        <Text
                          style={{
                            display: 'block',
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Huyết áp tâm thu (mmHg):
                        </Text>
                        <InputNumber
                          min={40}
                          max={300}
                          placeholder="120"
                          value={systolic}
                          onChange={setSystolic}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text
                          style={{
                            display: 'block',
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Huyết áp tâm trương (mmHg):
                        </Text>
                        <InputNumber
                          min={20}
                          max={200}
                          placeholder="80"
                          value={diastolic}
                          onChange={setDiastolic}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text
                          style={{
                            display: 'block',
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Nhịp tim (lần/phút):
                        </Text>
                        <InputNumber
                          min={20}
                          max={250}
                          placeholder="75"
                          value={heartRate}
                          onChange={setHeartRate}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text
                          style={{
                            display: 'block',
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Nhiệt độ (°C):
                        </Text>
                        <InputNumber
                          min={30}
                          max={45}
                          step={0.1}
                          placeholder="36.8"
                          value={temperature}
                          onChange={setTemperature}
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <Text
                          style={{
                            display: 'block',
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          Cân nặng (kg):
                        </Text>
                        <InputNumber
                          min={1}
                          max={500}
                          step={0.1}
                          placeholder="58.5"
                          value={weight}
                          onChange={setWeight}
                          disabled={!canEdit}
                        />
                      </div>
                    </Space>
                    <div style={{ marginTop: 14 }}>
                      <Button
                        type="primary"
                        loading={busy}
                        disabled={!canEdit}
                        onClick={handleSaveVitals}
                      >
                        Lưu dấu hiệu sinh tồn
                      </Button>
                      {!canEdit && (
                        <Text
                          type="secondary"
                          style={{ marginLeft: 12, fontSize: 12 }}
                        >
                          (Cần ấn "Bắt đầu khám bệnh" để nhập số liệu)
                        </Text>
                      )}
                    </div>
                  </div>

                  {/* Vitals History */}
                  {vitalsList.length > 0 && (
                    <div>
                      <Text
                        strong
                        style={{
                          fontSize: 13,
                          marginBottom: 8,
                          display: 'block',
                        }}
                      >
                        Lịch sử đo sinh hiệu:
                      </Text>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {vitalsList.map((v: any, idx: number) => (
                          <div
                            key={v.id || idx}
                            style={{
                              padding: '10px 14px',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 8,
                              fontSize: 13,
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>
                              <strong>
                                {v.systolic}/{v.diastolic} mmHg
                              </strong>{' '}
                              · {v.heartRate} bpm · {v.temperature} °C ·{' '}
                              {v.weight} kg
                            </span>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {v.recordedAt
                                ? new Date(v.recordedAt).toLocaleTimeString(
                                    'vi-VN',
                                  )
                                : ''}
                            </Text>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'diagnoses',
              label: '2. Chẩn đoán & Bệnh sử',
              children: (
                <div>
                  {/* Chief complaint */}
                  <div
                    style={{
                      background: '#f8fafc',
                      padding: 14,
                      borderRadius: 10,
                      marginBottom: 16,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Text strong style={{ fontSize: 13 }}>
                      Lý do đến khám:
                    </Text>
                    <Paragraph style={{ margin: '4px 0 0', color: '#334155' }}>
                      {String(
                        encounter?.chiefComplaint ||
                          appointment.pricing?.serviceName ||
                          'Khám thai định kỳ & tư vấn sức khỏe',
                      )}
                    </Paragraph>
                  </div>

                  {/* Diagnosis Form */}
                  <div
                    style={{
                      background: '#ffffff',
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      marginBottom: 16,
                    }}
                  >
                    <Title level={5} style={{ marginBottom: 10, fontSize: 14 }}>
                      Thêm Chẩn đoán bệnh (ICD-10):
                    </Title>

                    {/* Quick ICD tags */}
                    <div style={{ marginBottom: 12 }}>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, marginRight: 8 }}
                      >
                        Gợi ý nhanh:
                      </Text>
                      <Space wrap size={[0, 6]}>
                        {COMMON_ICD10.map((item) => (
                          <Tag.CheckableTag
                            key={item.code}
                            checked={icdCode === item.code}
                            onChange={() => {
                              setIcdCode(item.code);
                              setDiagnosisDesc(item.label);
                            }}
                          >
                            {item.code} - {item.label}
                          </Tag.CheckableTag>
                        ))}
                      </Space>
                    </div>

                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input
                        placeholder="Mã ICD-10 (ví dụ: Z34.8)"
                        value={icdCode}
                        onChange={(e) => setIcdCode(e.target.value)}
                        disabled={!canEdit}
                        style={{ maxWidth: 200 }}
                      />
                      <Input.TextArea
                        rows={2}
                        placeholder="Mô tả chẩn đoán lâm sàng chi tiết..."
                        value={diagnosisDesc}
                        onChange={(e) => setDiagnosisDesc(e.target.value)}
                        disabled={!canEdit}
                      />
                      <Button
                        type="primary"
                        loading={busy}
                        disabled={!canEdit}
                        onClick={handleSaveDiagnosis}
                      >
                        Lưu chẩn đoán
                      </Button>
                    </Space>
                  </div>

                  {/* Diagnoses List */}
                  {diagnosesList.length > 0 && (
                    <div>
                      <Text
                        strong
                        style={{
                          fontSize: 13,
                          marginBottom: 8,
                          display: 'block',
                        }}
                      >
                        Chẩn đoán đã ghi:
                      </Text>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {diagnosesList.map((d: any, idx: number) => (
                          <div
                            key={d.id || idx}
                            style={{
                              padding: '10px 14px',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: 8,
                            }}
                          >
                            <Tag color="geekblue" style={{ fontWeight: 700 }}>
                              {d.code}
                            </Tag>
                            <strong style={{ color: '#0f172a' }}>
                              {d.description}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'notes',
              label: '3. Ghi chú chuyên môn',
              children: (
                <div>
                  <div
                    style={{
                      background: '#ffffff',
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      marginBottom: 16,
                    }}
                  >
                    <Title level={5} style={{ marginBottom: 10, fontSize: 14 }}>
                      Ghi nhận diễn biến & y lệnh dặn dò:
                    </Title>
                    <Input.TextArea
                      rows={4}
                      placeholder="Ghi nhận triệu chứng lâm sàng, dặn dò uống thuốc, chế độ dinh dưỡng, mốc tái khám..."
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
                    >
                      Lưu ghi chú
                    </Button>
                  </div>

                  {/* Notes History */}
                  {notesList.length > 0 && (
                    <div>
                      <Text
                        strong
                        style={{
                          fontSize: 13,
                          marginBottom: 8,
                          display: 'block',
                        }}
                      >
                        Ghi chú đã lưu:
                      </Text>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {notesList.map((n: any, idx: number) => (
                          <div
                            key={n.id || idx}
                            style={{
                              padding: '12px 14px',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 8,
                            }}
                          >
                            <Paragraph style={{ margin: 0, color: '#1e293b' }}>
                              {n.content || n.text}
                            </Paragraph>
                            <Text
                              type="secondary"
                              style={{
                                fontSize: 11,
                                display: 'block',
                                marginTop: 4,
                              }}
                            >
                              Ghi nhận lúc:{' '}
                              {n.createdAt
                                ? new Date(n.createdAt).toLocaleString('vi-VN')
                                : ''}
                            </Text>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'prescriptions',
              label: '4. Kê đơn thuốc',
              children: encId ? (
                <DoctorClinicalResources
                  request={request}
                  encounterId={String(encId)}
                  patientId={String(
                    encounter?.patientId || appointment.patientId || '',
                  )}
                  encounterState={encState}
                  kind="prescriptions"
                />
              ) : (
                <Alert
                  message="Chưa tìm thấy hồ sơ khám để kê đơn thuốc."
                  type="warning"
                />
              ),
            },
            {
              key: 'plans',
              label: '5. Cận lâm sàng & Điều trị',
              children: encId ? (
                <DoctorClinicalResources
                  request={request}
                  encounterId={String(encId)}
                  patientId={String(
                    encounter?.patientId || appointment.patientId || '',
                  )}
                  encounterState={encState}
                  kind="plans"
                />
              ) : (
                <Alert
                  message="Chưa tìm thấy hồ sơ khám để chỉ định điều trị."
                  type="warning"
                />
              ),
            },
          ]}
        />
      </Card>
    </Drawer>
  );
}
