import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Row } from './DataTable';
import { StatusTag } from './StatusTag';

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({ matches: false, media: query, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false }) });
}

const columns = [{ title: 'Tên', dataIndex: 'name' }, { title: 'Trạng thái', dataIndex: 'status', render: (value: unknown) => <StatusTag status={value} /> }];
const rows: Row[] = [{ id: '1', name: 'Alpha', status: 'ACTIVE' }, { id: '2', name: 'Beta', status: 'CANCELLED' }];

describe('admin DataTable', () => {
  it('renders rows with Vietnamese status tags and filters by search', async () => {
    render(<DataTable<Row> rows={rows} columns={columns} state="ready" onReload={() => undefined} />);
    expect(screen.getByText('Hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Đã hủy')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Tìm kiếm'), 'beta');
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows retry on error and calls reload', async () => {
    const reload = vi.fn();
    render(<DataTable<Row> rows={[]} columns={columns} state="error" error="Lỗi mạng" onReload={reload} />);
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(reload).toHaveBeenCalled();
  });

  it('explains missing backend support and forbidden access', () => {
    const { rerender } = render(<DataTable<Row> rows={[]} columns={columns} state="unavailable" onReload={() => undefined} />);
    expect(screen.getByText('Backend chưa hỗ trợ')).toBeInTheDocument();
    rerender(<DataTable<Row> rows={[]} columns={columns} state="forbidden" onReload={() => undefined} />);
    expect(screen.getByText('Không đủ quyền')).toBeInTheDocument();
  });
});
