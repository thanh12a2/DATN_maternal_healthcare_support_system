import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "../app/AuthSessionProvider";
import { navigate } from "../app/navigation";
import { PatientSidebar } from "../components/navigation/PatientSidebar";
import { LoadingPlaceholder } from "../components/ui/LoadingPlaceholder";
import {
  createAppointment,
  createSlotHold,
  listBookableSlots,
  releaseSlotHold,
  type Appointment,
  type BookableSlot,
  type SelectionMode,
  type SlotHold,
} from "../services/appointment";
import {
  listCatalogServices,
  type CatalogService,
} from "../services/catalog";
import { listDoctors, type Doctor } from "../services/doctor";
import "../styles/patient-booking.css";

const initialDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

const idOf = (value: Record<string, unknown>) =>
  String(value.id ?? value.serviceId ?? value.doctorId ?? "");

const labelOf = (value: Record<string, unknown>) =>
  String(
    value.name ??
      value.displayName ??
      value.fullName ??
      value.slug ??
      value.code ??
      "",
  );

function doctorLabel(doctor: Doctor) {
  const profile = doctor.profile ?? {};
  const rawName = String(doctor.fullName ?? doctor.name ?? profile.fullName ?? doctor.displayName ?? "");
  const name = rawName.replace(/^BS\.?\s*/i, "").trim();
  const title = String(doctor.professionalTitle ?? profile.professionalTitle ?? "").trim();
  return [title, name].filter(Boolean).join(" · ") || idOf(doctor);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorMessage(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu.";
  if (message.includes("rankCode required")) {
    return "Vui lòng nhập mã hạng bác sĩ, ví dụ BASIC.";
  }
  if (message.includes("doctorId required")) {
    return "Vui lòng chọn bác sĩ.";
  }
  return message;
}

function dateOptions() {
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return date.toISOString().slice(0, 10);
  });
}

export function PatientBookingPage() {
  const auth = useAuthSession();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientName, setPatientName] = useState("Tài khoản hiện tại");
  const [serviceId, setServiceId] = useState("");
  const [mode, setMode] = useState<SelectionMode>("RANK");
  const [doctorId, setDoctorId] = useState("");
  const [rank, setRank] = useState("BASIC");
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [selected, setSelected] = useState<BookableSlot | null>(null);
  const [hold, setHold] = useState<SlotHold | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const dates = useMemo(dateOptions, []);
  const selectedService = services.find((service) => idOf(service) === serviceId);
  const selectedDoctor = doctors.find((doctor) => idOf(doctor) === doctorId);
  const morningSlots = slots.filter((slot) => new Date(slot.startAt).getHours() < 12);
  const afternoonSlots = slots.filter((slot) => new Date(slot.startAt).getHours() >= 12);

  useEffect(() => {
    let active = true;
    Promise.all([
      listCatalogServices(auth.request),
      auth.request<{ data?: { fullName?: string } }>("/api/patients/me"),
    ])
      .then(([catalog, patient]) => {
        if (!active) return;
        setServices(catalog);
        if (patient.data?.fullName) setPatientName(patient.data.fullName);
        setLoading(false);
      })
      .catch((reason) => {
        if (!active) return;
        setError(errorMessage(reason));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth.request]);

  useEffect(() => {
    if (mode !== "DOCTOR") return;
    void listDoctors(auth.request)
      .then(setDoctors)
      .catch((reason) => setError(errorMessage(reason)));
  }, [auth.request, mode]);

  useEffect(() => {
    if (!hold) return;
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hold]);

  useEffect(() => {
    if (seconds !== 0 || !hold) return;
    void releaseSlotHold(auth.request, hold.id).catch(() => undefined);
    setHold(null);
    setSelected(null);
  }, [auth.request, hold, seconds]);

  useEffect(
    () => () => {
      if (hold) void releaseSlotHold(auth.request, hold.id).catch(() => undefined);
    },
    [auth.request, hold],
  );

  async function loadSlots() {
    if (!serviceId) {
      setError("Vui lòng chọn dịch vụ khám.");
      return;
    }
    if (mode === "RANK" && !rank.trim()) {
      setError("Vui lòng nhập mã hạng bác sĩ, ví dụ BASIC.");
      return;
    }
    if (mode === "DOCTOR" && !doctorId) {
      setError("Vui lòng chọn bác sĩ.");
      return;
    }

    setLoadingSlots(true);
    setError("");
    setSuccess("");
    setSelected(null);
    setAppointment(null);
    try {
      const from = new Date(`${date}T08:00:00+07:00`).toISOString();
      const to = new Date(`${date}T18:00:00+07:00`).toISOString();
      setSlots(
        await listBookableSlots(auth.request, {
          serviceId,
          selectionMode: mode,
          from,
          to,
          requestedDoctorId: mode === "DOCTOR" ? doctorId : undefined,
          requestedRankCode: mode === "RANK" ? rank.trim() : undefined,
        }),
      );
    } catch (reason) {
      setError(errorMessage(reason));
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function selectSlot(slot: BookableSlot) {
    if (hold) await releaseSlotHold(auth.request, hold.id).catch(() => undefined);
    setSelected(slot);
    setAppointment(null);
    setSuccess("");
    setError("");
    try {
      const nextHold = await createSlotHold(auth.request, {
        serviceId,
        selectionMode: mode,
        requestedDoctorId: mode === "DOCTOR" ? doctorId : undefined,
        requestedRankCode: mode === "RANK" ? slot.rankCode || rank.trim() : undefined,
        startAt: slot.startAt,
        endAt: slot.endAt,
      });
      setHold(nextHold);
      setSeconds(Math.max(0, Math.ceil((Date.parse(nextHold.expiresAt) - Date.now()) / 1000)));
    } catch (reason) {
      setSelected(null);
      setError(errorMessage(reason));
    }
  }

  async function confirmBooking() {
    if (!hold) return;
    setError("");
    try {
      const created = await createAppointment(auth.request, hold.id);
      setAppointment(created);
      setSuccess("Đặt lịch thành công. Vui lòng lưu lại mã lịch hẹn.");
      setHold(null);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  function clearSelection() {
    if (hold) void releaseSlotHold(auth.request, hold.id).catch(() => undefined);
    setHold(null);
    setSelected(null);
    setAppointment(null);
    setSuccess("");
  }

  const modeLabel = mode === "DOCTOR" ? "Bác sĩ cụ thể" : `Hạng ${rank || "chưa chọn"}`;
  const countdown = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="patient-home-shell patient-desktop-portal">
      <PatientSidebar
        onLogout={() => void auth.signOut().then(() => navigate("/dang-nhap", { replace: true }))}
      />
      <main className="patient-main-view">
        <header className="patient-topbar">
          <div>
            <span>Chọn dịch vụ và khung giờ</span>
            <strong>Đặt lịch khám</strong>
          </div>
        </header>
        <section className="booking-page-content">
          <div className="booking-page-intro">
            <span className="booking-eyebrow">Đặt lịch khám</span>
            <h1>Chọn dịch vụ và thời gian</h1>
            <p>
              Chọn nhu cầu khám, bác sĩ phù hợp và một khung giờ thuận tiện. Bạn có thể
              xem lại mọi thông tin trước khi xác nhận.
            </p>
          </div>

          <LoadingPlaceholder visible={loading} label="Đang tải thông tin đặt lịch" />
          <div className="booking-page-grid">
              <div className="booking-workspace">
                <article className="booking-panel">
                  <header className="booking-panel-head">
                    <div>
                      <h2>Thông tin buổi khám</h2>
                      <p>Các lựa chọn được hiển thị theo dữ liệu thật từ hệ thống.</p>
                    </div>
                  </header>
                  <div className="booking-fields">
                    <label className="booking-field booking-field-full">
                      <span>Dịch vụ khám</span>
                      <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                        <option value="">Chọn dịch vụ</option>
                        {services.map((service) => (
                          <option key={idOf(service)} value={idOf(service)}>
                            {labelOf(service) || idOf(service)}
                          </option>
                        ))}
                      </select>
                      <small>Mức phí sẽ hiển thị khi Appointment API trả về pricing.</small>
                    </label>
                    <label className="booking-field">
                      <span>Hình thức chọn bác sĩ</span>
                      <select value={mode} onChange={(event) => { setMode(event.target.value as SelectionMode); setSlots([]); clearSelection(); }}>
                        <option value="RANK">Chọn theo hạng tư vấn</option>
                        <option value="DOCTOR">Chọn bác sĩ cụ thể</option>
                      </select>
                    </label>
                    {mode === "DOCTOR" ? (
                      <label className="booking-field">
                        <span>Bác sĩ</span>
                        <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                          <option value="">Chọn bác sĩ</option>
                          {doctors.map((doctor) => (
                            <option key={idOf(doctor)} value={idOf(doctor)}>
                              {doctorLabel(doctor)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="booking-field">
                        <span>Hạng tư vấn</span>
                        <input value={rank} onChange={(event) => setRank(event.target.value)} placeholder="Ví dụ: BASIC" />
                      </label>
                    )}
                    <label className="booking-field">
                      <span>Ngày khám</span>
                      <input type="date" value={date} min={dates[0]} onChange={(event) => { setDate(event.target.value); setSlots([]); clearSelection(); }} />
                    </label>
                    <label className="booking-field">
                      <span>Người khám</span>
                      <input value={patientName} readOnly />
                    </label>
                  </div>
                  <div className="booking-load-row">
                    <p aria-live="polite">{loadingSlots ? "Đang tải khung giờ…" : "Chọn ngày và tải các khung giờ còn trống."}</p>
                    <button className="booking-button booking-button-secondary" type="button" onClick={() => void loadSlots()} disabled={loadingSlots || !serviceId}>
                      {loadingSlots ? "Đang tải…" : "Tải khung giờ"}
                    </button>
                  </div>
                </article>

                <article className="booking-panel">
                  <header className="booking-panel-head">
                    <div>
                      <h2>Chọn ngày và khung giờ</h2>
                      <p>Khung giờ hết chỗ sẽ không thể chọn.</p>
                    </div>
                  </header>
                  <div className="booking-slots-head">
                    <h3>Khung giờ còn trống</h3>
                    <span>{slots.length ? `${slots.length} khung giờ` : formatDate(date)}</span>
                  </div>
                  {!slots.length ? (
                    <p className="booking-empty">Chưa có dữ liệu khung giờ. Hãy chọn dịch vụ và bấm “Tải khung giờ”.</p>
                  ) : (
                    <div className="booking-slot-groups">
                      {([
                        ["Buổi sáng", morningSlots],
                        ["Buổi chiều", afternoonSlots],
                      ] as Array<[string, BookableSlot[]]>).map(([label, group]) => (
                        group.length > 0 && (
                          <div className="booking-slot-group" key={label}>
                            <span>{label}</span>
                            <div className="booking-slots">
                              {group.map((slot) => (
                                <button key={slot.startAt} className={`booking-slot ${selected?.startAt === slot.startAt ? "is-selected" : ""}`} type="button" onClick={() => void selectSlot(slot)}>
                                  {formatTime(slot.startAt)}
                                  <small>{slot.availableCapacity ? `${slot.availableCapacity} chỗ` : "Còn chỗ"}</small>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </article>

                {(error || success) && <p className={`booking-feedback ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>{error || success}</p>}
              </div>

              <aside className="booking-summary-card">
                <div className="booking-summary-top">
                  <span className="booking-eyebrow">Tóm tắt lịch khám</span>
                  <h2>{appointment ? "Lịch hẹn đã được tạo" : "Kiểm tra trước khi tiếp tục"}</h2>
                  <p>{appointment ? "Thông tin này đã được ghi nhận trong Appointment Service." : "Thông tin chỉ được giữ tạm thời trước khi xác nhận."}</p>
                </div>
                <div className="booking-summary-body">
                  <div className="booking-summary-row"><span>Dịch vụ</span><strong>{labelOf(selectedService ?? {}) || "Chưa chọn"}</strong></div>
                  <div className="booking-summary-row"><span>Hình thức</span><strong>{selectedDoctor ? doctorLabel(selectedDoctor) : modeLabel}</strong></div>
                  <div className="booking-summary-row"><span>Ngày khám</span><strong>{formatDate(date)}</strong></div>
                  <div className="booking-summary-row"><span>Khung giờ</span><strong>{selected ? `${formatTime(selected.startAt)} – ${formatTime(selected.endAt)}` : "Chưa chọn"}</strong></div>
                  {appointment && <div className="booking-summary-row"><span>Mã lịch hẹn</span><strong>{appointment.appointmentCode || appointment.id || "Đã tạo"}</strong></div>}
                  {hold && !appointment && <div className="booking-hold"><span>Thời gian giữ lựa chọn</span><strong>{countdown}</strong></div>}
                  {appointment ? (
                    <button className="booking-button booking-button-primary" type="button" onClick={() => navigate("/lich-hen")}>Xem lịch hẹn</button>
                  ) : (
                    <button className="booking-button booking-button-primary" type="button" disabled={!hold} onClick={() => void confirmBooking()}>Tiếp tục xác nhận</button>
                  )}
                  {hold && !appointment && <button className="booking-clear-button" type="button" onClick={clearSelection}>Bỏ chọn khung giờ</button>}
                  <p className="booking-summary-note">Lịch hẹn chưa tạo queue ticket. Bạn sẽ được check-in tại quầy khi đến phòng khám.</p>
                </div>
              </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
