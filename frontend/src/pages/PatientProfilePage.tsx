import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useAuthSession } from "../app/AuthSessionProvider";
import { AppLink } from "../app/navigation";
import { ProfileField } from "../components/profile/ProfileField";
import { ProfileProgress } from "../components/profile/ProfileProgress";
import { ProfileSection } from "../components/profile/ProfileSection";
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
} from "../schemas/patientProfile";
import { ApiError } from "../services/api";
import type { EmergencyContact, PatientProfile } from "../services/patient";
import "../styles/patient-profile.css";

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
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

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
      .then(({ data }) => {
        if (!active) return;
        const next = {
          ...emptyPatientProfile,
          fullName: data.fullName,
          birthDate: data.dateOfBirth,
          phoneNumber: data.phoneNumber,
          address: data.address || "",
        };
        setProfile(data);
        setContacts(sortContacts(data.emergencyContacts));
        setValues(next);
        setInitialSnapshot(snapshot(next));
        setIsNewProfile(false);
        if (auth.user?.userId) clearDraft(auth.user.userId);
        setLoading(false);
      })
      .catch((reason) => {
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
        } else {
          setAlert({
            type: "error",
            message:
              reason instanceof Error ? reason.message : "Không thể tải hồ sơ.",
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
        message: "Vui lòng kiểm tra lại các thông tin được đánh dấu.",
      });
      return;
    }
    if (!changed) {
      setAlert({
        type: "success",
        message: "Hồ sơ không có thay đổi cần lưu.",
      });
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
      if (auth.user?.userId) clearDraft(auth.user.userId);
      setValues((current) => ({ ...current, nationalId: "" }));
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

  if (loading) {
    return (
      <main className="profile-page-shell">
        <section className="profile-page">
          <AppLink className="profile-back-link" href="/tong-quan">
            ← Quay lại Tổng quan
          </AppLink>
          <p role="status">Đang tải hồ sơ…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="profile-page-shell" id="main-content">
      <section className="profile-page">
        <AppLink className="profile-back-link" href="/tong-quan">
          ← Quay lại Tổng quan
        </AppLink>
        <header className="profile-page-heading">
          <div>
            <span>Hồ sơ của bạn</span>
            <h1>Hoàn thiện thông tin bệnh nhân</h1>
            <p>
              Hồ sơ bệnh nhân và danh sách liên hệ khẩn cấp được lưu độc lập.
              Bạn có thể thêm người liên hệ sau.
            </p>
          </div>
        </header>

        <div className="profile-content-layout">
          <aside className="profile-progress-sticky">
            <ProfileProgress value={progress} />
          </aside>
          <div className="profile-main-content">
            <form
              ref={formRef}
              className="profile-form-shell"
              noValidate
              onSubmit={submitProfile}
            >
              <ProfileSection
                number="01"
                title="Thông tin cá nhân"
                description="Thông tin định danh cơ bản của người bệnh."
              >
                <ProfileField
                  id="fullName"
                  label="Họ và tên"
                  error={errors.fullName}
                >
                  <input
                    id="fullName"
                    className="profile-input"
                    autoComplete="name"
                    {...input("fullName")}
                  />
                </ProfileField>
                <ProfileField
                  id="birthDate"
                  label="Ngày sinh"
                  error={errors.birthDate}
                >
                  <input
                    id="birthDate"
                    type="date"
                    className="profile-input"
                    max={new Date().toISOString().slice(0, 10)}
                    {...input("birthDate")}
                  />
                </ProfileField>
                <ProfileField
                  id="gender"
                  label="Giới tính"
                  hint="Patient Service chưa hỗ trợ lưu trường này."
                >
                  <select id="gender" className="profile-select" disabled>
                    <option>Chưa khả dụng</option>
                  </select>
                </ProfileField>
                <ProfileField
                  id="nationalId"
                  label="Số CCCD / CMND"
                  error={errors.nationalId}
                  hint={
                    hasStoredNationalId && !values.nationalId
                      ? `Đã lưu: ${profile?.nationalIdMasked}. Nhập lại khi cập nhật hồ sơ.`
                      : undefined
                  }
                >
                  <input
                    id="nationalId"
                    className="profile-input"
                    inputMode="numeric"
                    placeholder={
                      profile?.nationalIdMasked || "Nhập 9 hoặc 12 chữ số"
                    }
                    {...input("nationalId")}
                  />
                </ProfileField>
                <ProfileField
                  id="phoneNumber"
                  label="Số điện thoại"
                  error={errors.phoneNumber}
                >
                  <input
                    id="phoneNumber"
                    className="profile-input"
                    type="tel"
                    {...input("phoneNumber")}
                  />
                </ProfileField>
              </ProfileSection>

              <ProfileSection
                number="02"
                title="Địa chỉ"
                description="Thông tin liên lạc khi bệnh viện cần hỗ trợ."
              >
                <ProfileField
                  id="address"
                  label="Địa chỉ hiện tại"
                  full
                  error={errors.address}
                >
                  <input
                    id="address"
                    className="profile-input"
                    {...input("address")}
                  />
                </ProfileField>
              </ProfileSection>

              <ProfileSection
                number="03"
                title="Thông tin sức khỏe"
                description="Các trường này đang chờ contract từ service sở hữu hồ sơ y tế."
              >
                <ProfileField
                  id="bloodType"
                  label="Nhóm máu"
                  optional
                  hint="Chưa khả dụng"
                >
                  <select id="bloodType" className="profile-select" disabled>
                    <option>Chưa khả dụng</option>
                  </select>
                </ProfileField>
                <ProfileField
                  id="insurance"
                  label="Mã thẻ BHYT"
                  optional
                  hint="Chưa khả dụng"
                >
                  <input id="insurance" className="profile-input" disabled />
                </ProfileField>
              </ProfileSection>

              {alert && (
                <div className={`profile-alert ${alert.type}`} role="status">
                  {alert.message}
                </div>
              )}
              <footer className="profile-form-footer">
                <p>
                  Người liên hệ khẩn cấp không bắt buộc và không ảnh hưởng việc
                  lưu hồ sơ.
                </p>
                <button
                  className="profile-primary-action"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Đang lưu…" : "Lưu hồ sơ"}
                </button>
              </footer>
            </form>

            <section
              className="contact-manager"
              aria-labelledby="emergency-contacts-title"
            >
              <div className="contact-manager-heading">
                <div>
                  <span>Không bắt buộc</span>
                  <h2 id="emergency-contacts-title">Người liên hệ khẩn cấp</h2>
                  <p>
                    Thêm tối đa {MAX_CONTACTS} người và dùng nút lên/xuống để
                    thay đổi thứ tự ưu tiên.
                  </p>
                </div>
                {profile &&
                  contacts.length < MAX_CONTACTS &&
                  !showContactForm && (
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
                      Chưa có người liên hệ khẩn cấp. Hồ sơ của bạn vẫn đã được
                      lưu.
                    </p>
                  ) : (
                    <ol className="contact-list">
                      {contacts.map((contact, index) => (
                        <li key={contact.id} className="contact-card">
                          <div
                            className="contact-priority"
                            aria-label={`Ưu tiên ${index + 1}`}
                          >
                            {index + 1}
                          </div>
                          <div className="contact-card-copy">
                            <div>
                              <strong>{contact.fullName}</strong>
                              {index === 0 && (
                                <span className="primary-badge">
                                  Ưu tiên đầu tiên
                                </span>
                              )}
                            </div>
                            <p>
                              {contact.relationship} · {contact.phoneNumber}
                            </p>
                          </div>
                          <div className="contact-actions">
                            <button
                              type="button"
                              aria-label={`Tăng ưu tiên ${contact.fullName}`}
                              disabled={index === 0 || contactSubmitting}
                              onClick={() => moveContact(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              aria-label={`Giảm ưu tiên ${contact.fullName}`}
                              disabled={
                                index === contacts.length - 1 ||
                                contactSubmitting
                              }
                              onClick={() => moveContact(index, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(contact)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="danger"
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
                      <h3>
                        {editingContactId
                          ? "Cập nhật người liên hệ"
                          : "Thêm người liên hệ"}
                      </h3>
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
                            value={contactValues.phoneNumber}
                            onChange={changeContact}
                          />
                        </ProfileField>
                      </div>
                      <div className="contact-form-actions">
                        <button type="button" onClick={closeContact}>
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className="profile-primary-action"
                          disabled={contactSubmitting}
                        >
                          {contactSubmitting
                            ? "Đang lưu…"
                            : "Lưu người liên hệ"}
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
          </div>
        </div>
      </section>
    </main>
  );
}
