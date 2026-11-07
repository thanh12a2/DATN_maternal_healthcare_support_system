import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Building2,
  Stethoscope,
  CreditCard,
  UserCheck,
  Check,
} from 'lucide-react';
import type {
  Appointment,
  QueueTicketInfo,
} from '../../../services/appointment';

export type ClinicalStatus =
  | 'BOOKED'
  | 'CHECKED_IN'
  | 'IN_CLINICAL_CARE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'REASSIGNMENT_REQUIRED';

export type PaymentStatusType = 'PAID' | 'UNPAID' | 'PARTIAL';

export interface ClinicalStatusMeta {
  label: string;
  badgeClass: string;
  color: string;
  dotColor: string;
  bgColor: string;
  borderColor: string;
  stepIndex: number; // 1: Booked, 2: CheckedIn, 3: InClinicalCare, 4: Completed, -1: Cancelled
  icon: React.ReactNode;
}

export function getClinicalStatusMeta(
  status?: string | null,
): ClinicalStatusMeta {
  switch (status) {
    case 'CHECKED_IN':
      return {
        label: 'Đã check-in / Chờ khám',
        badgeClass: 'checked_in',
        color: '#0284c7',
        dotColor: '#0284c7',
        bgColor: '#f0f9ff',
        borderColor: '#bae6fd',
        stepIndex: 2,
        icon: <UserCheck size={13} />,
      };
    case 'IN_CLINICAL_CARE':
      return {
        label: 'Đang khám',
        badgeClass: 'in_clinical_care',
        color: '#16a34a',
        dotColor: '#16a34a',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        stepIndex: 3,
        icon: <Stethoscope size={13} />,
      };
    case 'COMPLETED':
      return {
        label: 'Đã hoàn tất',
        badgeClass: 'completed',
        color: '#0d9488',
        dotColor: '#0d9488',
        bgColor: '#f0fdfa',
        borderColor: '#99f6e4',
        stepIndex: 4,
        icon: <CheckCircle2 size={13} />,
      };
    case 'CANCELLED':
      return {
        label: 'Đã hủy',
        badgeClass: 'cancelled',
        color: '#dc2626',
        dotColor: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca',
        stepIndex: -1,
        icon: <XCircle size={13} />,
      };
    case 'NO_SHOW':
      return {
        label: 'Không đến / Vắng mặt',
        badgeClass: 'cancelled',
        color: '#ea580c',
        dotColor: '#ea580c',
        bgColor: '#fff7ed',
        borderColor: '#fed7aa',
        stepIndex: -1,
        icon: <AlertCircle size={13} />,
      };
    case 'REASSIGNMENT_REQUIRED':
      return {
        label: 'Cần đổi bác sĩ',
        badgeClass: 'checked_in',
        color: '#c2410c',
        dotColor: '#c2410c',
        bgColor: '#fff7ed',
        borderColor: '#fed7aa',
        stepIndex: 1,
        icon: <RefreshCw size={13} />,
      };
    case 'BOOKED':
    default:
      return {
        label: 'Chờ tiếp nhận',
        badgeClass: 'booked',
        color: '#d97706',
        dotColor: '#d97706',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        stepIndex: 1,
        icon: <Clock size={13} />,
      };
  }
}

export interface PaymentMeta {
  status: PaymentStatusType;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  desc: string;
  icon: React.ReactNode;
}

export function getPaymentMeta(
  appointmentStatus?: string | null,
  invoice?: any,
): PaymentMeta {
  if (invoice) {
    const paid = Number(invoice.paid ?? invoice.paidMinor ?? 0);
    const balance = Number(invoice.balance ?? invoice.balanceMinor ?? 0);
    if (paid > 0 && balance <= 0) {
      return {
        status: 'PAID',
        label: 'Đã thanh toán',
        color: '#16a34a',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        desc: 'Đã hoàn tất thanh toán viện phí tiếp đón.',
        icon: <CheckCircle2 size={13} />,
      };
    }
    if (paid > 0 && balance > 0) {
      return {
        status: 'PARTIAL',
        label: 'Thanh toán một phần',
        color: '#d97706',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        desc: 'Đã thanh toán một phần viện phí.',
        icon: <Clock size={13} />,
      };
    }
    return {
      status: 'UNPAID',
      label: 'Chưa thanh toán',
      color: '#dc2626',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
      desc: 'Quý khách vui lòng thanh toán tại Quầy thu ngân Tầng 1 khi check-in khám.',
      icon: <AlertCircle size={13} />,
    };
  }

  // Khi chưa có hóa đơn riêng: căn cứ vào trạng thái lâm sàng
  if (
    appointmentStatus === 'CHECKED_IN' ||
    appointmentStatus === 'IN_CLINICAL_CARE' ||
    appointmentStatus === 'COMPLETED'
  ) {
    return {
      status: 'PAID',
      label: 'Đã thanh toán',
      color: '#16a34a',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      desc: 'Đã hoàn tất thanh toán viện phí tiếp đón tại quầy lễ tân.',
      icon: <CheckCircle2 size={13} />,
    };
  }

  return {
    status: 'UNPAID',
    label: 'Chưa thanh toán',
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    desc: 'Quý khách thanh toán tại Quầy thu ngân Tầng 1 khi đến check-in khám.',
    icon: <AlertCircle size={13} />,
  };
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export interface ClinicalJourneyTrackerProps {
  appointment: Appointment;
  queueInfo?: QueueTicketInfo | null;
  compact?: boolean;
  hideHeaderBadge?: boolean;
}

/**
 * TIẾN TRÌNH KHÁM BỆNH KHI ĐI KHÁM (CLINICAL JOURNEY TRACKER)
 * 4 Bước rõ ràng: 1. Đã đặt -> 2. Check-in quầy -> 3. Vào khám -> 4. Hoàn tất
 */
export function ClinicalJourneyTracker({
  appointment,
  queueInfo,
  compact = false,
  hideHeaderBadge = false,
}: ClinicalJourneyTrackerProps) {
  const statusMeta = getClinicalStatusMeta(appointment.status);
  const currentStep = statusMeta.stepIndex;

  // Trường hợp đã hủy hoặc vắng mặt: hiển thị thông báo trạng thái riêng
  if (currentStep === -1) {
    const isCancelled = appointment.status === 'CANCELLED';
    return (
      <div
        className="pap-journey-alert-banner"
        style={{
          background: isCancelled ? '#fef2f2' : '#fff7ed',
          borderColor: isCancelled ? '#fecaca' : '#fed7aa',
          color: isCancelled ? '#991b1b' : '#9a3412',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCancelled ? <XCircle size={16} /> : <AlertCircle size={16} />}
          <strong>
            {isCancelled
              ? 'Lịch hẹn này đã bị hủy'
              : 'Quá giờ hẹn - Bệnh nhân không đến'}
          </strong>
        </div>
        {appointment.cancellationReason && (
          <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.9 }}>
            Lý do: {appointment.cancellationReason}
          </div>
        )}
      </div>
    );
  }

  const steps = [
    {
      num: 1,
      title: 'Đã đặt lịch',
      sub: formatTime(appointment.startAt)
        ? `Hẹn ${formatTime(appointment.startAt)}`
        : 'Trực tuyến',
      icon: <Calendar size={14} />,
    },
    {
      num: 2,
      title: 'Check-in quầy',
      sub:
        appointment.checkedInAt || appointment.checkInAt
          ? formatTime(appointment.checkedInAt || appointment.checkInAt)
          : currentStep >= 2
            ? 'Đã tiếp đón'
            : 'Chờ tại tầng 1',
      icon: <UserCheck size={14} />,
    },
    {
      num: 3,
      title: 'Vào khám',
      sub: appointment.clinicalStartedAt
        ? formatTime(appointment.clinicalStartedAt)
        : currentStep === 3
          ? 'Đang khám'
          : currentStep > 3
            ? 'Đã khám'
            : 'Đợi gọi số',
      icon: <Stethoscope size={14} />,
    },
    {
      num: 4,
      title: 'Hoàn tất',
      sub: appointment.completedAt
        ? formatTime(appointment.completedAt)
        : currentStep === 4
          ? 'Hoàn thành'
          : 'Kết thúc ca',
      icon: <CheckCircle2 size={14} />,
    },
  ];

  if (compact) {
    return (
      <div className="pap-journey-compact-wrap">
        <div className="pap-journey-compact-bar">
          {steps.map((st, idx) => {
            const isCompleted = currentStep > st.num;
            const isCurrent = currentStep === st.num;
            return (
              <div
                key={st.num}
                className={`pap-journey-compact-step ${
                  isCompleted ? 'is-completed' : isCurrent ? 'is-current' : ''
                }`}
                title={`${st.num}. ${st.title} (${st.sub})`}
              >
                <div className="pap-journey-compact-bullet">
                  {isCompleted ? <Check size={10} /> : st.num}
                </div>
                <span className="pap-journey-compact-label">{st.title}</span>
                {idx < steps.length - 1 && (
                  <div
                    className={`pap-journey-compact-line ${
                      currentStep > st.num ? 'is-active' : ''
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="pap-journey-full-wrap">
      <div className="pap-journey-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pap-journey-header-title">Tiến trình đi khám</span>
          <span className="pap-journey-step-count">
            (Bước {Math.max(1, currentStep)}/4)
          </span>
        </div>
        {!hideHeaderBadge && (
          <span
            className="pap-journey-current-badge"
            style={{
              background: statusMeta.bgColor,
              color: statusMeta.color,
              borderColor: statusMeta.borderColor,
            }}
          >
            {statusMeta.icon}
            <span>{statusMeta.label}</span>
          </span>
        )}
      </div>

      <div className="pap-journey-track">
        {steps.map((st, idx) => {
          const isCompleted = currentStep > st.num;
          const isCurrent = currentStep === st.num;
          return (
            <React.Fragment key={st.num}>
              <div
                className={`pap-journey-node ${
                  isCompleted ? 'is-completed' : isCurrent ? 'is-current' : ''
                }`}
              >
                <div className="pap-journey-node-circle">
                  {isCompleted ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <span>{st.num}</span>
                  )}
                </div>
                <div className="pap-journey-node-text">
                  <div className="pap-journey-node-title">{st.title}</div>
                  <div className="pap-journey-node-sub">{st.sub}</div>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`pap-journey-connector ${
                    currentStep > st.num ? 'is-done' : ''
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export interface QueueTicketBadgeProps {
  queueCode?: string | null;
  roomCode?: string | null;
  roomName?: string | null;
  appointmentStatus?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * HUY HIỆU SỐ THỨ TỰ (STT) KHI PHÁT SỐ & PHÒNG KHÁM
 */
export function QueueTicketBadge({
  queueCode,
  roomCode,
  roomName,
  appointmentStatus,
  size = 'md',
}: QueueTicketBadgeProps) {
  const isCheckedInOrBeyond =
    appointmentStatus === 'CHECKED_IN' ||
    appointmentStatus === 'IN_CLINICAL_CARE' ||
    appointmentStatus === 'COMPLETED';

  const hasCode = !!queueCode;

  if (hasCode || isCheckedInOrBeyond) {
    const displayCode = queueCode || 'Đã phát số';
    const displayRoom =
      roomName || (roomCode ? `Phòng ${roomCode}` : 'Phòng khám Sản Phụ khoa');

    return (
      <div className={`pap-queue-badge is-issued size-${size}`}>
        <div className="pap-queue-left">
          <span className="pap-queue-tag">STT KHÁM</span>
          <strong className="pap-queue-code">{displayCode}</strong>
        </div>
        <div className="pap-queue-divider" />
        <div className="pap-queue-right">
          <Building2 size={13} className="pap-queue-icon" />
          <span className="pap-queue-room">{displayRoom}</span>
        </div>
      </div>
    );
  }

  // Chưa phát số (trạng thái BOOKED)
  return (
    <div className={`pap-queue-badge is-pending size-${size}`}>
      <div className="pap-queue-left">
        <span className="pap-queue-tag">STT KHÁM</span>
        <span className="pap-queue-code-pending">Chưa cấp</span>
      </div>
      <div className="pap-queue-divider" />
      <div className="pap-queue-right">
        <span className="pap-queue-pending-note">
          (Sẽ cấp khi check-in tại quầy)
        </span>
      </div>
    </div>
  );
}

export interface PaymentStatusBadgeProps {
  appointmentStatus?: string | null;
  invoice?: any;
  showDesc?: boolean;
}

/**
 * HUY HIỆU TRẠNG THÁI THANH TOÁN VIỆN PHÍ
 */
export function PaymentStatusBadge({
  appointmentStatus,
  invoice,
  showDesc = false,
}: PaymentStatusBadgeProps) {
  const meta = getPaymentMeta(appointmentStatus, invoice);

  return (
    <div className="pap-payment-badge-wrap">
      <span
        className={`pap-payment-badge is-${meta.status.toLowerCase()}`}
        style={{
          color: meta.color,
          background: meta.bgColor,
          borderColor: meta.borderColor,
        }}
      >
        <CreditCard size={12} />
        <span>{meta.label}</span>
      </span>
      {showDesc && meta.desc && (
        <span className="pap-payment-desc">{meta.desc}</span>
      )}
    </div>
  );
}
