import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  DownOutlined,
  EyeOutlined,
  FileTextOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  SearchOutlined,
  SoundOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  App as AntApp,
  Avatar,
  Button,
  ConfigProvider,
  DatePicker,
  Dropdown,
  Input,
  message,
  notification,
  Radio,
  Select,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate, usePathname } from '../../../app/navigation';
import { listAllDoctorAppointments, type Appointment } from '../../../services/appointment';
import { listAllDoctorEncounters, type Encounter } from '../../../services/clinical';
import {
  callReceptionNext,
  listReceptionQueueStages,
  listReceptionStageTickets,
  type ReceptionQueueStage,
  type ReceptionQueueTicket,
} from '../../../services/operations';
import { getMyDoctor, type MyDoctor } from '../../../services/doctor';
import { UserChip } from '../../../shared/components/navigation/UserChip';
import { DoctorDeskStatsStrip } from '../components/DoctorDeskStatsStrip';
import { DoctorDeskTable, type DoctorDeskRow } from '../components/DoctorDeskTable';
import { DoctorConsultationDetail, type PatientDemographic } from '../components/DoctorConsultationDetail';
import { DoctorProfileSchedule } from '../components/DoctorProfileSchedule';
import { DoctorWorkspace } from '../components/DoctorWorkspace';
import { useDoctorRealtime } from '../hooks/useDoctorRealtime';

import '../../../styles/doctor-desk.css';

dayjs.locale('vi');
const { Text, Title } = Typography;

// Mapping fallback thông tin hành chính bệnh nhân
const PATIENT_FALLBACK_MAP: Record<string, PatientDemographic> = {
  '3c9ace53-18da-409f-9e06-d4c43936845a': {
    name: 'Bùi Phương Linh',
    phone: '0901234015',
    dob: '1999-01-14',
    gender: 'Nữ',
    nationalId: '001199000108',
    address: '55 Xã Đàn, Nam Đồng, Đống Đa, Hà Nội',
    emergencyContact: 'Bùi Quang Vinh (Bố đẻ - 0901234016)',
  },
  '1534b518-f2e9-4491-9151-4c6dee8f8280': {
    name: 'Bùi Thị Ngọc Mai',
    phone: '0901234025',
    dob: '1999-12-05',
    gender: 'Nữ',
    nationalId: '001199000113',
    address: '72 Bà Triệu, Hàng Bài, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Bùi Văn Hưng (Bố ruột - 0901234026)',
  },
  '4dfd4cc0-a48d-4d88-bba7-7c27e340390f': {
    name: 'Dương Yến Nhi',
    phone: '0901234021',
    dob: '2000-02-28',
    gender: 'Nữ',
    nationalId: '001200000111',
    address: '67 Trần Duy Hưng, Trung Hòa, Cầu Giấy, Hà Nội',
    emergencyContact: 'Dương Thế Anh (Bố đẻ - 0901234022)',
  },
  '2d186092-0f19-42d0-870a-d6c621a41915': {
    name: 'Hoàng Thùy Dương',
    phone: '0901234009',
    dob: '1996-08-18',
    gender: 'Nữ',
    nationalId: '001196000105',
    address: '23 Lạc Long Quân, Bưởi, Tây Hồ, Hà Nội',
    emergencyContact: 'Hoàng Văn Nam (Bố đẻ - 0901234010)',
  },
  'b6636063-1c6f-4dcf-822d-a3b3d4de9c7c': {
    name: 'Lê Ngọc Mai',
    phone: '0901234005',
    dob: '1998-03-10',
    gender: 'Nữ',
    nationalId: '001198000103',
    address: '88 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội',
    emergencyContact: 'Lê Văn Tuấn (Bố đẻ - 0901234006)',
  },
  '883c60df-2dd8-4010-aadc-1ccdcff5d738': {
    name: 'Nguyễn Minh Anh',
    phone: '0901000001',
    dob: '1995-06-15',
    gender: 'Nữ',
    nationalId: '001195000101',
    address: '12 Nguyễn Du, Phường Hàng Bài, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Trần Văn Bình (Chồng - 0901000002)',
  },
  '7733fbcd-19e8-41cf-b433-e88577c2532e': {
    name: 'Phan Thanh Trúc',
    phone: '0901234027',
    dob: '2001-04-20',
    gender: 'Nữ',
    nationalId: '001201000114',
    address: '15 Lê Thánh Tông, Phan Chu Trinh, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Đặng Quốc Anh (Chồng - 0901234028)',
  },
  '3a237e60-d9fd-4a6f-a6dc-e2a5b09b4303': {
    name: 'Phan Thị Bích Thủy',
    phone: '0901234019',
    dob: '1995-10-12',
    gender: 'Nữ',
    nationalId: '001195000110',
    address: '19 Lê Văn Lương, Nhân Chính, Thanh Xuân, Hà Nội',
    emergencyContact: 'Nguyễn Đình Trọng (Chồng - 0901234020)',
  },
  'd2cd309f-b87c-4a82-8181-e462ec978cb8': {
    name: 'Phạm Quỳnh Chi',
    phone: '0901234007',
    dob: '1992-12-05',
    gender: 'Nữ',
    nationalId: '001192000104',
    address: '156 Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
    emergencyContact: 'Vũ Mạnh Hùng (Chồng - 0901234008)',
  },
  'def77a34-7609-44bf-ab28-3b537b937ba0': {
    name: 'Trần Thị Thanh Hằng',
    phone: '0901234003',
    dob: '1993-09-22',
    gender: 'Nữ',
    nationalId: '001193000102',
    address: '45 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Nguyễn Hoàng Long (Chồng - 0901234004)',
  },
  '25e26c94-158e-4f10-a42c-9870a5700ffe': {
    name: 'Võ Bảo Châu',
    phone: '0901234023',
    dob: '1996-05-19',
    gender: 'Nữ',
    nationalId: '001196000112',
    address: '18 Lý Thường Kiệt, Phan Chu Trinh, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Lê Quang Huy (Chồng - 0901234024)',
  },
  '8dab0c4e-cb6d-442f-8084-f2805979515e': {
    name: 'Vũ Thị Kim Ngân',
    phone: '0901234011',
    dob: '1994-11-30',
    gender: 'Nữ',
    nationalId: '001194000106',
    address: '74 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội',
    emergencyContact: 'Đỗ Đức Thắng (Chồng - 0901234012)',
  },
  '667c36aa-da0b-4c5c-b565-371af2601a99': {
    name: 'Đinh Thị Hồng Hạnh',
    phone: '0901234017',
    dob: '1991-07-08',
    gender: 'Nữ',
    nationalId: '001191000109',
    address: '36 Hoàng Hoa Thám, Thụy Khuê, Tây Hồ, Hà Nội',
    emergencyContact: 'Trương Quốc Bảo (Chồng - 0901234018)',
  },
  'e6854601-dce9-43e0-8d2c-0e5e7e6a81f4': {
    name: 'Đỗ Thu Trang',
    phone: '0901234013',
    dob: '1997-04-25',
    gender: 'Nữ',
    nationalId: '001197000107',
    address: '102 Thái Hà, Trung Liệt, Đống Đa, Hà Nội',
    emergencyContact: 'Phạm Hải Đăng (Chồng - 0901234014)',
  },
};

function DoctorDesk() {
  const auth = useAuthSession();
  const { request } = auth;
  const pathname = usePathname();

  // Xác định view từ pathname hoặc mặc định là desk
  const initialSection = pathname.split('/').filter(Boolean).at(-1) || 'desk';
  const [viewMode, setViewMode] = useState<string>(
    ['schedule', 'profile', 'consultations'].includes(initialSection) ? initialSection : 'desk'
  );

  // States dữ liệu
  const [doctor, setDoctor] = useState<MyDoctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [stages, setStages] = useState<ReceptionQueueStage[]>([]);
  const [tickets, setTickets] = useState<ReceptionQueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [callingNext, setCallingNext] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Filter & Search
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('checked_in_only');

  // Active Consultation Row
  const [selectedRow, setSelectedRow] = useState<DoctorDeskRow | null>(null);

  const selectedDateStr = selectedDate.format('YYYY-MM-DD');

  // 1. Tải thông tin bác sĩ & phòng khám
  useEffect(() => {
    let active = true;
    getMyDoctor(request)
      .then((d) => {
        if (active) setDoctor(d);
      })
      .catch((err) => console.error('Error fetching doctor profile:', err));
    return () => {
      active = false;
    };
  }, [request]);

  // 2. Tải danh sách lịch hẹn, encounters và hàng đợi phòng khám
  const loadData = useCallback(async () => {
    try {
      const [apts, encs, allStages] = await Promise.all([
        listAllDoctorAppointments(request).catch(() => []),
        listAllDoctorEncounters(request).catch(() => []),
        listReceptionQueueStages(request).catch(() => []),
      ]);

      setAppointments(apts);
      setEncounters(encs);
      setStages(allStages);

      // Tìm stage của phòng bác sĩ (chuyên khoa Sản Phụ khoa / Khám bệnh)
      const targetRoom = doctor?.roomCode || 'P.201';
      const myStage =
        allStages.find((s) => s.code === 'CONSULTATION' || s.name?.includes('Khám')) ||
        allStages.find((s) => s.roomCode === targetRoom) ||
        allStages[0];

      if (myStage?.id) {
        const stageTickets = await listReceptionStageTickets(request, myStage.id).catch(() => []);
        setTickets(stageTickets);
      }
    } catch (err) {
      console.error('Error loading doctor workspace data:', err);
    } finally {
      setLoading(false);
    }
  }, [request, doctor?.roomCode]);

  useEffect(() => {
    loadData();
  }, [loadData, reloadTrigger]);

  // 3. Tích hợp SSE Realtime Stream (đồng bộ 2 chiều tức thì khi Lễ tân check-in)
  const { isLive } = useDoctorRealtime({
    doctorId: doctor?.id,
    roomCode: doctor?.roomCode || undefined,
    selectedDateStr,
    patientMap: PATIENT_FALLBACK_MAP,
    streamFn: auth.stream,
    onPatientCheckedIn: (evt) => {
      // Cập nhật trạng thái ngay lập tức trên RAM nếu appointment đã có trong danh sách
      setAppointments((cur) =>
        cur.map((a) => {
          if (a.id === evt.appointmentId) {
            return {
              ...a,
              status: 'CHECKED_IN' as any,
              roomCode: evt.roomCode || a.roomCode,
              roomName: evt.roomName || a.roomName,
              updatedAt: evt.updatedAt || a.updatedAt,
            };
          }
          return a;
        })
      );

      // Tải lại toàn bộ dữ liệu bàn khám & số thứ tự ngay lập tức
      loadData();

      // Refetch nhẹ sau 800ms để đảm bảo số vé STT từ queue-service đã cấp xong hoàn chỉnh
      setTimeout(() => {
        loadData();
      }, 800);
    },
    onAppointmentUpdate: (evt) => {
      setAppointments((cur) =>
        cur.map((a) => {
          if (a.id === evt.appointmentId) {
            return {
              ...a,
              status: evt.status as any,
              updatedAt: evt.updatedAt || a.updatedAt,
            };
          }
          return a;
        })
      );
      loadData();
    },
    onRefetch: () => {
      loadData();
    },
  });

  // Bản đồ vé STT theo appointmentId
  const ticketByApptId = useMemo(() => {
    const map = new Map<string, ReceptionQueueTicket>();
    tickets.forEach((t: any) => {
      if (t.appointmentId) {
        map.set(t.appointmentId, t);
      }
    });
    return map;
  }, [tickets]);

  // Danh sách rows hiển thị trên bàn khám
  const deskRows = useMemo(() => {
    return appointments.map((a): DoctorDeskRow => {
      const aptId = String(a.id || '');
      const t = aptId ? ticketByApptId.get(aptId) : undefined;
      const pid = String(a.patientId || '');
      const fallback = (pid && PATIENT_FALLBACK_MAP[pid]) || {
        name: 'Nguyễn Minh Anh',
        phone: '0901000001',
      };

      return {
        ...a,
        ticketCode: t?.ticketCode || undefined,
        patientName: a.patientName || fallback.name,
        patientPhone: fallback.phone,
      };
    });
  }, [appointments, ticketByApptId]);

  // Lọc theo ngày và trạng thái check-in
  const filteredRows = useMemo(() => {
    return deskRows.filter((r) => {
      // Lọc ngày
      const rowDate = r.startAt
        ? new Date(r.startAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
        : '';
      const dateMatches = !selectedDateStr || rowDate === selectedDateStr;

      // Lọc trạng thái
      let statusMatches = true;
      if (statusFilter === 'checked_in_only') {
        // Chỉ lấy những ca đã check-in hoặc đang khám
        statusMatches = r.status === 'CHECKED_IN' || r.status === 'IN_CLINICAL_CARE';
      } else if (statusFilter === 'in_care') {
        statusMatches = r.status === 'IN_CLINICAL_CARE';
      } else if (statusFilter === 'waiting') {
        statusMatches = r.status === 'CHECKED_IN';
      } else if (statusFilter === 'completed') {
        statusMatches = r.status === 'COMPLETED';
      }

      // Tìm kiếm từ khóa
      const q = searchQuery.trim().toLowerCase();
      const searchMatches =
        !q ||
        (r.patientName || '').toLowerCase().includes(q) ||
        (r.appointmentCode || '').toLowerCase().includes(q) ||
        (r.ticketCode || '').toLowerCase().includes(q);

      return dateMatches && statusMatches && searchMatches;
    });
  }, [deskRows, selectedDateStr, statusFilter, searchQuery]);

  // Thống kê KPIs
  const stats = useMemo(() => {
    const todayRows = deskRows.filter((r) => {
      const rowDate = r.startAt
        ? new Date(r.startAt).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
        : '';
      return rowDate === selectedDateStr;
    });

    const inCare = todayRows.find((r) => r.status === 'IN_CLINICAL_CARE');
    const waiting = todayRows.filter((r) => r.status === 'CHECKED_IN');
    const completed = todayRows.filter((r) => r.status === 'COMPLETED');

    const targetRoom = doctor?.roomCode || 'P.201';

    // Vé đang được gọi trong hàng đợi hôm nay (phải cùng ngày, cùng phòng và tương ứng với ca hẹn chưa hoàn tất)
    let currentServing = null;
    if (inCare) {
      currentServing = {
        ticketCode: inCare.ticketCode,
        patientName: inCare.patientName,
        status: 'IN_CLINICAL_CARE',
      };
    } else if (todayRows.length > 0) {
      // Chỉ tìm vé gọi nếu hôm nay có lịch hẹn
      const calledTicket = tickets.find((t: any) => {
        const isCalled = t.state === 'CALLED' || t.state === 'TICKET_STATE_CALLED';
        if (!isCalled) return false;

        // Kiểm tra ngày của vé
        const ticketDate = t.businessDate
          ? (typeof t.businessDate === 'string' ? t.businessDate.slice(0, 10) : dayjs(t.businessDate).format('YYYY-MM-DD'))
          : t.calledAt
          ? dayjs(t.calledAt).format('YYYY-MM-DD')
          : '';
        const dateMatch = !ticketDate || ticketDate === selectedDateStr;

        // Kiểm tra phòng khám
        const roomMatch = !t.roomCode || t.roomCode === targetRoom;

        return dateMatch && roomMatch;
      });

      if (calledTicket) {
        // Phải tìm thấy ca hẹn tương ứng trong danh sách hôm nay đang ở trạng thái CHECKED_IN
        const matched = todayRows.find(
          (r) =>
            r.status === 'CHECKED_IN' &&
            ((r as any).ticketCode === calledTicket.ticketCode || r.id === (calledTicket as any).appointmentId)
        );

        if (matched) {
          currentServing = {
            ticketCode: calledTicket.ticketCode || matched.ticketCode,
            patientName: matched.patientName || 'Bệnh nhân',
            status: 'CALLED',
          };
        }
      }
    }

    return {
      currentServing,
      waitingCount: waiting.length,
      totalToday: todayRows.length,
      completedCount: completed.length,
    };
  }, [deskRows, selectedDateStr, tickets, doctor?.roomCode]);

  // 3. Tác vụ: 📢 GỌI SỐ TIẾP THEO (Call Next)
  const handleCallNext = async () => {
    const targetRoom = doctor?.roomCode || 'P.201';
    const myStage =
      stages.find((s) => s.code === 'CONSULTATION' || s.name?.includes('Khám')) ||
      stages.find((s) => s.roomCode === targetRoom) ||
      stages[0];

    if (!myStage?.id) {
      message.warning('Chưa cấu hình hàng đợi cho phòng khám này.');
      return;
    }

    setCallingNext(true);
    try {
      const called = await callReceptionNext(request, myStage.id);
      if (called && called.ticketCode) {
        notification.success({
          message: '📢 Đã gọi số thứ tự tiếp theo',
          description: `Mời số phiếu ${called.ticketCode} vào ${doctor?.roomCode || myStage.name || 'phòng khám'}.`,
          placement: 'topRight',
          duration: 4,
        });
      } else {
        message.info('Hàng đợi hiện tại không còn bệnh nhân nào đang chờ.');
      }
      setReloadTrigger((n) => n + 1);
    } catch (err: any) {
      message.error(err?.message || 'Không thể gọi số kế tiếp lúc này.');
    } finally {
      setCallingNext(false);
    }
  };

  // Mở giao diện Khám bệnh chi tiết toàn màn hình (thay thế Drawer)
  const handleOpenClinical = (row: DoctorDeskRow) => {
    setSelectedRow(row);
    setViewMode('consultation');
  };

  // Tìm Encounter tương ứng với ca hẹn đang mở
  const currentEncounter = useMemo(() => {
    if (!selectedRow) return null;
    return (
      encounters.find(
        (e) => e.id === selectedRow.encounterId || e.appointmentId === selectedRow.id
      ) || null
    );
  }, [selectedRow, encounters]);

  // Đăng xuất
  const handleLogout = async () => {
    await auth.signOut();
    navigate('/dang-nhap', { replace: true });
  };

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#0B5CAD',
          borderRadius: 8,
          colorSuccess: '#10b981',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <div className="doctor-desk-container">
        <div className="doctor-desk-wrapper">
          {/* ─── TOP COMPACT HEADER BAR ─── */}
          <header className="doctor-desk-header">
            {/* Left: Brand Logo + Slogan (Khớp chuẩn 100% với Cổng Bệnh Nhân localhost:3000) */}
            <div
              className="portal-brand"
              onClick={() => {
                setViewMode('desk');
                setSelectedRow(null);
              }}
              title="Về bàn làm việc bác sĩ"
            >
              <img
                src="/brand/logo-symbol-clean.png"
                alt="Bệnh viện Phụ sản Tâm An"
                className="portal-brand-symbol"
              />
              <div className="portal-brand-typography">
                <div className="portal-brand-heading">
                  <span className="brand-name-main">TÂM AN</span>
                  <span className="brand-badge-sub">HOSPITAL</span>
                </div>
                <span className="portal-brand-slogan-text">
                  Trọn vẹn yêu thương, vẹn toàn <strong className="slogan-accent">yên tâm</strong>
                </span>
              </div>
            </div>

            {/* Right: Room Tag, Realtime Status, Action Button & UserChip */}
            <div className="doctor-header-actions">
              {/* Room Chip (Tách riêng, chỉ hiển thị mã phòng P.207) */}
              <div className="doctor-header-room-chip">
                <span>Phòng</span>
                <strong>{doctor?.roomCode || 'P.207'}</strong>
              </div>

              {/* Status Chip (Tách riêng trạng thái Trực tuyến) */}
              <div
                className={`doctor-header-live-chip ${isLive ? 'is-live' : 'is-connecting'}`}
                title={isLive ? 'Đang kết nối luồng sự kiện thời gian thực (SSE)' : 'Đang kết nối lại luồng sự kiện...'}
              >
                <span className="live-dot" />
                <span>{isLive ? 'Trực tuyến' : 'Đang kết nối...'}</span>
              </div>

              {/* Primary Call Next Button */}
              <Button
                type="primary"
                icon={<SoundOutlined />}
                loading={callingNext}
                className="doctor-btn-call-next"
                onClick={handleCallNext}
              >
                Gọi số tiếp theo
              </Button>

              {/* UserChip với ảnh thật của bác sĩ và ẩn link trang chủ */}
              <UserChip
                displayName={
                  doctor?.profile?.fullName
                    ? (doctor.profile.fullName.startsWith('BS')
                        ? doctor.profile.fullName
                        : `BS. ${doctor.profile.fullName}`)
                    : undefined
                }
                avatarUrl={doctor?.profile?.photoUrl}
                showWorkspaceLink={false}
                onLogout={handleLogout}
                extraMenuItems={[
                  {
                    label: 'Xem hồ sơ chuyên môn',
                    onClick: () => setViewMode('profile'),
                  },
                ]}
              />
            </div>
          </header>

          {/* ─── CONDITIONAL VIEW CONTENT ─── */}
          {viewMode === 'desk' && (
            <>
              {/* 1. Queue Stats Strip */}
              <DoctorDeskStatsStrip
                currentServing={stats.currentServing}
                waitingCount={stats.waitingCount}
                totalToday={stats.totalToday}
                completedCount={stats.completedCount}
              />

              {/* 2. Main Desk Table Card */}
              <div className="doctor-table-card">
                {/* Table Toolbar & Filters */}
                <div className="doctor-table-toolbar">
                  {/* Left: Filter Tabs */}
                  <Radio.Group
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="checked_in_only">
                      ⏳ Đang chờ & Đang khám ({stats.waitingCount + (stats.currentServing ? 1 : 0)})
                    </Radio.Button>
                    <Radio.Button value="waiting">
                      Chờ gọi ({stats.waitingCount})
                    </Radio.Button>
                    <Radio.Button value="in_care">
                      Đang khám ({stats.currentServing?.status === 'IN_CLINICAL_CARE' ? 1 : 0})
                    </Radio.Button>
                    <Radio.Button value="completed">
                      Đã hoàn tất ({stats.completedCount})
                    </Radio.Button>
                    <Radio.Button value="all">
                      Tất cả ca hôm nay ({stats.totalToday})
                    </Radio.Button>
                  </Radio.Group>

                  {/* Right: Date Picker & Search Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <DatePicker
                      value={selectedDate}
                      onChange={(d) => d && setSelectedDate(d)}
                      format="DD/MM/YYYY"
                      allowClear={false}
                      style={{ width: 140 }}
                    />
                    <Input
                      placeholder="Tìm theo tên BN, STT, mã phiếu..."
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: 260 }}
                      allowClear
                    />
                  </div>
                </div>

                {/* Queue Table */}
                <DoctorDeskTable
                  rows={filteredRows}
                  loading={loading}
                  onOpenClinical={handleOpenClinical}
                />
              </div>

            </>
          )}

          {/* 3. Giao diện Chi tiết Ca khám Bệnh nhân (thay thế hoàn toàn Drawer) */}
          {viewMode === 'consultation' && selectedRow && (
            <DoctorConsultationDetail
              appointment={selectedRow}
              encounter={currentEncounter}
              patientInfo={PATIENT_FALLBACK_MAP[selectedRow.patientId || '']}
              allAppointments={appointments}
              allEncounters={encounters}
              doctor={doctor}
              request={request}
              onBack={() => {
                setViewMode('desk');
                setSelectedRow(null);
                loadData();
              }}
              onReload={() => {
                setReloadTrigger((n) => n + 1);
              }}
            />
          )}

          {viewMode === 'schedule' && (
            <div style={{ background: '#ffffff', borderRadius: 14, padding: 24 }}>
              <DoctorProfileSchedule section="schedule" request={request} />
            </div>
          )}

          {viewMode === 'profile' && (
            <div style={{ background: '#ffffff', borderRadius: 14, padding: 24 }}>
              <DoctorProfileSchedule section="profile" request={request} />
            </div>
          )}

          {viewMode === 'consultations' && (
            <div style={{ background: '#ffffff', borderRadius: 14, padding: 24 }}>
              <DoctorWorkspace section="consultations" request={request} userId={auth.user?.userId} />
            </div>
          )}
        </div>
      </div>
    </ConfigProvider>
  );
}

export function DoctorWorkspacePage() {
  return (
    <AntApp>
      <DoctorDesk />
    </AntApp>
  );
}
