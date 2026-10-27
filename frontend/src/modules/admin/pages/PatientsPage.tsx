import { useCallback, useState } from 'react';
import { Alert, Button, Form, Input, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { DataTable, type Row } from '../components/DataTable';
import { useApiList } from '../hooks/useApiList';
import { autoColumns } from '../resources';
import { extractList } from '../format';

interface Criteria { fullName?: string; phoneNumber?: string; nationalId?: string }

/** Patient Service không có GET list; admin phải tra cứu bằng POST /api/patients/search. */
export function PatientsPage() {
  const { request } = useAuthSession();
  const [criteria, setCriteria] = useState<Criteria | null>(null);

  const load = useCallback(async () => {
    if (!criteria) return [];
    const body = JSON.stringify({ ...criteria, page: 1, limit: 50 });
    return extractList<Row>(await request<unknown>('/api/patients/search', { method: 'POST', body }));
  }, [criteria, request]);
  const { state, items, error, reload } = useApiList<Row>(load, [load]);

  function submit(values: Criteria) {
    const clean = Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === 'string' && value.trim() !== '')) as Criteria;
    setCriteria(Object.keys(clean).length ? clean : null);
  }

  return (
    <div>
      <Form layout="inline" onFinish={submit} className="admin-search-form">
        <Form.Item name="fullName" label="Họ tên" rules={[{ min: 2, message: 'Tối thiểu 2 ký tự' }]}><Input id="admin-patient-name" allowClear placeholder="Nguyễn Thị A" /></Form.Item>
        <Form.Item name="phoneNumber" label="Số điện thoại"><Input id="admin-patient-phone" allowClear placeholder="09…" /></Form.Item>
        <Form.Item name="nationalId" label="CCCD"><Input id="admin-patient-nid" allowClear /></Form.Item>
        <Form.Item><Space><Button type="primary" htmlType="submit" icon={<SearchOutlined />}>Tra cứu</Button></Space></Form.Item>
      </Form>
      {!criteria
        ? <Alert type="info" showIcon style={{ marginTop: 16 }} title="Nhập ít nhất một tiêu chí để tra cứu bệnh nhân" description="Backend không cung cấp danh sách toàn bộ bệnh nhân; thông tin được tra cứu theo tiêu chí để bảo vệ dữ liệu cá nhân." />
        : <div style={{ marginTop: 16 }}><DataTable<Row> rows={items} state={state} error={error} onReload={reload} columns={autoColumns(items)} detailTitle={(row) => `Bệnh nhân ${String(row.fullName ?? row.id ?? '')}`} /></div>}
    </div>
  );
}
