import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Lock,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../../app/navigation';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { listCatalogServices, type CatalogService } from '../../../services/catalog';
import { listDoctors, listSpecialties, type Doctor, type Specialty } from '../../../services/doctor';
import {
  createAppointment,
  createSlotHold,
  idempotencyKey,
  listBookableSlots,
  type Appointment,
  type BookableSlot,
  type SelectionMode,
} from '../../../services/appointment';
import { getMyPatient, saveMyPatient, type PatientProfile } from '../../../services/patient';
import '../../../styles/patient-booking.css';

function formatVnd(amountMinor?: number | null): string {
  if (amountMinor == null || amountMinor <= 0) return 'Miễn phí';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amountMinor);
}

function formatDateDisplay(isoDateString?: string): string {
  if (!isoDateString) return '';
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return isoDateString;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sH = String(s.getHours()).padStart(2, '0');
  const sM = String(s.getMinutes()).padStart(2, '0');
  const eH = String(e.getHours()).padStart(2, '0');
  const eM = String(e.getMinutes()).padStart(2, '0');
  return `${sH}:${sM} - ${eH}:${eM}`;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export function PatientBookingPage() {
  const auth = useAuthSession();

  // 1. Phân tích Query params từ URL (serviceId, specialtyId, doctorId)
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const queryServiceId = urlParams.get('serviceId') || '';
  const querySpecialtyId = urlParams.get('specialtyId') || '';
  const queryDoctorId = urlParams.get('doctorId') || '';

  // 2. State chính cho luồng 4 bước
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Danh mục chuyên khoa, dịch vụ, bác sĩ
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Lựa chọn ở Bước 1
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>(querySpecialtyId || 'all');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(queryServiceId);

  // Lựa chọn ở Bước 2
  const [doctorMode, setDoctorMode] = useState<SelectionMode>(queryDoctorId ? 'DOCTOR' : 'RANK');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(queryDoctorId);
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<BookableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Lựa chọn ở Bước 3: Hồ sơ bệnh nhân
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<'loading' | 'complete' | 'incomplete'>('loading');

  // Form điền thông tin bệnh nhân (cho tài khoản mới hoặc khi cần sửa)
  const [formFullName, setFormFullName] = useState('');
  const [formDateOfBirth, setFormDateOfBirth] = useState('');
  const [formPhoneNumber, setFormPhoneNumber] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Khách vãng lai (Chưa đăng nhập) - Form đăng nhập/đăng ký tại chỗ
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Bước 4 & Đặt lịch
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Cuộn mượt khi chuyển bước
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    if (topAnchorRef.current) {
      topAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 3. Tải danh mục ban đầu (Dịch vụ, Bác sĩ, Chuyên khoa)
  useEffect(() => {
    let active = true;
    Promise.all([
      listCatalogServices(auth.request).catch(() => []),
      listSpecialties(auth.request).catch(() => []),
      listDoctors(auth.request).catch(() => []),
    ]).then(([svcList, specList, docList]) => {
      if (!active) return;
      // Chỉ lấy dịch vụ ACTIVE và bookingEnabled
      const activeSvcs = (svcList || []).filter(
        (s: any) => s.bookingEnabled !== false && s.status !== 'INACTIVE' && s.status !== 'ARCHIVED' && s.status !== 'DRAFT'
      );
      setServices(activeSvcs);
      setSpecialties(specList || []);
      setDoctors((docList || []).filter((d: any) => d.status === 'ACTIVE'));
      setLoadingInitial(false);

      // Nếu có queryServiceId hợp lệ, tự động chọn
      if (queryServiceId && activeSvcs.some((s) => s.id === queryServiceId)) {
        setSelectedServiceId(queryServiceId);
      }
    });

    return () => {
      active = false;
    };
  }, [auth.request, queryServiceId]);

  // 4. Kiểm tra hồ sơ bệnh nhân khi đã đăng nhập
  const fetchPatientProfile = async () => {
    if (auth.status !== 'authenticated') {
      setProfileStatus('incomplete');
      return;
    }
    setProfileStatus('loading');
    try {
      const p = await getMyPatient(auth.request);
      if (p && p.fullName) {
        setPatientProfile(p);
        setFormFullName(p.fullName);
        setFormDateOfBirth(p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '');
        setFormPhoneNumber(p.phoneNumber || '');
        setFormNationalId(p.nationalIdMasked || '');
        setFormAddress(p.address || '');
        setProfileStatus('complete');
      } else {
        setProfileStatus('incomplete');
      }
    } catch (err: any) {
      // 404 PATIENT_PROFILE_NOT_FOUND => Tài khoản mới chưa có hồ sơ
      setPatientProfile(null);
      setProfileStatus('incomplete');
    }
  };

  useEffect(() => {
    fetchPatientProfile();
  }, [auth.status]);

  // Dịch vụ đang được chọn
  const selectedService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  // Danh sách bác sĩ khả dụng cho dịch vụ đang chọn
  const eligibleDoctorsForService = useMemo(() => {
    if (!selectedService || !selectedService.specialtyId) return doctors;
    return doctors.filter((doc: any) => {
      const specList = doc.specialties || [];
      return specList.some((s: any) => s.id === selectedService.specialtyId);
    });
  }, [doctors, selectedService]);

  // Bác sĩ đang được chọn
  const selectedDoctor = useMemo(() => {
    if (doctorMode === 'RANK' || !selectedDoctorId) return null;
    return doctors.find((d: any) => d.id === selectedDoctorId || d.doctorId === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId, doctorMode]);

  // Danh sách 14 ngày tới để chọn lịch
  const dateOptions = useMemo(() => {
    const list: Array<{ dateStr: string; dayName: string; formatted: string }> = [];
    const now = new Date();
    // Bắt đầu từ ngày mai (đặt trước tối thiểu 1 ngày theo tiêu chuẩn bệnh viện)
    for (let i = 1; i <= 14; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayName = i === 1 ? 'Ngày mai' : WEEKDAYS[d.getDay()];
      list.push({
        dateStr,
        dayName,
        formatted: `${dd}/${mm}`,
      });
    }
    return list;
  }, []);

  // Tự động chọn ngày đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedDate && dateOptions.length > 0) {
      setSelectedDate(dateOptions[0].dateStr);
    }
  }, [dateOptions, selectedDate]);

  // 5. Tải danh sách Slots khi chọn Dịch vụ, Bác sĩ/Chế độ và Ngày
  useEffect(() => {
    if (!selectedServiceId || !selectedDate) {
      setAvailableSlots([]);
      return;
    }

    let active = true;
    setLoadingSlots(true);
    setSelectedSlot(null);

    const from = `${selectedDate}T07:00:00.000Z`;
    const to = `${selectedDate}T18:00:00.000Z`;

    listBookableSlots(auth.request, {
      serviceId: selectedServiceId,
      selectionMode: doctorMode,
      from,
      to,
      requestedDoctorId: doctorMode === 'DOCTOR' ? selectedDoctorId || undefined : undefined,
      requestedRankCode: doctorMode === 'RANK' ? 'BASIC' : undefined,
    })
      .then((slots) => {
        if (!active) return;
        setAvailableSlots(slots || []);
        setLoadingSlots(false);
      })
      .catch(() => {
        if (!active) return;
        setAvailableSlots([]);
        setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [auth.request, selectedServiceId, doctorMode, selectedDoctorId, selectedDate]);

  // Lọc dịch vụ theo Chuyên khoa và Tìm kiếm từ khóa ở Bước 1
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      if (selectedSpecialtyId !== 'all') {
        const specMatch = svc.specialtyId === selectedSpecialtyId;
        if (!specMatch) return false;
      }
      if (serviceSearch.trim()) {
        const query = serviceSearch.toLowerCase();
        const nameMatch = (svc.name || '').toLowerCase().includes(query);
        const descMatch = (svc.summary || svc.description || '').toLowerCase().includes(query);
        if (!nameMatch && !descMatch) return false;
      }
      return true;
    });
  }, [services, selectedSpecialtyId, serviceSearch]);

  // Xử lý đăng nhập / đăng ký nhanh cho khách vãng lai ở Bước 3
  const handleQuickAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authTab === 'login') {
        await auth.signIn({ email: authEmail, password: authPassword }, true);
      } else {
        await auth.signUp({ email: authEmail, password: authPassword });
      }
      // Đăng nhập thành công, tải lại hồ sơ
      await fetchPatientProfile();
      setAuthSubmitting(false);
    } catch (err: any) {
      setAuthError(err.message || 'Xác thực tài khoản thất bại. Vui lòng kiểm tra lại.');
      setAuthSubmitting(false);
    }
  };

  // Validate form bệnh nhân khi ở trạng thái tạo mới hồ sơ
  const validatePatientForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formFullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên đầy đủ.';
    if (!formDateOfBirth.trim()) errors.dateOfBirth = 'Vui lòng chọn ngày sinh.';
    if (!formPhoneNumber.trim()) {
      errors.phoneNumber = 'Vui lòng nhập số điện thoại liên hệ.';
    } else if (!/^[0-9+() -]{9,15}$/.test(formPhoneNumber.trim())) {
      errors.phoneNumber = 'Số điện thoại không hợp lệ.';
    }
    if (!formNationalId.trim()) {
      errors.nationalId = 'Vui lòng nhập số Căn cước công dân (CCCD).';
    } else if (!/^[0-9A-Za-z]{9,15}$/.test(formNationalId.trim())) {
      errors.nationalId = 'Số CCCD/Định danh không hợp lệ (9 - 12 ký tự số).';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Xử lý chuyển bước tiếp theo
  const handleNextStep = async () => {
    setSubmitError(null);

    // Từ Bước 1 -> Bước 2
    if (currentStep === 1) {
      if (!selectedServiceId) {
        setSubmitError('Vui lòng chọn một dịch vụ y tế để tiếp tục.');
        return;
      }
      setCurrentStep(2);
      scrollToTop();
      return;
    }

    // Từ Bước 2 -> Bước 3
    if (currentStep === 2) {
      if (!selectedSlot) {
        setSubmitError('Vui lòng chọn một khung giờ khám còn trống.');
        return;
      }
      setCurrentStep(3);
      scrollToTop();
      return;
    }

    // Từ Bước 3 -> Bước 4
    if (currentStep === 3) {
      if (auth.status !== 'authenticated') {
        setSubmitError('Vui lòng đăng nhập hoặc đăng ký tài khoản để bảo mật và lưu phiếu khám.');
        return;
      }

      // Nếu tài khoản mới chưa có hồ sơ, kiểm tra form và lưu hồ sơ ngay
      if (profileStatus === 'incomplete') {
        const isValid = validatePatientForm();
        if (!isValid) {
          setSubmitError('Vui lòng điền đầy đủ và chính xác các thông tin người khám bắt buộc.');
          return;
        }

        try {
          setIsSubmitting(true);
          const savedProfile = await saveMyPatient(
            {
              fullName: formFullName.trim(),
              dateOfBirth: formDateOfBirth,
              phoneNumber: formPhoneNumber.trim(),
              nationalId: formNationalId.trim(),
              address: formAddress.trim() || undefined,
            },
            (auth as any).user?.accessToken || ''
          );
          setPatientProfile(savedProfile);
          setProfileStatus('complete');
          setIsSubmitting(false);
        } catch (err: any) {
          setIsSubmitting(false);
          setSubmitError(err.message || 'Không thể lưu hồ sơ bệnh nhân. Vui lòng kiểm tra lại số CCCD/SĐT.');
          return;
        }
      }

      setCurrentStep(4);
      scrollToTop();
      return;
    }

    // Tại Bước 4: XÁC NHẬN VÀ TẠO LỊCH HẸN TRỰC TIẾP
    if (currentStep === 4) {
      if (!selectedService || !selectedSlot) {
        setSubmitError('Thông tin đặt lịch không đầy đủ. Vui lòng quay lại kiểm tra.');
        return;
      }

      setIsSubmitting(true);
      try {
        // Bước A: Tạo Slot Hold (giữ chỗ 5 phút)
        const hold = await createSlotHold(auth.request, {
          serviceId: selectedService.id!,
          selectionMode: selectedSlot.selectionMode || doctorMode,
          requestedDoctorId: selectedSlot.doctorId || (doctorMode === 'DOCTOR' ? selectedDoctorId : undefined),
          requestedRankCode: selectedSlot.rankCode || (doctorMode === 'RANK' ? 'BASIC' : undefined),
          startAt: selectedSlot.startAt,
          endAt: selectedSlot.endAt,
        });

        if (!hold || !hold.id) {
          throw new Error('Khung giờ này vừa có người giữ chỗ. Vui lòng chọn khung giờ khác.');
        }

        // Bước B: Chuyển Hold thành Lịch hẹn chính thức (BookingChannel: ONLINE)
        const appointment = await createAppointment(auth.request, hold.id);

        setCreatedAppointment(appointment);
        setCurrentStep(5); // Chuyển sang màn hình thành công
        setIsSubmitting(false);
        scrollToTop();
      } catch (err: any) {
        setIsSubmitting(false);
        setSubmitError(err.message || 'Không thể tạo lịch hẹn. Vui lòng thử lại hoặc chọn khung giờ khác.');
      }
    }
  };

  // Quay lại bước trước
  const handlePrevStep = () => {
    setSubmitError(null);
    if (currentStep > 1 && currentStep <= 4) {
      setCurrentStep((prev) => (prev - 1) as any);
      scrollToTop();
    }
  };

  // Sao chép mã đặt lịch
  const handleCopyCode = () => {
    if (createdAppointment?.appointmentCode) {
      navigator.clipboard.writeText(createdAppointment.appointmentCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className="pb-page">
      <PublicPortalHeader />

      <main className="pb-main" ref={topAnchorRef}>
        <div className="portal-container pb-container">
          {/* Breadcrumbs */}
          <nav className="pb-breadcrumb" aria-label="Breadcrumb">
            <AppLink href="/">Trang chủ</AppLink>
            <span>/</span>
            <span className="pb-breadcrumb-current">Đăng ký đặt lịch khám</span>
          </nav>

          {/* Hero Banner Header */}
          <section className="pb-hero-header">
            <div className="pb-hero-left">
              <span className="pb-hero-badge">
                <Building2 size={14} /> Bệnh viện Phụ sản Tâm An • Hà Nội
              </span>
              <h1 className="pb-hero-title">Đăng Ký Đặt Lịch Khám Trực Tuyến</h1>
              <p className="pb-hero-desc">
                Chủ động lựa chọn dịch vụ, bác sĩ chuyên khoa và khung giờ khám thuận tiện nhất. Hệ thống tiếp đón ưu tiên
                không cần bốc số xếp hàng tại bệnh viện.
              </p>
            </div>
            <div className="pb-hero-right">
              <span className="pb-hero-commitment-item">
                <CheckCircle2 size={16} color="#4ade80" /> Khám đúng giờ hẹn
              </span>
              <span className="pb-hero-commitment-item">
                <CheckCircle2 size={16} color="#4ade80" /> Bác sĩ chuyên môn cao
              </span>
              <span className="pb-hero-commitment-item">
                <CheckCircle2 size={16} color="#4ade80" /> Bảo mật thông tin y tế
              </span>
            </div>
          </section>

          {/* Stepper Progress Bar (Chỉ hiện khi chưa hoàn tất bước 5) */}
          {currentStep < 5 && (
            <div className="pb-stepper-card">
              <ol className="pb-stepper-list">
                {/* Bước 1 */}
                <li
                  className={`pb-stepper-step ${currentStep === 1 ? 'is-active' : ''} ${currentStep > 1 ? 'is-done' : ''}`}
                  onClick={() => {
                    if (currentStep > 1) setCurrentStep(1);
                  }}
                >
                  <div className="pb-stepper-number">{currentStep > 1 ? <Check size={16} /> : 1}</div>
                  <div className="pb-stepper-info">
                    <span className="pb-stepper-step-title">Dịch vụ khám</span>
                    <span className="pb-stepper-step-sub">Chọn gói / chuyên khoa</span>
                  </div>
                </li>

                <div className={`pb-stepper-divider ${currentStep > 1 ? 'is-done' : ''}`} />

                {/* Bước 2 */}
                <li
                  className={`pb-stepper-step ${currentStep === 2 ? 'is-active' : ''} ${currentStep > 2 ? 'is-done' : ''} ${currentStep < 2 ? 'is-disabled' : ''}`}
                  onClick={() => {
                    if (currentStep > 2) setCurrentStep(2);
                  }}
                >
                  <div className="pb-stepper-number">{currentStep > 2 ? <Check size={16} /> : 2}</div>
                  <div className="pb-stepper-info">
                    <span className="pb-stepper-step-title">Bác sĩ &amp; Thời gian</span>
                    <span className="pb-stepper-step-sub">Chọn ngày và khung giờ</span>
                  </div>
                </li>

                <div className={`pb-stepper-divider ${currentStep > 2 ? 'is-done' : ''}`} />

                {/* Bước 3 */}
                <li
                  className={`pb-stepper-step ${currentStep === 3 ? 'is-active' : ''} ${currentStep > 3 ? 'is-done' : ''} ${currentStep < 3 ? 'is-disabled' : ''}`}
                  onClick={() => {
                    if (currentStep > 3) setCurrentStep(3);
                  }}
                >
                  <div className="pb-stepper-number">{currentStep > 3 ? <Check size={16} /> : 3}</div>
                  <div className="pb-stepper-info">
                    <span className="pb-stepper-step-title">Thông tin người khám</span>
                    <span className="pb-stepper-step-sub">Hồ sơ bệnh nhân</span>
                  </div>
                </li>

                <div className={`pb-stepper-divider ${currentStep > 3 ? 'is-done' : ''}`} />

                {/* Bước 4 */}
                <li
                  className={`pb-stepper-step ${currentStep === 4 ? 'is-active' : ''} ${currentStep > 4 ? 'is-done' : ''} ${currentStep < 4 ? 'is-disabled' : ''}`}
                >
                  <div className="pb-stepper-number">4</div>
                  <div className="pb-stepper-info">
                    <span className="pb-stepper-step-title">Xác nhận</span>
                    <span className="pb-stepper-step-sub">Hoàn tất lịch hẹn</span>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* THÔNG BÁO LỖI NẾU CÓ */}
          {submitError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#b91c1c',
                fontSize: '14px',
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <span>{submitError}</span>
            </div>
          )}

          {/* MÀN HÌNH THÀNH CÔNG (BƯỚC 5) */}
          {currentStep === 5 && createdAppointment && (
            <div className="pb-success-card">
              <div className="pb-success-icon-wrap">
                <Check size={40} />
              </div>
              <h2 className="pb-success-title">Đặt Lịch Khám Thành Công!</h2>
              <p className="pb-success-subtitle">
                Phiếu hẹn khám của bạn đã được ghi nhận trên hệ thống Bệnh viện Phụ sản Tâm An. Vui lòng lưu lại mã đặt lịch để
                làm thủ tục tiếp đón nhanh tại viện.
              </p>

              {/* Hộp mã đặt lịch */}
              <div className="pb-success-code-box">
                <span className="pb-success-code-label">Mã phiếu hẹn:</span>
                <span className="pb-success-code-val">{createdAppointment.appointmentCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Copy size={13} />
                  {copiedCode ? 'Đã sao chép!' : 'Sao chép'}
                </button>
              </div>

              {/* Tóm tắt phiếu khám */}
              <div className="pb-success-info-grid">
                <div className="pb-success-info-item">
                  <span className="pb-success-info-label">Dịch vụ đăng ký</span>
                  <span className="pb-success-info-val">
                    {createdAppointment.pricing?.serviceName || selectedService?.name}
                  </span>
                </div>

                <div className="pb-success-info-item">
                  <span className="pb-success-info-label">Bác sĩ phụ trách</span>
                  <span className="pb-success-info-val">
                    {selectedDoctor
                      ? (selectedDoctor.profile as any)?.fullName || selectedDoctor.name
                      : 'Bác sĩ chuyên khoa Tâm An phân bổ'}
                  </span>
                </div>

                <div className="pb-success-info-item">
                  <span className="pb-success-info-label">Thời gian khám</span>
                  <span className="pb-success-info-val">
                    {formatDateDisplay(createdAppointment.startAt)} (
                    {formatTimeRange(createdAppointment.startAt!, createdAppointment.endAt!)})
                  </span>
                </div>

                <div className="pb-success-info-item">
                  <span className="pb-success-info-label">Phòng khám tiếp nhận</span>
                  <span className="pb-success-info-val">
                    {createdAppointment.roomNameSnapshot || (selectedSlot as any)?.roomName || 'Quầy tiếp đón Tầng 1'}
                  </span>
                </div>

                <div className="pb-success-info-item">
                  <span className="pb-success-info-label">Bệnh nhân</span>
                  <span className="pb-success-info-val">
                    {patientProfile?.fullName || formFullName} ({formPhoneNumber || patientProfile?.phoneNumber})
                  </span>
                </div>

                <div className="pb-success-info-item">
                  <span className="pb-success-info-label">Chi phí tạm tính</span>
                  <span className="pb-success-info-val" style={{ color: '#0b4f9c', fontWeight: 800 }}>
                    {formatVnd(createdAppointment.pricing?.estimatedTotalMinor || (selectedService as any)?.price || (selectedService as any)?.basePrice?.amountMinor)}
                  </span>
                </div>
              </div>

              {/* Hướng dẫn bệnh nhân */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  marginBottom: '28px',
                  textAlign: 'left',
                  fontSize: '13.5px',
                  color: '#166534',
                  lineHeight: '1.6',
                }}
              >
                <strong>Hướng dẫn dành cho bạn:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                  <li>Vui lòng có mặt tại Bệnh viện Phụ sản Tâm An trước giờ hẹn 10 - 15 phút.</li>
                  <li>Xuất trình mã phiếu hẹn hoặc số CCCD tại Quầy tiếp đón Tầng 1 để nhận số thứ tự ưu tiên.</li>
                  <li>Nếu có kết quả khám, siêu âm cũ trong vòng 6 tháng, vui lòng mang theo để bác sĩ tham khảo.</li>
                </ul>
              </div>

              {/* Nút hành động */}
              <div className="pb-success-btn-group">
                <AppLink href="/lich-hen" className="pb-success-btn-primary">
                  <Calendar size={16} /> Xem danh sách lịch hẹn của tôi
                </AppLink>
                <AppLink href="/" className="pb-success-btn-secondary">
                  Về trang chủ
                </AppLink>
              </div>
            </div>
          )}

          {/* MAIN FORM GRID (BƯỚC 1 -> 4) */}
          {currentStep < 5 && (
            <div className="pb-layout-grid">
              {/* CỘT TRÁI: FORM THEO TỪNG BƯỚC */}
              <div className="pb-step-content-col">
                {/* ========================================================
                    BƯỚC 1: CHỌN CHUYÊN KHOA VÀ DỊCH VỤ Y TẾ
                   ======================================================== */}
                {currentStep === 1 && (
                  <div className="pb-step-card">
                    <div className="pb-step-header">
                      <h2 className="pb-step-heading">
                        <Stethoscope size={22} color="#0b4f9c" />
                        Bước 1: Chọn Chuyên Khoa &amp; Dịch Vụ Khám
                      </h2>
                      <p className="pb-step-subtitle">
                        Vui lòng lựa chọn dịch vụ khám hoặc gói chăm sóc thai sản theo nhu cầu của bạn.
                      </p>
                    </div>

                    {/* Bộ lọc từ khóa & chuyên khoa */}
                    <div className="pb-service-filter-row">
                      <div className="pb-search-box">
                        <Search size={16} className="pb-search-icon" />
                        <input
                          type="text"
                          className="pb-search-input"
                          placeholder="Tìm tên dịch vụ, gói khám, xét nghiệm..."
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Dải Tabs Chuyên khoa */}
                    <div className="pb-specialty-pills">
                      <button
                        type="button"
                        className={`pb-specialty-pill ${selectedSpecialtyId === 'all' ? 'is-active' : ''}`}
                        onClick={() => setSelectedSpecialtyId('all')}
                      >
                        Tất cả chuyên khoa ({services.length})
                      </button>
                      {specialties.map((spec) => {
                        const count = services.filter((s) => s.specialtyId === spec.id).length;
                        return (
                          <button
                            key={spec.id}
                            type="button"
                            className={`pb-specialty-pill ${selectedSpecialtyId === spec.id ? 'is-active' : ''}`}
                            onClick={() => setSelectedSpecialtyId(spec.id!)}
                          >
                            {spec.name} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* Danh sách thẻ dịch vụ */}
                    {loadingInitial ? (
                      <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                        Đang tải danh mục dịch vụ y tế...
                      </div>
                    ) : filteredServices.length === 0 ? (
                      <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                        Không tìm thấy dịch vụ nào phù hợp với bộ lọc hiện tại.
                      </div>
                    ) : (
                      <div className="pb-service-list">
                        {filteredServices.map((svc) => {
                          const isSelected = selectedServiceId === svc.id;
                          const priceVal = (svc as any).price || (svc as any).basePrice?.amountMinor;
                          const specObj = specialties.find((s) => s.id === svc.specialtyId);

                          return (
                            <div
                              key={svc.id}
                              className={`pb-service-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => setSelectedServiceId(svc.id!)}
                            >
                              <div className="pb-service-item-main">
                                <div className="pb-service-radio">
                                  <div className="pb-service-radio-dot" />
                                </div>
                                <div className="pb-service-item-info">
                                  <h3 className="pb-service-item-name">{svc.name}</h3>
                                  <p className="pb-service-item-summary">{svc.summary || svc.description}</p>
                                  <div className="pb-service-item-tags">
                                    <span className="pb-service-tag">{specObj?.name || 'Sản Phụ khoa'}</span>
                                    {svc.doctorRankSelectionPolicy === 'RANK_UPGRADE_ALLOWED' && (
                                      <span
                                        className="pb-service-tag"
                                        style={{ background: '#fef3c7', color: '#b45309' }}
                                      >
                                        Hỗ trợ chọn chuyên gia
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="pb-service-item-price-col">
                                <span className="pb-service-price-val">{formatVnd(priceVal)}</span>
                                <span className="pb-service-price-label">Giá niêm yết</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================
                    BƯỚC 2: CHỌN BÁC SĨ & THỜI GIAN KHÁM
                   ======================================================== */}
                {currentStep === 2 && (
                  <div className="pb-step-card">
                    <div className="pb-step-header">
                      <h2 className="pb-step-heading">
                        <Calendar size={22} color="#0b4f9c" />
                        Bước 2: Chọn Bác Sĩ &amp; Thời Gian Khám
                      </h2>
                      <p className="pb-step-subtitle">
                        Đang đặt lịch cho dịch vụ: <strong>{selectedService?.name}</strong>
                      </p>
                    </div>

                    {/* 1. Chọn chế độ bác sĩ */}
                    <div className="pb-selection-mode-toggle">
                      <div
                        className={`pb-mode-card ${doctorMode === 'RANK' ? 'is-active' : ''}`}
                        onClick={() => {
                          setDoctorMode('RANK');
                          setSelectedDoctorId('');
                        }}
                      >
                        <div className="pb-mode-icon-wrap">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <h4 className="pb-mode-title">Bệnh viện tự động sắp xếp</h4>
                          <p className="pb-mode-desc">
                            Khám cùng Bác sĩ chuyên khoa phù hợp nhất vào thời gian bạn chọn.
                          </p>
                        </div>
                      </div>

                      <div
                        className={`pb-mode-card ${doctorMode === 'DOCTOR' ? 'is-active' : ''}`}
                        onClick={() => setDoctorMode('DOCTOR')}
                      >
                        <div className="pb-mode-icon-wrap">
                          <Stethoscope size={20} />
                        </div>
                        <div>
                          <h4 className="pb-mode-title">Chỉ định Bác sĩ theo yêu cầu</h4>
                          <p className="pb-mode-desc">
                            Tự do lựa chọn Bác sĩ Trưởng khoa hoặc Chuyên gia cố vấn bạn mong muốn.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách bác sĩ nếu chọn chế độ DOCTOR */}
                    {doctorMode === 'DOCTOR' && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4
                          style={{
                            fontSize: '14.5px',
                            fontWeight: 750,
                            color: '#183153',
                            marginBottom: '12px',
                          }}
                        >
                          Danh sách Bác sĩ phụ trách chuyên khoa:
                        </h4>

                        <div className="pb-doctor-grid">
                          {eligibleDoctorsForService.map((doc: any) => {
                            const isSelected = selectedDoctorId === (doc.id || doc.doctorId);
                            const profile = doc.profile || {};
                            const docName = profile.fullName || doc.name || 'Bác sĩ chuyên khoa';
                            const docTitle = profile.professionalTitle || 'Bác sĩ Sản Phụ khoa';
                            const docPhoto = profile.photoUrl || 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80';

                            return (
                              <div
                                key={doc.id || doc.doctorId}
                                className={`pb-doctor-item-card ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => setSelectedDoctorId(doc.id || doc.doctorId)}
                              >
                                <img src={docPhoto} alt={docName} className="pb-doctor-thumb" />
                                <div className="pb-doctor-info">
                                  <h5 className="pb-doctor-name">{docName}</h5>
                                  <p className="pb-doctor-title">{docTitle}</p>
                                  <span className="pb-doctor-spec-tag">Bệnh viện Tâm An</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 2. Chọn Ngày khám (14 ngày tới) */}
                    <div className="pb-subheading-block">
                      <h4 className="pb-subheading-text">
                        <Calendar size={18} color="#0b4f9c" />
                        Chọn ngày đến khám
                      </h4>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>14 ngày khả dụng tiếp theo</span>
                    </div>

                    <div className="pb-date-chips-wrap">
                      {dateOptions.map((item) => {
                        const isSelected = selectedDate === item.dateStr;
                        return (
                          <div
                            key={item.dateStr}
                            className={`pb-date-chip ${isSelected ? 'is-active' : ''}`}
                            onClick={() => setSelectedDate(item.dateStr)}
                          >
                            <span className="pb-date-chip-day">{item.dayName}</span>
                            <span className="pb-date-chip-date">{item.formatted}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3. Khung giờ khám khả dụng */}
                    <div className="pb-slots-container">
                      <h4 className="pb-subheading-text">
                        <Clock size={18} color="#0b4f9c" />
                        Chọn khung giờ khám ngày {formatDateDisplay(selectedDate)}
                      </h4>

                      {loadingSlots ? (
                        <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b' }}>
                          Đang kiểm tra lịch trống của bác sĩ...
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="pb-slots-empty">
                          Ngày {formatDateDisplay(selectedDate)} hiện đã kín lịch hoặc bác sĩ không có ca trực. Vui lòng
                          chọn ngày khác hoặc chọn hình thức "Bệnh viện tự động sắp xếp".
                        </div>
                      ) : (
                        <div style={{ marginTop: '14px' }}>
                          <div className="pb-slots-grid">
                            {availableSlots.map((slot, idx) => {
                              const isSelected = selectedSlot?.startAt === slot.startAt && selectedSlot?.endAt === slot.endAt;
                              const timeLabel = formatTimeRange(slot.startAt, slot.endAt);
                              const roomLabel = (slot as any).roomName || (slot as any).roomCode || 'Phòng khám Tâm An';

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  className={`pb-slot-btn ${isSelected ? 'is-active' : ''}`}
                                  onClick={() => setSelectedSlot(slot)}
                                >
                                  <span className="pb-slot-time">{timeLabel}</span>
                                  <span className="pb-slot-room">{roomLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ========================================================
                    BƯỚC 3: THÔNG TIN NGƯỜI KHÁM (HỒ SƠ BỆNH NHÂN)
                   ======================================================== */}
                {currentStep === 3 && (
                  <div className="pb-step-card">
                    <div className="pb-step-header">
                      <h2 className="pb-step-heading">
                        <User size={22} color="#0b4f9c" />
                        Bước 3: Thông Tin Người Khám Bệnh
                      </h2>
                      <p className="pb-step-subtitle">
                        Thông tin được dùng để làm hồ sơ tiếp đón y tế và lưu trữ kết quả khám trực tuyến.
                      </p>
                    </div>

                    {/* TRƯỜNG HỢP A: KHÁCH VÃNG LAI (CHƯA ĐĂNG NHẬP) */}
                    {auth.status !== 'authenticated' && (
                      <div className="pb-guest-auth-card">
                        <div className="pb-guest-auth-tabs">
                          <button
                            type="button"
                            className={`pb-guest-auth-tab-btn ${authTab === 'login' ? 'is-active' : ''}`}
                            onClick={() => {
                              setAuthTab('login');
                              setAuthError(null);
                            }}
                          >
                            Đăng nhập tài khoản
                          </button>
                          <button
                            type="button"
                            className={`pb-guest-auth-tab-btn ${authTab === 'register' ? 'is-active' : ''}`}
                            onClick={() => {
                              setAuthTab('register');
                              setAuthError(null);
                            }}
                          >
                            Đăng ký tài khoản mới
                          </button>
                        </div>

                        {authError && (
                          <div
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '10px',
                              padding: '10px 14px',
                              marginBottom: '16px',
                              color: '#dc2626',
                              fontSize: '13px',
                            }}
                          >
                            {authError}
                          </div>
                        )}

                        <form onSubmit={handleQuickAuth}>
                          <div className="pb-form-grid">
                            <div className="pb-form-group">
                              <label className="pb-label">Email đăng nhập / Số điện thoại</label>
                              <input
                                type="text"
                                className="pb-input"
                                placeholder="ví dụ: demo.patient@antam.local"
                                value={authEmail}
                                onChange={(e) => setAuthEmail(e.target.value)}
                              />
                            </div>

                            <div className="pb-form-group">
                              <label className="pb-label">Mật khẩu</label>
                              <input
                                type="password"
                                className="pb-input"
                                placeholder="Tối thiểu 8 ký tự"
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                            <span style={{ fontSize: '13px', color: '#64748b' }}>
                              {authTab === 'login'
                                ? 'Tài khoản demo: demo.patient@antam.local / Demo@123456'
                                : 'Đăng ký nhanh để tự động liên kết hồ sơ bệnh án.'}
                            </span>

                            <button
                              type="submit"
                              className="pb-btn-primary"
                              style={{ width: 'auto', padding: '0 24px' }}
                              disabled={authSubmitting}
                            >
                              {authSubmitting
                                ? 'Đang xử lý...'
                                : authTab === 'login'
                                ? 'Đăng nhập & Tiếp tục'
                                : 'Tạo tài khoản & Tiếp tục'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* TRƯỜNG HỢP B: ĐÃ ĐĂNG NHẬP VÀ ĐÃ CÓ HỒ SƠ ĐẦY ĐỦ */}
                    {auth.status === 'authenticated' && profileStatus === 'complete' && (
                      <div>
                        <div className="pb-verified-profile-card">
                          <div className="pb-verified-header">
                            <span className="pb-verified-badge">
                              <ShieldCheck size={18} />
                              Hồ sơ bệnh nhân đã được xác thực
                            </span>
                            <span style={{ fontSize: '12.5px', color: '#166534', fontWeight: 600 }}>
                              Mã BN: {patientProfile?.id?.slice(0, 8).toUpperCase()}
                            </span>
                          </div>

                          <div className="pb-verified-grid">
                            <div className="pb-verified-item">
                              <span className="pb-verified-label">Họ và tên</span>
                              <span className="pb-verified-val">{patientProfile?.fullName}</span>
                            </div>

                            <div className="pb-verified-item">
                              <span className="pb-verified-label">Ngày sinh</span>
                              <span className="pb-verified-val">
                                {formatDateDisplay(patientProfile?.dateOfBirth)}
                              </span>
                            </div>

                            <div className="pb-verified-item">
                              <span className="pb-verified-label">Số điện thoại</span>
                              <span className="pb-verified-val">{patientProfile?.phoneNumber}</span>
                            </div>

                            <div className="pb-verified-item">
                              <span className="pb-verified-label">Số CCCD / Định danh</span>
                              <span className="pb-verified-val">
                                {patientProfile?.nationalIdMasked || 'Đã mã hóa an toàn'}
                              </span>
                            </div>

                            <div className="pb-verified-item" style={{ gridColumn: 'span 2' }}>
                              <span className="pb-verified-label">Địa chỉ cư trú</span>
                              <span className="pb-verified-val">{patientProfile?.address || 'Chưa cập nhật'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Triệu chứng / Lý do khám lâm sàng */}
                        <div className="pb-form-group" style={{ marginTop: '20px' }}>
                          <label className="pb-label">Lý do khám / Triệu chứng ban đầu (nếu có)</label>
                          <textarea
                            className="pb-textarea"
                            rows={3}
                            placeholder="Mô tả ngắn gọn tuần thai hiện tại hoặc triệu chứng khó chịu để bác sĩ chuẩn bị trước..."
                            value={clinicalNotes}
                            onChange={(e) => setClinicalNotes(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {/* TRƯỜNG HỢP C: ĐÃ ĐĂNG NHẬP NHƯNG LÀ TÀI KHOẢN MỚI CHƯA CÓ HỒ SƠ */}
                    {auth.status === 'authenticated' && profileStatus === 'incomplete' && (
                      <div>
                        <div className="pb-new-patient-alert">
                          <AlertCircle size={20} style={{ flexShrink: 0 }} />
                          <div>
                            <strong>Bạn đang dùng tài khoản mới:</strong> Vui lòng điền thông tin để Bệnh viện thiết lập hồ sơ
                            bệnh án điện tử và đồng bộ tiếp đón khi bạn đến khám.
                          </div>
                        </div>

                        <div className="pb-form-grid">
                          <div className="pb-form-group">
                            <label className="pb-label">
                              Họ và tên người khám <span className="required">*</span>
                            </label>
                            <input
                              type="text"
                              className={`pb-input ${formErrors.fullName ? 'has-error' : ''}`}
                              placeholder="Nhập họ và tên đầy đủ (IN HOA hoặc chữ thường)"
                              value={formFullName}
                              onChange={(e) => setFormFullName(e.target.value)}
                            />
                            {formErrors.fullName && <div className="pb-input-error">{formErrors.fullName}</div>}
                          </div>

                          <div className="pb-form-group">
                            <label className="pb-label">
                              Ngày sinh <span className="required">*</span>
                            </label>
                            <input
                              type="date"
                              className={`pb-input ${formErrors.dateOfBirth ? 'has-error' : ''}`}
                              value={formDateOfBirth}
                              onChange={(e) => setFormDateOfBirth(e.target.value)}
                            />
                            {formErrors.dateOfBirth && <div className="pb-input-error">{formErrors.dateOfBirth}</div>}
                          </div>

                          <div className="pb-form-group">
                            <label className="pb-label">
                              Số điện thoại nhận tin nhắn <span className="required">*</span>
                            </label>
                            <input
                              type="tel"
                              className={`pb-input ${formErrors.phoneNumber ? 'has-error' : ''}`}
                              placeholder="ví dụ: 0901234567"
                              value={formPhoneNumber}
                              onChange={(e) => setFormPhoneNumber(e.target.value)}
                            />
                            {formErrors.phoneNumber && <div className="pb-input-error">{formErrors.phoneNumber}</div>}
                          </div>

                          <div className="pb-form-group">
                            <label className="pb-label">
                              Số CCCD / Hộ chiếu <span className="required">*</span>
                            </label>
                            <input
                              type="text"
                              className={`pb-input ${formErrors.nationalId ? 'has-error' : ''}`}
                              placeholder="Số căn cước 12 chữ số"
                              value={formNationalId}
                              onChange={(e) => setFormNationalId(e.target.value)}
                            />
                            {formErrors.nationalId && <div className="pb-input-error">{formErrors.nationalId}</div>}
                          </div>

                          <div className="pb-form-group col-span-2">
                            <label className="pb-label">Địa chỉ nơi cư trú</label>
                            <input
                              type="text"
                              className="pb-input"
                              placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                              value={formAddress}
                              onChange={(e) => setFormAddress(e.target.value)}
                            />
                          </div>

                          <div className="pb-form-group col-span-2">
                            <label className="pb-label">Lý do khám / Triệu chứng lâm sàng</label>
                            <textarea
                              className="pb-textarea"
                              rows={3}
                              placeholder="Mô tả tuần thai hoặc triệu chứng khó chịu hiện tại..."
                              value={clinicalNotes}
                              onChange={(e) => setClinicalNotes(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================
                    BƯỚC 4: XÁC NHẬN VÀ KIỂM TRA PHIẾU KHÁM TRƯỚC KHI ĐẶT
                   ======================================================== */}
                {currentStep === 4 && (
                  <div className="pb-step-card">
                    <div className="pb-step-header">
                      <h2 className="pb-step-heading">
                        <FileText size={22} color="#0b4f9c" />
                        Bước 4: Kiểm Tra &amp; Xác Nhận Lịch Hẹn
                      </h2>
                      <p className="pb-step-subtitle">
                        Vui lòng rà soát lại thông tin trước khi hoàn tất đăng ký đặt lịch khám.
                      </p>
                    </div>

                    <div className="pb-confirm-review-table">
                      <div className="pb-review-row">
                        <span className="pb-review-label">Cơ sở khám</span>
                        <span className="pb-review-val">Bệnh viện Phụ sản Tâm An (Hà Nội)</span>
                      </div>

                      <div className="pb-review-row">
                        <span className="pb-review-label">Dịch vụ đăng ký</span>
                        <span className="pb-review-val highlight">{selectedService?.name}</span>
                      </div>

                      <div className="pb-review-row">
                        <span className="pb-review-label">Bác sĩ phụ trách</span>
                        <span className="pb-review-val">
                          {selectedDoctor
                            ? (selectedDoctor.profile as any)?.fullName || selectedDoctor.name
                            : 'Bác sĩ chuyên khoa Bệnh viện phân bổ'}
                        </span>
                      </div>

                      <div className="pb-review-row">
                        <span className="pb-review-label">Thời gian khám</span>
                        <span className="pb-review-val highlight">
                          {formatDateDisplay(selectedDate)} ({selectedSlot ? formatTimeRange(selectedSlot.startAt, selectedSlot.endAt) : ''})
                        </span>
                      </div>

                      <div className="pb-review-row">
                        <span className="pb-review-label">Phòng khám dự kiến</span>
                        <span className="pb-review-val">
                          {(selectedSlot as any)?.roomName || (selectedSlot as any)?.roomCode || 'Quầy tiếp đón Tầng 1 hướng dẫn'}
                        </span>
                      </div>

                      <div className="pb-review-row">
                        <span className="pb-review-label">Họ và tên người khám</span>
                        <span className="pb-review-val">{patientProfile?.fullName || formFullName}</span>
                      </div>

                      <div className="pb-review-row">
                        <span className="pb-review-label">Số điện thoại liên hệ</span>
                        <span className="pb-review-val">{patientProfile?.phoneNumber || formPhoneNumber}</span>
                      </div>

                      <div className="pb-review-row">
                        <span className="pb-review-label">Giá dịch vụ niêm yết</span>
                        <span className="pb-review-val" style={{ color: '#0b4f9c' }}>
                          {formatVnd((selectedService as any)?.price || (selectedService as any)?.basePrice?.amountMinor)}
                        </span>
                      </div>

                      {clinicalNotes.trim() && (
                        <div className="pb-review-row">
                          <span className="pb-review-label">Ghi chú lâm sàng</span>
                          <span className="pb-review-val" style={{ fontWeight: 500 }}>
                            {clinicalNotes}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pb-terms-notice">
                      <strong>Lưu ý quan trọng:</strong> Quý khách được miễn phí đổi lịch hoặc hủy lịch trước 24 giờ.
                      Khi đến viện, vui lòng xuất trình CCCD tại Quầy tiếp đón Tầng 1 để được cấp số thứ tự ưu tiên vào thẳng phòng
                      khám.
                    </div>
                  </div>
                )}
              </div>

              {/* CỘT PHẢI: BOOKING SUMMARY CARD (STICKY 390PX) */}
              <aside className="pb-summary-sidebar">
                <div className="pb-summary-card">
                  <div className="pb-summary-header">
                    <h3 className="pb-summary-title">Tóm Tắt Lịch Hẹn</h3>
                  </div>

                  <div className="pb-summary-body">
                    <div className="pb-summary-row">
                      <span className="pb-summary-row-label">Cơ sở khám chữa bệnh</span>
                      <span className="pb-summary-row-val">Bệnh viện Phụ sản Tâm An</span>
                    </div>

                    <div className="pb-summary-row">
                      <span className="pb-summary-row-label">Dịch vụ đã chọn</span>
                      <span className="pb-summary-row-val">
                        {selectedService ? selectedService.name : 'Chưa chọn dịch vụ'}
                      </span>
                    </div>

                    {selectedService && (
                      <div className="pb-summary-row">
                        <span className="pb-summary-row-label">Chuyên khoa</span>
                        <span className="pb-summary-row-val">
                          {specialties.find((s) => s.id === selectedService.specialtyId)?.name || 'Sản Phụ khoa'}
                        </span>
                      </div>
                    )}

                    <div className="pb-summary-row">
                      <span className="pb-summary-row-label">Bác sĩ khám</span>
                      <span className="pb-summary-row-val">
                        {selectedDoctor
                          ? (selectedDoctor.profile as any)?.fullName || selectedDoctor.name
                          : doctorMode === 'RANK'
                          ? 'Bệnh viện tự động sắp xếp'
                          : 'Chưa chọn bác sĩ'}
                      </span>
                    </div>

                    <div className="pb-summary-row">
                      <span className="pb-summary-row-label">Thời gian hẹn</span>
                      <span className="pb-summary-row-val">
                        {selectedDate
                          ? `${formatDateDisplay(selectedDate)} ${
                              selectedSlot ? `(${formatTimeRange(selectedSlot.startAt, selectedSlot.endAt)})` : ''
                            }`
                          : 'Chưa chọn thời gian'}
                      </span>
                    </div>

                    <div className="pb-summary-total-box">
                      <span className="pb-summary-total-label">Tổng tạm tính</span>
                      <span className="pb-summary-total-price">
                        {formatVnd((selectedService as any)?.price || (selectedService as any)?.basePrice?.amountMinor)}
                      </span>
                    </div>

                    <div className="pb-summary-actions">
                      <button
                        type="button"
                        className="pb-btn-primary"
                        onClick={handleNextStep}
                        disabled={
                          isSubmitting ||
                          (currentStep === 1 && !selectedServiceId) ||
                          (currentStep === 2 && !selectedSlot)
                        }
                      >
                        {isSubmitting ? (
                          'Đang xử lý...'
                        ) : currentStep === 4 ? (
                          <>
                            <Check size={18} /> Xác Nhận Đặt Lịch
                          </>
                        ) : (
                          <>
                            Tiếp tục <ArrowRight size={18} />
                          </>
                        )}
                      </button>

                      {currentStep > 1 && (
                        <button
                          type="button"
                          className="pb-btn-secondary"
                          onClick={handlePrevStep}
                          disabled={isSubmitting}
                        >
                          <ChevronLeft size={16} /> Quay lại bước trước
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hộp hỗ trợ trực tiếp */}
                <div className="pb-summary-hotline-card">
                  <div className="pb-hotline-icon">
                    <Phone size={20} />
                  </div>
                  <div className="pb-hotline-info">
                    <span className="pb-hotline-label">Cần hỗ trợ đặt lịch khẩn cấp?</span>
                    <a href="tel:19006868" className="pb-hotline-number">
                      1900 6868
                    </a>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      <PublicPortalFooter />
    </div>
  );
}
export default PatientBookingPage;
