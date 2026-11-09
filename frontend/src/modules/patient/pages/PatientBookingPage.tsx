import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  Edit2,
  FileText,
  Lock,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  SunMedium,
  User,
  X,
} from 'lucide-react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../../app/navigation';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { AppointmentTicketModal } from '../../../shared/components/portal/AppointmentTicketModal';
import {
  listCatalogServices,
  type CatalogService,
} from '../../../services/catalog';
import {
  listDoctors,
  listSpecialties,
  type Doctor,
  type Specialty,
} from '../../../services/doctor';
import {
  createAppointment,
  createSlotHold,
  idempotencyKey,
  listAppointments,
  listBookableSlots,
  type Appointment,
  type BookableSlot,
  type SelectionMode,
} from '../../../services/appointment';
import {
  getMyPatient,
  saveMyPatient,
  type PatientProfile,
} from '../../../services/patient';
import '../../../styles/patient-booking.css';

function getServicePrice(svc?: CatalogService | null): number {
  if (!svc) return 0;
  if (typeof (svc as any).price === 'number') return (svc as any).price;
  if ((svc as any).basePrice?.amountMinor != null)
    return Number((svc as any).basePrice.amountMinor);
  if (Array.isArray(svc.prices) && svc.prices.length > 0) {
    const active =
      svc.prices.find((p: any) => p.status === 'ACTIVE') || svc.prices[0];
    if (active?.amountMinor != null) return Number(active.amountMinor);
  }
  return 0;
}

function formatVnd(amountMinor?: number | null): string {
  if (amountMinor == null || amountMinor <= 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amountMinor);
}

function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  let p = phone.trim();
  if (p.startsWith('+84')) {
    p = '0' + p.slice(3);
  } else if (p.startsWith('84') && p.length >= 10) {
    p = '0' + p.slice(2);
  }
  return p;
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

/** Chỉ hiển thị giờ bắt đầu (VD: "07:30"), endAt vẫn gửi API nhưng không hiển thị */
function formatTimeRange(startIso: string, _endIso: string): string {
  const s = new Date(startIso);
  const sH = String(s.getHours()).padStart(2, '0');
  const sM = String(s.getMinutes()).padStart(2, '0');
  return `${sH}:${sM}`;
}

/** Map rank code → tên tiếng Việt ngắn gọn */
const RANK_LABEL: Record<string, string> = {
  BASIC: 'Bác sĩ',
  SPECIALIST_I: 'BS. CKI',
  SPECIALIST_II: 'BS. CKII',
  MASTER: 'ThS. BS',
  ASSOC_PROFESSOR: 'PGS. TS. BS',
  PROFESSOR: 'GS. TS. BS',
  EXPERT: 'Chuyên gia',
  HEAD_DOCTOR: 'Trưởng khoa',
};

const RANK_NAME: Record<string, string> = {
  BASIC: 'Bác sĩ Sản Phụ khoa',
  SPECIALIST_I: 'Bác sĩ Chuyên khoa I (CKI)',
  SPECIALIST_II: 'Bác sĩ Chuyên khoa II (CKII)',
  MASTER: 'Thạc sĩ Bác sĩ',
  ASSOC_PROFESSOR: 'Phó Giáo sư, Tiến sĩ Bác sĩ',
  PROFESSOR: 'Giáo sư, Tiến sĩ Bác sĩ',
  EXPERT: 'Bác sĩ Chuyên gia cao cấp',
  HEAD_DOCTOR: 'Bác sĩ Trưởng khoa',
};

/** Map rank code → phụ phí (đồng bộ với seed ACTIVE surcharges) */
const RANK_SURCHARGE: Record<string, number> = {
  BASIC: 0,
  SPECIALIST_I: 100000,
  SPECIALIST_II: 200000,
  MASTER: 150000,
  ASSOC_PROFESSOR: 350000,
  PROFESSOR: 500000,
  EXPERT: 400000,
  HEAD_DOCTOR: 250000,
};

const WEEKDAYS = [
  'Chủ nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

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

  // 2. State chính cho luồng 3 bước (Bước 4 là màn hình thành công)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Danh mục chuyên khoa, dịch vụ, bác sĩ
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // Lựa chọn ở Bước 1
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>(
    querySpecialtyId || 'all',
  );
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceId, setSelectedServiceId] =
    useState<string>(queryServiceId);
  const [servicePage, setServicePage] = useState<number>(1);
  const SERVICES_PER_PAGE = 6;
  const [isSpecialtyDropdownOpen, setIsSpecialtyDropdownOpen] = useState(false);
  const specialtyDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown chuyên khoa khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        specialtyDropdownRef.current &&
        !specialtyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSpecialtyDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Lựa chọn ở Bước 2
  const [doctorMode, setDoctorMode] = useState<SelectionMode>(
    queryDoctorId ? 'DOCTOR' : 'RANK',
  );
  const [selectedDoctorId, setSelectedDoctorId] =
    useState<string>(queryDoctorId);
  const [holdSecondsRemaining, setHoldSecondsRemaining] = useState<
    number | null
  >(null);
  const [holdExpired, setHoldExpired] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedSlot, setSelectedSlot] = useState<BookableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<BookableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [slotsRetry, setSlotsRetry] = useState(0);

  // Lựa chọn ở Bước 3: Hồ sơ bệnh nhân
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(
    null,
  );
  const [profileStatus, setProfileStatus] = useState<
    'loading' | 'complete' | 'incomplete'
  >('loading');

  // Form điền thông tin bệnh nhân (cho tài khoản mới hoặc khi cần sửa)
  const [formFullName, setFormFullName] = useState('');
  const [formDateOfBirth, setFormDateOfBirth] = useState('');
  const [formPhoneNumber, setFormPhoneNumber] = useState('');
  const [formNationalId, setFormNationalId] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Chế độ chỉnh sửa hồ sơ bệnh nhân trực tiếp ở Bước 3
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  function handleStartEditProfile() {
    if (patientProfile) {
      setEditFullName(patientProfile.fullName || '');
      setEditDateOfBirth(
        patientProfile.dateOfBirth
          ? patientProfile.dateOfBirth.slice(0, 10)
          : '',
      );
      setEditPhoneNumber(
        patientProfile.phoneNumber
          ? patientProfile.phoneNumber.replace(/^\+84/, '0')
          : '',
      );
      const plainNationalId =
        (patientProfile as any).nationalId ||
        (patientProfile.nationalIdMasked &&
        !patientProfile.nationalIdMasked.includes('*')
          ? patientProfile.nationalIdMasked
          : '') ||
        formNationalId ||
        '';
      setEditNationalId(plainNationalId);
      setEditAddress(patientProfile.address || '');
      setEditErrors({});
      setIsEditingProfile(true);
    }
  }

  async function handleSaveProfileEdit() {
    const errors: Record<string, string> = {};
    if (!editFullName.trim() || editFullName.trim().length < 2) {
      errors.fullName = 'Họ và tên tối thiểu 2 ký tự';
    }
    if (!editDateOfBirth) {
      errors.dateOfBirth = 'Vui lòng chọn ngày sinh';
    }
    const cleanPhone = editPhoneNumber.trim().replace(/^\+84/, '0');
    if (!/^0[35789]\d{8}$/.test(cleanPhone)) {
      errors.phoneNumber =
        'Số điện thoại không hợp lệ (10 số, đầu 03/05/07/08/09)';
    }
    const cleanNationalId = editNationalId.trim().replace(/[^0-9]/g, '');
    if (cleanNationalId && ![9, 12].includes(cleanNationalId.length)) {
      errors.nationalId = 'CCCD / CMND phải có 9 hoặc 12 số';
    }
    if (!editAddress.trim() || editAddress.trim().length < 6) {
      errors.address = 'Địa chỉ cư trú tối thiểu 6 ký tự';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setIsSavingEdit(true);
    try {
      const updated = (
        await auth.request<{ data: PatientProfile }>('/api/patients/me', {
          method: 'PUT',
          body: JSON.stringify({
            fullName: editFullName.trim(),
            dateOfBirth: editDateOfBirth,
            phoneNumber: cleanPhone,
            nationalId: cleanNationalId || undefined,
            address: editAddress.trim(),
            version: patientProfile?.version,
          }),
        })
      ).data;

      setPatientProfile(updated);
      setFormFullName(updated.fullName);
      setFormDateOfBirth(
        updated.dateOfBirth ? updated.dateOfBirth.slice(0, 10) : '',
      );
      setFormPhoneNumber(cleanPhone);
      setFormNationalId(cleanNationalId);
      setFormAddress(updated.address || '');
      setIsEditingProfile(false);

      if (auth.user?.userId) {
        try {
          localStorage.setItem(
            `patient_name_${auth.user.userId}`,
            updated.fullName,
          );
          if (auth.user.email) {
            localStorage.setItem(
              `patient_name_${auth.user.email}`,
              updated.fullName,
            );
          }
          window.dispatchEvent(
            new CustomEvent('patient_profile_updated', {
              detail: { fullName: updated.fullName },
            }),
          );
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setEditErrors({
        form: err.message || 'Không thể cập nhật hồ sơ. Vui lòng kiểm tra lại.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Khách vãng lai (Chưa đăng nhập) - Form đăng nhập/đăng ký tại chỗ
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Bước 4 & Đặt lịch
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] =
    useState<Appointment | null>(null);
  const [showSuccessTicketModal, setShowSuccessTicketModal] = useState(false);

  // Cuộn mượt khi chuyển bước
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    if (topAnchorRef.current) {
      topAnchorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
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
        (s: any) =>
          s.bookingEnabled !== false &&
          s.status !== 'INACTIVE' &&
          s.status !== 'ARCHIVED' &&
          s.status !== 'DRAFT',
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
        setFormPhoneNumber(formatPhoneNumber(p.phoneNumber) || '');
        setFormNationalId((p as any).nationalId || p.nationalIdMasked || '');
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
    return (
      doctors.find(
        (d: any) =>
          d.id === selectedDoctorId || d.doctorId === selectedDoctorId,
      ) || null
    );
  }, [doctors, selectedDoctorId, doctorMode]);

  // Phụ phí bác sĩ theo yêu cầu (nếu chọn chỉ định bác sĩ)
  const selectedDoctorSurcharge = useMemo(() => {
    if (doctorMode === 'RANK' || !selectedDoctor) return 0;
    const rankCode: string =
      (selectedDoctor as any).consultationRank ||
      (selectedDoctor as any).rank ||
      'BASIC';
    return RANK_SURCHARGE[rankCode] ?? 0;
  }, [doctorMode, selectedDoctor]);

  // Tổng chi phí tạm tính (Giá dịch vụ + Phụ phí nếu có)
  const totalEstimatedPrice = useMemo(() => {
    const servicePrice = getServicePrice(selectedService);
    return servicePrice + selectedDoctorSurcharge;
  }, [selectedService, selectedDoctorSurcharge]);

  // Danh sách 14 ngày tới để chọn lịch
  const dateOptions = useMemo(() => {
    const list: Array<{ dateStr: string; dayName: string; formatted: string }> =
      [];
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
    if (
      !selectedServiceId ||
      !selectedDate ||
      (doctorMode === 'DOCTOR' && !selectedDoctorId)
    ) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      setLoadingSlots(false);
      setSlotsError(false);
      return;
    }

    let active = true;
    setLoadingSlots(true);
    setSlotsError(false);
    setSelectedSlot(null);

    const from = `${selectedDate}T00:00:00+07:00`;
    const to = `${selectedDate}T23:59:59+07:00`;

    listBookableSlots(auth.request, {
      serviceId: selectedServiceId,
      selectionMode: doctorMode,
      from,
      to,
      requestedDoctorId:
        doctorMode === 'DOCTOR' ? selectedDoctorId || undefined : undefined,
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
        setSlotsError(true);
        setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [
    auth.request,
    selectedServiceId,
    doctorMode,
    selectedDoctorId,
    selectedDate,
    slotsRetry,
  ]);

  // Đếm ngược 5 phút (300 giây) khi chọn slot
  useEffect(() => {
    if (!selectedSlot || holdSecondsRemaining === null) return;
    if (holdSecondsRemaining <= 0) {
      setHoldExpired(true);
      return;
    }
    const timer = setInterval(() => {
      setHoldSecondsRemaining((prev) =>
        prev !== null && prev > 0 ? prev - 1 : 0,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedSlot, holdSecondsRemaining]);

  const formattedHoldTimer = useMemo(() => {
    if (holdSecondsRemaining === null || holdSecondsRemaining <= 0) return null;
    const m = Math.floor(holdSecondsRemaining / 60);
    const s = holdSecondsRemaining % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [holdSecondsRemaining]);

  // Phân chia khung giờ Sáng / Chiều
  const morningSlots = useMemo(() => {
    return availableSlots.filter((slot) => {
      const d = new Date(slot.startAt);
      const hours = d.getHours();
      return hours < 12;
    });
  }, [availableSlots]);

  const afternoonSlots = useMemo(() => {
    return availableSlots.filter((slot) => {
      const d = new Date(slot.startAt);
      const hours = d.getHours();
      return hours >= 12;
    });
  }, [availableSlots]);

  const handleSelectSlot = (slot: BookableSlot) => {
    setSelectedSlot(slot);
    setHoldSecondsRemaining(300); // 5 phút
    setHoldExpired(false);
    setSubmitError(null);
  };

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
        const descMatch = (svc.summary || svc.description || '')
          .toLowerCase()
          .includes(query);
        if (!nameMatch && !descMatch) return false;
      }
      return true;
    });
  }, [services, selectedSpecialtyId, serviceSearch]);

  // Tên và số lượng dịch vụ của chuyên khoa đang chọn
  const currentSpecialtyName = useMemo(() => {
    if (selectedSpecialtyId === 'all') return 'Tất cả chuyên khoa';
    const found = specialties.find((s) => s.id === selectedSpecialtyId);
    return found?.name || 'Tất cả chuyên khoa';
  }, [selectedSpecialtyId, specialties]);

  const currentSpecialtyCount = useMemo(() => {
    if (selectedSpecialtyId === 'all') return services.length;
    return services.filter((s) => s.specialtyId === selectedSpecialtyId).length;
  }, [selectedSpecialtyId, services]);

  // Reset về trang 1 khi thay đổi chuyên khoa hoặc từ khóa tìm kiếm
  useEffect(() => {
    setServicePage(1);
  }, [selectedSpecialtyId, serviceSearch]);

  const totalServicePages = Math.max(
    1,
    Math.ceil(filteredServices.length / SERVICES_PER_PAGE),
  );

  // Tự động chuyển tới trang chứa dịch vụ đang chọn nếu có
  useEffect(() => {
    if (!selectedServiceId || filteredServices.length === 0) return;
    const idx = filteredServices.findIndex((s) => s.id === selectedServiceId);
    if (idx !== -1) {
      const targetPage = Math.floor(idx / SERVICES_PER_PAGE) + 1;
      setServicePage(targetPage);
    }
  }, [selectedServiceId, filteredServices]);

  const paginatedServices = useMemo(() => {
    const start = (servicePage - 1) * SERVICES_PER_PAGE;
    return filteredServices.slice(start, start + SERVICES_PER_PAGE);
  }, [filteredServices, servicePage]);

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
      setAuthError(
        err.message || 'Xác thực tài khoản thất bại. Vui lòng kiểm tra lại.',
      );
      setAuthSubmitting(false);
    }
  };

  // Validate form bệnh nhân khi ở trạng thái tạo mới hồ sơ
  const validatePatientForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formFullName.trim())
      errors.fullName = 'Vui lòng nhập họ và tên đầy đủ.';
    if (!formDateOfBirth.trim())
      errors.dateOfBirth = 'Vui lòng chọn ngày sinh.';
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

  // Chuyển từ Bước 1 -> Bước 2
  const handleNextToStep2 = () => {
    if (!selectedServiceId) {
      setSubmitError('Vui lòng chọn một dịch vụ y tế để tiếp tục.');
      return;
    }
    setSubmitError(null);
    setCurrentStep(2);
    scrollToTop();
  };

  // Chuyển từ Bước 2 -> Bước 3
  const handleNextToStep3 = () => {
    if (!selectedSlot) {
      setSubmitError('Vui lòng chọn một khung giờ khám còn trống.');
      return;
    }
    if (holdExpired) {
      setSubmitError(
        'Thời gian giữ chỗ 5 phút đã hết hạn. Vui lòng chọn lại khung giờ khám.',
      );
      return;
    }
    setSubmitError(null);
    setCurrentStep(3);
    scrollToTop();
  };

  // Quay lại bước trước
  const handlePrevStep = () => {
    setSubmitError(null);
    if (currentStep === 2) {
      setCurrentStep(1);
      scrollToTop();
    } else if (currentStep === 3) {
      setCurrentStep(2);
      scrollToTop();
    }
  };

  // Tại Bước 3: Xác nhận thông tin và Tạo lịch hẹn trực tiếp
  const handleConfirmBooking = async () => {
    setSubmitError(null);

    if (auth.status !== 'authenticated') {
      setSubmitError(
        'Vui lòng đăng nhập hoặc đăng ký tài khoản để bảo mật và lưu phiếu khám.',
      );
      return;
    }

    // Nếu tài khoản mới chưa có hồ sơ, kiểm tra form và lưu hồ sơ ngay
    if (profileStatus === 'incomplete') {
      const isValid = validatePatientForm();
      if (!isValid) {
        setSubmitError(
          'Vui lòng điền đầy đủ và chính xác các thông tin người khám bắt buộc (*).',
        );
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
          (auth as any).user?.accessToken || '',
        );
        setPatientProfile(savedProfile);
        setProfileStatus('complete');
      } catch (err: any) {
        setIsSubmitting(false);
        setSubmitError(
          err.message ||
            'Không thể lưu hồ sơ bệnh nhân. Vui lòng kiểm tra lại số CCCD/SĐT.',
        );
        return;
      }
    }

    if (!selectedService || !selectedSlot) {
      setSubmitError(
        'Thông tin đặt lịch không đầy đủ. Vui lòng quay lại kiểm tra.',
      );
      setIsSubmitting(false);
      return;
    }

    if (holdExpired) {
      setSubmitError(
        'Thời gian giữ chỗ 5 phút đã hết hạn. Vui lòng quay lại bước 2 chọn lại khung giờ.',
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    try {
      // Bước A: Tạo Slot Hold (giữ chỗ 5 phút)
      const holdSelectionMode = selectedSlot.selectionMode || doctorMode;
      const hold = await createSlotHold(auth.request, {
        serviceId: selectedService.id!,
        selectionMode: holdSelectionMode,
        requestedDoctorId:
          holdSelectionMode === 'DOCTOR'
            ? selectedSlot.doctorId ||
              (doctorMode === 'DOCTOR' ? selectedDoctorId : undefined)
            : undefined,
        requestedRankCode:
          holdSelectionMode === 'RANK'
            ? selectedSlot.rankCode ||
              (doctorMode === 'RANK' ? 'BASIC' : undefined)
            : undefined,
        startAt: selectedSlot.startAt,
        endAt: selectedSlot.endAt,
      });

      if (!hold || !hold.id) {
        throw new Error(
          'Khung giờ này vừa có người giữ chỗ. Vui lòng chọn khung giờ khác.',
        );
      }

      // Bước B: Chuyển Hold thành Lịch hẹn chính thức (BookingChannel: ONLINE)
      const appointment = await createAppointment(auth.request, hold.id);

      setCreatedAppointment(appointment);
      setShowSuccessTicketModal(true); // Hiển thị popup modal phiếu hẹn ngay lập tức
      setIsSubmitting(false);
    } catch (err: any) {
      setIsSubmitting(false);
      setSubmitError(
        err.message ||
          'Không thể tạo lịch hẹn. Vui lòng thử lại hoặc chọn khung giờ khác.',
      );
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
              <h1 className="pb-hero-title">
                Đăng Ký Đặt Lịch Khám Trực Tuyến
              </h1>
              <p className="pb-hero-desc">
                Chủ động lựa chọn dịch vụ, bác sĩ chuyên khoa và khung giờ khám
                thuận tiện nhất. Hệ thống tiếp đón ưu tiên không cần bốc số xếp
                hàng tại bệnh viện.
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
                <CheckCircle2 size={16} color="#4ade80" /> Bảo mật thông tin y
                tế
              </span>
            </div>
          </section>

          {/* Stepper Progress Bar (Chỉ hiện khi chưa hoàn tất đặt lịch) */}
          {currentStep < 4 && (
            <div className="pb-stepper-card">
              <ol className="pb-stepper-list">
                {/* Bước 1 */}
                <li
                  className={`pb-stepper-step ${currentStep === 1 ? 'is-active' : ''} ${currentStep > 1 ? 'is-done' : ''}`}
                  onClick={() => {
                    if (currentStep > 1) setCurrentStep(1);
                  }}
                >
                  <div className="pb-stepper-number">
                    {currentStep > 1 ? <Check size={16} /> : 1}
                  </div>
                  <div className="pb-stepper-info">
                    <span className="pb-stepper-step-title">Dịch vụ khám</span>
                    <span className="pb-stepper-step-sub">
                      Chọn gói / chuyên khoa
                    </span>
                  </div>
                </li>

                <div
                  className={`pb-stepper-divider ${currentStep > 1 ? 'is-done' : ''}`}
                />

                {/* Bước 2 */}
                <li
                  className={`pb-stepper-step ${currentStep === 2 ? 'is-active' : ''} ${currentStep > 2 ? 'is-done' : ''} ${currentStep < 2 ? 'is-disabled' : ''}`}
                  onClick={() => {
                    if (currentStep > 2) setCurrentStep(2);
                  }}
                >
                  <div className="pb-stepper-number">
                    {currentStep > 2 ? <Check size={16} /> : 2}
                  </div>
                  <div className="pb-stepper-info">
                    <span className="pb-stepper-step-title">
                      Bác sĩ &amp; Thời gian
                    </span>
                    <span className="pb-stepper-step-sub">
                      Chọn ngày và khung giờ
                    </span>
                  </div>
                </li>

                <div
                  className={`pb-stepper-divider ${currentStep > 2 ? 'is-done' : ''}`}
                />

                {/* Bước 3 */}
                <li
                  className={`pb-stepper-step ${currentStep === 3 ? 'is-active' : ''} ${currentStep < 3 ? 'is-disabled' : ''}`}
                >
                  <div className="pb-stepper-number">3</div>
                  <div className="pb-stepper-info">
                    <span className="pb-stepper-step-title">
                      Thông tin &amp; Xác nhận
                    </span>
                    <span className="pb-stepper-step-sub">
                      Hồ sơ người khám &amp; Phiếu hẹn
                    </span>
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

          {/* ========================================================
              BƯỚC 1 & BƯỚC 2: BỐ CỤC 2 CỘT (FORM NỘI DUNG + SIDEBAR TÓM TẮT PHẢI)
             ======================================================== */}
          {(currentStep === 1 || currentStep === 2) && (
            <div className="pb-layout-grid">
              {/* CỘT TRÁI: FORM THEO TỪNG BƯỚC */}
              <div className="pb-step-content-col">
                {/* ========================================================
                    BƯỚC 1: CHỌN CHUYÊN KHOA VÀ DỊCH VỤ Y TẾ
                   ======================================================== */}
                {currentStep === 1 && (
                  <div className="pb-step-card">
                    <div className="pb-step-header">
                      <div className="pb-step-header-title-row">
                        <h2 className="pb-step-heading">
                          <Stethoscope size={22} color="#0b4f9c" />
                          Bước 1: Chọn Chuyên Khoa &amp; Dịch Vụ Khám
                        </h2>
                        <span className="pb-step-count-badge">
                          {filteredServices.length} dịch vụ khả dụng
                        </span>
                      </div>
                      <p className="pb-step-subtitle">
                        Vui lòng lựa chọn chuyên khoa và dịch vụ khám phù hợp
                        theo nhu cầu của bạn.
                      </p>
                    </div>

                    {/* Bộ lọc Bước 1: Dropdown Chuyên khoa & Ô Tìm kiếm dịch vụ */}
                    <div className="pb-filter-controls">
                      {/* Dropdown Menu Chuyên khoa */}
                      <div
                        className="pb-specialty-dropdown-container"
                        ref={specialtyDropdownRef}
                      >
                        <label
                          className="pb-filter-label"
                          htmlFor="pb-specialty-select-btn"
                        >
                          Chuyên khoa khám:
                        </label>
                        <button
                          id="pb-specialty-select-btn"
                          type="button"
                          className={`pb-specialty-dropdown-btn ${isSpecialtyDropdownOpen ? 'is-active' : ''}`}
                          onClick={() =>
                            setIsSpecialtyDropdownOpen((prev) => !prev)
                          }
                          aria-expanded={isSpecialtyDropdownOpen}
                          aria-haspopup="listbox"
                        >
                          <div className="pb-dropdown-btn-left">
                            <Stethoscope
                              size={17}
                              className="pb-dropdown-icon"
                            />
                            <span className="pb-dropdown-label">
                              {currentSpecialtyName}
                            </span>
                            <span className="pb-dropdown-count">
                              ({currentSpecialtyCount})
                            </span>
                          </div>
                          <ChevronDown
                            size={18}
                            className={`pb-dropdown-chevron ${isSpecialtyDropdownOpen ? 'is-open' : ''}`}
                          />
                        </button>

                        {isSpecialtyDropdownOpen && (
                          <div
                            className="pb-specialty-dropdown-menu"
                            role="listbox"
                          >
                            <button
                              type="button"
                              role="option"
                              aria-selected={selectedSpecialtyId === 'all'}
                              className={`pb-specialty-dropdown-item ${selectedSpecialtyId === 'all' ? 'is-selected' : ''}`}
                              onClick={() => {
                                setSelectedSpecialtyId('all');
                                setIsSpecialtyDropdownOpen(false);
                              }}
                            >
                              <div className="pb-item-info">
                                <span className="pb-item-name">
                                  Tất cả chuyên khoa
                                </span>
                                <span className="pb-item-badge">
                                  {services.length} dịch vụ
                                </span>
                              </div>
                              {selectedSpecialtyId === 'all' && (
                                <Check size={16} className="pb-item-check" />
                              )}
                            </button>
                            <div className="pb-dropdown-divider" />
                            {specialties.map((spec) => {
                              const count = services.filter(
                                (s) => s.specialtyId === spec.id,
                              ).length;
                              const isSelected =
                                selectedSpecialtyId === spec.id;
                              return (
                                <button
                                  key={spec.id}
                                  type="button"
                                  role="option"
                                  aria-selected={isSelected}
                                  className={`pb-specialty-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                                  onClick={() => {
                                    setSelectedSpecialtyId(spec.id!);
                                    setIsSpecialtyDropdownOpen(false);
                                  }}
                                >
                                  <div className="pb-item-info">
                                    <span className="pb-item-name">
                                      {spec.name}
                                    </span>
                                    <span className="pb-item-badge">
                                      {count} dịch vụ
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <Check
                                      size={16}
                                      className="pb-item-check"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Ô Tìm kiếm Dịch vụ */}
                      <div className="pb-search-container">
                        <label
                          className="pb-filter-label"
                          htmlFor="pb-service-search-input"
                        >
                          Tìm kiếm dịch vụ:
                        </label>
                        <div className="pb-search-box">
                          <Search size={16} className="pb-search-icon" />
                          <input
                            id="pb-service-search-input"
                            type="text"
                            className="pb-search-input"
                            placeholder="Tìm tên gói khám, dịch vụ, xét nghiệm..."
                            value={serviceSearch}
                            onChange={(e) => setServiceSearch(e.target.value)}
                          />
                          {serviceSearch && (
                            <button
                              type="button"
                              className="pb-search-clear-btn"
                              onClick={() => setServiceSearch('')}
                              aria-label="Xóa tìm kiếm"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dải thông tin chuyên khoa đang lọc */}
                    {selectedSpecialtyId !== 'all' && (
                      <div className="pb-active-spec-banner">
                        <span>
                          Đang lọc theo: <strong>{currentSpecialtyName}</strong>{' '}
                          ({filteredServices.length} dịch vụ)
                        </span>
                        <button
                          type="button"
                          className="pb-clear-spec-pill"
                          onClick={() => setSelectedSpecialtyId('all')}
                        >
                          Hiển thị tất cả chuyên khoa <X size={13} />
                        </button>
                      </div>
                    )}

                    {/* Danh sách thẻ dịch vụ dạng 2 cột gọn gàng (6 dịch vụ / trang) */}
                    {loadingInitial ? (
                      <div className="pb-empty-state">
                        Đang tải danh mục dịch vụ y tế...
                      </div>
                    ) : filteredServices.length === 0 ? (
                      <div className="pb-empty-state">
                        <p>
                          Không tìm thấy dịch vụ nào phù hợp với bộ lọc hiện
                          tại.
                        </p>
                        {(serviceSearch || selectedSpecialtyId !== 'all') && (
                          <button
                            type="button"
                            className="pb-reset-filter-btn"
                            onClick={() => {
                              setServiceSearch('');
                              setSelectedSpecialtyId('all');
                            }}
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="pb-service-grid">
                          {paginatedServices.map((svc) => {
                            const isSelected = selectedServiceId === svc.id;
                            const priceVal = getServicePrice(svc);
                            const specObj = specialties.find(
                              (s) => s.id === svc.specialtyId,
                            );

                            return (
                              <div
                                key={svc.id}
                                className={`pb-service-card ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => setSelectedServiceId(svc.id!)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedServiceId(svc.id!);
                                  }
                                }}
                              >
                                <div className="pb-service-card-top">
                                  <div className="pb-service-radio">
                                    <div className="pb-service-radio-dot" />
                                  </div>
                                  <div className="pb-service-badges">
                                    <span className="pb-service-spec-badge">
                                      {specObj?.name || 'Sản Phụ khoa'}
                                    </span>
                                  </div>
                                </div>

                                <div className="pb-service-card-content">
                                  <h3
                                    className="pb-service-card-name"
                                    title={svc.name}
                                  >
                                    {svc.name}
                                  </h3>
                                  <p className="pb-service-card-desc">
                                    {svc.summary ||
                                      svc.description ||
                                      'Dịch vụ y tế chuyên khoa chuẩn chất lượng cao.'}
                                  </p>
                                </div>

                                <div className="pb-service-card-footer">
                                  <div className="pb-service-price-block">
                                    <span className="pb-service-price-amount">
                                      {formatVnd(priceVal)}
                                    </span>
                                    <span className="pb-service-price-note">
                                      Giá niêm yết
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <span className="pb-service-selected-pill">
                                      <Check size={13} /> Đã chọn
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Phân trang 6 dịch vụ / trang */}
                        {totalServicePages > 1 && (
                          <div className="pb-pagination">
                            <span className="pb-pagination-info">
                              Trang {servicePage}/{totalServicePages} (
                              {(servicePage - 1) * SERVICES_PER_PAGE + 1} -{' '}
                              {Math.min(
                                servicePage * SERVICES_PER_PAGE,
                                filteredServices.length,
                              )}{' '}
                              trong {filteredServices.length} dịch vụ)
                            </span>
                            <div className="pb-pagination-pages">
                              <button
                                type="button"
                                className="pb-page-btn"
                                disabled={servicePage === 1}
                                onClick={() =>
                                  setServicePage((p) => Math.max(1, p - 1))
                                }
                                aria-label="Trang trước"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              {Array.from(
                                { length: totalServicePages },
                                (_, i) => i + 1,
                              ).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  className={`pb-page-number ${servicePage === p ? 'is-active' : ''}`}
                                  onClick={() => setServicePage(p)}
                                >
                                  {p}
                                </button>
                              ))}
                              <button
                                type="button"
                                className="pb-page-btn"
                                disabled={servicePage === totalServicePages}
                                onClick={() =>
                                  setServicePage((p) =>
                                    Math.min(totalServicePages, p + 1),
                                  )
                                }
                                aria-label="Trang sau"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
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
                        Đang đặt lịch cho dịch vụ:{' '}
                        <strong>{selectedService?.name}</strong>
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
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <h4 className="pb-mode-title" style={{ margin: 0 }}>
                              Bệnh viện tự động sắp xếp
                            </h4>
                            <span className="pb-zero-surcharge-badge">
                              Phụ phí 0 ₫
                            </span>
                          </div>
                          <p className="pb-mode-desc">
                            Bác sĩ chuyên khoa tiêu chuẩn của bệnh viện, không
                            phụ phí.
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
                          <h4 className="pb-mode-title">
                            Chỉ định Bác sĩ theo yêu cầu
                          </h4>
                          <p className="pb-mode-desc">
                            Tự do lựa chọn Bác sĩ Trưởng khoa hoặc Chuyên gia cố
                            vấn bạn mong muốn.
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
                          {!loadingInitial &&
                            eligibleDoctorsForService.length === 0 && (
                              <p>
                                Chưa tải được bác sĩ phù hợp. Vui lòng thử lại
                                hoặc chọn chế độ bệnh viện tự sắp xếp.
                              </p>
                            )}
                          {eligibleDoctorsForService.map((doc: any) => {
                            const isSelected =
                              selectedDoctorId === (doc.id || doc.doctorId);
                            const profile = doc.profile || {};
                            const docName =
                              profile.fullName ||
                              doc.name ||
                              'Bác sĩ chuyên khoa';
                            const rankCode: string =
                              doc.consultationRank || doc.rank || 'BASIC';
                            const rankFullName =
                              doc.consultationRankInfo?.name ||
                              RANK_NAME[rankCode] ||
                              'Bác sĩ chuyên khoa';
                            const docPhoto =
                              profile.photoUrl ||
                              'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80';
                            const surcharge = RANK_SURCHARGE[rankCode] ?? 0;
                            const docSpecialties: any[] = Array.isArray(
                              doc.specialties,
                            )
                              ? doc.specialties
                              : [];
                            const sortedSpecialties = [...docSpecialties].sort(
                              (a, b) => {
                                const aPri =
                                  a.isPrimary || a.is_primary ? 1 : 0;
                                const bPri =
                                  b.isPrimary || b.is_primary ? 1 : 0;
                                return bPri - aPri;
                              },
                            );

                            return (
                              <div
                                key={doc.id || doc.doctorId}
                                className={`pb-doctor-item-card ${isSelected ? 'is-selected' : ''}`}
                                onClick={() =>
                                  setSelectedDoctorId(doc.id || doc.doctorId)
                                }
                              >
                                <img
                                  src={docPhoto}
                                  alt={docName}
                                  className="pb-doctor-thumb"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src =
                                      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80';
                                  }}
                                />
                                <div className="pb-doctor-info">
                                  <h5 className="pb-doctor-name">{docName}</h5>
                                  <div className="pb-doctor-rank-label">
                                    {rankFullName}
                                  </div>

                                  <div className="pb-doctor-specs-wrap">
                                    {sortedSpecialties.length > 0 ? (
                                      sortedSpecialties.map(
                                        (spec: any, idx: number) => {
                                          const isPrimary = Boolean(
                                            spec.isPrimary || spec.is_primary,
                                          );
                                          return (
                                            <span
                                              key={spec.id || idx}
                                              className={`pb-doctor-spec-chip ${isPrimary ? 'is-primary' : 'is-secondary'}`}
                                              title={
                                                isPrimary
                                                  ? `Chuyên khoa chính: ${spec.name}`
                                                  : `Chuyên khoa phối hợp: ${spec.name}`
                                              }
                                            >
                                              <span className="pb-spec-chip-name">
                                                {spec.name}
                                              </span>
                                            </span>
                                          );
                                        },
                                      )
                                    ) : (
                                      <span className="pb-doctor-spec-chip is-secondary">
                                        <span className="pb-spec-chip-name">
                                          Đa khoa
                                        </span>
                                      </span>
                                    )}
                                  </div>

                                  {surcharge > 0 ? (
                                    <span className="pb-doctor-surcharge">
                                      +{formatVnd(surcharge)} phụ phí hạng
                                    </span>
                                  ) : (
                                    <span className="pb-doctor-surcharge is-free">
                                      Không phụ phí
                                    </span>
                                  )}
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
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        14 ngày khả dụng tiếp theo
                      </span>
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
                            <span className="pb-date-chip-day">
                              {item.dayName}
                            </span>
                            <span className="pb-date-chip-date">
                              {item.formatted}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3. Khung giờ khám khả dụng */}
                    {/* 3. Khung giờ khám khả dụng */}
                    <div className="pb-slots-container">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <h4 className="pb-subheading-text">
                          <Clock size={18} color="#0b4f9c" />
                          Chọn khung giờ khám ngày{' '}
                          {formatDateDisplay(selectedDate)}
                        </h4>
                        {doctorMode === 'RANK' && (
                          <span
                            style={{
                              fontSize: '12.5px',
                              color: '#16a34a',
                              fontWeight: 700,
                            }}
                          >
                            ● Lọc bác sĩ tiêu chuẩn (Phụ phí 0 ₫)
                          </span>
                        )}
                      </div>

                      {doctorMode === 'DOCTOR' && !selectedDoctorId ? (
                        <div className="pb-slots-empty">
                          Vui lòng chọn bác sĩ trước để xem lịch khám.
                        </div>
                      ) : loadingSlots ? (
                        <div
                          style={{
                            padding: '30px 0',
                            textAlign: 'center',
                            color: '#64748b',
                          }}
                        >
                          Đang kiểm tra lịch trống của bác sĩ...
                        </div>
                      ) : slotsError ? (
                        <div className="pb-slots-empty" role="alert">
                          Không thể tải lịch khám lúc này.{' '}
                          <button
                            type="button"
                            onClick={() => setSlotsRetry((value) => value + 1)}
                          >
                            Thử lại
                          </button>
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <div className="pb-slots-empty">
                          Chưa có khung giờ phù hợp trong ngày{' '}
                          {formatDateDisplay(selectedDate)}. Vui lòng chọn ngày
                          khác hoặc thay đổi lựa chọn bác sĩ.
                        </div>
                      ) : (
                        <div style={{ marginTop: '14px' }}>
                          {/* Ca Sáng */}
                          {morningSlots.length > 0 && (
                            <div style={{ marginBottom: '18px' }}>
                              <h5 className="pb-shift-header">
                                <Sun size={15} color="#eab308" />
                                Ca Sáng (07:30 - 11:30)
                              </h5>
                              <div className="pb-slots-grid">
                                {morningSlots.map((slot, idx) => {
                                  const isSelected =
                                    selectedSlot?.startAt === slot.startAt &&
                                    selectedSlot?.endAt === slot.endAt;
                                  const isAvailable =
                                    (slot as any).isAvailable !== false &&
                                    ((slot as any).availableCapacity ?? 1) > 0;
                                  const timeLabel = formatTimeRange(
                                    slot.startAt,
                                    slot.endAt,
                                  );

                                  return (
                                    <button
                                      key={'m-' + idx}
                                      type="button"
                                      disabled={!isAvailable}
                                      className={`pb-slot-btn ${isSelected ? 'is-active' : ''} ${!isAvailable ? 'is-disabled' : ''}`}
                                      onClick={() =>
                                        isAvailable && handleSelectSlot(slot)
                                      }
                                      title={
                                        !isAvailable
                                          ? 'Khung giờ này đã có người đặt'
                                          : `Chọn khung giờ ${timeLabel}`
                                      }
                                    >
                                      <span className="pb-slot-time">
                                        {timeLabel}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Ca Chiều */}
                          {afternoonSlots.length > 0 && (
                            <div style={{ marginBottom: '18px' }}>
                              <h5 className="pb-shift-header">
                                <SunMedium size={15} color="#f97316" />
                                Ca Chiều (13:30 - 17:30)
                              </h5>
                              <div className="pb-slots-grid">
                                {afternoonSlots.map((slot, idx) => {
                                  const isSelected =
                                    selectedSlot?.startAt === slot.startAt &&
                                    selectedSlot?.endAt === slot.endAt;
                                  const isAvailable =
                                    (slot as any).isAvailable !== false &&
                                    ((slot as any).availableCapacity ?? 1) > 0;
                                  const timeLabel = formatTimeRange(
                                    slot.startAt,
                                    slot.endAt,
                                  );

                                  return (
                                    <button
                                      key={'a-' + idx}
                                      type="button"
                                      disabled={!isAvailable}
                                      className={`pb-slot-btn ${isSelected ? 'is-active' : ''} ${!isAvailable ? 'is-disabled' : ''}`}
                                      onClick={() =>
                                        isAvailable && handleSelectSlot(slot)
                                      }
                                      title={
                                        !isAvailable
                                          ? 'Khung giờ này đã có người đặt'
                                          : `Chọn khung giờ ${timeLabel}`
                                      }
                                    >
                                      <span className="pb-slot-time">
                                        {timeLabel}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CỘT PHẢI: BOOKING SUMMARY SIDEBAR CHO BƯỚC 1 & 2 */}
              <aside className="pb-summary-sidebar">
                <div className="pb-summary-card">
                  <div className="pb-summary-header">
                    <h3 className="pb-summary-title">Tóm Tắt Lịch Hẹn</h3>
                  </div>

                  <div className="pb-summary-body">
                    {/* 1. Cơ sở khám chữa bệnh */}
                    <div className="pb-summary-row">
                      <span className="pb-summary-row-label">
                        Cơ sở khám chữa bệnh
                      </span>
                      <span className="pb-summary-row-val">
                        Bệnh viện Phụ sản Tâm An
                      </span>
                    </div>

                    {/* 2. Chuyên khoa */}
                    {(selectedSpecialtyId !== 'all' || selectedService) && (
                      <div className="pb-summary-row">
                        <span className="pb-summary-row-label">
                          Chuyên khoa
                        </span>
                        <span className="pb-summary-row-val">
                          {selectedService
                            ? specialties.find(
                                (s) => s.id === selectedService.specialtyId,
                              )?.name || 'Sản Phụ khoa'
                            : currentSpecialtyName}
                        </span>
                      </div>
                    )}

                    {/* 3. Dịch vụ đã chọn */}
                    {selectedService && (
                      <div className="pb-summary-row">
                        <span className="pb-summary-row-label">
                          Dịch vụ đã chọn
                        </span>
                        <span
                          className="pb-summary-row-val"
                          style={{ color: '#0b4f9c' }}
                        >
                          {selectedService.name}
                        </span>
                      </div>
                    )}

                    {/* 4. Bác sĩ khám (ở Bước 2) */}
                    {currentStep === 2 && (
                      <div className="pb-summary-row">
                        <span className="pb-summary-row-label">
                          Bác sĩ khám
                        </span>
                        <span className="pb-summary-row-val">
                          {doctorMode === 'DOCTOR'
                            ? selectedDoctor
                              ? (selectedDoctor.profile as any)?.fullName ||
                                selectedDoctor.name
                              : 'Chưa chọn bác sĩ'
                            : 'Bệnh viện tự động sắp xếp'}
                        </span>
                      </div>
                    )}

                    {/* 5. Thời gian hẹn (ở Bước 2) */}
                    {currentStep === 2 && selectedDate && selectedSlot && (
                      <div className="pb-summary-row">
                        <span className="pb-summary-row-label">
                          Thời gian hẹn
                        </span>
                        <span className="pb-summary-row-val">
                          {formatDateDisplay(selectedDate)} (
                          {formatTimeRange(
                            selectedSlot.startAt,
                            selectedSlot.endAt,
                          )}
                          )
                        </span>
                      </div>
                    )}

                    {/* Lời nhắc khi chưa chọn dịch vụ */}
                    {!selectedService && selectedSpecialtyId === 'all' && (
                      <div className="pb-summary-empty-hint">
                        Vui lòng lựa chọn chuyên khoa và dịch vụ khám để tiếp
                        tục các bước đặt lịch.
                      </div>
                    )}

                    {/* 6. Tổng tạm tính */}
                    {selectedService && (
                      <div className="pb-summary-total-box">
                        <span className="pb-summary-total-label">
                          Tổng tạm tính
                        </span>
                        <span className="pb-summary-total-price">
                          {formatVnd(totalEstimatedPrice)}
                        </span>
                      </div>
                    )}

                    {/* Thông báo giữ chỗ 5 phút sau khi chọn xong giờ ở bước 2 */}
                    {currentStep === 2 &&
                      selectedSlot &&
                      formattedHoldTimer &&
                      !holdExpired && (
                        <div className="pb-hold-sidebar-notice">
                          <Clock size={16} className="pb-hold-icon" />
                          <div className="pb-hold-text">
                            Khung giờ{' '}
                            <strong>
                              {formatTimeRange(
                                selectedSlot.startAt,
                                selectedSlot.endAt,
                              )}
                            </strong>{' '}
                            ngày{' '}
                            <strong>{formatDateDisplay(selectedDate)}</strong>{' '}
                            đã được giữ chỗ trong{' '}
                            <strong className="pb-hold-countdown">
                              {formattedHoldTimer}
                            </strong>
                            .
                          </div>
                        </div>
                      )}

                    {currentStep === 2 && selectedSlot && holdExpired && (
                      <div className="pb-hold-sidebar-expired">
                        ⚠️ <strong>Hết hạn giữ chỗ:</strong> Thời gian giữ chỗ 5
                        phút đã kết thúc. Vui lòng bấm chọn lại khung giờ khám.
                      </div>
                    )}

                    <div className="pb-summary-actions">
                      {currentStep === 1 && (
                        <button
                          type="button"
                          className="pb-btn-primary"
                          onClick={handleNextToStep2}
                          disabled={!selectedServiceId}
                        >
                          Tiếp tục sang bước 2 <ArrowRight size={18} />
                        </button>
                      )}

                      {currentStep === 2 && (
                        <>
                          <button
                            type="button"
                            className="pb-btn-primary"
                            onClick={handleNextToStep3}
                            disabled={!selectedSlot || holdExpired}
                          >
                            Tiếp tục sang bước 3 <ArrowRight size={18} />
                          </button>
                          <button
                            type="button"
                            className="pb-btn-secondary"
                            onClick={handlePrevStep}
                          >
                            <ChevronLeft size={16} /> Quay lại bước 1
                          </button>
                        </>
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
                    <span className="pb-hotline-label">
                      Cần hỗ trợ đặt lịch khẩn cấp?
                    </span>
                    <a href="tel:19006868" className="pb-hotline-number">
                      1900 6868
                    </a>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* ========================================================
              BƯỚC 3: BỐ CỤC 2 CỘT CÂN ĐỐI (THÔNG TIN NGƯỜI KHÁM TRÁI + CHI TIẾT & CHI PHÍ PHẢI)
             ======================================================== */}
          {currentStep === 3 && (
            <div className="pb-step3-grid">
              {/* CỘT TRÁI (BƯỚC 3): THÔNG TIN NGƯỜI KHÁM BỆNH */}
              <div className="pb-step-card pb-step3-left-card">
                <div className="pb-step-header">
                  <div className="pb-step-header-title-row">
                    <h2 className="pb-step-heading">
                      <User size={22} color="#0b4f9c" />
                      Bước 3: Thông Tin Người Khám Bệnh
                    </h2>
                  </div>
                  <p className="pb-step-subtitle">
                    Thông tin được dùng để làm hồ sơ tiếp đón y tế và lưu trữ
                    kết quả khám trực tuyến.
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
                          <label className="pb-label">
                            Email đăng nhập / Số điện thoại
                          </label>
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

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '12px',
                        }}
                      >
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
                {auth.status === 'authenticated' &&
                  profileStatus === 'complete' && (
                    <div>
                      {!isEditingProfile ? (
                        <div className="pb-verified-profile-card">
                          <div className="pb-verified-header">
                            <div className="pb-verified-title-left">
                              <ShieldCheck size={18} color="#166534" />
                              <span>Hồ sơ bệnh nhân hợp lệ</span>
                            </div>
                            <div className="pb-verified-header-right">
                              <span className="pb-verified-id-badge">
                                Mã bệnh nhân:{' '}
                                <strong>
                                  {patientProfile?.id
                                    ? patientProfile.id
                                        .slice(0, 8)
                                        .toUpperCase()
                                    : '98942BA2'}
                                </strong>
                              </span>
                              <button
                                type="button"
                                className="pb-btn-edit-profile"
                                onClick={handleStartEditProfile}
                                title="Chỉnh sửa thông tin hồ sơ người khám"
                              >
                                <Edit2 size={13} />
                                <span>Chỉnh sửa hồ sơ</span>
                              </button>
                            </div>
                          </div>

                          <div className="pb-verified-grid">
                            <div className="pb-verified-item">
                              <span className="pb-verified-label">
                                Họ và tên
                              </span>
                              <span className="pb-verified-val">
                                {patientProfile?.fullName}
                              </span>
                            </div>

                            <div className="pb-verified-item">
                              <span className="pb-verified-label">
                                Ngày sinh
                              </span>
                              <span className="pb-verified-val">
                                {formatDateDisplay(patientProfile?.dateOfBirth)}
                              </span>
                            </div>

                            <div className="pb-verified-item">
                              <span className="pb-verified-label">
                                Số điện thoại
                              </span>
                              <span className="pb-verified-val">
                                {formatPhoneNumber(patientProfile?.phoneNumber)}
                              </span>
                            </div>

                            <div className="pb-verified-item">
                              <span className="pb-verified-label">
                                Số CCCD / Định danh
                              </span>
                              <span className="pb-verified-val">
                                {(patientProfile as any)?.nationalId ||
                                  formNationalId ||
                                  patientProfile?.nationalIdMasked ||
                                  '001195000101'}
                              </span>
                            </div>

                            <div className="pb-verified-item pb-col-full">
                              <span className="pb-verified-label">
                                Địa chỉ cư trú
                              </span>
                              <span className="pb-verified-val">
                                {patientProfile?.address || 'Chưa cập nhật'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pb-verified-profile-card is-editing">
                          <div className="pb-verified-header">
                            <div className="pb-verified-title-left">
                              <Edit2 size={18} color="#0b4f9c" />
                              <span style={{ color: '#0b4f9c' }}>
                                Chỉnh sửa thông tin hồ sơ người khám
                              </span>
                            </div>
                            <span className="pb-verified-id-badge">
                              Mã bệnh nhân:{' '}
                              <strong>
                                {patientProfile?.id
                                  ? patientProfile.id.slice(0, 8).toUpperCase()
                                  : '98942BA2'}
                              </strong>
                            </span>
                          </div>

                          {editErrors.form && (
                            <div className="pb-edit-error-banner">
                              <AlertCircle size={15} />
                              <span>{editErrors.form}</span>
                            </div>
                          )}

                          <div
                            className="pb-form-grid"
                            style={{ marginBottom: '16px' }}
                          >
                            <div className="pb-form-group">
                              <label className="pb-label">
                                Họ và tên <span className="required">*</span>
                              </label>
                              <input
                                type="text"
                                className={`pb-input ${editErrors.fullName ? 'has-error' : ''}`}
                                placeholder="Nhập họ và tên đầy đủ"
                                value={editFullName}
                                onChange={(e) => {
                                  setEditFullName(e.target.value);
                                  if (editErrors.fullName)
                                    setEditErrors((prev) => ({
                                      ...prev,
                                      fullName: '',
                                    }));
                                }}
                              />
                              {editErrors.fullName && (
                                <div className="pb-input-error">
                                  {editErrors.fullName}
                                </div>
                              )}
                            </div>

                            <div className="pb-form-group">
                              <label className="pb-label">
                                Ngày sinh <span className="required">*</span>
                              </label>
                              <input
                                type="date"
                                className={`pb-input ${editErrors.dateOfBirth ? 'has-error' : ''}`}
                                value={editDateOfBirth}
                                onChange={(e) => {
                                  setEditDateOfBirth(e.target.value);
                                  if (editErrors.dateOfBirth)
                                    setEditErrors((prev) => ({
                                      ...prev,
                                      dateOfBirth: '',
                                    }));
                                }}
                              />
                              {editErrors.dateOfBirth && (
                                <div className="pb-input-error">
                                  {editErrors.dateOfBirth}
                                </div>
                              )}
                            </div>

                            <div className="pb-form-group">
                              <label className="pb-label">
                                Số điện thoại{' '}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="tel"
                                className={`pb-input ${editErrors.phoneNumber ? 'has-error' : ''}`}
                                placeholder="ví dụ: 0901234567"
                                value={editPhoneNumber}
                                onChange={(e) => {
                                  setEditPhoneNumber(e.target.value);
                                  if (editErrors.phoneNumber)
                                    setEditErrors((prev) => ({
                                      ...prev,
                                      phoneNumber: '',
                                    }));
                                }}
                              />
                              {editErrors.phoneNumber && (
                                <div className="pb-input-error">
                                  {editErrors.phoneNumber}
                                </div>
                              )}
                            </div>

                            <div className="pb-form-group">
                              <label className="pb-label">
                                Số CCCD / Định danh{' '}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="text"
                                className={`pb-input ${editErrors.nationalId ? 'has-error' : ''}`}
                                placeholder="9 hoặc 12 chữ số"
                                value={editNationalId}
                                onChange={(e) => {
                                  setEditNationalId(e.target.value);
                                  if (editErrors.nationalId)
                                    setEditErrors((prev) => ({
                                      ...prev,
                                      nationalId: '',
                                    }));
                                }}
                              />
                              {editErrors.nationalId && (
                                <div className="pb-input-error">
                                  {editErrors.nationalId}
                                </div>
                              )}
                            </div>

                            <div
                              className="pb-form-group pb-col-full"
                              style={{ gridColumn: 'span 2' }}
                            >
                              <label className="pb-label">
                                Địa chỉ cư trú{' '}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="text"
                                className={`pb-input ${editErrors.address ? 'has-error' : ''}`}
                                placeholder="Số nhà, đường/phố, phường/xã, quận/huyện, tỉnh/thành phố"
                                value={editAddress}
                                onChange={(e) => {
                                  setEditAddress(e.target.value);
                                  if (editErrors.address)
                                    setEditErrors((prev) => ({
                                      ...prev,
                                      address: '',
                                    }));
                                }}
                              />
                              {editErrors.address && (
                                <div className="pb-input-error">
                                  {editErrors.address}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pb-edit-actions">
                            <button
                              type="button"
                              className="pb-btn-cancel-edit"
                              onClick={() => {
                                setIsEditingProfile(false);
                                setEditErrors({});
                              }}
                              disabled={isSavingEdit}
                            >
                              Hủy bỏ
                            </button>
                            <button
                              type="button"
                              className="pb-btn-save-edit"
                              onClick={handleSaveProfileEdit}
                              disabled={isSavingEdit}
                            >
                              {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lý do khám / Triệu chứng lâm sàng */}
                      <div
                        className="pb-form-group"
                        style={{ marginTop: '20px' }}
                      >
                        <label className="pb-label">
                          Lý do khám / Triệu chứng ban đầu (nếu có)
                        </label>
                        <textarea
                          className="pb-textarea"
                          rows={4}
                          placeholder="Mô tả ngắn gọn tuần thai hiện tại hoặc triệu chứng khó chịu để bác sĩ chuẩn bị trước..."
                          value={clinicalNotes}
                          onChange={(e) => setClinicalNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                {/* TRƯỜNG HỢP C: ĐÃ ĐĂNG NHẬP NHƯNG LÀ TÀI KHOẢN MỚI CHƯA CÓ HỒ SƠ */}
                {auth.status === 'authenticated' &&
                  profileStatus === 'incomplete' && (
                    <div>
                      <div className="pb-new-patient-alert">
                        <AlertCircle size={20} style={{ flexShrink: 0 }} />
                        <div>
                          <strong>Bạn đang dùng tài khoản mới:</strong> Vui lòng
                          điền thông tin để Bệnh viện thiết lập hồ sơ bệnh án
                          điện tử và đồng bộ tiếp đón khi bạn đến khám.
                        </div>
                      </div>

                      <div className="pb-form-grid">
                        <div className="pb-form-group">
                          <label className="pb-label">
                            Họ và tên người khám{' '}
                            <span className="required">*</span>
                          </label>
                          <input
                            type="text"
                            className={`pb-input ${formErrors.fullName ? 'has-error' : ''}`}
                            placeholder="Nhập họ và tên đầy đủ (IN HOA hoặc chữ thường)"
                            value={formFullName}
                            onChange={(e) => setFormFullName(e.target.value)}
                          />
                          {formErrors.fullName && (
                            <div className="pb-input-error">
                              {formErrors.fullName}
                            </div>
                          )}
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
                          {formErrors.dateOfBirth && (
                            <div className="pb-input-error">
                              {formErrors.dateOfBirth}
                            </div>
                          )}
                        </div>

                        <div className="pb-form-group">
                          <label className="pb-label">
                            Số điện thoại nhận tin nhắn{' '}
                            <span className="required">*</span>
                          </label>
                          <input
                            type="tel"
                            className={`pb-input ${formErrors.phoneNumber ? 'has-error' : ''}`}
                            placeholder="ví dụ: 0901234567"
                            value={formPhoneNumber}
                            onChange={(e) => setFormPhoneNumber(e.target.value)}
                          />
                          {formErrors.phoneNumber && (
                            <div className="pb-input-error">
                              {formErrors.phoneNumber}
                            </div>
                          )}
                        </div>

                        <div className="pb-form-group">
                          <label className="pb-label">
                            Số CCCD / Hộ chiếu{' '}
                            <span className="required">*</span>
                          </label>
                          <input
                            type="text"
                            className={`pb-input ${formErrors.nationalId ? 'has-error' : ''}`}
                            placeholder="Số căn cước 12 chữ số"
                            value={formNationalId}
                            onChange={(e) => setFormNationalId(e.target.value)}
                          />
                          {formErrors.nationalId && (
                            <div className="pb-input-error">
                              {formErrors.nationalId}
                            </div>
                          )}
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
                          <label className="pb-label">
                            Lý do khám / Triệu chứng lâm sàng
                          </label>
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

              {/* CỘT PHẢI (BƯỚC 3): CHI TIẾT LỊCH HẸN, CHI PHÍ KHÁM & NÚT XÁC NHẬN */}
              <div className="pb-step-card pb-step3-right-card">
                <div className="pb-step-header">
                  <h3 className="pb-step-heading" style={{ fontSize: '18px' }}>
                    <ClipboardCheck size={20} color="#0b4f9c" />
                    Chi Tiết Lịch Hẹn &amp; Chi Phí Khám
                  </h3>
                  <p className="pb-step-subtitle">
                    Vui lòng rà soát lại thông tin trước khi hoàn tất đăng ký
                    đặt lịch khám.
                  </p>
                </div>

                {/* Bảng chi tiết */}
                <div className="pb-confirm-review-table">
                  <div className="pb-review-row">
                    <span className="pb-review-label">Cơ sở khám</span>
                    <span className="pb-review-val">
                      Bệnh viện Phụ sản Tâm An (Hà Nội)
                    </span>
                  </div>

                  <div className="pb-review-row">
                    <span className="pb-review-label">Chuyên khoa</span>
                    <span className="pb-review-val">
                      {selectedService
                        ? specialties.find(
                            (s) => s.id === selectedService.specialtyId,
                          )?.name || 'Sản Phụ khoa'
                        : currentSpecialtyName}
                    </span>
                  </div>

                  <div className="pb-review-row">
                    <span className="pb-review-label">Dịch vụ đăng ký</span>
                    <span className="pb-review-val is-black-bold">
                      {selectedService?.name}
                    </span>
                  </div>

                  <div className="pb-review-row">
                    <span className="pb-review-label">Bác sĩ phụ trách</span>
                    <span className="pb-review-val">
                      {doctorMode === 'DOCTOR'
                        ? selectedDoctor
                          ? `${(selectedDoctor.profile as any)?.fullName || selectedDoctor.name} (${RANK_LABEL[(selectedDoctor as any).consultationRank || (selectedDoctor as any).rank || 'BASIC'] || ''})`
                          : 'Chưa chọn bác sĩ'
                        : 'Bác sĩ chuyên khoa tiêu chuẩn (Bệnh viện tự động sắp xếp)'}
                    </span>
                  </div>

                  <div className="pb-review-row">
                    <span className="pb-review-label">Thời gian khám</span>
                    <span className="pb-review-val is-black-bold">
                      {formatDateDisplay(selectedDate)} lúc{' '}
                      {selectedSlot
                        ? formatTimeRange(
                            selectedSlot.startAt,
                            selectedSlot.endAt,
                          )
                        : ''}
                    </span>
                  </div>

                  <div className="pb-review-row">
                    <span className="pb-review-label">
                      Phòng khám tiếp nhận
                    </span>
                    <span className="pb-review-val">
                      Quầy tiếp đón Tầng 1 (Bệnh viện sẽ phân bổ phòng theo ca
                      trực)
                    </span>
                  </div>
                </div>

                {/* Bảng chi phí & Tạm tính */}
                <div className="pb-price-breakdown-card">
                  <div className="pb-price-row">
                    <span className="pb-price-label">
                      Giá dịch vụ niêm yết:
                    </span>
                    <span className="pb-price-val">
                      {formatVnd(getServicePrice(selectedService))}
                    </span>
                  </div>

                  <div className="pb-price-row">
                    <span className="pb-price-label">
                      Phụ phí bác sĩ theo yêu cầu:
                    </span>
                    <span className="pb-price-val">
                      {doctorMode === 'DOCTOR' && selectedDoctorSurcharge > 0
                        ? `+${formatVnd(selectedDoctorSurcharge)}`
                        : '0 ₫ (Miễn phí)'}
                    </span>
                  </div>

                  <div className="pb-price-divider" />

                  <div className="pb-price-row pb-price-total">
                    <span className="pb-price-total-label">
                      Tổng chi phí tạm tính:
                    </span>
                    <span className="pb-price-total-val">
                      {formatVnd(totalEstimatedPrice)}
                    </span>
                  </div>

                  <div className="pb-price-subnote">
                    * Quý khách thanh toán tại Quầy tiếp đón khi đến khám. Miễn
                    phí 100% đổi / hủy lịch hẹn trước 24 giờ.
                  </div>
                </div>

                {/* Thông báo giữ chỗ 5 phút tại Bước 3 */}
                {selectedSlot && formattedHoldTimer && !holdExpired && (
                  <div className="pb-hold-step3-notice">
                    <Clock size={16} className="pb-hold-icon" />
                    <div className="pb-hold-text">
                      Khung giờ{' '}
                      <strong>
                        {formatTimeRange(
                          selectedSlot.startAt,
                          selectedSlot.endAt,
                        )}
                      </strong>{' '}
                      ngày <strong>{formatDateDisplay(selectedDate)}</strong> đã
                      được giữ chỗ trong{' '}
                      <strong className="pb-hold-countdown">
                        {formattedHoldTimer}
                      </strong>
                      .
                    </div>
                  </div>
                )}

                {selectedSlot && holdExpired && (
                  <div className="pb-hold-step3-expired">
                    ⚠️ <strong>Hết hạn giữ chỗ:</strong> Thời gian giữ chỗ 5
                    phút đã kết thúc. Vui lòng quay lại bước 2 chọn lại khung
                    giờ khám.
                  </div>
                )}

                {/* Hộp lưu ý */}
                <div className="pb-terms-notice">
                  <AlertCircle
                    size={18}
                    style={{ flexShrink: 0, marginTop: '2px' }}
                  />
                  <div>
                    <strong>Lưu ý:</strong> Quý khách vui lòng có mặt trước giờ
                    hẹn 10 - 15 phút và xuất trình CCCD tại Quầy tiếp đón Tầng 1
                    để được tiếp đón ưu tiên.
                  </div>
                </div>

                {/* Cụm nút xác nhận */}
                <div className="pb-step3-action-buttons">
                  <button
                    type="button"
                    className="pb-btn-primary pb-btn-confirm-lg"
                    onClick={handleConfirmBooking}
                    disabled={
                      isSubmitting ||
                      auth.status !== 'authenticated' ||
                      holdExpired
                    }
                  >
                    {isSubmitting ? (
                      'Đang xử lý tạo lịch hẹn...'
                    ) : (
                      <>
                        <Check size={18} /> Xác Nhận Đặt Lịch Khám
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="pb-btn-secondary"
                    onClick={handlePrevStep}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft size={16} /> Quay lại bước 2
                  </button>
                </div>

                {/* Hotline hỗ trợ nhỏ */}
                <div className="pb-step3-hotline">
                  <Phone size={15} color="#ef4444" />
                  <span>Hỗ trợ đặt lịch khẩn cấp:</span>
                  <a href="tel:19006868" className="pb-step3-hotline-phone">
                    1900 6868
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL PHIẾU HẸN TIẾP ĐÓN XUẤT HIỆN SAU KHI ĐẶT LỊCH THÀNH CÔNG */}
      <AppointmentTicketModal
        isOpen={showSuccessTicketModal}
        onClose={() => {
          setShowSuccessTicketModal(false);
          navigate('/lich-hen');
        }}
        appointment={createdAppointment}
        patientProfile={patientProfile}
        fallbackPatientName={formFullName}
        fallbackPhoneNumber={formPhoneNumber}
        fallbackDateOfBirth={formDateOfBirth}
        fallbackNationalId={formNationalId}
        fallbackDoctorName={
          selectedDoctor
            ? (selectedDoctor.profile as any)?.fullName || selectedDoctor.name
            : 'Bác sĩ chuyên khoa Tâm An'
        }
        fallbackSpecialtyName={
          specialties.find(
            (s) =>
              s.id === (selectedService?.specialtyId || selectedSpecialtyId),
          )?.name || 'Sản Phụ khoa'
        }
        fallbackServiceName={
          selectedService?.name || 'Dịch vụ khám Sản Phụ khoa'
        }
        fallbackRoomName={
          createdAppointment?.roomNameSnapshot ||
          (selectedSlot as any)?.roomName ||
          'Quầy tiếp đón Tầng 1'
        }
        fallbackPriceMinor={getServicePrice(selectedService)}
        showGoToAppointmentsBtn={true}
        onGoToAppointments={() => {
          setShowSuccessTicketModal(false);
          navigate('/lich-hen');
        }}
      />

      <PublicPortalFooter />
    </div>
  );
}
export default PatientBookingPage;
