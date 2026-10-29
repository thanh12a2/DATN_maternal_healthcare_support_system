import { Card, Col, Row, Statistic } from 'antd';
import type { DeskAppointment } from '../../../services/receptionDesk';

export function StatsStrip({ data }: { data: DeskAppointment[] }) {
  const c = (s: DeskAppointment['status']) => data.filter((a) => a.status === s).length;
  const items = [
    { title: 'Tổng ca hẹn', value: data.length, color: '#0B5CAD' },
    { title: 'Chờ tiếp nhận', value: c('BOOKED'), color: '#d48806' },
    { title: 'Đã check-in / Chờ khám', value: c('CHECKED_IN'), color: '#1677ff' },
    { title: 'Đang khám', value: c('IN_CLINICAL_CARE'), color: '#389e0d' },
    { title: 'Hoàn tất', value: c('COMPLETED'), color: '#08979c' },
  ];
  return (
    <Row gutter={[12, 12]}>
      {items.map((i) => (
        <Col key={i.title} xs={12} md={8} lg={{ flex: '1 1 0' }}>
          <Card size="small" variant="borderless"><Statistic title={i.title} value={i.value} styles={{ content: { color: i.color, fontWeight: 700 } }} /></Card>
        </Col>
      ))}
    </Row>
  );
}

