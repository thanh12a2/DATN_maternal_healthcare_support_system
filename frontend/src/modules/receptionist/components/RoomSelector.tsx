import { Badge, Segmented, Typography } from 'antd';
import type { DeskRoom } from '../../../services/receptionDesk';

interface Props { rooms: DeskRoom[]; value: string; onChange: (v: string) => void; waiting: Record<string, number> }

export function RoomSelector({ rooms, value, onChange, waiting }: Props) {
  const total = Object.values(waiting).reduce((a, b) => a + b, 0);
  const options = [
    { value: 'ALL', label: <div style={{ padding: '4px 10px' }}><b>Tất cả phòng</b><div style={{ fontSize: 12 }}><Badge count={total} showZero color="#0B5CAD" overflowCount={99} /> đang chờ</div></div> },
    ...rooms.map((r) => ({
      value: r.code,
      label: (
        <div style={{ padding: '4px 10px', textAlign: 'left', minWidth: 150 }}>
          <b>{r.code}</b>
          <div style={{ fontSize: 12, color: '#6b7a90' }}>{r.doctorName}</div>
          <Badge count={waiting[r.code] ?? 0} showZero color={(waiting[r.code] ?? 0) > 0 ? '#0B5CAD' : '#bfbfbf'} size="small" />
          <Typography.Text style={{ fontSize: 12, marginLeft: 6 }} type="secondary">ca chờ</Typography.Text>
        </div>
      ),
    })),
  ];
  return <div style={{ overflowX: 'auto', paddingBottom: 4 }}><Segmented value={value} onChange={(v) => onChange(String(v))} options={options} /></div>;
}

