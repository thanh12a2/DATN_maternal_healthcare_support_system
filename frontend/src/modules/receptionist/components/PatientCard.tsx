import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CreditCardOutlined,
  EditOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  SwapOutlined,
  UserOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import {
  getEncounterReport,
  generateEncounterReport,
} from '../../../services/clinicalReport';
import { getEncounter } from '../../../services/clinical';
import { MedicalReportModal } from '../../doctor/components/MedicalReportModal';
import { ClinicalOrdersResultModal } from '../../../shared/components/portal/ClinicalOrdersResultModal';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Segmented,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import type { Requester } from '../../../services/catalog';
import {
  amountTotalOf,
  createAppointmentVnpayAttempt,
  createReceptionVnpayAttempt,
  collectCash,
  paymentStatusOf,
  payAndCheckInAppointment,
  recordPendingTransfer,
  refreshAppointment,
  type DeskAppointment,
  type DeskInvoice,
  type DeskCatalog,
  type DeskPatient,
  type PatientMap,
} from '../../../services/receptionDesk';
import {
  PENDING_VNPAY_RETURN_KEY,
  type VnpayReturnContext,
} from '../../../services/vnpayReturn';
import {
  age,
  channelText,
  money,
  payMeta,
  sourceMeta,
  statusMeta,
  time,
} from '../utils/appointmentMeta';
import { EditPatientModal } from './EditPatientModal';
import { RescheduleModal } from './RescheduleModal';

interface Props {
  patient: DeskPatient;
  patients: PatientMap;
  appointments: DeskAppointment[];
  catalog?: DeskCatalog | null;
  request?: Requester;
  busy?: boolean;
  targetAppointmentId?: string | null;
  autoPrintAppointment?: DeskAppointment | null;
  onOpen?: (a: DeskAppointment) => void;
  onCheckIn: (a: DeskAppointment) => void;
  onCancel?: (a: DeskAppointment) => void;
  onCollect?: (a: DeskAppointment) => void;
  onPrint?: (what: string) => void;
  onPatientUpdated?: (updated: DeskPatient) => void;
  onAppointmentUpdated?: (updated: DeskAppointment) => void;
}

export function PatientCard({
  patient: p,
  appointments,
  catalog,
  request: propRequest,
  busy,
  targetAppointmentId,
  autoPrintAppointment,
  onOpen,
  onCheckIn,
  onCancel,
  onCollect,
  onPrint,
  onPatientUpdated,
  onAppointmentUpdated,
}: Props) {
  const auth = useAuthSession();
  const request = propRequest || auth.request;

  const [currentPatient, setCurrentPatient] = useState<DeskPatient>(p);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [reschedulingApp, setReschedulingApp] =
    useState<DeskAppointment | null>(null);
  const [paymentModalApp, setPaymentModalApp] =
    useState<DeskAppointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'TRANSFER' | 'VNPAY'
  >('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [payingAndCheckingIn, setPayingAndCheckingIn] =
    useState<boolean>(false);
  const [printTicketApp, setPrintTicketApp] = useState<DeskAppointment | null>(
    null,
  );

  useEffect(() => {
    if (
      autoPrintAppointment?.patientId === p.id &&
      autoPrintAppointment.queueCode
    ) {
      setPrintTicketApp(autoPrintAppointment);
    }
  }, [autoPrintAppointment, p.id]);

  // Modal xem và in phiếu kết quả khám bệnh PDF
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportDocumentId, setReportDocumentId] = useState<string | null>(null);
  const [reportAppointment, setReportAppointment] =
    useState<DeskAppointment | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Modal xem kết quả chỉ định cận lâm sàng (file đính kèm)
  const [clsResultModalOpen, setClsResultModalOpen] = useState(false);
  const [clsAppointment, setClsAppointment] = useState<DeskAppointment | null>(
    null,
  );

  const handleOpenReportModal = async (a: DeskAppointment) => {
    setLoadingReport(true);
    setReportAppointment(a);
    try {
      const encId = a.encounterId;
      if (!encId) {
        message.warning(
          'Lịch hẹn này chưa có thông tin lượt khám (Encounter).',
        );
        return;
      }
      let existing = await getEncounterReport(request, encId);
      if (!existing?.documentId && a.status === 'COMPLETED') {
        try {
          const encRes: any = await getEncounter(request, encId);
          const encData = encRes?.data || encRes;
          if (encData) {
            const vitals =
              Array.isArray(encData.vitalSigns) && encData.vitalSigns.length > 0
                ? encData.vitalSigns[encData.vitalSigns.length - 1]
                : null;
            const diagnoses =
              Array.isArray(encData.diagnoses) && encData.diagnoses.length > 0
                ? encData.diagnoses[encData.diagnoses.length - 1]
                : null;
            const orders = Array.isArray(encData.orders)
              ? encData.orders.map((o: any) => ({
                  name:
                    o.catalogServiceName ||
                    o.serviceName ||
                    'Dịch vụ cận lâm sàng',
                  category: o.category || 'Cận lâm sàng',
                  result:
                    o.resultNotes ||
                    (o.status === 'VERIFIED'
                      ? 'Đã có kết quả (Bình thường)'
                      : 'Đã thực hiện / Chờ kết quả'),
                  status:
                    o.status === 'VERIFIED' ? 'Đã thực hiện' : 'Đã chỉ định',
                }))
              : [];

            const payload = {
              appointmentCode: a.code || '',
              encounterId: encId,
              patientId: a.patientId || encData.patientId || '',
              roomCode: a.roomCode || 'P.207',
              roomName: a.roomName || 'Phòng khám Sản Phụ khoa 207',
              examinationDate: dayjs(
                a.checkedInAt || a.date || new Date(),
              ).format('DD/MM/YYYY'),
              examinationTime: dayjs(
                a.checkedInAt || a.date || new Date(),
              ).format('HH:mm'),
              patientName: String(currentPatient?.fullName || 'Bệnh nhân'),
              patientPhone: String(currentPatient?.phone || ''),
              patientGender: 'Nữ',
              vitals: vitals
                ? {
                    bloodPressure:
                      vitals.bloodPressure ||
                      (vitals.systolic && vitals.diastolic
                        ? `${vitals.systolic}/${vitals.diastolic}`
                        : undefined),
                    heartRate: vitals.heartRate
                      ? String(vitals.heartRate)
                      : undefined,
                    temperature: vitals.temperature
                      ? String(vitals.temperature)
                      : undefined,
                    weight: vitals.weightKg
                      ? String(vitals.weightKg)
                      : vitals.weight
                        ? String(vitals.weight)
                        : undefined,
                    height: vitals.heightCm
                      ? String(vitals.heightCm)
                      : vitals.height
                        ? String(vitals.height)
                        : undefined,
                    bmi: vitals.bmi ? String(vitals.bmi) : undefined,
                  }
                : undefined,
              chiefComplaint: a.service || 'Khám thai định kỳ chuẩn y khoa',
              primaryDiagnosis:
                diagnoses?.description ||
                'Khám thai định kỳ chuẩn y khoa - Thai phụ và thai nhi phát triển bình thường',
              clinicalOrders: orders,
              prescriptions: [],
              careAdvice: [],
              doctorName: a.doctorName
                ? String(a.doctorName)
                : 'BS. Nguyễn Hồng Nhung',
              finalizedAt: new Date().toISOString(),
            };
            const generated = await generateEncounterReport(request, payload);
            if (generated && (generated as any).documentId) {
              existing = generated as any;
            }
          }
        } catch (genErr) {
          console.warn('Tự động tạo phiếu kết quả thất bại:', genErr);
        }
      }

      if (existing && existing.documentId) {
        setReportDocumentId(existing.documentId);
        setReportModalOpen(true);
      } else {
        message.info(
          'Phiếu kết quả khám bệnh đang được xử lý hoặc bác sĩ chưa hoàn tất ký số.',
        );
      }
    } catch (err: any) {
      message.error(
        err?.message || 'Có lỗi xảy ra khi tải phiếu kết quả khám.',
      );
    } finally {
      setLoadingReport(false);
    }
  };

  const handleConfirmPayAndCheckIn = async () => {
    if (!paymentModalApp) return;
    setPayingAndCheckingIn(true);
    try {
      if (paymentMethod === 'VNPAY') {
        const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const { invoice, attempt } = await createAppointmentVnpayAttempt(
          request,
          paymentModalApp,
          returnPath,
        );
        const context: VnpayReturnContext = {
          txnRef: attempt.txnRef,
          returnPath,
          invoiceId: invoice.id,
          appointment: {
            ...paymentModalApp,
            invoice,
            invoices: paymentModalApp.invoices?.length
              ? paymentModalApp.invoices
              : [invoice],
          },
          patient: currentPatient,
          page: {
            room: paymentModalApp.roomCode,
            date: paymentModalApp.date,
            query: currentPatient.phone ?? currentPatient.fullName,
          },
          completeCheckInAfterPayment: true,
        };
        window.sessionStorage.setItem(
          PENDING_VNPAY_RETURN_KEY,
          JSON.stringify(context),
        );
        window.location.assign(attempt.paymentUrl);
        return;
      }

      if (paymentMethod === 'TRANSFER') {
        await recordPendingTransfer(request, paymentModalApp, paymentRef);
        message.success(
          'Đã ghi nhận chuyển khoản. Giao dịch đang chờ lễ tân xác minh trước khi check-in.',
        );
        if (catalog)
          onAppointmentUpdated?.(
            await refreshAppointment(request, catalog, paymentModalApp),
          );
        setPaymentModalApp(null);
        return;
      }

      const res = await payAndCheckInAppointment(
        request,
        paymentModalApp,
        paymentRef.trim() || undefined,
      );
      if (res.success) {
        message.success('Đã thu viện phí và check-in tiếp đón thành công!');
        if (catalog) {
          const refreshed = await refreshAppointment(
            request,
            catalog,
            paymentModalApp,
          );
          onAppointmentUpdated?.(refreshed);
          setPrintTicketApp(refreshed);
        }
        setPaymentModalApp(null);
      }
    } catch (err: any) {
      console.error('Lỗi thu tiền và check-in:', err);
      if (
        String(err?.message ?? '').includes(
          'Case đã có người xử lý hoặc đang thực hiện thao tác khác',
        )
      )
        Modal.warning({
          title: 'Không thể xử lý thanh toán',
          content: err.message,
        });
      else
        message.error(
          err?.message || 'Có lỗi xảy ra khi thu tiền và check-in.',
        );
    } finally {
      setPayingAndCheckingIn(false);
    }
  };

  const [suppPaymentModalData, setSuppPaymentModalData] = useState<{
    app: DeskAppointment;
    invoice: DeskInvoice;
  } | null>(null);
  const [suppPaymentMethod, setSuppPaymentMethod] = useState<
    'CASH' | 'TRANSFER'
  >('CASH');
  const [suppPaymentRef, setSuppPaymentRef] = useState<string>('');
  const [payingSupp, setPayingSupp] = useState<boolean>(false);

  const handleConfirmSuppPayment = async () => {
    if (!suppPaymentModalData) return;
    const { app, invoice } = suppPaymentModalData;
    setPayingSupp(true);
    try {
      await collectCash(request, invoice);

      // Đồng bộ realtime 2 chiều sang phòng khám của Bác sĩ ngay lập tức
      await request('/api/appointment/desk/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'appointment.invoice_updated',
          appointmentId: app.id,
          appointmentCode: app.code,
          patientId: app.patientId,
          paymentStatus: 'PAID',
        }),
      }).catch(() => null);

      message.success(
        `Đã thu ${money(invoice.balance)} viện phí chỉ định phát sinh thành công!`,
      );
      if (catalog) {
        const refreshed = await refreshAppointment(request, catalog, app);
        onAppointmentUpdated?.(refreshed);
      }
      setSuppPaymentModalData(null);
    } catch (err: any) {
      console.error('Lỗi thu tiền chỉ định phát sinh:', err);
      message.error(
        err?.message || 'Không thể ghi nhận thu tiền chỉ định phát sinh.',
      );
    } finally {
      setPayingSupp(false);
    }
  };

  useEffect(() => {
    setCurrentPatient(p);
  }, [p]);

  const todayStr = dayjs().format('YYYY-MM-DD');

  // Bộ lọc thời gian: 'TODAY' | 'ALL' | 'CUSTOM'
  // Nếu có targetAppointmentId mà ngày khám khác hôm nay -> tự động chọn 'ALL' để chắc chắn hiển thị lịch được chọn
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'ALL' | 'CUSTOM'>(
    () => {
      if (targetAppointmentId) {
        const target = appointments.find(
          (x) => x.id === targetAppointmentId || x.code === targetAppointmentId,
        );
        if (target && target.date !== todayStr) {
          return 'ALL';
        }
      }
      return appointments.some((a) => a.date === todayStr) ? 'TODAY' : 'ALL';
    },
  );
  const [customDate, setCustomDate] = useState<Dayjs>(dayjs());

  useEffect(() => {
    if (targetAppointmentId) {
      const target = appointments.find(
        (x) => x.id === targetAppointmentId || x.code === targetAppointmentId,
      );
      if (target && target.date !== todayStr && timeFilter === 'TODAY') {
        setTimeFilter('ALL');
      }
    } else if (
      appointments.length > 0 &&
      !appointments.some((a) => a.date === todayStr) &&
      timeFilter === 'TODAY'
    ) {
      setTimeFilter('ALL');
    }
  }, [targetAppointmentId, appointments, todayStr]);

  const todayApps = useMemo(
    () => appointments.filter((a) => a.date === todayStr),
    [appointments, todayStr],
  );

  const filteredAppointments = useMemo(() => {
    if (timeFilter === 'TODAY') {
      return appointments.filter((a) => a.date === todayStr);
    }
    if (timeFilter === 'CUSTOM') {
      const selected = customDate.format('YYYY-MM-DD');
      return appointments.filter((a) => a.date === selected);
    }
    return appointments;
  }, [appointments, timeFilter, todayStr, customDate]);

  // Sắp xếp: Nếu có targetAppointmentId thì đưa lên đầu tiên;
  // tiếp theo lịch hôm nay ở trên đầu, sau đó sắp xếp theo thời gian mới nhất
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      if (targetAppointmentId) {
        const isTargetA =
          a.id === targetAppointmentId || a.code === targetAppointmentId
            ? 1
            : 0;
        const isTargetB =
          b.id === targetAppointmentId || b.code === targetAppointmentId
            ? 1
            : 0;
        if (isTargetA !== isTargetB) return isTargetB - isTargetA;
      }
      const isTodayA = a.date === todayStr ? 1 : 0;
      const isTodayB = b.date === todayStr ? 1 : 0;
      if (isTodayA !== isTodayB) return isTodayB - isTodayA;
      return dayjs(b.startAt).valueOf() - dayjs(a.startAt).valueOf();
    });
  }, [filteredAppointments, todayStr, targetAppointmentId]);

  const emergency = currentPatient.emergencyContacts?.[0];
  const emergencyDisplay = emergency
    ? `${emergency.fullName}${emergency.relationship ? ` (${emergency.relationship})` : ''}${
        emergency.phone ? ` - ${emergency.phone}` : ''
      }`
    : '—';

  const nationalIdDisplay =
    currentPatient.nationalId || currentPatient.nationalIdMasked || '—';

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e5e7eb',
        background: '#ffffff',
      }}
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>
            {currentPatient.fullName}
          </span>
          {todayApps.length > 0 ? (
            <Tag
              color="processing"
              style={{ fontWeight: 600, fontSize: 12, padding: '2px 8px' }}
            >
              {todayApps.length} lịch hôm nay
            </Tag>
          ) : (
            <Tag color="default">0 lịch hôm nay</Tag>
          )}
        </div>
      }
      extra={
        <Space size={8} wrap>
          <Segmented
            value={timeFilter}
            onChange={(val) => setTimeFilter(val as 'TODAY' | 'ALL' | 'CUSTOM')}
            options={[
              { label: `Hôm nay (${todayApps.length})`, value: 'TODAY' },
              { label: `Tất cả (${appointments.length})`, value: 'ALL' },
              { label: 'Chọn ngày', value: 'CUSTOM' },
            ]}
          />
          {timeFilter === 'CUSTOM' && (
            <DatePicker
              value={customDate}
              format="DD/MM/YYYY"
              allowClear={false}
              onChange={(d) => d && setCustomDate(d)}
              style={{ width: 140 }}
            />
          )}
        </Space>
      }
    >
      {/* KHỐI 1: HỒ SƠ HÀNH CHÍNH BỆNH NHÂN */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          Thông tin hành chính bệnh nhân
        </span>
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => setEditPatientOpen(true)}
          style={{
            borderRadius: 6,
            borderColor: '#0B5CAD',
            color: '#0B5CAD',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          Chỉnh sửa thông tin
        </Button>
      </div>

      <Descriptions
        size="small"
        column={{ xs: 1, sm: 2, md: 3, xl: 3 }}
        bordered
        style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden' }}
        items={[
          {
            label: (
              <span>
                <CalendarOutlined
                  style={{ marginRight: 6, color: '#0B5CAD' }}
                />
                Ngày sinh
              </span>
            ),
            children: currentPatient.dateOfBirth
              ? `${dayjs(currentPatient.dateOfBirth).format('DD/MM/YYYY')} (${age(currentPatient.dateOfBirth)} tuổi)`
              : '—',
          },
          {
            label: (
              <span>
                <PhoneOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                Số điện thoại
              </span>
            ),
            children: (
              <span style={{ color: '#0F172A', fontWeight: 400 }}>
                {currentPatient.phone || '—'}
              </span>
            ),
          },
          {
            label: (
              <span>
                <IdcardOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                CCCD / Định danh
              </span>
            ),
            children: (
              <span style={{ color: '#0F172A', fontWeight: 400 }}>
                {nationalIdDisplay}
              </span>
            ),
          },
          {
            label: (
              <span>
                <EnvironmentOutlined
                  style={{ marginRight: 6, color: '#0B5CAD' }}
                />
                Địa chỉ
              </span>
            ),
            children: currentPatient.address || '—',
          },
          {
            label: (
              <span>
                <UserOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                Liên hệ khẩn cấp
              </span>
            ),
            children: emergencyDisplay,
            span: 2,
          },
        ]}
      />

      {/* KHỐI 2: DANH SÁCH LỊCH HẸN VÀ VIỆN PHÍ */}
      {sortedAppointments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#6b7280', fontSize: 14 }}>
              {timeFilter === 'TODAY'
                ? 'Bệnh nhân không có lịch hẹn nào trong ngày hôm nay'
                : `Không có lịch hẹn trong ngày ${
                    timeFilter === 'CUSTOM'
                      ? customDate.format('DD/MM/YYYY')
                      : ''
                  }`}
            </span>
          }
          style={{ padding: '36px 0', background: '#f9fafb', borderRadius: 8 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sortedAppointments.map((a, index) => {
            const isToday = a.date === todayStr;
            const isUpcoming = dayjs(a.date).isAfter(dayjs());
            const appStep =
              a.completedAt || a.status === 'COMPLETED'
                ? 3
                : a.startedAt || a.status === 'IN_CLINICAL_CARE'
                  ? 2
                  : a.checkedInAt || a.status === 'CHECKED_IN'
                    ? 1
                    : 0;
            const payStatus = paymentStatusOf(a);

            const isSelected = Boolean(
              targetAppointmentId &&
              (a.id === targetAppointmentId || a.code === targetAppointmentId),
            );

            return (
              <div
                key={a.id}
                style={{
                  background: '#ffffff',
                  border: isSelected
                    ? '2px solid #0B5CAD'
                    : isToday
                      ? '1.5px solid #93c5fd'
                      : '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: isSelected
                    ? '0 6px 20px rgba(11, 92, 173, 0.14)'
                    : isToday
                      ? '0 4px 14px rgba(11, 92, 173, 0.07)'
                      : '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                {/* Header dải lịch hẹn */}
                <div
                  onClick={() => onOpen?.(a)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    paddingBottom: 12,
                    marginBottom: 16,
                    borderBottom: '1px solid #f1f5f9',
                    cursor: onOpen ? 'pointer' : 'default',
                  }}
                  title={onOpen ? 'Nhấn để xem chi tiết lịch hẹn' : undefined}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: '#0B5CAD',
                      }}
                    >
                      {a.code}
                    </span>

                    {isSelected && (
                      <Tag
                        color="#0B5CAD"
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        Lịch khám đang chọn
                      </Tag>
                    )}

                    {isToday ? (
                      <Tag
                        color="processing"
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        Lịch khám hôm nay
                      </Tag>
                    ) : isUpcoming ? (
                      <Tag
                        color="purple"
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        Lịch hẹn sắp tới
                      </Tag>
                    ) : (
                      <Tag
                        color="default"
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        Lịch khám trước đó
                      </Tag>
                    )}

                    {a.queueCode && (
                      <Tag
                        color="blue"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        STT: {a.queueCode}
                      </Tag>
                    )}
                  </div>

                  <Space size={8} wrap>
                    <Tag
                      color={statusMeta[a.status]?.color}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 8px',
                        margin: 0,
                      }}
                    >
                      {statusMeta[a.status]?.label ?? a.status}
                    </Tag>
                    <Tag
                      color={sourceMeta[a.source].color}
                      style={{ margin: 0 }}
                    >
                      {sourceMeta[a.source].label}
                    </Tag>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      ({channelText(a.channel)})
                    </span>
                  </Space>
                </div>

                {/* Bố cục 2 cột: Cột trái (Thông tin khám) & Cột phải (Hóa đơn) */}
                <Row gutter={[16, 16]}>
                  {/* CỘT TRÁI: CHI TIẾT LỊCH HẸN & TIẾN TRÌNH */}
                  <Col xs={24} lg={13}>
                    <div
                      style={{
                        height: '100%',
                        background: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Tiến trình khám */}
                        <div
                          style={{
                            background: '#f8fafc',
                            padding: '10px 14px',
                            borderRadius: 6,
                            marginBottom: 14,
                          }}
                        >
                          <Steps
                            size="small"
                            current={appStep}
                            status={
                              a.status === 'CANCELLED' || a.status === 'NO_SHOW'
                                ? 'error'
                                : undefined
                            }
                            items={[
                              {
                                title: 'Đã đặt',
                                description: a.createdAt
                                  ? dayjs(a.createdAt).format('HH:mm DD/MM')
                                  : '',
                              },
                              {
                                title: 'Check-in',
                                description: time(a.checkedInAt),
                              },
                              {
                                title: 'Vào khám',
                                description: a.startedAt
                                  ? time(a.startedAt)
                                  : a.status === 'IN_CLINICAL_CARE'
                                    ? 'Đang khám'
                                    : '—',
                              },
                              {
                                title: 'Hoàn tất',
                                description: a.completedAt
                                  ? time(a.completedAt)
                                  : a.status === 'COMPLETED'
                                    ? 'Đã hoàn tất'
                                    : '—',
                              },
                            ]}
                          />
                        </div>

                        {/* Chi tiết nội dung khám */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 12,
                            marginBottom: 14,
                          }}
                        >
                          <div
                            style={{
                              gridColumn: '1 / -1',
                              background: '#f0f7ff',
                              padding: '10px 12px',
                              borderRadius: 6,
                              borderLeft: '4px solid #0B5CAD',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: '#64748b',
                                fontWeight: 600,
                              }}
                            >
                              DỊCH VỤ ĐĂNG KÝ KHÁM
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#0f172a',
                                marginTop: 2,
                              }}
                            >
                              {a.service}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Thời gian khám:
                            </span>
                            <div
                              style={{
                                fontWeight: 600,
                                color: '#1e293b',
                                marginTop: 2,
                              }}
                            >
                              <CalendarOutlined
                                style={{ color: '#0B5CAD', marginRight: 4 }}
                              />
                              {time(a.startAt)} – {time(a.endAt)} (
                              {a.date
                                ? dayjs(a.date).format('DD/MM/YYYY')
                                : '—'}
                              )
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Phòng khám tiếp nhận:
                            </span>
                            <div
                              style={{
                                fontWeight: 600,
                                color: '#1e293b',
                                marginTop: 2,
                              }}
                            >
                              <Tag
                                color="blue"
                                style={{
                                  fontWeight: 700,
                                  margin: 0,
                                  marginRight: 6,
                                }}
                              >
                                {a.roomCode}
                              </Tag>
                              {a.roomName || 'Phòng khám Sản Phụ khoa'}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Bác sĩ đảm nhiệm:
                            </span>
                            <div
                              style={{
                                fontWeight: 600,
                                color: '#1e293b',
                                marginTop: 2,
                              }}
                            >
                              <MedicineBoxOutlined
                                style={{ color: '#0B5CAD', marginRight: 4 }}
                              />
                              {a.doctorName || '—'}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Chuyên khoa:
                            </span>
                            <div
                              style={{
                                fontWeight: 600,
                                color: '#1e293b',
                                marginTop: 2,
                              }}
                            >
                              {a.specialty || 'Sản Phụ khoa'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Nút hành động của lịch hẹn */}
                      <div>
                        <Divider style={{ margin: '10px 0' }} />
                        <Space size={8} wrap>
                          {onOpen && (
                            <Button
                              icon={<FileTextOutlined />}
                              onClick={() => onOpen(a)}
                              style={{
                                borderRadius: 6,
                                borderColor: '#0B5CAD',
                                color: '#0B5CAD',
                                fontWeight: 600,
                              }}
                            >
                              Chi tiết lịch hẹn
                            </Button>
                          )}
                          {a.status === 'BOOKED' && (
                            <Button
                              type="primary"
                              size="middle"
                              icon={<CheckCircleOutlined />}
                              loading={busy || payingAndCheckingIn}
                              onClick={() => onCheckIn(a)}
                              style={{
                                backgroundColor: '#0B5CAD',
                                fontWeight: 600,
                                borderRadius: 6,
                              }}
                            >
                              Ghi nhận đến
                            </Button>
                          )}

                          {['BOOKED', 'REASSIGNMENT_REQUIRED'].includes(
                            a.status,
                          ) && (
                            <Button
                              icon={<CalendarOutlined />}
                              onClick={() => setReschedulingApp(a)}
                              style={{
                                borderRadius: 6,
                                borderColor: '#0B5CAD',
                                color: '#0B5CAD',
                                fontWeight: 500,
                              }}
                            >
                              Dời lịch / Đổi bác sĩ
                            </Button>
                          )}

                          {a.queueCode && (
                            <Button
                              icon={<PrinterOutlined />}
                              onClick={() => onPrint?.('phiếu số thứ tự')}
                              style={{ borderRadius: 6 }}
                            >
                              In phiếu STT ({a.queueCode})
                            </Button>
                          )}

                          {(a.status === 'COMPLETED' || a.completedAt) && (
                            <>
                              <Button
                                icon={<ExperimentOutlined />}
                                onClick={() => {
                                  setClsAppointment(a);
                                  setClsResultModalOpen(true);
                                }}
                                style={{
                                  borderRadius: 6,
                                  color: '#0d9488',
                                  borderColor: '#99f6e4',
                                  background: '#f0fdfa',
                                  fontWeight: 600,
                                }}
                              >
                                Xem kết quả CLS
                              </Button>
                              <Button
                                icon={<FilePdfOutlined />}
                                onClick={() => handleOpenReportModal(a)}
                                loading={
                                  loadingReport &&
                                  reportAppointment?.id === a.id
                                }
                                style={{
                                  borderRadius: 6,
                                  color: '#059669',
                                  borderColor: '#059669',
                                  fontWeight: 500,
                                }}
                              >
                                In phiếu kết quả khám (PDF)
                              </Button>
                            </>
                          )}

                          {a.status === 'BOOKED' && (
                            <Popconfirm
                              title="Xác nhận hủy lịch hẹn này?"
                              description="Lịch hẹn sẽ bị hủy bỏ trên toàn hệ thống."
                              okText="Hủy lịch"
                              okButtonProps={{ danger: true }}
                              cancelText="Không"
                              onConfirm={() => onCancel?.(a)}
                            >
                              <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                style={{ borderRadius: 6 }}
                              >
                                Hủy lịch
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                      </div>
                    </div>
                  </Col>

                  {/* CỘT PHẢI: HÓA ĐƠN & VIỆN PHÍ */}
                  <Col xs={24} lg={11}>
                    <div
                      style={{
                        height: '100%',
                        background: '#fcfdfd',
                        border: '1px solid #f1f5f9',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Header Hóa đơn & Viện phí */}
                        {(() => {
                          const baseInvoice =
                            a.invoices?.find((i) => i.type === 'BASE') ??
                            a.invoice ??
                            null;
                          const suppInvoice =
                            a.supplementaryInvoice ||
                            a.invoices?.find(
                              (i) => i.type === 'SUPPLEMENTARY',
                            ) ||
                            null;

                          // Dòng dịch vụ khám ban đầu
                          const baseLines =
                            baseInvoice?.lines && baseInvoice.lines.length > 0
                              ? baseInvoice.lines.map((l, idx) => ({
                                  ...l,
                                  itemType: 'BASE' as const,
                                  key: `base-${idx}-${l.name}`,
                                }))
                              : [
                                  {
                                    name: a.service || 'Khám chuyên khoa',
                                    qty: 1,
                                    unitPrice: a.estimatedTotal || 0,
                                    amount: a.estimatedTotal || 0,
                                    itemType: 'BASE' as const,
                                    key: 'base-default',
                                  },
                                ];

                          // Dòng dịch vụ cận lâm sàng do bác sĩ chỉ định thêm
                          const suppLines = (suppInvoice?.lines || []).map(
                            (l, idx) => ({
                              ...l,
                              itemType: 'SUPPLEMENTARY' as const,
                              key: `supp-${idx}-${l.name}`,
                            }),
                          );

                          // Toàn bộ các khoản thu gộp chung vào 1 bảng duy nhất
                          const allLines = [...baseLines, ...suppLines];

                          // Tổng kết tài chính toàn bộ ca khám
                          const baseTotal =
                            baseInvoice?.total ?? a.estimatedTotal ?? 0;
                          const basePaid =
                            baseInvoice?.paid ??
                            (payStatus === 'PAID' ? baseTotal : 0);
                          const suppTotal = suppInvoice?.total ?? 0;
                          const suppPaid = suppInvoice?.paid ?? 0;

                          const totalAmount = baseTotal + suppTotal;
                          const paidAmount = basePaid + suppPaid;
                          const balanceAmount = totalAmount - paidAmount;

                          // Lọc bỏ các dòng phụ phí 0 đ (như Doctor rank surcharge) để giao diện tinh gọn
                          const displayedBaseLines = baseLines.filter(
                            (l) => l.amount > 0,
                          );
                          const finalBaseLines =
                            displayedBaseLines.length > 0
                              ? displayedBaseLines
                              : baseLines;

                          // Lịch sử giao dịch gộp
                          const allPayments = [
                            ...(baseInvoice?.payments || []),
                            ...(suppInvoice?.payments || []),
                          ];

                          const basePaidPayment = baseInvoice?.payments?.find(
                            (p) => p.amount > 0,
                          );
                          const basePayTime = basePaidPayment?.at
                            ? dayjs(basePaidPayment.at).format('HH:mm')
                            : a.checkedInAt
                              ? dayjs(a.checkedInAt).format('HH:mm')
                              : '';

                          // Xử lý chuẩn hóa tên bác sĩ, tránh lặp tiền tố "BS. BS."
                          const cleanDoctorName = (
                            a.doctorName || 'Nguyễn Hồng Nhung'
                          )
                            .replace(/^(BS\.\s*|BS\s*|Bác sĩ\s*)+/i, '')
                            .trim();
                          const doctorDisplayName = `BS. ${cleanDoctorName}`;

                          // Giờ chỉ định cận lâm sàng đồng bộ với tiến trình khám
                          let suppOrderTime = '';
                          if (suppInvoice?.createdAt) {
                            suppOrderTime = dayjs(suppInvoice.createdAt).format(
                              'HH:mm',
                            );
                          } else if (a.startedAt) {
                            suppOrderTime = dayjs(a.startedAt)
                              .add(2, 'minute')
                              .format('HH:mm');
                          }

                          return (
                            <>
                              {/* Header tiêu đề chung */}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: 10,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 15,
                                      fontWeight: 700,
                                      color: '#0f172a',
                                    }}
                                  >
                                    Hóa đơn & Viện phí
                                  </span>
                                  {balanceAmount === 0 && totalAmount > 0 && (
                                    <Tag
                                      color="success"
                                      style={{
                                        margin: 0,
                                        borderRadius: 10,
                                        fontSize: 11,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Tất toán ✓
                                    </Tag>
                                  )}
                                </div>
                                {allPayments.length > 0 && (
                                  <span
                                    style={{ fontSize: 11.5, color: '#64748b' }}
                                  >
                                    {allPayments.length} lượt thanh toán
                                  </span>
                                )}
                              </div>

                              {/* ─── KHỐI 1: PHÍ KHÁM BAN ĐẦU ─── */}
                              <div
                                style={{
                                  background: '#f6fef9',
                                  border: '1px solid #bbf7d0',
                                  borderLeft: '4px solid #16a34a',
                                  borderRadius: 8,
                                  padding: '10px 12px',
                                  marginBottom: 10,
                                }}
                              >
                                {/* Header Khối 1 */}
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 6,
                                    marginBottom: 6,
                                    paddingBottom: 6,
                                    borderBottom: '1px solid #dcfce7',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        fontSize: 13,
                                        color: '#166534',
                                      }}
                                    >
                                      Phí khám ban đầu
                                    </span>
                                    {baseInvoice?.number && (
                                      <span
                                        style={{
                                          fontSize: 11,
                                          color: '#64748b',
                                          fontWeight: 500,
                                        }}
                                      >
                                        (#{baseInvoice.number})
                                      </span>
                                    )}
                                  </div>

                                  <Tag
                                    color={
                                      basePaid >= baseTotal && baseTotal > 0
                                        ? 'success'
                                        : 'error'
                                    }
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      padding: '1px 8px',
                                      borderRadius: 4,
                                      margin: 0,
                                    }}
                                  >
                                    {basePaid >= baseTotal && baseTotal > 0
                                      ? `✓ Đã thanh toán${basePayTime ? ` (${basePayTime})` : ''}`
                                      : 'Chưa thanh toán'}
                                  </Tag>
                                </div>

                                {/* Danh sách khoản thu Khối 1 */}
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 6,
                                    margin: '6px 0',
                                  }}
                                >
                                  {finalBaseLines.map((l) => {
                                    const cleanName = l.name
                                      .replace(
                                        'Doctor rank surcharge BASIC',
                                        'Phụ phí hạng bác sĩ (Cơ bản)',
                                      )
                                      .replace(
                                        'Doctor rank surcharge',
                                        'Phụ phí hạng bác sĩ',
                                      );
                                    return (
                                      <div
                                        key={l.key}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 8,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 12.5,
                                            color: '#0f172a',
                                            fontWeight: 500,
                                            flex: 1,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                          title={cleanName}
                                        >
                                          {cleanName}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 11.5,
                                            color: '#166534',
                                            background: '#dcfce7',
                                            padding: '0 6px',
                                            borderRadius: 4,
                                            fontWeight: 600,
                                          }}
                                        >
                                          x{l.qty}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 12.5,
                                            fontWeight: 600,
                                            color: '#166534',
                                            whiteSpace: 'nowrap',
                                            minWidth: 90,
                                            textAlign: 'right',
                                          }}
                                        >
                                          {money(l.amount)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Footer Khối 1: Tạm tính */}
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    marginTop: 4,
                                    paddingTop: 4,
                                    borderTop: '1px dashed #bbf7d0',
                                    fontSize: 12,
                                  }}
                                >
                                  <span
                                    style={{
                                      color: '#166534',
                                      fontWeight: 500,
                                      marginRight: 6,
                                    }}
                                  >
                                    Tạm tính:
                                  </span>
                                  <strong
                                    style={{
                                      color: '#166534',
                                      fontSize: 13,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {money(baseTotal)}
                                  </strong>
                                </div>
                              </div>

                              {/* ─── KHỐI 2: CHỈ ĐỊNH PHÁT SINH CỦA BÁC SĨ (CẬN LÂM SÀNG) ─── */}
                              {suppInvoice && suppLines.length > 0 && (
                                <div
                                  style={{
                                    background:
                                      suppInvoice.balance > 0
                                        ? '#fffbeb'
                                        : '#f0fdfa',
                                    border: `1px solid ${suppInvoice.balance > 0 ? '#fed7aa' : '#ccfbf1'}`,
                                    borderLeft: `4px solid ${suppInvoice.balance > 0 ? '#f59e0b' : '#0d9488'}`,
                                    borderRadius: 8,
                                    padding: '10px 12px',
                                    marginBottom: 10,
                                  }}
                                >
                                  {/* Header Khối 2: Tiêu đề gọn gàng */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'flex-start',
                                      flexWrap: 'wrap',
                                      gap: 6,
                                      marginBottom: 6,
                                      paddingBottom: 6,
                                      borderBottom: `1px solid ${suppInvoice.balance > 0 ? '#fed7aa' : '#ccfbf1'}`,
                                    }}
                                  >
                                    <div>
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 700,
                                            fontSize: 13,
                                            color:
                                              suppInvoice.balance > 0
                                                ? '#9a3412'
                                                : '#0f766e',
                                          }}
                                        >
                                          Chỉ định phát sinh (Cận lâm sàng)
                                        </span>
                                        {suppInvoice.number && (
                                          <span
                                            style={{
                                              fontSize: 11,
                                              color: '#64748b',
                                              fontWeight: 500,
                                            }}
                                          >
                                            (#{suppInvoice.number})
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 11.5,
                                          color:
                                            suppInvoice.balance > 0
                                              ? '#c2410c'
                                              : '#0d9488',
                                          marginTop: 2,
                                        }}
                                      >
                                        {doctorDisplayName} chỉ định
                                        {suppOrderTime
                                          ? ` lúc ${suppOrderTime}`
                                          : ''}
                                      </div>
                                    </div>

                                    <Tag
                                      color={
                                        suppInvoice.balance > 0
                                          ? 'error'
                                          : 'success'
                                      }
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: '1px 8px',
                                        borderRadius: 4,
                                        margin: 0,
                                      }}
                                    >
                                      {suppInvoice.balance > 0
                                        ? 'Chưa thanh toán'
                                        : `✓ Đã thanh toán (${money(suppInvoice.paid)})`}
                                    </Tag>
                                  </div>

                                  {/* Danh sách các dòng chỉ định Khối 2 */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 6,
                                      margin: '6px 0',
                                    }}
                                  >
                                    {suppLines.map((l) => (
                                      <div
                                        key={l.key}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 8,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 12.5,
                                            color: '#0f172a',
                                            fontWeight: 500,
                                            flex: 1,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                          title={l.name}
                                        >
                                          {l.name}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 11.5,
                                            color:
                                              suppInvoice.balance > 0
                                                ? '#9a3412'
                                                : '#0f766e',
                                            background:
                                              suppInvoice.balance > 0
                                                ? '#ffedd5'
                                                : '#ccfbf1',
                                            padding: '0 6px',
                                            borderRadius: 4,
                                            fontWeight: 600,
                                          }}
                                        >
                                          x{l.qty}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: 12.5,
                                            fontWeight: 700,
                                            color:
                                              suppInvoice.balance > 0
                                                ? '#c2410c'
                                                : '#0d9488',
                                            whiteSpace: 'nowrap',
                                            minWidth: 90,
                                            textAlign: 'right',
                                          }}
                                        >
                                          {money(l.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Footer Khối 2: Tạm tính */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'flex-end',
                                      alignItems: 'center',
                                      marginTop: 4,
                                      paddingTop: 4,
                                      borderTop: `1px dashed ${suppInvoice.balance > 0 ? '#fed7aa' : '#ccfbf1'}`,
                                      fontSize: 12,
                                    }}
                                  >
                                    <span
                                      style={{
                                        color:
                                          suppInvoice.balance > 0
                                            ? '#9a3412'
                                            : '#0f766e',
                                        fontWeight: 500,
                                        marginRight: 6,
                                      }}
                                    >
                                      Tạm tính chỉ định:
                                    </span>
                                    <strong
                                      style={{
                                        color:
                                          suppInvoice.balance > 0
                                            ? '#9a3412'
                                            : '#0f766e',
                                        fontSize: 13,
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {money(suppTotal)}
                                    </strong>
                                  </div>
                                </div>
                              )}

                              {/* ─── TỔNG KẾT VIỆN PHÍ: NỀN XÁM NHẠT TRUNG TÍNH (#f8fafc) ─── */}
                              <div
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 8,
                                  padding: '10px 12px',
                                  marginTop: 2,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 4,
                                  }}
                                >
                                  <span
                                    style={{ color: '#475569', fontSize: 12.5 }}
                                  >
                                    Tổng toàn bộ viện phí:
                                  </span>
                                  <strong
                                    style={{
                                      color: '#0f172a',
                                      fontSize: 13.5,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {money(totalAmount)}
                                  </strong>
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 4,
                                  }}
                                >
                                  <span
                                    style={{ color: '#475569', fontSize: 12.5 }}
                                  >
                                    Đã thanh toán:
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: '#16a34a',
                                      fontSize: 13.5,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {money(paidAmount)}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    borderTop: '1px solid #cbd5e1',
                                    margin: '6px 0',
                                  }}
                                />

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: '#0f172a',
                                      fontSize: 13,
                                    }}
                                  >
                                    {paidAmount > 0 && balanceAmount > 0
                                      ? 'Còn lại cần thu thêm:'
                                      : 'Còn lại cần thu:'}
                                  </span>
                                  <strong
                                    style={{
                                      fontWeight: 800,
                                      fontSize: 16,
                                      color:
                                        balanceAmount > 0
                                          ? '#dc2626'
                                          : '#16a34a',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {money(balanceAmount)}
                                  </strong>
                                </div>
                              </div>

                              {/* LỊCH SỬ GIAO DỊCH */}
                              {allPayments.length > 0 && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: '#64748b',
                                    background: '#f1f5f9',
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <b>Lịch sử nộp: </b>
                                  {allPayments.map((pm, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        background: '#fff',
                                        border: '1px solid #e2e8f0',
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                      }}
                                    >
                                      {pm.method} ({money(pm.amount)}){' '}
                                      {pm.at
                                        ? dayjs(pm.at).format('HH:mm DD/MM')
                                        : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Nút hành động hóa đơn */}
                      <div>
                        <Divider style={{ margin: '10px 0' }} />
                        <Space size={8} wrap>
                          {(() => {
                            const baseInvoice =
                              a.invoices?.find((i) => i.type === 'BASE') ??
                              a.invoice ??
                              null;
                            const suppInvoice =
                              a.supplementaryInvoice ||
                              a.invoices?.find(
                                (i) => i.type === 'SUPPLEMENTARY',
                              ) ||
                              null;

                            const baseTotal =
                              baseInvoice?.total ?? a.estimatedTotal ?? 0;
                            const basePaid =
                              baseInvoice?.paid ??
                              (payStatus === 'PAID' ? baseTotal : 0);
                            const baseBalance = baseTotal - basePaid;

                            return (
                              <>
                                {/* Nút 1: Thu tiền khám ban đầu & Check-in (chỉ khi BOOKED và chưa thu tiền khám) */}
                                {a.status === 'BOOKED' && baseBalance > 0 && (
                                  <Button
                                    type="primary"
                                    icon={<CreditCardOutlined />}
                                    loading={busy || payingAndCheckingIn}
                                    onClick={() => {
                                      setPaymentModalApp(a);
                                      setPaymentMethod('CASH');
                                      setPaymentRef('');
                                    }}
                                    style={{
                                      backgroundColor: '#16a34a',
                                      borderColor: '#16a34a',
                                      fontWeight: 700,
                                      fontSize: 13,
                                      borderRadius: 6,
                                      padding: '0 16px',
                                      boxShadow:
                                        '0 2px 6px rgba(22, 163, 74, 0.3)',
                                    }}
                                  >
                                    Thu tiền & Check-in ngay (
                                    {money(baseBalance)})
                                  </Button>
                                )}

                                {/* Nút 2: Thu tiền chỉ định phát sinh (Cận lâm sàng) - không cần check-in và cấp số */}
                                {suppInvoice && suppInvoice.balance > 0 && (
                                  <Button
                                    type="primary"
                                    icon={<CreditCardOutlined />}
                                    loading={
                                      payingSupp &&
                                      suppPaymentModalData?.invoice?.id ===
                                        suppInvoice.id
                                    }
                                    onClick={() => {
                                      setSuppPaymentModalData({
                                        app: a,
                                        invoice: suppInvoice,
                                      });
                                      setSuppPaymentMethod('CASH');
                                      setSuppPaymentRef('');
                                    }}
                                    style={{
                                      backgroundColor: '#16a34a',
                                      borderColor: '#16a34a',
                                      fontWeight: 700,
                                      fontSize: 13,
                                      borderRadius: 6,
                                      padding: '0 16px',
                                      boxShadow:
                                        '0 2px 6px rgba(22, 163, 74, 0.3)',
                                    }}
                                  >
                                    Thu tiền phát sinh (
                                    {money(suppInvoice.balance)})
                                  </Button>
                                )}
                              </>
                            );
                          })()}

                          {a.status === 'CHECKED_IN' && (
                            <Button
                              type="primary"
                              icon={<PrinterOutlined />}
                              onClick={() => setPrintTicketApp(a)}
                              style={{
                                backgroundColor: '#0B5CAD',
                                borderColor: '#0B5CAD',
                                borderRadius: 6,
                                fontWeight: 600,
                              }}
                            >
                              In phiếu khám & Biên lai (STT:{' '}
                              {a.queueCode || 'Đã cấp'})
                            </Button>
                          )}

                          {(a.status === 'COMPLETED' || a.completedAt) && (
                            <>
                              <Button
                                icon={<ExperimentOutlined />}
                                onClick={() => {
                                  setClsAppointment(a);
                                  setClsResultModalOpen(true);
                                }}
                                style={{
                                  borderRadius: 6,
                                  color: '#0d9488',
                                  borderColor: '#99f6e4',
                                  background: '#f0fdfa',
                                  fontWeight: 600,
                                }}
                              >
                                Xem kết quả CLS
                              </Button>
                              <Button
                                type="primary"
                                icon={<FilePdfOutlined />}
                                onClick={() => handleOpenReportModal(a)}
                                loading={
                                  loadingReport &&
                                  reportAppointment?.id === a.id
                                }
                                style={{
                                  backgroundColor: '#059669',
                                  borderColor: '#059669',
                                  borderRadius: 6,
                                  fontWeight: 600,
                                }}
                              >
                                In phiếu kết quả khám (PDF)
                              </Button>
                            </>
                          )}

                          <Button
                            icon={<PrinterOutlined />}
                            onClick={() => {
                              if (a.status === 'CHECKED_IN' || a.queueCode) {
                                setPrintTicketApp(a);
                              } else {
                                onPrint?.('hóa đơn');
                              }
                            }}
                            style={{ borderRadius: 6 }}
                          >
                            In hóa đơn / Phiếu thu
                          </Button>
                        </Space>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            );
          })}
        </div>
      )}

      {editPatientOpen && request && (
        <EditPatientModal
          open={editPatientOpen}
          patient={currentPatient}
          request={request}
          onClose={() => setEditPatientOpen(false)}
          onSuccess={(updated) => {
            setCurrentPatient(updated);
            onPatientUpdated?.(updated);
          }}
        />
      )}

      {reschedulingApp && request && (
        <RescheduleModal
          open={Boolean(reschedulingApp)}
          appointment={reschedulingApp}
          catalog={catalog ?? null}
          request={request}
          onClose={() => setReschedulingApp(null)}
          onSuccess={(updated) => {
            onAppointmentUpdated?.(updated);
            setReschedulingApp(null);
          }}
        />
      )}

      {/* MODAL 1 CHẠM: THU TIỀN VIỆN PHÍ & CHECK-IN TIẾP ĐÓN */}
      {paymentModalApp && (
        <Modal
          open={Boolean(paymentModalApp)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCardOutlined
                  style={{ color: '#16A34A', fontSize: 18 }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#0F172A',
                    lineHeight: 1.2,
                  }}
                >
                  Thu tiền viện phí & Check-in tiếp đón
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748B',
                    fontWeight: 400,
                    marginTop: 2,
                  }}
                >
                  Ghi nhận thanh toán và tự động cấp số thứ tự vào phòng khám
                </div>
              </div>
            </div>
          }
          onCancel={() => !payingAndCheckingIn && setPaymentModalApp(null)}
          footer={[
            <Button
              key="cancel"
              disabled={payingAndCheckingIn}
              onClick={() => setPaymentModalApp(null)}
              style={{ borderRadius: 6 }}
            >
              Hủy
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={payingAndCheckingIn}
              icon={
                paymentMethod === 'VNPAY' ? (
                  <QrcodeOutlined />
                ) : (
                  <CheckCircleOutlined />
                )
              }
              onClick={handleConfirmPayAndCheckIn}
              style={{
                backgroundColor: '#16A34A',
                borderColor: '#16A34A',
                fontWeight: 600,
                borderRadius: 6,
                padding: '0 18px',
              }}
            >
              {paymentMethod === 'VNPAY'
                ? 'Tiếp tục thanh toán VNPay'
                : paymentMethod === 'TRANSFER'
                  ? 'Ghi nhận chờ xác minh'
                  : 'Xác nhận Thu tiền & Cấp số thứ tự'}
            </Button>,
          ]}
          width={540}
          centered
        >
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Bệnh nhân:</span>
                <strong style={{ color: '#0F172A' }}>
                  {currentPatient.fullName}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Số điện thoại:</span>
                <span>{currentPatient.phone || 'Chưa có SĐT'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Dịch vụ khám:</span>
                <strong style={{ color: '#0B5CAD' }}>
                  {paymentModalApp.service}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Phòng khám & Bác sĩ:</span>
                <span>
                  Phòng {paymentModalApp.roomCode} —{' '}
                  {paymentModalApp.doctorName}
                </span>
              </div>
            </div>

            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 8,
                padding: '14px 16px',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#166534',
                  textTransform: 'uppercase',
                }}
              >
                Số tiền cần thu tại quầy
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: '#15803D',
                  marginTop: 2,
                }}
              >
                {money(
                  paymentModalApp.invoice && paymentModalApp.invoice.balance > 0
                    ? paymentModalApp.invoice.balance
                    : paymentModalApp.estimatedTotal,
                )}
              </div>
              <Tag color="success" style={{ marginTop: 4, fontWeight: 600 }}>
                Thu đúng đủ viện phí dịch vụ
              </Tag>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1E293B',
                  marginBottom: 8,
                }}
              >
                Hình thức thanh toán tại quầy:
              </div>
              <Radio.Group
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="CASH">
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>
                      💵 Tiền mặt (Cash)
                    </span>
                    <span
                      style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}
                    >
                      Thu tiền mặt trực tiếp tại quầy tiếp đón
                    </span>
                  </Radio>
                  <Radio value="TRANSFER">
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>
                      📲 Quét mã VietQR tại quầy
                    </span>
                    <span
                      style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}
                    >
                      Bệnh nhân quét mã QR ngân hàng tại quầy
                    </span>
                  </Radio>
                  <Radio value="VNPAY">
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>
                      Thanh toán VNPay / QR
                    </span>
                    <span
                      style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}
                    >
                      Mở trang VNPay để bệnh nhân quét mã hoặc chọn ngân hàng
                      thanh toán
                    </span>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            {paymentMethod === 'TRANSFER' && (
              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary">
                  Giao dịch cần được xác minh trước khi tiếp nhận và cấp số.
                </Typography.Text>
                <Input
                  placeholder="Nhập mã giao dịch chuyển khoản"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{ borderRadius: 6 }}
                />
              </div>
            )}
            {paymentMethod === 'VNPAY' && (
              <Typography.Text
                type="secondary"
                style={{ display: 'block', marginTop: 8 }}
              >
                Check-in và cấp số thứ tự chỉ hoàn tất sau khi hệ thống nhận xác
                nhận thanh toán từ VNPay.
              </Typography.Text>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL 1 CHẠM: THU TIỀN VIỆN PHÍ CHỈ ĐỊNH PHÁT SINH (CẬN LÂM SÀNG) - KHÔNG CHECK-IN, KHÔNG CẤP SỐ */}
      {suppPaymentModalData && (
        <Modal
          open={Boolean(suppPaymentModalData)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCardOutlined
                  style={{ color: '#16A34A', fontSize: 18 }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#0F172A',
                    lineHeight: 1.2,
                  }}
                >
                  Thu tiền viện phí chỉ định phát sinh
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748B',
                    fontWeight: 400,
                    marginTop: 2,
                  }}
                >
                  Ghi nhận thanh toán viện phí cận lâm sàng do bác sĩ chỉ định
                </div>
              </div>
            </div>
          }
          onCancel={() => !payingSupp && setSuppPaymentModalData(null)}
          footer={[
            <Button
              key="cancel"
              disabled={payingSupp}
              onClick={() => setSuppPaymentModalData(null)}
              style={{ borderRadius: 6 }}
            >
              Hủy
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={payingSupp}
              icon={<CheckCircleOutlined />}
              onClick={handleConfirmSuppPayment}
              style={{
                backgroundColor: '#16A34A',
                borderColor: '#16A34A',
                fontWeight: 600,
                borderRadius: 6,
                padding: '0 18px',
              }}
            >
              Xác nhận Thu tiền ({money(suppPaymentModalData.invoice.balance)})
            </Button>,
          ]}
          width={540}
          centered
        >
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Bệnh nhân:</span>
                <strong style={{ color: '#0F172A' }}>
                  {currentPatient.fullName}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Số điện thoại:</span>
                <span>{currentPatient.phone || 'Chưa có SĐT'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Bác sĩ chỉ định:</span>
                <strong style={{ color: '#0B5CAD' }}>
                  {suppPaymentModalData.app.doctorName}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Phòng khám tiếp nhận:</span>
                <span>
                  Phòng {suppPaymentModalData.app.roomCode} —{' '}
                  {suppPaymentModalData.app.roomName}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    color: '#64748B',
                    whiteSpace: 'nowrap',
                    marginRight: 12,
                  }}
                >
                  Dịch vụ chỉ định:
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: '#0F172A',
                    textAlign: 'right',
                  }}
                >
                  {suppPaymentModalData.invoice.lines
                    ?.map((l) => l.name)
                    .join(', ') || 'Chỉ định cận lâm sàng'}
                </span>
              </div>
            </div>

            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 8,
                padding: '14px 16px',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#166534',
                  textTransform: 'uppercase',
                }}
              >
                Số tiền cần thu tại quầy
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: '#15803D',
                  marginTop: 2,
                }}
              >
                {money(suppPaymentModalData.invoice.balance)}
              </div>
              <Tag color="success" style={{ marginTop: 4, fontWeight: 600 }}>
                Thu đúng đủ viện phí chỉ định phát sinh
              </Tag>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1E293B',
                  marginBottom: 8,
                }}
              >
                Hình thức thanh toán tại quầy:
              </div>
              <Radio.Group
                value={suppPaymentMethod}
                onChange={(e) => setSuppPaymentMethod(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="CASH">
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>
                      💵 Tiền mặt (Cash)
                    </span>
                    <span
                      style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}
                    >
                      Thu tiền mặt trực tiếp tại quầy tiếp đón
                    </span>
                  </Radio>
                  <Radio value="TRANSFER">
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>
                      📲 Quét mã VietQR tại quầy
                    </span>
                    <span
                      style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}
                    >
                      Bệnh nhân quét mã QR ngân hàng tại quầy
                    </span>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            {suppPaymentMethod === 'TRANSFER' && (
              <div style={{ marginTop: 8 }}>
                <Input
                  placeholder="Nhập mã giao dịch / ngân hàng (không bắt buộc)"
                  value={suppPaymentRef}
                  onChange={(e) => setSuppPaymentRef(e.target.value)}
                  style={{ borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: PHIẾU KHÁM & BIÊN LAI THU TIỀN CÓ SỐ THỨ TỰ */}
      {printTicketApp && (
        <Modal
          open={Boolean(printTicketApp)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PrinterOutlined style={{ color: '#0B5CAD', fontSize: 18 }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Phiếu tiếp đón khám bệnh & Biên lai thu tiền
              </span>
            </div>
          }
          onCancel={() => setPrintTicketApp(null)}
          footer={[
            <Button
              key="close"
              onClick={() => setPrintTicketApp(null)}
              style={{ borderRadius: 6 }}
            >
              Đóng
            </Button>,
            <Button
              key="print"
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              style={{
                backgroundColor: '#0B5CAD',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              In phiếu ngay
            </Button>,
          ]}
          width={480}
          centered
        >
          <div
            id="printable-ticket"
            style={{
              padding: '16px 18px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              marginTop: 10,
            }}
          >
            <div
              style={{
                textAlign: 'center',
                borderBottom: '1px dashed #CBD5E1',
                paddingBottom: 10,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#0B5CAD',
                  textTransform: 'uppercase',
                }}
              >
                Bệnh viện Phụ sản & Sức khỏe Bà mẹ
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                PHIẾU TIẾP ĐÓN KHÁM BỆNH & BIÊN LAI THU VIỆN PHÍ
              </div>
            </div>

            <div
              style={{
                textAlign: 'center',
                background: '#EFF6FF',
                borderRadius: 8,
                padding: '12px 8px',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: '#475569',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                SỐ THỨ TỰ KHÁM (STT)
              </div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: '#0B5CAD',
                  letterSpacing: '1px',
                  margin: '2px 0',
                }}
              >
                {printTicketApp.queueCode || 'Chưa cấp'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                Phòng khám: {printTicketApp.roomCode} —{' '}
                {printTicketApp.roomName || 'Phòng khám Sản Phụ khoa'}
              </div>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.8, color: '#334155' }}>
              <div>
                <strong>Bệnh nhân:</strong> {currentPatient.fullName}
              </div>
              <div>
                <strong>Số điện thoại:</strong> {currentPatient.phone || '—'}
              </div>
              <div>
                <strong>Bác sĩ phụ trách:</strong> {printTicketApp.doctorName}
              </div>
              <div>
                <strong>Dịch vụ y tế:</strong> {printTicketApp.service}
              </div>
              <div>
                <strong>Thời gian khám:</strong> {time(printTicketApp.startAt)}{' '}
                – {time(printTicketApp.endAt)} (
                {printTicketApp.date
                  ? dayjs(printTicketApp.date).format('DD/MM/YYYY')
                  : 'Hôm nay'}
                )
              </div>
              <div>
                <strong>Viện phí đã thu:</strong>{' '}
                <span style={{ fontWeight: 700, color: '#16A34A' }}>
                  {money(
                    printTicketApp.invoice?.total ||
                      printTicketApp.estimatedTotal,
                  )}
                </span>{' '}
                (Đã thu đủ)
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px dashed #CBD5E1',
                textAlign: 'center',
                fontSize: 11,
                color: '#64748B',
                fontStyle: 'italic',
              }}
            >
              Quý khách vui lòng ngồi chờ trước cửa phòng{' '}
              {printTicketApp.roomCode}, theo dõi màn hình hiển thị để được gọi
              số thứ tự vào khám.
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL XEM VÀ IN PHIẾU KẾT QUẢ KHÁM BỆNH PDF (CHO LỄ TÂN) */}
      <MedicalReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        documentId={reportDocumentId}
        appointmentCode={reportAppointment?.code || reportAppointment?.id}
        patientName={currentPatient?.fullName || ''}
      />

      {/* MODAL XEM KẾT QUẢ CHỈ ĐỊNH CẬN LÂM SÀNG CHO LỄ TÂN */}
      <ClinicalOrdersResultModal
        open={clsResultModalOpen}
        onClose={() => setClsResultModalOpen(false)}
        encounterId={
          clsAppointment?.encounterId
            ? String(clsAppointment.encounterId)
            : undefined
        }
        appointmentCode={clsAppointment?.code || clsAppointment?.id}
        patientName={currentPatient?.fullName || ''}
      />
    </Card>
  );
}
