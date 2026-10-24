import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminDoctorsPage } from './AdminDoctorsPage';
import { AdminPatientsPage } from './AdminPatientsPage';
import { AdminFeedbackModal } from '../components/AdminFeedbackModal';
import * as adminDoctorsService from '../../services/adminDoctors';
import * as adminPatientsService from '../../services/adminPatients';

const mockRequest = vi.fn();

vi.mock('../../app/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    request: mockRequest,
    user: { userId: 'admin-uuid-1', email: 'admin@test.local', role: 'ADMIN' },
  }),
}));

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

const mockDoctors: adminDoctorsService.DoctorItem[] = [
  {
    id: 'doc-uuid-001',
    accountId: 'acc-uuid-001',
    licenseNumber: 'VN-BS-998877',
    consultationRank: 'SPECIALIST_I',
    status: 'ACTIVE',
    version: 1,
    profile: {
      fullName: 'Trần Quốc Việt',
      professionalTitle: 'BS. CKI',
      biography: 'Bác sĩ chuyên sản phụ khoa với 12 năm kinh nghiệm.',
      practiceStartYear: 2012,
    },
    specialties: [
      { id: 'sp-01', code: 'OBGYN', name: 'Sản phụ khoa', isPrimary: true },
    ],
  },
];

const mockPatients: adminPatientsService.PatientItem[] = [
  {
    id: 'pat-uuid-001',
    fullName: 'Nguyễn Thị Bích Ngọc',
    phoneNumber: '0935112233',
    dateOfBirth: '1995-08-15',
    nationalId: '001295012345',
    address: '123 Cầu Giấy, Hà Nội',
    version: 1,
    emergencyContacts: [
      {
        id: 'ec-01',
        fullName: 'Nguyễn Văn Minh',
        relationship: 'Chồng',
        phoneNumber: '0988776655',
        isPrimary: true,
        priority: 1,
      },
    ],
  },
];

describe('AdminDoctorsPage', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.includes('/specialties')) {
        return Promise.resolve([
          { id: 'sp-01', code: 'OBGYN', name: 'Sản phụ khoa', status: 'ACTIVE' },
        ]);
      }
      if (typeof path === 'string' && path.includes('/consultation-ranks')) {
        return Promise.resolve([
          { id: 'rk-01', code: 'SPECIALIST_I', name: 'Bác sĩ CKI', status: 'ACTIVE' },
        ]);
      }
      if (typeof path === 'string' && path.includes('/doctors/')) {
        return Promise.resolve({ data: mockDoctors[0] });
      }
      if (typeof path === 'string' && path.startsWith('/api/doctors')) {
        return Promise.resolve({ data: mockDoctors });
      }
      return Promise.resolve([]);
    });
  });

  it('renders doctors table and toolbar correctly', async () => {
    render(<AdminDoctorsPage />);

    expect(await screen.findByText(/Trần Quốc Việt/)).toBeInTheDocument();
    expect(screen.getByText('VN-BS-998877')).toBeInTheDocument();
    expect(screen.getByText('Sản phụ khoa')).toBeInTheDocument();
    expect(screen.getByText('Thêm bác sĩ')).toBeInTheDocument();
  });

  it('opens drawer detail and shows doctor info and action buttons', async () => {
    render(<AdminDoctorsPage />);
    const nameEl = await screen.findByText(/Trần Quốc Việt/);
    await userEvent.click(nameEl);

    expect(await screen.findByText('Số chứng chỉ hành nghề')).toBeInTheDocument();
    expect(screen.getAllByText('Bác sĩ CKI').length).toBeGreaterThan(0);
    expect(screen.getByText('Giới thiệu / Tiểu sử')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chỉnh sửa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xóa bác sĩ/i })).toBeInTheDocument();
  });

  it('opens delete confirmation modal with red Xóa and Hủy', async () => {
    render(<AdminDoctorsPage />);
    const nameEl = await screen.findByText(/Trần Quốc Việt/);
    await userEvent.click(nameEl);

    const deleteBtn = await screen.findByRole('button', { name: /Xóa bác sĩ/i });
    await userEvent.click(deleteBtn);

    expect(await screen.findByText('Xác nhận xóa bác sĩ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  it('opens create doctor modal when clicking Thêm bác sĩ', async () => {
    render(<AdminDoctorsPage />);
    const addBtn = screen.getByRole('button', { name: /Thêm bác sĩ/i });
    await userEvent.click(addBtn);

    expect(await screen.findByText('Thêm bác sĩ mới')).toBeInTheDocument();
    expect(screen.getByText('Họ và tên bác sĩ')).toBeInTheDocument();
  });
});

describe('AdminPatientsPage', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockImplementation((path: string) => {
      if (typeof path === 'string' && path.startsWith('/api/patients/search')) {
        return Promise.resolve({
          data: { items: mockPatients, total: 1, page: 1, limit: 10 },
        });
      }
      if (typeof path === 'string' && path.includes('/patients/')) {
        return Promise.resolve({ data: mockPatients[0] });
      }
      return Promise.resolve({});
    });
  });

  it('renders patients table and search toolbar', async () => {
    render(<AdminPatientsPage />);

    expect(await screen.findByText('Nguyễn Thị Bích Ngọc')).toBeInTheDocument();
    expect(screen.getByText('0935112233')).toBeInTheDocument();
    expect(screen.getByText('001295012345')).toBeInTheDocument();
    expect(screen.getByText('Thêm bệnh nhân')).toBeInTheDocument();
  });

  it('opens drawer detail and shows emergency contact table', async () => {
    render(<AdminPatientsPage />);
    const nameEl = await screen.findByText('Nguyễn Thị Bích Ngọc');
    await userEvent.click(nameEl);

    expect(await screen.findByText('Người liên hệ khẩn cấp')).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn Văn Minh').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Chồng').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Chỉnh sửa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xóa hồ sơ/i })).toBeInTheDocument();
  });

  it('opens delete confirmation modal with red Xóa and Hủy', async () => {
    render(<AdminPatientsPage />);
    const nameEl = await screen.findByText('Nguyễn Thị Bích Ngọc');
    await userEvent.click(nameEl);

    const deleteBtn = await screen.findByRole('button', { name: /Xóa hồ sơ/i });
    await userEvent.click(deleteBtn);

    expect(await screen.findByText('Xác nhận xóa hồ sơ bệnh nhân')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });
});

describe('AdminFeedbackModal', () => {
  it('renders success feedback stroke modal and auto-dismisses', async () => {
    const handleClose = vi.fn();
    render(
      <AdminFeedbackModal
        feedback={{
          open: true,
          type: 'success',
          title: 'Cập nhật thành công!',
          description: 'Thông tin đã được lưu.',
        }}
        onClose={handleClose}
      />,
    );

    expect(screen.getByText('Cập nhật thành công!')).toBeInTheDocument();
    expect(screen.getByText('Thông tin đã được lưu.')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(handleClose).toHaveBeenCalled();
      },
      { timeout: 2500 },
    );
  });

  it('renders error feedback stroke modal', () => {
    render(
      <AdminFeedbackModal
        feedback={{
          open: true,
          type: 'error',
          title: 'Cập nhật thất bại!',
          description: 'Có lỗi xảy ra.',
        }}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('Cập nhật thất bại!')).toBeInTheDocument();
    expect(screen.getByText('Có lỗi xảy ra.')).toBeInTheDocument();
  });
});
