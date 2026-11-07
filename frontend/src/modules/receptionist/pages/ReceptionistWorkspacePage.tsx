import {
  DownOutlined,
  LogoutOutlined,
  ReloadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  ConfigProvider,
  DatePicker,
  Dropdown,
  Select,
  Skeleton,
} from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import { ApiError } from '../../../services/api';
import {
  cancelAppointment,
  checkInAppointment,
  collectCash,
  createReceptionVnpayAttempt,
  createWalkInAppointment,
  fetchCatalog,
  fetchDayAppointments,
  loadPatientWorkspace,
  refreshAppointment,
  searchDesk,
  fetchPatientDetails,
  type AppointmentSource,
  type AppointmentStatus,
  type DeskAppointment,
  type DeskInvoice,
  type DeskCatalog,
  type DeskPatient,
  type PatientMap,
  type WalkInInput,
} from '../../../services/receptionDesk';
import {
  COMPLETED_VNPAY_RETURN_KEY,
  PENDING_VNPAY_RETURN_KEY,
  readVnpayContext,
  type VnpayReturnContext,
} from '../../../services/vnpayReturn';
import { AppointmentDrawer } from '../components/AppointmentDrawer';
import { AppointmentTable } from '../components/AppointmentTable';
import { PatientSearchBar } from '../components/PatientSearchBar';
import { SearchResults } from '../components/SearchResults';
import { StatsStrip } from '../components/StatsStrip';
import { WalkInModal } from '../components/WalkInModal';
import { UserChip } from '../../../shared/components/navigation/UserChip';
import { useReceptionRealtime } from '../hooks/useReceptionRealtime';
import { sortByStart, sourceMeta, statusMeta } from '../utils/appointmentMeta';

dayjs.locale('vi');

interface SearchState {
  found: DeskPatient[];
  patients: PatientMap;
  appointments: DeskAppointment[];
}
const errText = (e: unknown) =>
  e instanceof ApiError || e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.';

function Desk() {
  const { message } = AntApp.useApp();
  const auth = useAuthSession();
  const { request } = auth;

  const [vnpayReturnContext] = useState<VnpayReturnContext | null>(() => {
    const value = readVnpayContext(COMPLETED_VNPAY_RETURN_KEY);
    if (value) window.sessionStorage.removeItem(COMPLETED_VNPAY_RETURN_KEY);
    return value;
  });

  const [catalog, setCatalog] = useState<DeskCatalog | null>(null);
  const [rows, setRows] = useState<DeskAppointment[]>([]);
  const [patients, setPatients] = useState<PatientMap>(() => vnpayReturnContext?.patient ? { [vnpayReturnContext.patient.id]: vnpayReturnContext.patient } : {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(() => vnpayReturnContext?.page.query ?? '');
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searching, setSearching] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [targetAppointmentId, setTargetAppointmentId] = useState<string | null>(null);
  const skipSearchRef = useRef(false);
  const [room, setRoom] = useState(() => vnpayReturnContext?.page.room ?? 'P.201');
  const [date, setDate] = useState(() => vnpayReturnContext?.page.date ? dayjs(vnpayReturnContext.page.date) : dayjs());
  const [status, setStatus] = useState<AppointmentStatus | undefined>(() => vnpayReturnContext?.page.status as AppointmentStatus | undefined);
  const [source, setSource] = useState<AppointmentSource | undefined>(() => vnpayReturnContext?.page.source as AppointmentSource | undefined);
  const [openId, setOpenId] = useState<string | null>(() => vnpayReturnContext?.appointment.id ?? null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const dateStr = date.format('YYYY-MM-DD');
  const trimmed = query.trim();

  // User display info
  const userEmail = auth.user?.email || 'reception.hoangyen@antam.local';
  const userName = userEmail.split('@')[0];
  const userInitials = userName.slice(0, 2).toUpperCase();

  // Khóa lịch sử trình duyệt khi đang ở Bàn tiếp đón Lễ tân:
  // Ngăn chặn nút Back trên trình duyệt hoặc thao tác vuốt quay lại trang Cổng bệnh nhân
  useEffect(() => {
    const currentUrl = window.location.href;
    window.history.pushState(null, '', currentUrl);

    const handlePopState = () => {
      // Giữ nguyên trạng thái ở bàn tiếp đón, ngăn không cho back ra trang bệnh nhân
      window.history.pushState(null, '', currentUrl);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/dang-nhap', { replace: true });
    } catch {
      navigate('/dang-nhap', { replace: true });
    }
  };

  useEffect(() => {
    fetchCatalog(request)
      .then(setCatalog)
      .catch((e) => setError(errText(e)));
  }, [request]);

  useEffect(() => {
    if (!catalog) return;
    let live = true;
    setLoading(true);
    setError('');
    fetchDayAppointments(request, catalog, dateStr)
      .then((r) => {
        if (live) {
          setRows(r.rows);
          setPatients((cur) => ({ ...cur, ...r.patients }));
        }
      })
      .catch((e) => {
        if (live) setError(errText(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [request, catalog, dateStr, reload]);

  // ─── TÍCH HỢP SSE REALTIME STREAM (ĐỒNG BỘ 2 CHIỀU TỨC THÌ) ───────────────
  const { isLive } = useReceptionRealtime({
    selectedDateStr: dateStr,
    streamFn: auth.stream,
    onNewAppointment: async () => {
      // Khi có bệnh nhân vừa đặt lịch mới, tải lại danh sách và các chỉ số StatsStrip ngay tức thì
      setReload((n) => n + 1);
    },
    onAppointmentUpdate: (evt) => {
      setRows((cur) =>
        cur.map((a) => {
          if (a.id === evt.appointmentId) {
            return {
              ...a,
              status: (evt.status as AppointmentStatus) || a.status,
              queueCode: evt.ticketCode || a.queueCode,
              roomCode: evt.roomCode || a.roomCode,
              roomName: evt.roomName || a.roomName,
              updatedAt: evt.updatedAt || a.updatedAt,
            };
          }
          return a;
        })
      );
      // Đồng thời cập nhật lại thống kê các ca hẹn
      setReload((n) => n + 1);
    },
    onRefetch: () => {
      setReload((n) => n + 1);
    },
  });

  useEffect(() => {
    if (!catalog || trimmed.length < 2) {
      setSearch(null);
      return;
    }
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    let live = true;
    setSearching(true);
    searchDesk(request, catalog, trimmed)
      .then((r) => {
        if (live) setSearch(r);
      })
      .catch((e) => {
        if (live) {
          setSearch({ found: [], patients: {}, appointments: [] });
          message.error(errText(e));
        }
      })
      .finally(() => {
        if (live) setSearching(false);
      });
    return () => {
      live = false;
    };
  }, [request, catalog, trimmed, message]);

  const obgynRows = useMemo(() => {
    const codes = new Set((catalog?.rooms ?? []).map((r) => r.code));
    return rows.filter((a) => codes.has(a.roomCode));
  }, [rows, catalog]);

  const dayRoomList = useMemo(
    () => obgynRows.filter((a) => room === 'ALL' || a.roomCode === room),
    [obgynRows, room]
  );

  const tableData = useMemo(
    () =>
      sortByStart(
        dayRoomList.filter(
          (a) => (!status || a.status === status) && (!source || a.source === source)
        )
      ),
    [dayRoomList, status, source]
  );

  const waiting = useMemo(() => {
    const w: Record<string, number> = {};
    obgynRows
      .filter((a) => a.status === 'CHECKED_IN')
      .forEach((a) => {
        w[a.roomCode] = (w[a.roomCode] ?? 0) + 1;
      });
    return w;
  }, [obgynRows]);

  const roomOptions = useMemo(() => {
    const list = catalog?.rooms ?? [];
    return [
      {
        value: 'ALL',
        label: 'Tất cả phòng',
      },
      ...list.map((r) => {
        const waitCount = waiting[r.code] ?? 0;
        return {
          value: r.code,
          label: `${r.code} - ${r.doctorName || r.name}${waitCount > 0 ? ` (${waitCount} ca chờ)` : ''}`,
        };
      }),
    ];
  }, [catalog, waiting]);

  useEffect(() => {
    if (catalog?.rooms?.length && !catalog.rooms.some((r) => r.code === room) && room !== 'ALL') {
      setRoom(catalog.rooms[0].code);
    }
  }, [catalog, room]);

  const allPatients = useMemo(
    () => ({ ...patients, ...(search?.patients ?? {}) }),
    [patients, search]
  );

  const [openAppointment, setOpenAppointment] = useState<DeskAppointment | null>(() => vnpayReturnContext?.appointment ?? null);

  const handleOpenAppointment = (a: DeskAppointment) => {
    setOpenAppointment(a);
    setOpenId(a.id);
  };

  const opened = useMemo(
    () =>
      [...rows, ...(search?.appointments ?? [])].find((a) => a.id === openId || a.code === openId) ?? openAppointment,
    [rows, search, openId, openAppointment]
  );

  const replace = (n: DeskAppointment) => {
    setRows((cur) => cur.map((a) => (a.id === n.id ? n : a)));
    setSearch((cur) =>
      cur
        ? {
            ...cur,
            appointments: cur.appointments.map((a) => (a.id === n.id ? n : a)),
          }
        : cur
    );
  };

  useEffect(() => {
    if (!catalog || !vnpayReturnContext) return;
    let live = true;
    const refreshReturnedInvoice = async () => {
      try {
        let latest = vnpayReturnContext.appointment;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          latest = await refreshAppointment(request, catalog, latest);
          if (!live) return;
          setOpenAppointment(latest);
          replace(latest);
          const settledInvoice = latest.invoices?.find((invoice) => invoice.id === vnpayReturnContext.invoiceId) ?? latest.invoice;
          if (settledInvoice && settledInvoice.balance <= 0) {
            if (vnpayReturnContext.completeCheckInAfterPayment && latest.status === 'BOOKED') {
              const checkIn = await checkInAppointment(request, latest);
              latest = await refreshAppointment(request, catalog, latest);
              if (!live) return;
              setOpenAppointment(latest);
              replace(latest);
              message.success(`VNPay đã xác nhận thanh toán; check-in hoàn tất${checkIn.ticketCode ? `, số thứ tự ${checkIn.ticketCode}` : ''}.`);
            } else {
              message.success('VNPay đã xác nhận thanh toán. Hóa đơn đã được cập nhật.');
            }
            return;
          }
          if (attempt < 4) await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
        if (vnpayReturnContext.responseCode && vnpayReturnContext.responseCode !== '00') {
          message.warning('VNPay trả về giao dịch chưa thành công. Hóa đơn vẫn chưa được ghi nhận đã thanh toán.');
        } else {
          message.info('Đã quay lại đúng hồ sơ. Hệ thống đang chờ VNPay xác nhận hóa đơn; bạn có thể làm mới để kiểm tra lại.');
        }
      } catch (error) {
        if (live) message.error(`Không thể làm mới hóa đơn sau khi quay lại: ${errText(error)}`);
      }
    };
    void refreshReturnedInvoice();
    return () => { live = false; };
  }, [catalog, message, request, vnpayReturnContext]);

  const run = async (a: DeskAppointment, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      if (catalog) replace(await refreshAppointment(request, catalog, a));
    } catch (e) {
      message.error(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const checkIn = (a: DeskAppointment) =>
    run(a, async () => {
      const r = await checkInAppointment(request, a);
      if (r.awaitingPayment) {
        message.warning(
          'Cần thanh toán hóa đơn trước khi check-in. Mở chi tiết → Hóa đơn để thu tiền.'
        );
        setOpenId(a.id);
      } else {
        message.success('Check-in thành công, bệnh nhân đã vào hàng đợi.');
      }
    });

  const cancel = (a: DeskAppointment) =>
    run(a, async () => {
      await cancelAppointment(request, a, 'Lễ tân hủy lịch theo yêu cầu bệnh nhân');
      message.success('Đã hủy lịch hẹn');
    });

  const collect = (a: DeskAppointment, invoice: DeskInvoice | undefined = a.invoice ?? undefined) =>
    run(a, async () => {
      if (!invoice) return;
      await collectCash(request, invoice);
      message.success('Đã thu tiền thành công');
    });

  const payVnpay = async (a: DeskAppointment, invoice: DeskInvoice) => {
    setBusy(true);
    try {
      const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const attempt = await createReceptionVnpayAttempt(request, invoice, returnPath);
      const context: VnpayReturnContext = {
        txnRef: attempt.txnRef,
        returnPath,
        invoiceId: invoice.id,
        appointment: a,
        patient: allPatients[a.patientId],
        page: { room, date: dateStr, status, source, query: trimmed },
      };
      window.sessionStorage.setItem(PENDING_VNPAY_RETURN_KEY, JSON.stringify(context));
      window.location.assign(attempt.paymentUrl);
    } catch (error) {
      message.error(errText(error));
      setBusy(false);
    }
  };

  const handleCreateWalkIn = async (data: WalkInInput) => {
    try {
      const res = await createWalkInAppointment(request, data);
      message.success(
        `Đã tiếp nhận bệnh nhân vãng lai thành công! (Mã hẹn: ${res.appointmentCode || res.code || ''})`
      );
      setWalkInOpen(false);
      setReload((n) => n + 1);
    } catch (err: any) {
      message.error(errText(err));
      throw err;
    }
  };

  const handleOpenPatientDetail = async (a: DeskAppointment) => {
    if (!catalog) return;
    setSearching(true);
    setTargetAppointmentId(a.id);
    try {
      const res = await loadPatientWorkspace(request, catalog, a.patientId);
      const existing = res.appointments ?? [];
      const hasClicked = existing.some((item) => item.id === a.id || item.code === a.code);
      const allAppts = hasClicked ? existing : [a, ...existing];

      const patient = res.found[0] || allPatients[a.patientId] || {
        id: a.patientId,
        fullName: 'Bệnh nhân',
        emergencyContacts: [],
      };

      const finalRes = {
        found: [patient],
        patients: { [patient.id]: patient, ...res.patients },
        appointments: allAppts,
      };

      skipSearchRef.current = true;
      setSearch(finalRes);
      setQuery(patient.phone || patient.fullName);
    } catch (err) {
      console.error('Lỗi khi mở hồ sơ bệnh nhân:', err);
      const p = allPatients[a.patientId] || {
        id: a.patientId,
        fullName: 'Bệnh nhân',
        emergencyContacts: [],
      };
      const patientApps = rows.filter((item) => item.patientId === a.patientId);
      const hasClicked = patientApps.some((item) => item.id === a.id);
      const allAppts = hasClicked ? patientApps : [a, ...patientApps];

      skipSearchRef.current = true;
      setSearch({
        found: [p],
        patients: { [p.id]: p },
        appointments: allAppts,
      });
      setQuery(p.phone || p.fullName);
    } finally {
      setSearching(false);
    }
  };

  const clear = useCallback(() => {
    setQuery('');
    setTargetAppointmentId(null);
    setSearch(null);
    setResetSignal((n) => n + 1);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F0F6FD', padding: '20px 16px' }}>
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* TOP COMPACT HEADER BAR */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            background: '#ffffff',
            padding: '10px 18px',
            borderRadius: 12,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Brand Logo + Compact Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flex: 1,
              minWidth: 320,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0B5CAD 0%, #1677ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                ✚
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', lineHeight: 1.2 }}>
                  An Tâm Medical
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Bàn Tiếp đón Lễ tân</div>
              </div>
            </div>

            {/* Compact Search Bar */}
            <div style={{ maxWidth: 440, width: '100%' }}>
              <PatientSearchBar onSearch={setQuery} resetSignal={resetSignal} value={query} />
            </div>
          </div>

          {/* Right: + Tiếp nhận vãng lai & User Info Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                color: isLive ? '#166534' : '#b45309',
                background: isLive ? '#f0fdf4' : '#fffbeb',
                border: `1.5px solid ${isLive ? '#86efac' : '#fde68a'}`,
                padding: '5px 12px',
                borderRadius: '20px',
                userSelect: 'none',
              }}
              title={isLive ? 'Đang kết nối luồng sự kiện trực tiếp với máy chủ' : 'Đang kết nối lại luồng sự kiện...'}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isLive ? '#16a34a' : '#d97706',
                  boxShadow: isLive ? '0 0 0 3px rgba(22, 163, 74, 0.25)' : 'none',
                }}
              />
              <span>{isLive ? 'Trực tuyến' : 'Đang kết nối...'}</span>
            </span>

            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setWalkInOpen(true)}
              style={{
                fontWeight: 600,
                height: 38,
                borderRadius: 8,
                backgroundColor: '#0B5CAD',
              }}
            >
              + Tiếp nhận vãng lai
            </Button>

            <UserChip displayName={userName} showWorkspaceLink={false} onLogout={handleLogout} />
          </div>
        </header>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Không tải được dữ liệu"
            description={error}
            action={
              <Button size="small" onClick={() => setReload((n) => n + 1)}>
                Thử lại
              </Button>
            }
          />
        )}

        {trimmed.length >= 2 ? (
          searching || !search ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <SearchResults
              query={trimmed}
              patients={search.found}
              patientMap={allPatients}
              appointments={search.appointments}
              catalog={catalog}
              busy={busy}
              targetAppointmentId={targetAppointmentId}
              onOpen={handleOpenAppointment}
              onCheckIn={checkIn}
              onCancel={cancel}
              onCollect={collect}
              onPrint={(w) => message.info(`Đang gửi lệnh in ${w}...`)}
              onClear={clear}
              onPatientUpdated={(updated) => {
                message.success('Đã cập nhật thông tin bệnh nhân thành công!');
                setPatients((prev) => ({ ...prev, [updated.id]: updated }));
                setSearch((prev) =>
                  prev
                    ? {
                        ...prev,
                        found: prev.found.map((p) => (p.id === updated.id ? updated : p)),
                        patients: { ...prev.patients, [updated.id]: updated },
                      }
                    : prev
                );
              }}
              onAppointmentUpdated={(updated) => {
                message.success('Đã dời lịch khám thành công!');
                replace(updated);
                setReload((n) => n + 1);
              }}
            />
          )
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center',
                background: '#ffffff',
                padding: '12px 16px',
                borderRadius: 12,
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                  Phòng khám:
                </span>
                <Select
                  style={{ minWidth: 260 }}
                  value={room}
                  onChange={setRoom}
                  options={roomOptions}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                  Ngày:
                </span>
                <DatePicker
                  value={date}
                  allowClear={false}
                  format="DD/MM/YYYY"
                  onChange={(d) => d && setDate(d)}
                />
              </div>

              <Select
                allowClear
                placeholder="Tất cả trạng thái"
                style={{ minWidth: 180 }}
                value={status}
                onChange={setStatus}
                options={Object.entries(statusMeta).map(([value, m]) => ({
                  value,
                  label: m.label,
                }))}
              />

              <Select
                allowClear
                placeholder="Tất cả nguồn"
                style={{ minWidth: 140 }}
                value={source}
                onChange={setSource}
                options={Object.entries(sourceMeta).map(([value, m]) => ({
                  value,
                  label: m.label,
                }))}
              />

              <Button
                icon={<ReloadOutlined />}
                onClick={() => setReload((n) => n + 1)}
              >
                Làm mới
              </Button>
            </div>
            <StatsStrip data={dayRoomList} />
            <div style={{ background: '#fff', borderRadius: 12, padding: 12 }}>
              {loading && !rows.length ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : (
                <AppointmentTable
                  data={tableData}
                  patients={allPatients}
                  loading={loading}
                  onOpen={handleOpenPatientDetail}
                  onOpenPatient={handleOpenPatientDetail}
                  onCheckIn={checkIn}
                />
              )}
            </div>
          </>
        )}
      </div>

      <WalkInModal
        open={walkInOpen}
        catalog={catalog}
        request={request}
        initialPatient={search?.found?.[0] || null}
        onCancel={() => setWalkInOpen(false)}
        onSubmit={handleCreateWalkIn}
        onPatientUpdated={(updated) => {
          message.success('Đã cập nhật thông tin bệnh nhân thành công!');
          setPatients((prev) => ({ ...prev, [updated.id]: updated }));
          setSearch((prev) =>
            prev
              ? {
                  ...prev,
                  found: prev.found.map((p) => (p.id === updated.id ? updated : p)),
                  patients: { ...prev.patients, [updated.id]: updated },
                }
              : prev
          );
        }}
      />

      <AppointmentDrawer
        appointment={opened}
        patient={opened ? allPatients[opened.patientId] : undefined}
        busy={busy}
        onClose={() => {
          setOpenId(null);
          setOpenAppointment(null);
        }}
        onCheckIn={checkIn}
        onCancel={cancel}
        onCollect={collect}
        onPayVnpay={payVnpay}
        onPrint={(w) => message.info(`Đang gửi lệnh in ${w}...`)}
      />
    </div>
  );
}

/** Màn hình lễ tân: một trang duy nhất (tìm kiếm → lịch hẹn theo phòng → drawer chi tiết). */
export function ReceptionistWorkspacePage() {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#0B5CAD',
          borderRadius: 10,
          borderRadiusLG: 12,
          colorBgLayout: '#F0F6FD',
        },
      }}
    >
      <AntApp>
        <Desk />
      </AntApp>
    </ConfigProvider>
  );
}
