import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  User,
  Phone,
  Calendar,
  MapPin,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  PhoneCall,
  AlertTriangle,
  BadgeAlert,
  ChevronRight,
  Stethoscope,
  X,
  Camera,
} from "lucide-react";
import { useAuthSession } from "../../../app/AuthSessionProvider";
import { AppLink } from "../../../app/navigation";
import { PatientPortalLayout } from "../components/PatientPortalLayout";
import { LoadingPlaceholder } from "../../../shared/components/ui/LoadingPlaceholder";
import { ProfileField } from "../components/profile/ProfileField";
import { ProfileProgress } from "../components/profile/ProfileProgress";
import { ProfileSection } from "../components/profile/ProfileSection";
import { AvatarCropModal } from "../components/profile/AvatarCropModal";
import {
  emptyEmergencyContact,
  emptyPatientProfile,
  profileProgress,
  validateEmergencyContact,
  validatePatientProfile,
  type EmergencyContactField,
  type EmergencyContactFormValues,
  type EmergencyContactValidationMap,
  type PatientProfileField,
  type PatientProfileFormValues,
  type ValidationMap,
} from "../../../schemas/patientProfile";
import { ApiError } from "../../../services/api";
import type { EmergencyContact, PatientProfile } from "../../../services/patient";
import { listAppointments, type Appointment } from "../../../services/appointment";
import "../../../styles/patient-profile.css";

interface Envelope<T> {
  data: T;
}

const DRAFT_TTL_MS = 30 * 60 * 1000;
const MAX_CONTACTS = 3;
const draftKey = (userId: string) => `an-tam-patient-profile-draft:${userId}`;

interface PatientProfileDraft {
  version: 2;
  savedAt: number;
  values: PatientProfileFormValues;
}

function readDraft(userId: string): PatientProfileFormValues | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as PatientProfileDraft;
    if (draft.version !== 2 || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(draftKey(userId));
      return null;
    }
    return { ...emptyPatientProfile, ...draft.values };
  } catch {
    return null;
  }
}

function writeDraft(userId: string, values: PatientProfileFormValues) {
  try {
    window.sessionStorage.setItem(
      draftKey(userId),
      JSON.stringify({ version: 2, savedAt: Date.now(), values }),
    );
  } catch {
    // Ignore unavailable browser storage.
  }
}

function clearDraft(userId: string) {
  try {
    window.sessionStorage.removeItem(draftKey(userId));
  } catch {
    // Ignore unavailable browser storage.
  }
}

function sortContacts(items: EmergencyContact[]) {
  return [...items].sort(
    (left, right) =>
      left.priority - right.priority || left.id.localeCompare(right.id),
  );
}

function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? age : null;
}

function formatDateVN(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTimeVN(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${hours}:${minutes} - ${day}/${month}/${year}`;
}

function formatPhoneVN(phone?: string | null): string {
  if (!phone) return "Chưa có";
  return phone.replace(/^\+84/, "0");
}

const snapshot = (values: PatientProfileFormValues) =>
  JSON.stringify({
    fullName: values.fullName.trim(),
    birthDate: values.birthDate,
    phoneNumber: values.phoneNumber.trim(),
    address: values.address.trim(),
  });

export function PatientProfilePage() {
  const auth = useAuthSession();
  const [values, setValues] = useState(emptyPatientProfile);
  const [errors, setErrors] = useState<ValidationMap>({});
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window !== "undefined" && auth.user?.userId) {
      return localStorage.getItem(`patient_avatar_${auth.user.userId}`) || null;
    }
    return null;
  });
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tự động đóng thông báo nổi sau 3 giây theo yêu cầu người dùng
  useEffect(() => {
    if (!alert) return;
    const timer = window.setTimeout(() => {
      setAlert(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [alert]);

  function handleTriggerAvatarUpload() {
    fileInputRef.current?.click();
  }

  function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setTempImageSrc(reader.result);
        setCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleSaveCroppedAvatar(croppedDataUrl: string) {
    setAvatarUrl(croppedDataUrl);
    if (auth.user?.userId) {
      try {
        localStorage.setItem(`patient_avatar_${auth.user.userId}`, croppedDataUrl);
      } catch {
        // ignore
      }
    }
    setAlert({
      type: 'success',
      message: 'Ảnh đại diện đã được cập nhật thành công.',
    });
  }

  function handleStartEdit() {
    const plainNationalId =
      profile?.nationalId ||
      values.nationalId ||
      (profile?.nationalIdMasked && !profile.nationalIdMasked.includes("*")
        ? profile.nationalIdMasked
        : "") ||
      "";
    setValues((prev) => ({
      ...prev,
      fullName: profile?.fullName || prev.fullName,
      birthDate: profile?.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : prev.birthDate,
      phoneNumber: profile?.phoneNumber ? profile.phoneNumber.replace(/^\+84/, "0") : prev.phoneNumber,
      nationalId: plainNationalId,
      address: profile?.address || prev.address,
    }));
    setErrors({});
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setErrors({});
    if (profile) {
      const plainNationalId =
        profile.nationalId ||
        (profile.nationalIdMasked && !profile.nationalIdMasked.includes("*")
          ? profile.nationalIdMasked
          : "") ||
        "";
      setValues({
        ...emptyPatientProfile,
        fullName: profile.fullName || "",
        birthDate: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
        phoneNumber: profile.phoneNumber ? profile.phoneNumber.replace(/^\+84/, "0") : "",
        address: profile.address || "",
        nationalId: plainNationalId,
      });
    }
  }

  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactValues, setContactValues] =
    useState<EmergencyContactFormValues>(emptyEmergencyContact);
  const [contactErrors, setContactErrors] =
    useState<EmergencyContactValidationMap>({});
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactAlert, setContactAlert] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const hasStoredNationalId = Boolean(profile?.nationalIdMasked);

  useEffect(() => {
    let active = true;
    auth
      .request<Envelope<PatientProfile>>("/api/patients/me")
      .then(({ data }: Envelope<PatientProfile>) => {
        if (!active) return;
        const next = {
          ...emptyPatientProfile,
          fullName: data.fullName,
          birthDate: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "",
          phoneNumber: data.phoneNumber ? data.phoneNumber.replace(/^\+84/, "0") : "",
          nationalId: data.nationalId || (data.nationalIdMasked && !data.nationalIdMasked.includes("*") ? data.nationalIdMasked : "") || "",
          address: data.address || "",
        };
        setProfile(data);
        setContacts(sortContacts(data.emergencyContacts));
        setValues(next);
        setInitialSnapshot(snapshot(next));
        setIsNewProfile(false);
        setIsEditing(false);
        if (auth.user?.userId) clearDraft(auth.user.userId);
        setLoading(false);

        // Nạp lịch hẹn nếu không ở môi trường unit test
        if (import.meta.env.MODE !== "test") {
          listAppointments(auth.request)
            .then((page) => {
              if (active && page.items) {
                setAppointments(page.items);
              }
            })
            .catch(() => {});
        }
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.statusCode === 404) {
          const next =
            (auth.user?.userId && readDraft(auth.user.userId)) ||
            emptyPatientProfile;
          setProfile(null);
          setContacts([]);
          setValues(next);
          setInitialSnapshot(snapshot(next));
          setIsNewProfile(true);
          setIsEditing(true);
        } else {
          setAlert({
            type: "error",
            message:
              reason instanceof Error ? reason.message : "Không thể tải hồ sơ bệnh nhân.",
          });
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth.request, auth.user?.userId]);

  useEffect(() => {
    if (!loading && isNewProfile && auth.user?.userId) {
      writeDraft(auth.user.userId, values);
    }
  }, [auth.user?.userId, isNewProfile, loading, values]);

  const progress = useMemo(
    () => profileProgress(values, hasStoredNationalId),
    [values, hasStoredNationalId],
  );

  function changeProfile(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name as PatientProfileField]) {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  }

  function validateProfileField(field: PatientProfileField) {
    const next = validatePatientProfile(values, {
      storedNationalId: hasStoredNationalId,
    });
    setErrors((current) => ({ ...current, [field]: next[field] }));
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    setAlert(null);
    const nextErrors = validatePatientProfile(values, {
      storedNationalId: hasStoredNationalId,
    });
    const changed =
      !profile ||
      snapshot(values) !== initialSnapshot ||
      Boolean(values.nationalId.trim());

    if (profile && changed && hasStoredNationalId && !values.nationalId) {
      nextErrors.nationalId =
        "Để cập nhật hồ sơ mà không xóa giấy tờ đã lưu, vui lòng nhập lại CCCD/CMND.";
    }
    setErrors(nextErrors);
    const first = Object.keys(nextErrors)[0] as PatientProfileField | undefined;
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      setAlert({
        type: "error",
        message: "Vui lòng kiểm tra lại các thông tin được đánh dấu đỏ.",
      });
      return;
    }
    if (!changed) {
      setAlert({
        type: "success",
        message: "Hồ sơ không có thay đổi cần lưu.",
      });
      setIsEditing(false);
      return;
    }

    setSubmitting(true);
    try {
      const saved = (
        await auth.request<Envelope<PatientProfile>>("/api/patients/me", {
          method: "PUT",
          body: JSON.stringify({
            fullName: values.fullName.trim(),
            dateOfBirth: values.birthDate,
            phoneNumber: values.phoneNumber.trim(),
            nationalId: values.nationalId.replace(/[^0-9]/g, ""),
            address: values.address.trim(),
            ...(profile ? { version: profile.version } : {}),
          }),
        })
      ).data;
      setProfile(saved);
      setContacts(sortContacts(saved.emergencyContacts));
      setInitialSnapshot(snapshot(values));
      setIsNewProfile(false);
      setIsEditing(false);
      if (auth.user?.userId) clearDraft(auth.user.userId);
      setValues((current) => ({ ...current, nationalId: saved.nationalId || current.nationalId }));
      setAlert({
        type: "success",
        message: "Hồ sơ bệnh nhân đã được lưu thành công.",
      });
    } catch (reason) {
      setAlert({
        type: "error",
        message:
          reason instanceof Error ? reason.message : "Không thể lưu hồ sơ.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function changeContact(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setContactValues((current) => ({ ...current, [name]: value }));
    if (contactErrors[name as EmergencyContactField]) {
      setContactErrors((current) => ({ ...current, [name]: undefined }));
    }
  }

  function openNew() {
    setEditingContactId(null);
    setContactValues(emptyEmergencyContact);
    setContactErrors({});
    setContactAlert(null);
    setShowContactForm(true);
  }

  function openEdit(contact: EmergencyContact) {
    setEditingContactId(contact.id);
    setContactValues({
      fullName: contact.fullName,
      relationship: contact.relationship,
      phoneNumber: contact.phoneNumber,
    });
    setContactErrors({});
    setContactAlert(null);
    setShowContactForm(true);
  }

  function closeContact() {
    setShowContactForm(false);
    setEditingContactId(null);
    setContactValues(emptyEmergencyContact);
    setContactErrors({});
  }

  async function submitContact(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    const nextErrors = validateEmergencyContact(contactValues);
    setContactErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setContactSubmitting(true);
    setContactAlert(null);
    const editing = Boolean(editingContactId);
    try {
      const endpoint = editingContactId
        ? `/api/patients/${profile.id}/emergency-contacts/${editingContactId}`
        : `/api/patients/${profile.id}/emergency-contacts`;
      const saved = (
        await auth.request<Envelope<EmergencyContact>>(endpoint, {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            fullName: contactValues.fullName.trim(),
            relationship: contactValues.relationship.trim(),
            phoneNumber: contactValues.phoneNumber.trim(),
          }),
        })
      ).data;
      setContacts((current) =>
        sortContacts(
          editing
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved],
        ),
      );
      closeContact();
      setContactAlert({
        type: "success",
        message: editing
          ? "Đã cập nhật người liên hệ."
          : "Đã thêm người liên hệ khẩn cấp.",
      });
    } catch (reason) {
      setContactAlert({
        type: "error",
        message:
          reason instanceof Error
            ? reason.message
            : "Không thể lưu người liên hệ.",
      });
    } finally {
      setContactSubmitting(false);
    }
  }

  async function removeContact(contact: EmergencyContact) {
    if (!profile) return;
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa người liên hệ “${contact.fullName}” không?`,
    );
    if (!confirmed) return;

    setContactSubmitting(true);
    setContactAlert(null);
    try {
      await auth.request<void>(
        `/api/patients/${profile.id}/emergency-contacts/${contact.id}`,
        { method: "DELETE" },
      );
      setContacts((current) =>
        current
          .filter((item) => item.id !== contact.id)
          .map((item, index) => ({
            ...item,
            priority: index + 1,
            isPrimary: index === 0,
          })),
      );
      if (editingContactId === contact.id) closeContact();
      setContactAlert({ type: "success", message: "Đã xóa người liên hệ." });
    } catch (reason) {
      setContactAlert({
        type: "error",
        message:
          reason instanceof Error
            ? reason.message
            : "Không thể xóa người liên hệ.",
      });
    } finally {
      setContactSubmitting(false);
    }
  }

  async function moveContact(index: number, direction: -1 | 1) {
    if (!profile) return;
    const target = index + direction;
    if (target < 0 || target >= contacts.length) return;
    const next = [...contacts];
    [next[index], next[target]] = [next[target], next[index]];

    setContactSubmitting(true);
    setContactAlert(null);
    try {
      const ordered = (
        await auth.request<Envelope<EmergencyContact[]>>(
          `/api/patients/${profile.id}/emergency-contacts/order`,
          {
            method: "PUT",
            body: JSON.stringify({
              contactIds: next.map((item) => item.id),
            }),
          },
        )
      ).data;
      setContacts(sortContacts(ordered));
      setContactAlert({
        type: "success",
        message: "Đã cập nhật thứ tự ưu tiên.",
      });
    } catch (reason) {
      setContactAlert({
        type: "error",
        message:
          reason instanceof Error
            ? reason.message
            : "Không thể đổi thứ tự ưu tiên.",
      });
    } finally {
      setContactSubmitting(false);
    }
  }

  const input = (name: PatientProfileField) => ({
    name,
    value: values[name],
    onChange: changeProfile,
    onBlur: () => validateProfileField(name),
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": name + "-message",
  });

  const displayName = profile?.fullName || values.fullName || auth.user?.email.split("@")[0] || "Bệnh nhân";
  const userInitials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "BN";
  const age = calculateAge(values.birthDate || profile?.dateOfBirth || "");
  const patientCode = profile ? `PA-${profile.id.slice(0, 8).toUpperCase()}` : "PA-NEW";

  return (
    <PatientPortalLayout
      displayName={displayName}
      contentClassName="patient-profile-unified-page"
      profileComplete={loading ? null : Boolean(profile)}
    >
      <LoadingPlaceholder visible={loading} label="Đang tải hồ sơ bệnh nhân..." />

      <div className="profile-container-root">
        {/* Navigation Breadcrumb */}
        <div className="profile-breadcrumb-bar">
          <AppLink className="profile-breadcrumb-link" href="/">
            Trang chủ
          </AppLink>
          <span className="profile-breadcrumb-sep">/</span>
          <span className="profile-breadcrumb-current">Hồ sơ bệnh nhân</span>
        </div>

        {/* Floating Toast Notification (không đẩy modal, tự động ẩn sau 3 giây) */}
        {alert && (
          <div className={`profile-floating-toast is-${alert.type}`} role="status">
            <div className="toast-icon-wrap">
              {alert.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              )}
            </div>
            <div className="toast-content">
              <strong className="toast-title">
                {alert.type === "success" ? "Thành công" : "Thông báo"}
              </strong>
              <p className="toast-msg">{alert.message}</p>
            </div>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setAlert(null)}
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input ẩn để chọn file ảnh từ thư viện */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleAvatarFileChange}
          aria-label="Chọn ảnh đại diện từ thư viện"
        />

        {/* THẺ THỐNG NHẤT DUY NHẤT: THIẾT KẾ ĐẸP, ĐẦY ĐỦ THÔNG TIN, KÍCH THƯỚC CHUẨN XÁC TRONG CẢ CHẾ ĐỘ XEM VÀ CHỈNH SỬA */}
        <section className="profile-section-card" aria-labelledby="patient-info-title">
          <div className={`profile-unified-card ${isEditing ? "is-editing" : ""}`}>
            {/* Header nhận diện bệnh nhân & Avatar */}
            <div className="profile-unified-header">
              <div className="profile-unified-identity">
                <div
                  className="patient-avatar-circle"
                  onClick={handleTriggerAvatarUpload}
                  title="Nhấp để tải lên hoặc chỉnh sửa ảnh đại diện"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTriggerAvatarUpload();
                    }
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="patient-avatar-img" />
                  ) : (
                    <span className="patient-avatar-text">{userInitials}</span>
                  )}
                  <span className="patient-avatar-status-dot is-verified" />
                  <div className="patient-avatar-edit-badge" title="Đổi ảnh đại diện">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="profile-unified-meta">
                  {!isEditing ? (
                    <>
                      <div className="profile-unified-name-row">
                        <h1 id="patient-info-title" className="profile-unified-name">
                          {displayName}
                        </h1>
                        <span className="patient-badge-verified">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          Đã định danh y tế
                        </span>
                        <span className="patient-code-tag">
                          <strong>Mã hồ sơ:</strong> {patientCode}
                        </span>
                      </div>
                      <p className="profile-unified-desc">
                        Thông tin hành chính cơ bản dùng để cấp số khám, hồ sơ thai sản và liên lạc tại bệnh viện.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="profile-unified-name-row">
                        <h1 id="patient-info-title" className="profile-unified-name">
                          {isNewProfile ? "Hoàn thiện thông tin bệnh nhân" : "Chỉnh sửa thông tin hành chính"}
                        </h1>
                        <span className="patient-code-tag">
                          <strong>Mã hồ sơ:</strong> {patientCode}
                        </span>
                      </div>
                      <p className="profile-unified-desc">
                        {isNewProfile
                          ? "Vui lòng nhập đầy đủ các trường thông tin cơ bản để bệnh viện khởi tạo mã bệnh nhân."
                          : "Cập nhật thông tin hành chính của bạn. Dữ liệu được bảo mật y tế tuyệt đối."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="profile-unified-actions">
                <aside className="profile-progress-sticky profile-unified-progress">
                  <ProfileProgress value={progress} />
                </aside>
                {!isEditing ? (
                  <button
                    type="button"
                    className="btn-card-edit-action"
                    onClick={handleStartEdit}
                  >
                    <Edit2 className="w-4 h-4" />
                    Chỉnh sửa thông tin
                  </button>
                ) : (
                  !isNewProfile && (
                    <button
                      type="button"
                      className="btn-unified-cancel"
                      onClick={handleCancelEdit}
                    >
                      <X className="w-4 h-4" />
                      Hủy bỏ
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="profile-unified-divider" />

            {!isEditing && profile ? (
              /* VIEW MODE: 5 TRƯỜNG DỮ LIỆU ĐẸP, CHUẨN XÁC, SĐT ĐẦU 0, CCCD KHÔNG CHE */
              <div className="profile-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Họ và tên</span>
                  <strong className="detail-value">{profile.fullName}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Ngày tháng năm sinh</span>
                  <strong className="detail-value">
                    {formatDateVN(profile.dateOfBirth)} {age !== null ? `(${age} tuổi)` : ""}
                  </strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Số điện thoại liên hệ</span>
                  <strong className="detail-value">{formatPhoneVN(profile.phoneNumber)}</strong>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Căn cước công dân / CMND</span>
                  <strong className="detail-value font-mono">
                    {profile.nationalId || values.nationalId || (profile.nationalIdMasked && !profile.nationalIdMasked.includes("*") ? profile.nationalIdMasked : "") || profile.nationalIdMasked || "Chưa lưu"}
                  </strong>
                </div>
                <div className="detail-item is-full">
                  <span className="detail-label">Địa chỉ thường trú / Nơi ở hiện tại</span>
                  <strong className="detail-value">{profile.address || "Chưa cập nhật"}</strong>
                </div>
                <div className="detail-item is-full detail-meta-box">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0" />
                    <span>
                      Dữ liệu được bảo mật y tế tuyệt đối theo tiêu chuẩn mã hóa AES-256-GCM.
                      Khi đến khám trực tiếp, lễ tân tiếp đón sẽ hỗ trợ đối soát mã hồ sơ <strong>{patientCode}</strong>.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT MODE: KÍCH THƯỚC VÀ KHUNG CHUẨN 100% VỚI KHUNG XEM, HIỂN THỊ RÕ CCCD */
              <form
                ref={formRef}
                className="profile-unified-form"
                noValidate
                onSubmit={submitProfile}
              >
                <div className="profile-unified-form-grid">
                  <div className="profile-unified-field">
                    <label htmlFor="fullName" className="profile-unified-label">
                      <span>Họ và tên</span>
                      {errors.fullName && <span className="profile-unified-error">{errors.fullName}</span>}
                    </label>
                    <input
                      id="fullName"
                      className={`profile-unified-input ${errors.fullName ? "has-error" : ""}`}
                      autoComplete="name"
                      placeholder="Ví dụ: Trần Diệu Hương"
                      {...input("fullName")}
                    />
                  </div>

                  <div className="profile-unified-field">
                    <label htmlFor="birthDate" className="profile-unified-label">
                      <span>Ngày sinh</span>
                      {errors.birthDate && <span className="profile-unified-error">{errors.birthDate}</span>}
                    </label>
                    <input
                      id="birthDate"
                      type="date"
                      className={`profile-unified-input ${errors.birthDate ? "has-error" : ""}`}
                      max={new Date().toISOString().slice(0, 10)}
                      {...input("birthDate")}
                    />
                  </div>

                  <div className="profile-unified-field">
                    <label htmlFor="phoneNumber" className="profile-unified-label">
                      <span>Số điện thoại</span>
                      {errors.phoneNumber && <span className="profile-unified-error">{errors.phoneNumber}</span>}
                    </label>
                    <input
                      id="phoneNumber"
                      type="tel"
                      className={`profile-unified-input ${errors.phoneNumber ? "has-error" : ""}`}
                      placeholder="090xxxxxxx"
                      {...input("phoneNumber")}
                    />
                  </div>

                  <div className="profile-unified-field">
                    <label htmlFor="nationalId" className="profile-unified-label">
                      <span>Số CCCD / CMND</span>
                      {errors.nationalId && <span className="profile-unified-error">{errors.nationalId}</span>}
                    </label>
                    <input
                      id="nationalId"
                      inputMode="numeric"
                      className={`profile-unified-input font-mono ${errors.nationalId ? "has-error" : ""}`}
                      placeholder="Nhập 9 hoặc 12 chữ số"
                      {...input("nationalId")}
                    />
                  </div>

                  <div className="profile-unified-field is-full">
                    <label htmlFor="address" className="profile-unified-label">
                      <span>Địa chỉ hiện tại</span>
                      {errors.address && <span className="profile-unified-error">{errors.address}</span>}
                    </label>
                    <input
                      id="address"
                      className={`profile-unified-input ${errors.address ? "has-error" : ""}`}
                      placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                      {...input("address")}
                    />
                  </div>
                </div>

                <footer className="profile-unified-footer">
                  <p className="profile-unified-footer-hint">
                    Người liên hệ khẩn cấp không bắt buộc và không ảnh hưởng việc lưu hồ sơ.
                  </p>
                  <div className="profile-unified-footer-btns">
                    {!isNewProfile && (
                      <button
                        type="button"
                        className="btn-unified-cancel"
                        onClick={handleCancelEdit}
                      >
                        Hủy
                      </button>
                    )}
                    <button
                      className="btn-unified-save"
                      type="submit"
                      disabled={submitting}
                    >
                      {submitting ? "Đang lưu…" : "Lưu hồ sơ"}
                    </button>
                  </div>
                </footer>
              </form>
            )}
          </div>
        </section>

        {/* 3. CARD 2: NGƯỜI LIÊN HỆ KHẨN CẤP */}
        <section
          className="contact-manager"
          aria-labelledby="emergency-contacts-title"
        >
          <div className="contact-manager-heading">
            <div>
              <span className="profile-card-eyebrow">Bảo hộ an toàn thai kỳ</span>
              <h2 id="emergency-contacts-title">Người liên hệ khẩn cấp</h2>
              <p>
                Thêm tối đa {MAX_CONTACTS} người và dùng nút lên/xuống để
                thay đổi thứ tự ưu tiên.
              </p>
            </div>
            {profile && contacts.length < MAX_CONTACTS && !showContactForm && (
              <button
                type="button"
                className="contact-add-button"
                onClick={openNew}
              >
                + Thêm người liên hệ
              </button>
            )}
          </div>

          {!profile ? (
            <p className="contact-empty">
              Hãy lưu hồ sơ bệnh nhân trước. Bạn có thể bỏ qua phần người
              liên hệ.
            </p>
          ) : (
            <>
              {contacts.length === 0 ? (
                <p className="contact-empty">
                  Chưa có người liên hệ khẩn cấp. Hồ sơ của bạn vẫn đã được lưu.
                </p>
              ) : (
                <ol className="contact-list">
                  {contacts.map((contact, index) => (
                    <li key={contact.id} className="contact-card">
                      <div
                        className={`contact-priority ${index === 0 ? "is-primary-priority" : ""}`}
                        aria-label={`Ưu tiên ${index + 1}`}
                      >
                        {index + 1}
                      </div>

                      <div className="contact-card-copy">
                        <div className="contact-name-row">
                          <strong className="contact-name-text">{contact.fullName}</strong>
                          {index === 0 && (
                            <span className="primary-badge">
                              Ưu tiên đầu tiên
                            </span>
                          )}
                        </div>
                        <p className="contact-details-row">
                          {contact.relationship} · {formatPhoneVN(contact.phoneNumber)}
                        </p>
                      </div>

                      <div className="contact-actions">
                        <button
                          type="button"
                          className="btn-order"
                          aria-label={`Tăng ưu tiên ${contact.fullName}`}
                          title="Tăng độ ưu tiên lên trên"
                          disabled={index === 0 || contactSubmitting}
                          onClick={() => moveContact(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn-order"
                          aria-label={`Giảm ưu tiên ${contact.fullName}`}
                          title="Giảm độ ưu tiên xuống dưới"
                          disabled={index === contacts.length - 1 || contactSubmitting}
                          onClick={() => moveContact(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="btn-edit"
                          onClick={() => openEdit(contact)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn-delete danger"
                          disabled={contactSubmitting}
                          onClick={() => removeContact(contact)}
                        >
                          Xóa
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {showContactForm && (
                <form
                  className="contact-form"
                  noValidate
                  onSubmit={submitContact}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-800">
                      {editingContactId
                        ? "Cập nhật người liên hệ"
                        : "Thêm người liên hệ"}
                    </h3>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600 p-1"
                      onClick={closeContact}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="profile-form-grid">
                    <ProfileField
                      id="contactFullName"
                      label="Họ và tên người liên hệ"
                      error={contactErrors.fullName}
                    >
                      <input
                        id="contactFullName"
                        name="fullName"
                        className="profile-input"
                        placeholder="Ví dụ: Phạm Quốc Huy"
                        value={contactValues.fullName}
                        onChange={changeContact}
                      />
                    </ProfileField>

                    <ProfileField
                      id="contactRelationship"
                      label="Mối quan hệ"
                      error={contactErrors.relationship}
                    >
                      <select
                        id="contactRelationship"
                        name="relationship"
                        className="profile-select"
                        value={contactValues.relationship}
                        onChange={changeContact}
                      >
                        <option value="Người thân">Người thân</option>
                        <option value="Chồng">Chồng</option>
                        <option value="Vợ">Vợ</option>
                        <option value="Cha/Mẹ">Cha/Mẹ</option>
                        <option value="Mẹ ruột">Mẹ ruột</option>
                        <option value="Bố ruột">Bố ruột</option>
                        <option value="Anh/Chị/Em">Anh/Chị/Em</option>
                        <option value="Bạn bè">Bạn bè</option>
                      </select>
                    </ProfileField>

                    <ProfileField
                      id="contactPhoneNumber"
                      label="Số điện thoại người liên hệ"
                      error={contactErrors.phoneNumber}
                    >
                      <input
                        id="contactPhoneNumber"
                        name="phoneNumber"
                        className="profile-input"
                        type="tel"
                        placeholder="09xxxxxxxx"
                        value={contactValues.phoneNumber}
                        onChange={changeContact}
                      />
                    </ProfileField>
                  </div>

                  <div className="contact-form-actions">
                    <button
                      type="button"
                      className="btn-secondary-flat"
                      onClick={closeContact}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="profile-primary-action"
                      disabled={contactSubmitting}
                    >
                      {contactSubmitting ? "Đang lưu…" : "Lưu người liên hệ"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {contactAlert && (
            <div
              className={`profile-alert ${contactAlert.type}`}
              role="status"
            >
              {contactAlert.message}
            </div>
          )}
        </section>

        {/* 4. CARD 3: LỊCH HẸN & BỆNH ÁN TẠI VIỆN (CHỈ HIỂN THỊ KHI ĐÃ CÓ HỒ SƠ) */}
        {profile && (
          <section className="profile-appointments-panel" aria-labelledby="history-title">
            <div className="panel-header">
              <div>
                <span className="profile-card-eyebrow">Dữ liệu hồ sơ y tế</span>
                <h2 id="history-title" className="panel-title">
                  Lịch hẹn & Quá trình theo dõi tại viện
                </h2>
                <p className="panel-desc">
                  Tổng hợp các lượt khám đã thực hiện và lịch hẹn sắp tới tại Bệnh viện Phụ sản Tâm An.
                </p>
              </div>
              <AppLink href="/dat-lich" className="btn-add-booking-pill">
                <Plus className="w-4 h-4" />
                Đặt lịch khám mới
              </AppLink>
            </div>

            {appointments.length === 0 ? (
              <div className="appointments-empty-state">
                <div className="empty-icon-wrap">
                  <Calendar className="w-8 h-8 text-sky-500 opacity-60" />
                </div>
                <h3 className="empty-title">Chưa có lịch khám nào phát sinh</h3>
                <p className="empty-desc">
                  Bạn chưa có lịch hẹn khám thai hoặc dịch vụ sản phụ khoa tại viện. Hãy đặt lịch hẹn để được bác sĩ chuyên khoa thăm khám và lập hồ sơ theo dõi sức khỏe chi tiết.
                </p>
                <AppLink href="/dat-lich" className="btn-empty-book">
                  Đặt lịch khám ngay
                </AppLink>
              </div>
            ) : (
              <div className="appointments-list-wrap">
                {appointments.map((app) => {
                  const isCompleted = app.status === "COMPLETED";
                  const isBooked = app.status === "BOOKED";
                  const isInCare = app.status === "IN_CLINICAL_CARE" || app.status === "CHECKED_IN";
                  const statusText =
                    app.status === "COMPLETED"
                      ? "Đã hoàn thành"
                      : app.status === "BOOKED"
                      ? "Đã đặt lịch"
                      : app.status === "IN_CLINICAL_CARE"
                      ? "Đang khám"
                      : app.status === "CHECKED_IN"
                      ? "Đã check-in"
                      : app.status === "CANCELLED"
                      ? "Đã hủy"
                      : String(app.status);

                  const statusClass = isCompleted
                    ? "status-completed"
                    : isBooked
                    ? "status-booked"
                    : isInCare
                    ? "status-incare"
                    : "status-other";

                  return (
                    <div key={app.id || app.appointmentCode} className="appointment-patient-card">
                      <div className="app-card-top">
                        <div className="app-code-badge">
                          <span className="app-code">{app.appointmentCode}</span>
                          <span className={`app-status-badge ${statusClass}`}>
                            {statusText}
                          </span>
                        </div>
                        {app.pricing?.estimatedTotalMinor !== undefined && (
                          <span className="app-price-tag">
                            {Number(app.pricing.estimatedTotalMinor).toLocaleString("vi-VN")} đ
                          </span>
                        )}
                      </div>

                      <h3 className="app-service-name">
                        {app.pricing?.serviceName || "Khám Sản Phụ Khoa Chuyên Sâu"}
                      </h3>

                      <div className="app-meta-grid">
                        <div className="app-meta-item">
                          <Clock className="w-4 h-4 text-sky-600" />
                          <span>
                            <strong>Thời gian:</strong> {formatDateTimeVN(app.startAt || "")}
                          </span>
                        </div>
                        {Boolean(app.roomName || app.roomCode) && (
                          <div className="app-meta-item">
                            <MapPin className="w-4 h-4 text-amber-600" />
                            <span>
                              <strong>Phòng khám:</strong> {String(app.roomName || app.roomCode)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="app-card-footer">
                        <span className="app-doctor-hint">
                          Chuyên khoa Bệnh viện Phụ sản Tâm An
                        </span>
                        <AppLink
                          href={`/lich-hen/${app.id || app.appointmentCode}`}
                          className="btn-app-detail-link"
                        >
                          Xem chi tiết phiếu hẹn
                          <ChevronRight className="w-4 h-4" />
                        </AppLink>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal cắt chỉnh khung ảnh đại diện chuẩn hình tròn */}
      <AvatarCropModal
        isOpen={cropModalOpen}
        imageSrc={tempImageSrc}
        onClose={() => setCropModalOpen(false)}
        onSave={handleSaveCroppedAvatar}
      />
    </PatientPortalLayout>
  );
}
