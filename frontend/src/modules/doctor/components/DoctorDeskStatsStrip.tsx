import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  SoundOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';

export interface DoctorDeskStatsProps {
  currentServing: {
    ticketCode?: string;
    patientName?: string;
    status?: string;
  } | null;
  waitingCount: number;
  totalToday: number;
  completedCount: number;
}

export function DoctorDeskStatsStrip({
  currentServing,
  waitingCount,
  totalToday,
  completedCount,
}: DoctorDeskStatsProps) {
  return (
    <div className="doctor-kpi-grid">
      {/* 1. Đang khám / Đang gọi hiện tại */}
      <div
        className={`doctor-kpi-card ${currentServing ? 'is-active-serving' : ''}`}
      >
        <div className="doctor-kpi-label">
          <span>🩺 Đang khám / Gọi số</span>
          {currentServing?.ticketCode ? (
            <Tag color="green" style={{ margin: 0, fontWeight: 700 }}>
              {currentServing.status === 'IN_CLINICAL_CARE'
                ? 'ĐANG KHÁM'
                : 'SỐ ĐÃ GỌI'}
            </Tag>
          ) : (
            <Tag color="default" style={{ margin: 0 }}>
              TRỐNG PHÒNG
            </Tag>
          )}
        </div>
        <div className="doctor-kpi-value">
          {currentServing?.ticketCode ? (
            <>
              <span style={{ color: '#0B5CAD', fontFamily: 'monospace' }}>
                STT {currentServing.ticketCode}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 16, color: '#64748b', fontWeight: 600 }}>
              Chưa gọi bệnh nhân
            </span>
          )}
        </div>
        <div className="doctor-kpi-sub">
          {currentServing?.patientName
            ? `Bệnh nhân: ${currentServing.patientName}`
            : 'Nhấn "Gọi số tiếp theo" để tiếp nhận'}
        </div>
      </div>

      {/* 2. Đang chờ ngoài cửa (Checked-in) */}
      <div className="doctor-kpi-card">
        <div className="doctor-kpi-label">
          <span>⏳ Chờ vào khám</span>
          <ClockCircleOutlined style={{ color: '#f59e0b', fontSize: 16 }} />
        </div>
        <div className="doctor-kpi-value">
          <span style={{ color: waitingCount > 0 ? '#d97706' : '#0f172a' }}>
            {waitingCount}
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>
            bệnh nhân
          </span>
        </div>
        <div className="doctor-kpi-sub">
          Đã check-in quầy & sẵn sàng vào phòng
        </div>
      </div>

      {/* 3. Tổng ca tiếp nhận hôm nay */}
      <div className="doctor-kpi-card">
        <div className="doctor-kpi-label">
          <span>📋 Tổng ca hôm nay</span>
          <UsergroupAddOutlined style={{ color: '#0284c7', fontSize: 16 }} />
        </div>
        <div className="doctor-kpi-value">
          <span>{totalToday}</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>
            lượt khám
          </span>
        </div>
        <div className="doctor-kpi-sub">Lịch hẹn được phân công cho phòng</div>
      </div>

      {/* 4. Đã khám hoàn tất */}
      <div className="doctor-kpi-card">
        <div className="doctor-kpi-label">
          <span>✅ Đã hoàn tất</span>
          <CheckCircleOutlined style={{ color: '#10b981', fontSize: 16 }} />
        </div>
        <div className="doctor-kpi-value">
          <span style={{ color: '#059669' }}>{completedCount}</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>
            ca khám
          </span>
        </div>
        <div className="doctor-kpi-sub">
          Đã đóng hồ sơ và kết thúc buổi khám
        </div>
      </div>
    </div>
  );
}
