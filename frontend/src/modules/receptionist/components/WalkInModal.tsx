import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ContactsOutlined,
  EditOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Spin,
  Tag,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { Requester } from '../../../services/catalog';
import { searchReceptionPatients } from '../../../services/operations';
import {
  fetchDoctorOccupiedSlots,
  fetchPatientDetails,
  generateSlotsForShift,
  type DeskCatalog,
  type DeskDoctorInfo,
  type DeskPatient,
  type WalkInInput,
} from '../../../services/receptionDesk';
import { EditPatientModal } from './EditPatientModal';

interface Props {
  open: boolean;
  catalog: DeskCatalog | null;
  request: Requester;
  initialPatient?: DeskPatient | null;
  onCancel: () => void;
  onSubmit: (data: WalkInInput) => Promise<void>;
  onPatientUpdated?: (updated: DeskPatient) => void;
}

export function WalkInModal({
  open,
  catalog,
  request,
  initialPatient,
  onCancel,
  onSubmit,
  onPatientUpdated,
}: Props) {
  const [form] = Form.useForm();
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');
  const [submitting, setSubmitting] = useState(false);
  const [patientSearchList, setPatientSearchList] = useState<DeskPatient[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<DeskPatient | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [editPatientOpen, setEditPatientOpen] = useState(false);

  // Quản lý Ngày, Ca khám, Bác sĩ và Khung giờ khám
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING'>('ALL');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [occupiedSlots, setOccupiedSlots] = useState<Set<string>>(new Set());
  const [loadingOccupied, setLoadingOccupied] = useState(false);

  // Xác định ca hiện tại theo giờ thực tế để highlight sẵn
  const getInitialShift = (): 'MORNING' | 'AFTERNOON' | 'EVENING' => {
    const currentHour = dayjs().hour();
    if (currentHour < 12) return 'MORNING';
    if (currentHour < 17) return 'AFTERNOON';
    return 'EVENING';
  };

  // Danh sách bác sĩ lọc theo ca làm việc đã chọn
  const availableDoctors = useMemo(() => {
    if (!catalog?.doctors) return [];
    if (selectedShift === 'ALL') return catalog.doctors;
    return catalog.doctors.filter((d) => d.shiftType === selectedShift);
  }, [catalog, selectedShift]);

  // Thông tin chi tiết bác sĩ đang được chọn
  const currentDoctorInfo = useMemo<DeskDoctorInfo | null>(() => {
    if (!selectedDoctorId) return null;
    return (
      catalog?.doctorInfoById?.get(selectedDoctorId) ||
      catalog?.doctors.find((d) => d.id === selectedDoctorId) ||
      null
    );
  }, [catalog, selectedDoctorId]);

  // Sinh danh sách các khung giờ khám theo ca trực chuẩn của bác sĩ
  const doctorSlots = useMemo<string[]>(() => {
    if (!currentDoctorInfo) {
      return generateSlotsForShift('07:30', '12:00', 30);
    }
    if (currentDoctorInfo.slots && currentDoctorInfo.slots.length > 0) {
      return currentDoctorInfo.slots;
    }
    return generateSlotsForShift(
      currentDoctorInfo.startTime || '07:30',
      currentDoctorInfo.endTime || '12:00',
      30
    );
  }, [currentDoctorInfo]);

  // Khởi tạo form khi mở Modal
  useEffect(() => {
    if (open) {
      form.resetFields();
      const today = dayjs();
      setSelectedDate(today);

      if (initialPatient) {
        setPatientMode('existing');
        setPatientSearchList([initialPatient]);
        setSelectedPatient(initialPatient);
        form.setFieldValue('patientId', initialPatient.id);

        fetchPatientDetails(request, initialPatient.id)
          .then((full) => {
            if (full) {
              setSelectedPatient(full);
              setPatientSearchList([full]);
            }
          })
          .catch(() => {});
      } else {
        setPatientMode('existing');
        setPatientSearchList([]);
        setSelectedPatient(null);
      }

      // Xác định ca hiện tại và tự động chọn bác sĩ trực ca này
      const initShift = getInitialShift();
      setSelectedShift(initShift);

      const docsInShift = (catalog?.doctors || []).filter((d) => d.shiftType === initShift);
      const defaultDoc = docsInShift[0] || catalog?.doctors?.[0];

      if (defaultDoc) {
        form.setFieldValue('doctorId', defaultDoc.id);
        form.setFieldValue('roomCode', defaultDoc.roomCode);
        setSelectedDoctorId(defaultDoc.id);
      }

      if (catalog?.services?.[0]) {
        form.setFieldValue('serviceId', catalog.services[0].id);
      }

      form.setFieldValue('date', today);
    }
  }, [open, catalog, form, initialPatient, request]);

  // Tải danh sách slot đã kín lịch khi đổi Ngày hoặc Bác sĩ
  useEffect(() => {
    if (!open || !selectedDoctorId || !selectedDate) return;

    let active = true;
    const loadOccupied = async () => {
      setLoadingOccupied(true);
      try {
        const dateStr = selectedDate.format('YYYY-MM-DD');
        const occupied = await fetchDoctorOccupiedSlots(request, selectedDoctorId, dateStr);
        if (active) setOccupiedSlots(occupied);
      } catch (err) {
        console.warn('Lỗi kiểm tra occupied slots:', err);
        if (active) setOccupiedSlots(new Set());
      } finally {
        if (active) setLoadingOccupied(false);
      }
    };

    loadOccupied();
    return () => {
      active = false;
    };
  }, [open, selectedDoctorId, selectedDate, request]);

  // Tự động chọn khung giờ khả dụng đầu tiên nếu khung giờ hiện tại không hợp lệ hoặc đã kín
  useEffect(() => {
    if (doctorSlots.length === 0) return;
    const isValid = doctorSlots.includes(selectedSlot) && !occupiedSlots.has(selectedSlot);
    if (!isValid) {
      const firstAvailable = doctorSlots.find((s) => !occupiedSlots.has(s));
      if (firstAvailable) {
        setSelectedSlot(firstAvailable);
        form.setFieldValue('slot', firstAvailable);
      }
    }
  }, [doctorSlots, occupiedSlots, selectedSlot, form]);

  // Xử lý khi đổi ca khám: cập nhật danh sách bác sĩ và tự chọn bác sĩ đầu tiên của ca
  const handleShiftChange = (shift: 'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING') => {
    setSelectedShift(shift);
    const docs =
      shift === 'ALL'
        ? catalog?.doctors || []
        : (catalog?.doctors || []).filter((d) => d.shiftType === shift);

    if (docs.length > 0) {
      const isCurrentInDocs = docs.some((d) => d.id === selectedDoctorId);
      if (!isCurrentInDocs) {
        const nextDoc = docs[0];
        setSelectedDoctorId(nextDoc.id);
        form.setFieldValue('doctorId', nextDoc.id);
        form.setFieldValue('roomCode', nextDoc.roomCode);
      }
    }
  };

  // Xử lý khi chọn bác sĩ: tự động đồng bộ phòng khám của bác sĩ đó
  const handleDoctorChange = (docId: string) => {
    setSelectedDoctorId(docId);
    form.setFieldValue('doctorId', docId);
    const doc =
      catalog?.doctorInfoById?.get(docId) ||
      catalog?.doctors.find((d) => d.id === docId);
    if (doc) {
      form.setFieldValue('roomCode', doc.roomCode);
    }
  };

  // Chuyển đổi dữ liệu tìm kiếm thành DeskPatient hợp lệ
  const toDeskPatient = (r: any, full?: DeskPatient | null): DeskPatient => {
    if (full) return full;
    const rawPhone = String(r.phoneNumber ?? r.phone ?? r.phoneNumberMasked ?? '');
    const formattedPhone = rawPhone.startsWith('+84') ? '0' + rawPhone.slice(3) : rawPhone;
    return {
      id: String(r.id),
      fullName: String(r.fullName || 'Bệnh nhân'),
      phone: formattedPhone || undefined,
      dateOfBirth: r.dateOfBirth ? String(r.dateOfBirth) : undefined,
      nationalId: r.nationalId ? String(r.nationalId) : undefined,
      nationalIdMasked: r.nationalIdMasked ? String(r.nationalIdMasked) : undefined,
      address: r.address ? String(r.address) : undefined,
      emergencyContacts: Array.isArray(r.emergencyContacts) ? r.emergencyContacts : [],
    };
  };

  // Tìm kiếm bệnh nhân theo tên, SĐT hoặc CCCD/CMND
  const handlePatientSearch = async (val: string) => {
    const q = val.trim();
    if (q.length < 2) return;
    setPatientSearching(true);
    try {
      const compact = q.replace(/[\s.-]/g, '');
      const resultsMap = new Map<string, DeskPatient>();

      // 1. Tìm theo số CCCD/CMND (9 hoặc 12 chữ số)
      if (compact.length >= 9 && compact.length <= 12 && /^\d+$/.test(compact)) {
        try {
          const rows = await searchReceptionPatients(request, { nationalId: compact });
          for (const r of rows) {
            if (r.id) {
              const full = await fetchPatientDetails(request, r.id);
              resultsMap.set(r.id, toDeskPatient(r, full));
            }
          }
        } catch {}
      }

      // 2. Tìm theo Số điện thoại (8 đến 11 chữ số)
      if (compact.length >= 8 && compact.length <= 11 && /^\+?\d+$/.test(compact)) {
        try {
          const phoneParam = compact.startsWith('0')
            ? '+84' + compact.slice(1)
            : compact.startsWith('+') ? compact : '+84' + compact;
          const rows = await searchReceptionPatients(request, { phoneNumber: phoneParam });
          for (const r of rows) {
            if (r.id && !resultsMap.has(r.id)) {
              const full = await fetchPatientDetails(request, r.id);
              resultsMap.set(r.id, toDeskPatient(r, full));
            }
          }
        } catch {}
      }

      // 3. Tìm theo Họ và tên (nếu chuỗi có chữ hoặc chưa tìm thấy bằng số)
      if (!/^\d+$/.test(compact) || resultsMap.size === 0) {
        try {
          const rows = await searchReceptionPatients(request, { fullName: q });
          for (const r of rows) {
            if (r.id && !resultsMap.has(r.id)) {
              const full = await fetchPatientDetails(request, r.id);
              resultsMap.set(r.id, toDeskPatient(r, full));
            }
          }
        } catch {}
      }

      const mapped = Array.from(resultsMap.values());
      setPatientSearchList(mapped);
    } catch {
      setPatientSearchList([]);
    } finally {
      setPatientSearching(false);
    }
  };

  // Khi chọn một bệnh nhân từ danh sách tìm kiếm
  const handleSelectPatient = async (patientId: string) => {
    form.setFieldValue('patientId', patientId);
    const current = patientSearchList.find((p) => p.id === patientId);
    if (current) {
      setSelectedPatient(current);
    }

    setLoadingPatient(true);
    try {
      const full = await fetchPatientDetails(request, patientId);
      if (full) {
        setSelectedPatient(full);
        setPatientSearchList((prev) => {
          const idx = prev.findIndex((p) => p.id === full.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = full;
            return next;
          }
          return [full, ...prev];
        });
      }
    } catch (err) {
      console.warn('Lỗi khi nạp chi tiết bệnh nhân:', err);
    } finally {
      setLoadingPatient(false);
    }
  };

  const handleFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const slotParts = (values.slot || selectedSlot).split(' - ');
      const startTime = slotParts[0]?.trim();
      const endTime = slotParts[1]?.trim();
      const dateStr = values.date
        ? values.date.format('YYYY-MM-DD')
        : selectedDate.format('YYYY-MM-DD');

      const payload: WalkInInput = {
        serviceId: values.serviceId,
        doctorId: values.doctorId,
        roomCode: values.roomCode,
        date: dateStr,
        startTime,
        endTime,
      };

      if (patientMode === 'existing') {
        if (!values.patientId) {
          throw new Error('Vui lòng chọn bệnh nhân đã có hồ sơ.');
        }
        payload.patientId = values.patientId;
      } else {
        if (!values.fullName?.trim()) {
          throw new Error('Vui lòng nhập họ và tên bệnh nhân.');
        }
        payload.fullName = values.fullName.trim();
        payload.phoneNumber = values.phoneNumber?.trim();
        payload.dateOfBirth = values.dateOfBirth
          ? values.dateOfBirth.format('YYYY-MM-DD')
          : '1995-01-01';
        payload.address = values.address?.trim() || 'Hà Nội';
      }

      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserAddOutlined style={{ color: '#0B5CAD', fontSize: 16 }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                Tiếp nhận bệnh nhân vãng lai (Walk-in)
              </div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Tạo ca khám trực tiếp tại quầy, chọn khung giờ khám và đưa vào hàng đợi hôm nay
              </div>
            </div>
          </div>
        }
        open={open}
        onCancel={onCancel}
        centered
        footer={null}
        destroyOnHidden
        width={880}
      >
        <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 12 }}>
          {/* KHỐI 1: ĐỐI TƯỢNG TIẾP NHẬN */}
          <Form.Item label={<span style={{ fontWeight: 600, color: '#1E293B' }}>Đối tượng tiếp nhận</span>}>
            <Radio.Group
              value={patientMode}
              onChange={(e) => {
                setPatientMode(e.target.value);
                if (e.target.value === 'new') {
                  setSelectedPatient(null);
                }
              }}
              buttonStyle="solid"
            >
              <Radio.Button value="existing">Bệnh nhân đã có hồ sơ</Radio.Button>
              <Radio.Button value="new">+ Bệnh nhân mới chưa có hồ sơ</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {/* KHỐI 2: THÔNG TIN BỆNH NHÂN */}
          {patientMode === 'existing' ? (
            <>
              <Form.Item
                name="patientId"
                label={
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>
                    <SearchOutlined style={{ color: '#0B5CAD', marginRight: 6 }} />
                    Tìm kiếm & Chọn bệnh nhân
                  </span>
                }
                rules={[{ required: true, message: 'Vui lòng tìm và chọn bệnh nhân' }]}
                extra={
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Gõ tên, số điện thoại hoặc số CCCD để tìm nhanh bệnh nhân trong hệ thống
                  </span>
                }
              >
                <Select
                  showSearch
                  placeholder="Gõ tên, SĐT hoặc CCCD..."
                  filterOption={false}
                  onSearch={handlePatientSearch}
                  onChange={handleSelectPatient}
                  loading={patientSearching}
                  popupMatchSelectWidth={false}
                  dropdownStyle={{ minWidth: 540 }}
                  notFoundContent={patientSearching ? 'Đang tìm kiếm...' : 'Không tìm thấy bệnh nhân phù hợp'}
                  options={patientSearchList.map((p) => {
                    const birthYear = p.dateOfBirth ? dayjs(p.dateOfBirth).format('YYYY') : '';
                    const ageStr = p.dateOfBirth
                      ? `${dayjs().year() - dayjs(p.dateOfBirth).year()} tuổi`
                      : '';
                    const idStr = p.nationalId || p.nationalIdMasked;
                    return {
                      value: p.id,
                      label: (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: '2px 0',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>
                              {p.fullName}
                            </span>
                            {birthYear && (
                              <Tag color="default" style={{ margin: 0, fontSize: 11, borderRadius: 3 }}>
                                {birthYear} ({ageStr})
                              </Tag>
                            )}
                            {idStr && (
                              <Tag color="geekblue" style={{ margin: 0, fontSize: 11, borderRadius: 3 }}>
                                CCCD: {idStr}
                              </Tag>
                            )}
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            {p.phone ? (
                              <Tag color="blue" style={{ margin: 0, fontWeight: 500, fontSize: 12 }}>
                                {p.phone}
                              </Tag>
                            ) : (
                              <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>
                                Chưa có SĐT
                              </Tag>
                            )}
                          </div>
                        </div>
                      ),
                    };
                  })}
                />
              </Form.Item>

              {/* KHỐI HIỂN THỊ ĐẦY ĐỦ THÔNG TIN BỆNH NHÂN ĐÃ CHỌN VÀ NÚT CHỈNH SỬA */}
              {selectedPatient && (
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 18,
                    marginTop: -4,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: 10,
                      marginBottom: 10,
                      borderBottom: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UserOutlined style={{ color: '#0B5CAD', fontSize: 15 }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                        {selectedPatient.fullName}
                      </span>
                      <Tag color="cyan" style={{ margin: 0, fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
                        Đã có hồ sơ y tế
                      </Tag>
                      {loadingPatient && <Spin size="small" />}
                    </div>

                    <Button
                      type="default"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => setEditPatientOpen(true)}
                      style={{
                        borderRadius: 6,
                        borderColor: '#0B5CAD',
                        color: '#0B5CAD',
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      Chỉnh sửa bệnh nhân
                    </Button>
                  </div>

                  <Row gutter={[16, 8]}>
                    <Col span={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                        <CalendarOutlined style={{ color: '#0B5CAD', fontSize: 14 }} />
                        <span>
                          Ngày sinh:{' '}
                          <span style={{ color: '#0F172A', fontWeight: 400 }}>
                            {selectedPatient.dateOfBirth
                              ? `${dayjs(selectedPatient.dateOfBirth).format('DD/MM/YYYY')} (${dayjs().year() - dayjs(selectedPatient.dateOfBirth).year()} tuổi)`
                              : '—'}
                          </span>
                        </span>
                      </div>
                    </Col>

                    <Col span={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                        <PhoneOutlined style={{ color: '#0B5CAD', fontSize: 14 }} />
                        <span>
                          Số điện thoại:{' '}
                          <span style={{ color: '#0F172A', fontWeight: 400 }}>
                            {selectedPatient.phone || 'Chưa có SĐT'}
                          </span>
                        </span>
                      </div>
                    </Col>

                    <Col span={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                        <IdcardOutlined style={{ color: '#0B5CAD', fontSize: 14 }} />
                        <span>
                          CCCD / Định danh:{' '}
                          <span style={{ color: '#0F172A', fontWeight: 400 }}>
                            {selectedPatient.nationalId || selectedPatient.nationalIdMasked || '—'}
                          </span>
                        </span>
                      </div>
                    </Col>

                    <Col span={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                        <EnvironmentOutlined style={{ color: '#0B5CAD', fontSize: 14 }} />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={selectedPatient.address || ''}
                        >
                          Địa chỉ:{' '}
                          <span style={{ color: '#0F172A', fontWeight: 400 }}>
                            {selectedPatient.address || '—'}
                          </span>
                        </span>
                      </div>
                    </Col>

                    <Col span={24}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                        <ContactsOutlined style={{ color: '#0B5CAD', fontSize: 14 }} />
                        <span>
                          Liên hệ khẩn cấp:{' '}
                          <span style={{ color: '#0F172A', fontWeight: 400 }}>
                            {selectedPatient.emergencyContacts?.[0]
                              ? `${selectedPatient.emergencyContacts[0].fullName} (${selectedPatient.emergencyContacts[0].relationship || 'Người thân'}) – ${selectedPatient.emergencyContacts[0].phone || '—'}`
                              : '—'}
                          </span>
                        </span>
                      </div>
                    </Col>
                  </Row>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>
                Thông tin hành chính bệnh nhân mới
              </div>
              <Form.Item
                name="fullName"
                label={<span style={{ fontWeight: 600 }}>Họ và tên bệnh nhân</span>}
                rules={[{ required: true, message: 'Nhập họ và tên bệnh nhân' }]}
                style={{ marginBottom: 12 }}
              >
                <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: Hoàng Thùy Dương" />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="phoneNumber"
                    label={<span style={{ fontWeight: 600 }}>Số điện thoại</span>}
                    rules={[
                      { required: true, message: 'Nhập số điện thoại' },
                      { pattern: /^0\d{9}$/, message: 'SĐT gồm 10 số (0...)' },
                    ]}
                    style={{ marginBottom: 12 }}
                  >
                    <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: 0912345678" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item name="dateOfBirth" label={<span style={{ fontWeight: 600 }}>Ngày sinh</span>} style={{ marginBottom: 12 }}>
                    <DatePicker
                      format="DD/MM/YYYY"
                      placeholder="Chọn ngày sinh"
                      style={{ width: '100%' }}
                      disabledDate={(d) => d && d.isAfter(dayjs())}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="address" label={<span style={{ fontWeight: 600 }}>Địa chỉ cư trú</span>} style={{ marginBottom: 4 }}>
                <Input prefix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: Tây Hồ, Hà Nội" />
              </Form.Item>
            </div>
          )}

          {/* KHỐI 3: THỜI ĐIỂM KHÁM, BÁC SĨ & DỊCH VỤ */}
          <Form.Item name="roomCode" hidden>
            <Input />
          </Form.Item>

          {/* HÀNG 1: NGÀY KHÁM & CA KHÁM BỆNH */}
          <Row gutter={16} align="bottom" style={{ marginBottom: 14 }}>
            <Col span={7}>
              <Form.Item
                name="date"
                label={
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>
                    <CalendarOutlined style={{ color: '#0B5CAD', marginRight: 6 }} />
                    Ngày khám
                  </span>
                }
                rules={[{ required: true, message: 'Chọn ngày khám' }]}
                style={{ marginBottom: 0 }}
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%', borderRadius: 6 }}
                  minDate={dayjs()}
                  allowClear={false}
                  onChange={(d) => {
                    if (d) {
                      setSelectedDate(d);
                      form.setFieldValue('date', d);
                    }
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={17}>
              <div>
                <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: 8, fontSize: 14 }}>
                  <ClockCircleOutlined style={{ color: '#0B5CAD', marginRight: 6 }} />
                  Ca khám bệnh
                </div>
                <Segmented
                  block
                  value={selectedShift}
                  onChange={(val) => handleShiftChange(val as any)}
                  options={[
                    { label: 'Tất cả ca', value: 'ALL' },
                    { label: '🌅 Ca Sáng (07:30 - 12:00)', value: 'MORNING' },
                    { label: '🌇 Ca Chiều (12:30 - 17:00)', value: 'AFTERNOON' },
                    { label: '🌙 Ca Tối (17:30 - 20:30)', value: 'EVENING' },
                  ]}
                  style={{ padding: 3, background: '#F1F5F9', borderRadius: 8 }}
                />
              </div>
            </Col>
          </Row>

          {/* HÀNG 2: BÁC SĨ PHỤ TRÁCH & DỊCH VỤ Y TẾ */}
          <Row gutter={16} style={{ marginBottom: 6 }}>
            <Col span={12}>
              <Form.Item
                name="doctorId"
                label={
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>
                    <MedicineBoxOutlined style={{ color: '#0B5CAD', marginRight: 6 }} />
                    Bác sĩ phụ trách ca
                  </span>
                }
                rules={[{ required: true, message: 'Chọn bác sĩ phụ trách' }]}
                style={{ marginBottom: 14 }}
              >
                <Select
                  style={{ width: '100%', borderRadius: 6 }}
                  placeholder="Chọn bác sĩ phụ trách"
                  popupMatchSelectWidth={false}
                  dropdownStyle={{ minWidth: 500 }}
                  onChange={handleDoctorChange}
                  options={availableDoctors.map((d) => ({
                    value: d.id,
                    label: `${d.name} — Phòng ${d.roomCode}`,
                    doctor: d,
                  }))}
                  optionRender={(option) => {
                    const d = option.data.doctor;
                    if (!d) return option.label;
                    return (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          width: '100%',
                          padding: '2px 0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap' }}>
                            {d.name}
                          </span>
                          <Tag
                            color="blue"
                            style={{
                              margin: 0,
                              fontWeight: 600,
                              fontSize: 11,
                              padding: '0 6px',
                              lineHeight: '18px',
                              borderRadius: 4,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Phòng {d.roomCode}
                          </Tag>
                        </div>
                        {d.shiftLabel && (
                          <Tag
                            color={
                              d.shiftType === 'MORNING'
                                ? 'cyan'
                                : d.shiftType === 'AFTERNOON'
                                ? 'orange'
                                : 'purple'
                            }
                            style={{
                              margin: 0,
                              fontSize: 11,
                              fontWeight: 500,
                              padding: '0 6px',
                              lineHeight: '18px',
                              borderRadius: 4,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {d.shiftLabel}
                          </Tag>
                        )}
                      </div>
                    );
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="serviceId"
                label={
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>
                    Dịch vụ y tế đăng ký khám
                  </span>
                }
                rules={[{ required: true, message: 'Chọn dịch vụ khám' }]}
                style={{ marginBottom: 14 }}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn gói khám / dịch vụ"
                  style={{ width: '100%', borderRadius: 6 }}
                  options={(catalog?.services || []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* HÀNG 3: CHỌN KHUNG GIỜ KHÁM TRỰC DIỆN (5 Ô / HÀNG) */}
          <Form.Item
            name="slot"
            label={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <span style={{ fontWeight: 600, color: '#1E293B' }}>
                  <ClockCircleOutlined style={{ color: '#0B5CAD', marginRight: 6 }} />
                  Khung giờ khám ({currentDoctorInfo?.shiftLabel || 'Theo ca làm việc của bác sĩ'})
                </span>
                {loadingOccupied && <Spin size="small" />}
              </div>
            }
            rules={[{ required: true, message: 'Vui lòng chọn khung giờ khám' }]}
            style={{ marginBottom: 16 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
                padding: 2,
              }}
            >
              {doctorSlots.map((slotTime) => {
                const isOccupied = occupiedSlots.has(slotTime);
                const isSelected = selectedSlot === slotTime;

                if (isOccupied) {
                  return (
                    <div
                      key={slotTime}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 8,
                        border: '1px solid #E2E8F0',
                        background: '#F1F5F9',
                        color: '#94A3B8',
                        cursor: 'not-allowed',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        opacity: 0.75,
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, textDecoration: 'line-through' }}>
                        {slotTime}
                      </span>
                      <Tag
                        color="default"
                        style={{
                          margin: 0,
                          fontSize: 10,
                          padding: '0 6px',
                          lineHeight: '18px',
                          borderRadius: 4,
                        }}
                      >
                        Đã kín lịch
                      </Tag>
                    </div>
                  );
                }

                return (
                  <button
                    key={slotTime}
                    type="button"
                    onClick={() => {
                      setSelectedSlot(slotTime);
                      form.setFieldValue('slot', slotTime);
                    }}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      border: isSelected ? '1.5px solid #0B5CAD' : '1px solid #CBD5E1',
                      background: isSelected ? '#0B5CAD' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#1E293B',
                      boxShadow: isSelected
                        ? '0 2px 6px rgba(11, 92, 173, 0.25)'
                        : '0 1px 2px rgba(0, 0, 0, 0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600 }}>
                        {slotTime}
                      </span>
                      {isSelected && <CheckCircleFilled style={{ color: '#FFFFFF', fontSize: 13 }} />}
                    </div>

                    <Tag
                      color={isSelected ? 'processing' : 'success'}
                      style={{
                        margin: 0,
                        fontSize: 10,
                        padding: '0 6px',
                        lineHeight: '18px',
                        borderRadius: 4,
                        border: 'none',
                        background: isSelected ? 'rgba(255, 255, 255, 0.25)' : undefined,
                        color: isSelected ? '#FFFFFF' : undefined,
                        fontWeight: 500,
                      }}
                    >
                      {isSelected ? 'Đang chọn' : 'Khả dụng'}
                    </Tag>
                  </button>
                );
              })}
            </div>
          </Form.Item>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              borderTop: '1px solid #E2E8F0',
              paddingTop: 16,
            }}
          >
            <Button onClick={onCancel} disabled={submitting} style={{ borderRadius: 6 }}>
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={<PlusCircleOutlined />}
              style={{
                backgroundColor: '#0B5CAD',
                borderRadius: 6,
                fontWeight: 600,
                padding: '0 20px',
              }}
            >
              Xác nhận Tiếp nhận vãng lai
            </Button>
          </div>
        </Form>
      </Modal>

      {/* MODAL CHỈNH SỬA THÔNG TIN BỆNH NHÂN TRỰC TIẾP TRONG MODAL VÃNG LAI */}
      <EditPatientModal
        open={editPatientOpen}
        patient={selectedPatient}
        request={request}
        onClose={() => setEditPatientOpen(false)}
        onSuccess={(updated) => {
          setSelectedPatient(updated);
          setPatientSearchList((prev) => {
            const idx = prev.findIndex((p) => p.id === updated.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = updated;
              return next;
            }
            return [updated, ...prev];
          });
          form.setFieldValue('patientId', updated.id);
          if (onPatientUpdated) {
            onPatientUpdated(updated);
          }
        }}
      />
    </>
  );
}
