import { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  Printer,
  X,
} from 'lucide-react';
import type { Appointment } from '../../../services/appointment';
import type { PatientProfile } from '../../../services/patient';
import '../../../styles/patient-appointments.css';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function formatDateDisplay(isoString?: string | null): string {
  if (!isoString) return '--/--/----';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--/--/----';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatWeekday(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getDay()] || '';
}

function formatTimeRange(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return '--:--';
  const s = new Date(startIso);
  const startStr = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
  if (!endIso) return startStr;
  const e = new Date(endIso);
  const endStr = `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`;
  return `${startStr} - ${endStr}`;
}

function formatVnd(amount?: number | null): string {
  if (!amount && amount !== 0) return '0 ₫';
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

function formatPhoneLocal(phone?: string | null): string {
  if (!phone) return '--';
  let p = phone.trim();
  if (p.startsWith('+84')) {
    p = '0' + p.slice(3);
  } else if (p.startsWith('84') && p.length >= 10) {
    p = '0' + p.slice(2);
  }
  return p;
}

export interface AppointmentTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  patientProfile?: PatientProfile | null;
  fallbackPatientName?: string;
  fallbackPhoneNumber?: string;
  fallbackDateOfBirth?: string;
  fallbackNationalId?: string;
  fallbackDoctorName?: string;
  fallbackSpecialtyName?: string;
  fallbackServiceName?: string;
  fallbackRoomName?: string;
  fallbackPriceMinor?: number;
  onGoToAppointments?: () => void;
  showGoToAppointmentsBtn?: boolean;
}

export function AppointmentTicketModal({
  isOpen,
  onClose,
  appointment,
  patientProfile,
  fallbackPatientName,
  fallbackPhoneNumber,
  fallbackDateOfBirth,
  fallbackNationalId,
  fallbackDoctorName,
  fallbackSpecialtyName,
  fallbackServiceName,
  fallbackRoomName,
  fallbackPriceMinor,
  onGoToAppointments,
  showGoToAppointmentsBtn = false,
}: AppointmentTicketModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !appointment) return null;

  const code = appointment.appointmentCode || '--';

  const handleCopyCode = () => {
    if (code && code !== '--') {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const patientName = patientProfile?.fullName || fallbackPatientName || appointment.patientName || 'Bệnh nhân Tâm An';
  const patientDob = formatDateDisplay(patientProfile?.dateOfBirth || fallbackDateOfBirth);
  const patientPhone = formatPhoneLocal(patientProfile?.phoneNumber || fallbackPhoneNumber);
  const patientNationalId = patientProfile?.nationalId || fallbackNationalId || patientProfile?.nationalIdMasked || '--';

  const serviceName = appointment.pricing?.serviceName || fallbackServiceName || 'Khám Sản Phụ khoa';
  const doctorName = fallbackDoctorName || (appointment.assignedDoctorId ? 'Bác sĩ chuyên khoa' : 'Bệnh viện tự động sắp xếp');
  const specialtyName = fallbackSpecialtyName || 'Sản Phụ khoa';
  const timeRange = formatTimeRange(appointment.startAt, appointment.endAt);
  const dateStr = appointment.startAt
    ? `${formatWeekday(appointment.startAt)}, ${formatDateDisplay(appointment.startAt)}`
    : '--/--/----';

  const totalPrice = appointment.pricing?.estimatedTotalMinor || appointment.pricing?.totalMinor || fallbackPriceMinor || 0;

  return (
    <div className="pap-modal-backdrop" onClick={onClose}>
      <div className="pap-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="pap-modal-header">
          <div className="pap-modal-header-left">
            <img src="/brand/logo-symbol-cropped.png" alt="Tâm An" className="pap-modal-logo" />
            <div>
              <h4 className="pap-modal-header-title">BỆNH VIỆN PHỤ SẢN TÂM AN</h4>
              <p className="pap-modal-header-sub">Phiếu hẹn khám bệnh trực tuyến điện tử</p>
            </div>
          </div>
          <button
            type="button"
            className="pap-btn-modal-close"
            onClick={onClose}
            aria-label="Đóng phiếu hẹn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nội dung Phiếu hẹn */}
        <div className="pap-ticket-body">
          {/* Banner mã phiếu hẹn */}
          <div className="pap-ticket-code-banner">
            <div className="pap-ticket-code-left">
              <div>
                <div className="pap-ticket-code-label">MÃ PHIẾU HẸN TIẾP ĐÓN</div>
                <div className="pap-ticket-code-num">{code}</div>
              </div>
            </div>
            <button
              type="button"
              className="pap-btn-copy-code"
              onClick={handleCopyCode}
            >
              {copiedCode ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
            </button>
          </div>

          {/* Bố cục 2 cột không phải cuộn trang: Cột trái to hơn hiển thị 1. Thông tin lịch hẹn y tế; Cột phải là 2. Thông tin người khám bệnh */}
          <div className="pap-ticket-columns">
            {/* Cột trái: 1. Thông tin lịch hẹn y tế & Chi phí tạm tính (To hơn, hiển thị nhiều thông tin) */}
            <div className="pap-ticket-col is-left-primary">
              <div className="pap-ticket-card-box">
                <div className="pap-ticket-card-title">1. Thông tin lịch hẹn y tế</div>
                <div className="pap-ticket-grid">
                  <div className="pap-ticket-field" style={{ gridColumn: '1 / -1' }}>
                    <span className="pap-ticket-field-label">Dịch vụ đăng ký:</span>
                    <strong className="pap-ticket-field-val is-service">
                      {serviceName}
                    </strong>
                  </div>

                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Bác sĩ phụ trách:</span>
                    <strong className="pap-ticket-field-val">{doctorName}</strong>
                  </div>

                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Chuyên khoa:</span>
                    <strong className="pap-ticket-field-val">{specialtyName}</strong>
                  </div>

                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Khung giờ hẹn:</span>
                    <strong className="pap-ticket-field-val">
                      {timeRange}
                    </strong>
                  </div>

                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Ngày hẹn khám:</span>
                    <strong className="pap-ticket-field-val">{dateStr}</strong>
                  </div>
                </div>
              </div>

              {/* Chi phí tạm tính */}
              <div>
                <div className="pap-ticket-price-box">
                  <span className="pap-ticket-price-label">Tổng chi phí tạm tính:</span>
                  <span className="pap-ticket-price-num">{formatVnd(totalPrice)}</span>
                </div>
                <div className="pap-ticket-price-note">
                  * Quý khách thanh toán trực tiếp tại Quầy tiếp đón khi đến khám.
                </div>
              </div>
            </div>

            {/* Cột phải: 2. Thông tin người khám bệnh & Hướng dẫn tiếp đón */}
            <div className="pap-ticket-col is-right-secondary">
              <div className="pap-ticket-card-box">
                <div className="pap-ticket-card-title">2. Thông tin người khám bệnh</div>
                <div className="pap-ticket-grid">
                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Họ và tên bệnh nhân:</span>
                    <strong className="pap-ticket-field-val">{patientName}</strong>
                  </div>
                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Ngày sinh:</span>
                    <strong className="pap-ticket-field-val">{patientDob}</strong>
                  </div>
                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Số điện thoại:</span>
                    <strong className="pap-ticket-field-val">{patientPhone}</strong>
                  </div>
                  <div className="pap-ticket-field">
                    <span className="pap-ticket-field-label">Số CCCD / Định danh:</span>
                    <strong className="pap-ticket-field-val">{patientNationalId}</strong>
                  </div>
                </div>
              </div>

              {/* Hướng dẫn khi đến khám */}
              <div className="pap-ticket-notice-box">
                <div className="pap-ticket-notice-title">
                  <AlertCircle size={15} /> Hướng dẫn tiếp đón khi đến khám
                </div>
                <ul className="pap-ticket-notice-list">
                  <li>Quý khách vui lòng có mặt trước giờ hẹn từ 10 - 15 phút.</li>
                  <li>Xuất trình CCCD hoặc mã phiếu hẹn tại Quầy tiếp đón Tầng 1.</li>
                  <li>Nếu cần đổi lịch, vui lòng liên hệ tổng đài <strong>1900 6868</strong> trước 24 giờ.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="pap-modal-footer">
          <button
            type="button"
            className="pap-btn-secondary"
            onClick={() => window.print()}
          >
            <Printer size={15} style={{ display: 'inline', marginRight: '6px' }} />
            In phiếu hẹn
          </button>
          {showGoToAppointmentsBtn && onGoToAppointments && (
            <button
              type="button"
              className="pap-btn-primary"
              onClick={onGoToAppointments}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={15} />
              Xem lịch hẹn của tôi
            </button>
          )}
          <button
            type="button"
            className={showGoToAppointmentsBtn ? "pap-btn-secondary" : "pap-btn-primary"}
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

