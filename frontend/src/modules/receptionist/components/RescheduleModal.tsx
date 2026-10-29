import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { Requester } from '../../../services/catalog';
import {
  fetchDoctorOccupiedSlots,
  generateSlotsForShift,
  rescheduleAppointment,
  KNOWN_DOCTOR_SHIFTS,
  type DeskAppointment,
  type DeskCatalog,
  type DeskDoctorInfo,
} from '../../../services/receptionDesk';

interface Props {
  open: boolean;
  appointment: DeskAppointment | null;
  catalog: DeskCatalog | null;
  request: Requester;
  onClose: () => void;
  onSuccess: (updated: DeskAppointment) => void;
}

const QUICK_REASONS = [
  'Bệnh nhân yêu cầu đổi giờ hẹn',
  'Bệnh nhân bận lịch đột xuất',
  'Bác sĩ bận hội chẩn / ca phẫu thuật',
  'Điều phối cân bằng tải phòng khám',
];

export function RescheduleModal({
  open,
  appointment,
  catalog,
  request,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [occupiedSlots, setOccupiedSlots] = useState<Set<string>>(new Set());
  const [loadingOccupied, setLoadingOccupied] = useState(false);

  // Danh sách bác sĩ từ catalog
  const doctorsList = useMemo(() => {
    return catalog?.doctors || [];
  }, [catalog]);

  // Thông tin bác sĩ đang được chọn
  const currentDoctorInfo = useMemo<DeskDoctorInfo | null>(() => {
    if (!selectedDoctorId) return null;
    return (
      catalog?.doctorInfoById?.get(selectedDoctorId) ||
      doctorsList.find((d) => d.id === selectedDoctorId) ||
      null
    );
  }, [catalog, selectedDoctorId, doctorsList]);

  // Sinh danh sách các slot khám CHUẨN XÁC theo ca làm việc của bác sĩ đang chọn
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

  // Khởi tạo form khi mở modal
  useEffect(() => {
    if (open && appointment) {
      const apptDate = appointment.startAt ? dayjs(appointment.startAt) : dayjs();
      setSelectedDate(apptDate);

      // Tìm ID bác sĩ hiện tại
      const docId =
        appointment.doctorId ||
        doctorsList.find((d) => d.name === appointment.doctorName)?.id ||
        doctorsList[0]?.id ||
        '';
      setSelectedDoctorId(docId);

      const currentSlotLabel =
        appointment.startAt && appointment.endAt
          ? `${dayjs(appointment.startAt).format('HH:mm')} - ${dayjs(appointment.endAt).format('HH:mm')}`
          : '';
      setSelectedSlot(currentSlotLabel);

      form.setFieldsValue({
        date: apptDate,
        doctorId: docId,
        slot: currentSlotLabel,
        reason: 'Bệnh nhân yêu cầu dời lịch khám tại quầy',
      });
    }
  }, [open, appointment, doctorsList, form]);

  // Tải danh sách các slot đã bị đặt (kín lịch) khi thay đổi Ngày hoặc Bác sĩ
  useEffect(() => {
    if (!open || !appointment || !selectedDoctorId || !selectedDate) return;

    let active = true;
    const loadOccupied = async () => {
      setLoadingOccupied(true);
      try {
        const dateStr = selectedDate.format('YYYY-MM-DD');
        const occupied = await fetchDoctorOccupiedSlots(
          request,
          selectedDoctorId,
          dateStr,
          appointment.id
        );
        if (active) {
          setOccupiedSlots(occupied);
        }
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
  }, [open, appointment, selectedDoctorId, selectedDate, request]);

  // Tự động kiểm tra: nếu selectedSlot không thuộc ca của bác sĩ mới hoặc đã kín, chọn slot trống đầu tiên
  useEffect(() => {
    if (doctorSlots.length === 0) return;
    const isCurrentSlotValid =
      doctorSlots.includes(selectedSlot) && !occupiedSlots.has(selectedSlot);

    if (!isCurrentSlotValid) {
      const firstAvailable = doctorSlots.find((s) => !occupiedSlots.has(s));
      if (firstAvailable) {
        setSelectedSlot(firstAvailable);
        form.setFieldValue('slot', firstAvailable);
      }
    }
  }, [doctorSlots, occupiedSlots, selectedSlot, form]);

  // Xử lý gửi form dời lịch
  const handleFinish = async (values: any) => {
    if (!appointment || !catalog) return;
    setSubmitting(true);
    try {
      const slotParts = (values.slot || selectedSlot).split(' - ');
      const startTime = slotParts[0]?.trim() || '08:00';
      const endTime = slotParts[1]?.trim() || '08:30';

      const dateStr = values.date.format('YYYY-MM-DD');

      const updated = await rescheduleAppointment(request, catalog, {
        appointment,
        date: dateStr,
        startTime,
        endTime,
        doctorId: values.doctorId,
        reason: values.reason,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi dời lịch hẹn:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  if (!appointment) return null;

  const currentFormattedDate = appointment.startAt
    ? dayjs(appointment.startAt).format('DD/MM/YYYY')
    : '—';
  const currentFormattedTime =
    appointment.startAt && appointment.endAt
      ? `${dayjs(appointment.startAt).format('HH:mm')} – ${dayjs(appointment.endAt).format('HH:mm')}`
      : '—';

  const dayOfWeekNames = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const selectedDayName = dayOfWeekNames[selectedDate.day()];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            <SwapOutlined style={{ color: '#0B5CAD', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
              Dời lịch khám & Điều phối bác sĩ
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
              Thay đổi ngày hẹn, khung giờ hoặc chuyển bác sĩ phụ trách ca khám
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={880}
      footer={null}
      destroyOnClose
    >
      {/* KHỐI 1: TÓM TẮT THÔNG TIN LỊCH HẸN HIỆN TẠI (ĐÃ CÂN ĐỐI LẠI, KHÔNG XUỐNG DÒNG) */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '14px 18px',
          marginTop: 14,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            borderBottom: '1px solid #E2E8F0',
            paddingBottom: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span
              style={{
                fontFamily: 'monospace, sans-serif',
                fontWeight: 700,
                color: '#0B5CAD',
                fontSize: 16,
                whiteSpace: 'nowrap',
                letterSpacing: '0.02em',
              }}
            >
              {appointment.code}
            </span>
            <Tag
              color="gold"
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: 12,
                padding: '1px 8px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              Chờ tiếp nhận
            </Tag>
          </div>

          <div
            style={{
              textAlign: 'right',
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={appointment.service}
          >
            <span style={{ color: '#64748B' }}>Dịch vụ: </span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{appointment.service}</span>
          </div>
        </div>

        <Row gutter={[16, 6]}>
          <Col xs={24} sm={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
              <ClockCircleOutlined style={{ color: '#0B5CAD', fontSize: 14 }} />
              <span>
                Thời gian hiện tại: <b style={{ color: '#0F172A' }}>{currentFormattedTime}</b> ({currentFormattedDate})
              </span>
            </div>
          </Col>

          <Col xs={24} sm={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
              <MedicineBoxOutlined style={{ color: '#0B5CAD', fontSize: 14 }} />
              <span>
                Bác sĩ hiện tại: <b style={{ color: '#0F172A' }}>{appointment.doctorName}</b>
                {appointment.roomCode ? (
                  <Tag color="blue" style={{ marginLeft: 6, fontWeight: 600, marginInlineEnd: 0 }}>
                    {appointment.roomCode}
                  </Tag>
                ) : null}
              </span>
            </div>
          </Col>
        </Row>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          date: selectedDate,
          doctorId: selectedDoctorId,
          slot: selectedSlot,
          reason: 'Bệnh nhân yêu cầu đổi giờ hẹn',
        }}
      >
        {/* KHỐI 2: CHỌN NGÀY VÀ CHỌN BÁC SĨ TIẾP NHẬN */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="date"
              label={
                <span style={{ fontWeight: 600, color: '#1E293B' }}>
                  <CalendarOutlined style={{ color: '#0B5CAD', marginRight: 6 }} />
                  Ngày khám mới
                </span>
              }
              rules={[{ required: true, message: 'Vui lòng chọn ngày khám mới' }]}
              extra={
                <span style={{ fontSize: 12, color: '#0B5CAD', fontWeight: 500 }}>
                  {selectedDayName}, {selectedDate.format('DD/MM/YYYY')}
                </span>
              }
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

          <Col span={16}>
            <Form.Item
              name="doctorId"
              label={
                <span style={{ fontWeight: 600, color: '#1E293B' }}>
                  <MedicineBoxOutlined style={{ color: '#0B5CAD', marginRight: 6 }} />
                  Bác sĩ & Phòng khám phụ trách
                </span>
              }
              rules={[{ required: true, message: 'Vui lòng chọn bác sĩ tiếp nhận' }]}
            >
              <Select
                placeholder="Chọn bác sĩ tiếp nhận"
                style={{ width: '100%', borderRadius: 6 }}
                popupMatchSelectWidth={false}
                dropdownStyle={{ minWidth: 620 }}
                showSearch
                filterOption={(input, option) => {
                  const doc = doctorsList.find((d) => d.id === option?.value);
                  if (!doc) return false;
                  const searchStr = `${doc.name} ${doc.roomCode} ${doc.shiftLabel} ${doc.specialtyName}`.toLowerCase();
                  return searchStr.includes(input.toLowerCase());
                }}
                onChange={(id) => {
                  setSelectedDoctorId(id);
                  form.setFieldValue('doctorId', id);
                }}
                options={doctorsList.map((d) => ({
                  value: d.id,
                  label: (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        width: '100%',
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
                    </div>
                  ),
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* KHỐI 3: CHỌN KHUNG GIỜ KHÁM (CHUẨN 100% THEO CA LÀM VIỆC CỦA BÁC SĨ) */}
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
                Khung giờ khám ({currentDoctorInfo?.shiftLabel || 'Theo ca trực'})
              </span>
              {loadingOccupied && <Spin size="small" />}
            </div>
          }
          rules={[{ required: true, message: 'Vui lòng chọn khung giờ khám' }]}
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
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #E2E8F0',
                      background: '#F1F5F9',
                      color: '#94A3B8',
                      cursor: 'not-allowed',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
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
                        padding: '0 4px',
                        lineHeight: '16px',
                        borderRadius: 3,
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
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
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
                      padding: '0 4px',
                      lineHeight: '16px',
                      borderRadius: 3,
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

        {/* KHỐI 4: LÝ DO THAY ĐỔI */}
        <Form.Item
          name="reason"
          label={<span style={{ fontWeight: 600, color: '#1E293B' }}>Lý do thay đổi lịch hẹn</span>}
          rules={[{ required: true, message: 'Vui lòng cung cấp lý do thay đổi' }]}
        >
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {QUICK_REASONS.map((r) => (
                <Tag
                  key={r}
                  style={{
                    cursor: 'pointer',
                    margin: 0,
                    fontSize: 12,
                    padding: '2px 10px',
                    borderRadius: 4,
                  }}
                  onClick={() => form.setFieldValue('reason', r)}
                >
                  {r}
                </Tag>
              ))}
            </div>
            <Input.TextArea
              rows={2}
              placeholder="Nhập lý do chi tiết..."
              style={{ borderRadius: 6 }}
            />
          </div>
        </Form.Item>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            borderTop: '1px solid #E2E8F0',
            paddingTop: 16,
            marginTop: 8,
          }}
        >
          <Button onClick={onClose} disabled={submitting} style={{ borderRadius: 6 }}>
            Hủy bỏ
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            icon={<SwapOutlined />}
            style={{
              backgroundColor: '#0B5CAD',
              borderRadius: 6,
              fontWeight: 600,
              padding: '0 22px',
            }}
          >
            Xác nhận dời lịch
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
