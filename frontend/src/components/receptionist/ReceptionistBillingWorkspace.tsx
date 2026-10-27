import { useState } from 'react';
import type { Requester } from '../../services/catalog';
import { ApiError } from '../../services/api';
import {
  admitReceptionCase,
  getReceptionCaseByAppointment,
  listReceptionAppointments,
  listReceptionInvoices,
  readReceptionSelection,
  recordReceptionCashPayment,
  type ReceptionInvoice,
} from '../../services/operations';
import '../../styles/receptionist-workspace.css';

const messageOf = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Không thể tải hóa đơn.';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveAppointmentId(
  request: Requester,
  value: string,
  patientId: string,
): Promise<string> {
  if (UUID_PATTERN.test(value)) return value;

  const selected = readReceptionSelection();
  const appointments = await listReceptionAppointments(
    request,
    patientId || selected?.patientId,
  );
  const match = appointments.find(
    (item) => item.appointmentCode?.toLowerCase() === value.toLowerCase(),
  );

  if (!match?.id || !UUID_PATTERN.test(match.id)) {
    throw new Error(
      `Không tìm thấy lịch hẹn tương ứng với mã ${value}. Hãy chọn lịch hẹn từ flow tiếp nhận.`,
    );
  }
  return match.id;
}

export function ReceptionistBillingWorkspace({
  request,
}: {
  request: Requester;
}) {
  const [patientId, setPatientId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [items, setItems] = useState<ReceptionInvoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function find() {
    const nextPatientId = patientId.trim();
    const enteredAppointmentId = appointmentId.trim();

    if (!nextPatientId && !enteredAppointmentId) {
      setMessage('Nhập Patient ID hoặc Appointment ID để tra cứu hóa đơn.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const resolvedAppointmentId = enteredAppointmentId
        ? await resolveAppointmentId(
            request,
            enteredAppointmentId,
            nextPatientId,
          )
        : undefined;

      setItems(
        await listReceptionInvoices(request, {
          patientId: nextPatientId || undefined,
          appointmentId: resolvedAppointmentId,
        }),
      );
      if (
        resolvedAppointmentId &&
        resolvedAppointmentId !== enteredAppointmentId
      ) {
        setAppointmentId(resolvedAppointmentId);
      }
      setMessage('Đã tải danh sách hóa đơn.');
    } catch (error) {
      setMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function pay(invoice: ReceptionInvoice) {
    setBusy(true);
    setMessage('');
    try {
      if (invoice.status !== 'PAID') {
        await recordReceptionCashPayment(request, invoice);
      }
      const selected = readReceptionSelection();
      const storedCaseId = window.sessionStorage.getItem('an-tam-receptionist-case') ?? '';
      let caseId = storedCaseId;

      if (!caseId && invoice.appointmentId) {
        try {
          const receptionCase = await getReceptionCaseByAppointment(request, invoice.appointmentId);
          if (receptionCase?.id) {
            caseId = receptionCase.id;
            window.sessionStorage.setItem('an-tam-receptionist-case', caseId);
          }
        } catch (error) {
          if (!(error instanceof ApiError && error.statusCode === 404)) throw error;
        }
      }

      if (!caseId && selected?.appointmentId === invoice.appointmentId) {
        setMessage(invoice.status === 'PAID'
          ? 'Hóa đơn đã thanh toán. Vui lòng mở lại bước Check-in để tiếp tục tạo hàng đợi.'
          : 'Đã thanh toán. Vui lòng mở lại bước Check-in để tiếp tục tạo hàng đợi.');
      } else if (!caseId) {
        setMessage(invoice.status === 'PAID'
          ? 'Hóa đơn đã thanh toán nhưng chưa tìm thấy hồ sơ tiếp nhận để tạo hàng đợi.'
          : 'Đã thanh toán tiền mặt nhưng chưa tìm thấy hồ sơ tiếp nhận để tạo hàng đợi.');
      } else {
        const admission = await admitReceptionCase(request, caseId) as {
          status?: string;
          admission?: { status?: string; queueJourneyId?: string; queueTicketId?: string };
          data?: { admission?: { status?: string; queueJourneyId?: string; queueTicketId?: string } };
        };
        const admissionData = admission.data ?? admission;
        const admissionState = admissionData.admission?.status ?? admission.status;
        if (admissionState === 'COMPLETED' || admissionData.admission?.queueJourneyId) {
          setMessage('Đã thanh toán và tạo hàng đợi thành công.');
        } else {
          setMessage('Đã thanh toán nhưng Admission chưa hoàn tất: ' + (admissionState ?? 'đang xử lý') + '.');
        }
      }
      await find();
    } catch (error) {
      setMessage(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="view-heading">
        <div>
          <span className="view-kicker">Payment desk</span>
          <h1>Hóa đơn</h1>
        </div>
      </header>
      <section className="surface-panel billing-filter">
        <label className="filter-field">
          Patient ID (UUID)
          <input
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            placeholder="Chọn từ flow tiếp nhận"
          />
        </label>
        <label className="filter-field filter-grow">
          Appointment ID / mã lịch
          <input
            value={appointmentId}
            onChange={(event) => setAppointmentId(event.target.value)}
            placeholder="UUID hoặc APTM..."
          />
        </label>
        <button
          className="solid-action"
          type="button"
          disabled={busy || (!patientId.trim() && !appointmentId.trim())}
          onClick={() => void find()}
        >
          Tìm hóa đơn
        </button>
      </section>
      <section className="surface-panel invoice-list">
        <header className="panel-title">
          <h2>Hóa đơn</h2>
          <span>{items.length.toString().padStart(2, '0')}</span>
        </header>
        {items.length ? (
          items.map((invoice) => (
            <article className="invoice-row" key={invoice.id}>
              <span>
                <strong>{invoice.invoiceNumber ?? invoice.id ?? 'Hóa đơn'}</strong>
                <small>Trạng thái: {invoice.status ?? '—'}</small>
              </span>
              <span>
                <strong>
                  {(invoice.balanceMinor ?? invoice.totalMinor ?? 0).toLocaleString('vi-VN')}{' '}
                  {invoice.currency ?? 'VND'}
                </strong>
                <small>Còn phải thu</small>
              </span>
              <button
                className="quiet-action"
                type="button"
                disabled={busy || !invoice.id}
                onClick={() => void pay(invoice)}
              >
                {invoice.status === 'PAID' ? 'Tiếp tục tạo hàng đợi' : 'Thu tiền mặt'}
              </button>
            </article>
          ))
        ) : (
          <p className="panel-empty">
            Nhập Patient ID hoặc Appointment ID từ flow tiếp nhận để tra cứu hóa đơn.
          </p>
        )}
      </section>
      <p className="inline-status" role="status">
        {busy ? 'Đang xử lý…' : message}
      </p>
    </>
  );
}
