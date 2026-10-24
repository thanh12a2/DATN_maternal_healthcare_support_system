import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Button, Descriptions, Drawer, Empty, Input, Result, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ListState } from '../hooks/useApiList';
import { humanizeKey, text } from '../format';

export type Row = Record<string, unknown>;

interface DataTableProps<T extends Row> {
  rows: T[];
  columns: ColumnsType<T>;
  state: ListState;
  error?: string;
  onReload: () => void;
  rowKey?: (row: T) => string;
  searchPlaceholder?: string;
  detailTitle?: (row: T) => ReactNode;
  toolbar?: ReactNode;
}

function matches(row: Row, term: string) {
  return JSON.stringify(Object.values(row)).toLowerCase().includes(term);
}

function renderValue(value: unknown): ReactNode {
  if (value && typeof value === 'object') return <pre className="admin-json">{JSON.stringify(value, null, 2)}</pre>;
  return text(value);
}

export function DataTable<T extends Row>({ rows, columns, state, error, onReload, rowKey, searchPlaceholder = 'Tìm kiếm trong danh sách…', detailTitle, toolbar }: DataTableProps<T>) {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<T | null>(null);
  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return needle ? rows.filter((row) => matches(row, needle)) : rows;
  }, [rows, term]);

  if (state === 'forbidden') return <Result status="403" title="Không đủ quyền" subTitle="Tài khoản hiện tại không có quyền xem dữ liệu này." />;
  if (state === 'unavailable') return <Result status="info" title="Backend chưa hỗ trợ" subTitle="API cho khu vực này chưa được expose qua gateway." extra={<Button onClick={onReload}>Thử lại</Button>} />;

  return (
    <div className="admin-table-card">
      <div className="admin-toolbar">
        <Input allowClear id="admin-table-search" className="admin-search" prefix={<SearchOutlined />} placeholder={searchPlaceholder} value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Tìm kiếm" />
        <Space>
          {toolbar}
          <Button id="admin-table-reload" icon={<ReloadOutlined />} onClick={onReload} loading={state === 'loading'}>Làm mới</Button>
        </Space>
      </div>
      {state === 'error' && <Alert type="error" showIcon title="Không thể tải dữ liệu" description={error} action={<Button size="small" onClick={onReload}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
      <Table<T>
        size="middle"
        loading={state === 'loading'}
        dataSource={filtered}
        columns={columns}
        rowKey={(row) => rowKey?.(row) ?? String(row.id ?? JSON.stringify(row))}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" /> }}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50], showTotal: (total) => `${total} bản ghi` }}
        onRow={detailTitle ? (row) => ({ onClick: () => setSelected(row), style: { cursor: 'pointer' } }) : undefined}
      />
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} size="large" title={selected && detailTitle ? detailTitle(selected) : 'Chi tiết'}>
        {selected && (
          <Descriptions column={1} bordered size="small" items={Object.entries(selected).map(([key, value]) => ({ key, label: humanizeKey(key), children: renderValue(value) }))} />
        )}
      </Drawer>
    </div>
  );
}
