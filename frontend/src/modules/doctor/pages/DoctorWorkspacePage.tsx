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

// Mapping fallback thông tin hành chính & bệnh sử bệnh nhân
const PATIENT_FALLBACK_MAP: Record<string, PatientDemographic> = {
  '3c9ace53-18da-409f-9e06-d4c43936845a': {
    name: 'Bùi Phương Linh',
    phone: '0901234015',
    dob: '1999-01-14',
    gender: 'Nữ',
    nationalId: '001199000108',
    address: '55 Xã Đàn, Nam Đồng, Đống Đa, Hà Nội',
    emergencyContact: 'Bùi Quang Vinh (Bố đẻ - 0901234016)',
    bloodType: 'O+',
    allergies: 'Không dị ứng',
    para: '0000',
  },
  '1534b518-f2e9-4491-9151-4c6dee8f8280': {
    name: 'Bùi Thị Ngọc Mai',
    phone: '0901234025',
    dob: '1999-12-05',
    gender: 'Nữ',
    nationalId: '001199000113',
    address: '72 Bà Triệu, Hàng Bài, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Bùi Văn Hưng (Bố ruột - 0901234026)',
    bloodType: 'B+',
    allergies: 'Chưa ghi nhận dị ứng',
    para: '0000',
  },
  '4dfd4cc0-a48d-4d88-bba7-7c27e340390f': {
    name: 'Dương Yến Nhi',
    phone: '0901234021',
    dob: '2000-02-28',
    gender: 'Nữ',
    nationalId: '001200000111',
    address: '67 Trần Duy Hưng, Trung Hòa, Cầu Giấy, Hà Nội',
    emergencyContact: 'Dương Thế Anh (Bố đẻ - 0901234022)',
    bloodType: 'A+',
    allergies: 'Chưa ghi nhận dị ứng',
    para: '0000',
  },
  '2d186092-0f19-42d0-870a-d6c621a41915': {
    name: 'Hoàng Thùy Dương',
    phone: '0901234009',
    dob: '1996-08-18',
    gender: 'Nữ',
    nationalId: '001196000105',
    address: '23 Lạc Long Quân, Bưởi, Tây Hồ, Hà Nội',
    emergencyContact: 'Hoàng Văn Nam (Bố đẻ - 0901234010)',
    bloodType: 'A+',
    allergies: 'Không dị ứng',
    para: '1001',
  },
  'b6636063-1c6f-4dcf-822d-a3b3d4de9c7c': {
    name: 'Lê Ngọc Mai',
    phone: '0901234005',
    dob: '1998-03-10',
    gender: 'Nữ',
    nationalId: '001198000103',
    address: '88 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội',
    emergencyContact: 'Lê Văn Tuấn (Bố đẻ - 0901234006)',
    bloodType: 'O+',
    allergies: 'Chưa ghi nhận dị ứng',
    para: '0000',
  },
  '883c60df-2dd8-4010-aadc-1ccdcff5d738': {
    name: 'Nguyễn Minh Anh',
    phone: '0901000001',
    dob: '1995-06-15',
    gender: 'Nữ',
    nationalId: '001195000101',
    address: '12 Nguyễn Du, Phường Hàng Bài, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Trần Văn Bình (Chồng - 0901000002)',
    bloodType: 'B+',
    allergies: 'Dị ứng nhẹ Penicillin',
    para: '0010',
  },
  '7733fbcd-19e8-41cf-b433-e88577c2532e': {
    name: 'Phan Thanh Trúc',
    phone: '0901234027',
    dob: '2001-04-20',
    gender: 'Nữ',
    nationalId: '001201000114',
    address: '15 Lê Thánh Tông, Phan Chu Trinh, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Đặng Quốc Anh (Chồng - 0901234028)',
    bloodType: 'O+',
    allergies: 'Không dị ứng',
    para: '0000',
  },
  '3a237e60-d9fd-4a6f-a6dc-e2a5b09b4303': {
    name: 'Phan Thị Bích Thủy',
    phone: '0901234019',
    dob: '1995-10-12',
    gender: 'Nữ',
    nationalId: '001195000110',
    address: '19 Lê Văn Lương, Nhân Chính, Thanh Xuân, Hà Nội',
    emergencyContact: 'Nguyễn Đình Trọng (Chồng - 0901234020)',
    bloodType: 'O+',
    allergies: 'Không dị ứng',
    para: '1001',
  },
  'd2cd309f-b87c-4a82-8181-e462ec978cb8': {
    name: 'Phạm Quỳnh Chi',
    phone: '0901234007',
    dob: '1992-12-05',
    gender: 'Nữ',
    nationalId: '001192000104',
    address: '156 Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
    emergencyContact: 'Vũ Mạnh Hùng (Chồng - 0901234008)',
    bloodType: 'AB+',
    allergies: 'Không dị ứng',
    para: '0000',
  },
  'def77a34-7609-44bf-ab28-3b537b937ba0': {
    name: 'Trần Thị Thanh Hằng',
    phone: '0901234003',
    dob: '1993-09-22',
    gender: 'Nữ',
    nationalId: '001193000102',
    address: '45 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Nguyễn Hoàng Long (Chồng - 0901234004)',
    bloodType: 'O+',
    allergies: 'Không dị ứng',
    para: '1011',
  },
  '25e26c94-158e-4f10-a42c-9870a5700ffe': {
    name: 'Võ Bảo Châu',
    phone: '0901234023',
    dob: '1996-05-19',
    gender: 'Nữ',
    nationalId: '001196000112',
    address: '18 Lý Thường Kiệt, Phan Chu Trinh, Hoàn Kiếm, Hà Nội',
    emergencyContact: 'Lê Quang Huy (Chồng - 0901234024)',
    bloodType: 'O+',
    allergies: 'Không dị ứng',
    para: '0000',
  },
  '8dab0c4e-cb6d-442f-8084-f2805979515e': {
    name: 'Vũ Thị Kim Ngân',
    phone: '0901234011',
    dob: '1994-11-30',
    gender: 'Nữ',
    nationalId: '001194000106',
    address: '74 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội',
    emergencyContact: 'Đỗ Đức Thắng (Chồng - 0901234012)',
    bloodType: 'O+',
    allergies: 'Không dị ứng',
    para: '1001',
  },
  '667c36aa-da0b-4c5c-b565-371af2601a99': {
    name: 'Đinh Thị Hồng Hạnh',
    phone: '0901234017',
    dob: '1991-07-08',
    gender: 'Nữ',
    nationalId: '001191000109',
    address: '36 Hoàng Hoa Thám, Thụy Khuê, Tây Hồ, Hà Nội',
    emergencyContact: 'Trương Quốc Bảo (Chồng - 0901234018)',
    bloodType: 'B+',
    allergies: 'Không dị ứng',
    para: '2002',
  },
  'e6854601-dce9-43e0-8d2c-0e5e7e6a81f4': {
    name: 'Đỗ Thu Trang',
    phone: '0901234013',
    dob: '1997-04-25',
    gender: 'Nữ',
    nationalId: '001197000107',
    address: '102 Thái Hà, Trung Liệt, Đống Đa, Hà Nội',
    emergencyContact: 'Phạm Hải Đăng (Chồng - 0901234014)',
    bloodType: 'A+',
    allergies: 'Không dị ứng',
    para: '0000',
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

      // Tìm stage của phòng bác sĩ
      const targetRoom = doctor?.roomCode || 'P.201';
      const myStage = allStages.find((s) => s.roomCode === targetRoom) || allStages[0];

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

    // Vé đang được gọi trong hàng đợi
    const calledTicket = tickets.find((t: any) => t.state === 'CALLED' || t.state === 'TICKET_STATE_CALLED');

    let currentServing = null;
    if (inCare) {
      currentServing = {
        ticketCode: inCare.ticketCode,
        patientName: inCare.patientName,
        status: 'IN_CLINICAL_CARE',
      };
    } else if (calledTicket) {
      const matched = todayRows.find((r) => (r as any).ticketCode === calledTicket.ticketCode || r.id === (calledTicket as any).appointmentId);
      currentServing = {
        ticketCode: calledTicket.ticketCode,
        patientName: matched?.patientName || 'Đang gọi vào phòng',
        status: 'CALLED',
      };
    }

    return {
      currentServing,
      waitingCount: waiting.length,
      totalToday: todayRows.length,
      completedCount: completed.length,
    };
  }, [deskRows, selectedDateStr, tickets]);

  // 3. Tác vụ: 📢 GỌI SỐ TIẾP THEO (Call Next)
  const handleCallNext = async () => {
    const targetRoom = doctor?.roomCode || 'P.201';
    const myStage = stages.find((s) => s.roomCode === targetRoom) || stages[0];

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
          description: `Mời số phiếu ${called.ticketCode} vào ${myStage.name || 'phòng khám'}.`,
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
            {/* Left: Brand Logo + Clinical Desk Title */}
            <div className="doctor-desk-brand">
              <div className="doctor-desk-logo">+</div>
              <div className="doctor-desk-title-group">
                <h1>An Tâm Medical</h1>
                <p>Bàn Khám Bác Sĩ Chuyên Khoa</p>
              </div>

              {/* Room Pill */}
              <div className="doctor-room-pill">
                <span>Phòng trực:</span>
                <strong>{doctor?.roomCode || 'P.201'} - {doctor?.roomName || 'Sản Phụ khoa 201'}</strong>
              </div>

              {/* Status Pill */}
              <div
                className="doctor-status-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: isLive ? '#ecfdf5' : '#fffbeb',
                  border: `1px solid ${isLive ? '#a7f3d0' : '#fde68a'}`,
                  color: isLive ? '#065f46' : '#92400e',
                  cursor: 'default',
                  userSelect: 'none',
                }}
                title={isLive ? 'Đang kết nối luồng sự kiện thời gian thực' : 'Đang kết nối lại luồng sự kiện...'}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: isLive ? '#10b981' : '#f59e0b',
                    boxShadow: isLive ? '0 0 6px #10b981' : 'none',
                  }}
                />
                <span>{isLive ? 'Trực tuyến' : 'Đang kết nối...'}</span>
              </div>
            </div>

            {/* Right: Action Buttons & Doctor Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* PRIMARY CALL NEXT BUTTON */}
              <Button
                type="primary"
                icon={<SoundOutlined />}
                loading={callingNext}
                className="btn-call-next"
                onClick={handleCallNext}
              >
                📢 Gọi số tiếp theo
              </Button>

              <Button
                icon={<ReloadOutlined />}
                onClick={() => setReloadTrigger((n) => n + 1)}
                title="Làm mới dữ liệu"
              >
                Làm mới
              </Button>

              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'profile',
                      label: 'Xem hồ sơ chuyên môn',
                      icon: <IdcardOutlined />,
                      onClick: () => setViewMode('profile'),
                    },
                    {
                      type: 'divider',
                    },
                    {
                      key: 'logout',
                      label: 'Đăng xuất',
                      icon: <LogoutOutlined />,
                      danger: true,
                      onClick: handleLogout,
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Avatar
                    size={30}
                    style={{ backgroundColor: '#0B5CAD', fontWeight: 700 }}
                  >
                    {doctor?.profile?.fullName
                      ? doctor.profile.fullName.slice(-1)
                      : 'BS'}
                  </Avatar>
                  <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {doctor?.profile?.fullName || 'BS. Trần Thanh Mai'}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Bác sĩ Chuyên khoa
                    </Text>
                  </div>
                  <DownOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
                </div>
              </Dropdown>
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
