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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import { ApiError } from '../../../services/api';
import {
  cancelAppointment,
  checkInAppointment,
  collectCash,
  createWalkInAppointment,
  fetchCatalog,
  fetchDayAppointments,
  loadPatientWorkspace,
  refreshAppointment,
  searchDesk,
  type AppointmentSource,
  type AppointmentStatus,
  type DeskAppointment,
  type DeskCatalog,
  type DeskPatient,
  type PatientMap,
  type WalkInInput,
} from '../../../services/receptionDesk';
import { AppointmentDrawer } from '../components/AppointmentDrawer';
import { AppointmentTable } from '../components/AppointmentTable';
import { PatientSearchBar } from '../components/PatientSearchBar';
import { SearchResults } from '../components/SearchResults';
import { StatsStrip } from '../components/StatsStrip';
import { WalkInModal } from '../components/WalkInModal';
import { UserChip } from '../../../shared/components/navigation/UserChip';
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

  const [catalog, setCatalog] = useState<DeskCatalog | null>(null);
  const [rows, setRows] = useState<DeskAppointment[]>([]);
  const [patients, setPatients] = useState<PatientMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searching, setSearching] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [room, setRoom] = useState('P.201');
  const [date, setDate] = useState(dayjs());
  const [status, setStatus] = useState<AppointmentStatus | undefined>();
  const [source, setSource] = useState<AppointmentSource | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const dateStr = date.format('YYYY-MM-DD');
  const trimmed = query.trim();

  // User display info
  const userEmail = auth.user?.email || 'reception.hoangyen@antam.local';
  const userName = userEmail.split('@')[0];
  const userInitials = userName.slice(0, 2).toUpperCase();

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

  useEffect(() => {
    if (!catalog || trimmed.length < 2) {
      setSearch(null);
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

  const opened = useMemo(
    () =>
      [...rows, ...(search?.appointments ?? [])].find((a) => a.id === openId) ?? null,
    [rows, search, openId]
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

  const collect = (a: DeskAppointment) =>
    run(a, async () => {
      if (a.invoice) await collectCash(request, a.invoice);
      message.success('Đã thu tiền thành công');
    });

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
    try {
      const res = await loadPatientWorkspace(request, catalog, a.patientId);
      if (res.found.length > 0) {
        setSearch(res);
        setQuery(res.found[0].phone || res.found[0].fullName);
      } else {
        const p = allPatients[a.patientId] || {
          id: a.patientId,
          fullName: 'Bệnh nhân',
          emergencyContacts: [],
        };
        setSearch({
          found: [p],
          patients: { [p.id]: p },
          appointments: rows.filter((item) => item.patientId === a.patientId),
        });
        setQuery(p.fullName);
      }
    } catch (err) {
      console.error('Lỗi khi mở hồ sơ bệnh nhân:', err);
      message.error('Không thể tải thông tin bệnh nhân');
    } finally {
      setSearching(false);
    }
  };

  const clear = useCallback(() => {
    setQuery('');
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
              <PatientSearchBar onSearch={setQuery} resetSignal={resetSignal} />
            </div>
          </div>

          {/* Right: + Tiếp nhận vãng lai & User Info Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
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
              onOpen={(a) => setOpenId(a.id)}
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
