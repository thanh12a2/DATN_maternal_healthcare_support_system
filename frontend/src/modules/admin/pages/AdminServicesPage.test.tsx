import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AdminServicesPage } from './AdminServicesPage';
import * as adminCatalogService from '../../../services/adminCatalog';
import * as adminDoctorsService from '../../../services/adminDoctors';

const mockRequest = vi.fn();

vi.mock('../../../app/AuthSessionProvider', () => ({
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

const mockServices: adminCatalogService.MedicalServiceItem[] = [
  {
    id: 'srv-001',
    code: 'KHAM_THAI_01',
    name: 'Khám thai định kỳ tiêu chuẩn',
    slug: 'kham-thai-dinh-ky-tieu-chuan',
    summary: 'Khám sức khỏe mẹ bầu toàn diện theo từng mốc thai kỳ',
    description: 'Chi tiết khám đo bề cao tử cung, tim thai, huyết áp.',
    kind: 'CONSULTATION',
    specialtyId: 'sp-obgyn-01',
    durationMinutes: 30,
    bookingEnabled: true,
    doctorRankSelectionPolicy: 'RANK_UPGRADE_ALLOWED',
    status: 'ACTIVE',
    version: 1,
    thumbnailUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982',
    categories: [
      {
        id: 'cat-kham-thai',
        code: 'KHAM_THAI',
        name: 'Khám & Theo dõi Thai kỳ',
        slug: 'kham-theo-doi-thai-ky',
        sortOrder: 1,
        status: 'ACTIVE',
        isPrimary: true,
      },
    ],
    prices: [
      {
        id: 'price-001',
        amountMinor: 250000,
        currency: 'VND',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
        status: 'ACTIVE',
        version: 1,
      },
    ],
    tags: [
      {
        id: 'tag-1',
        code: 'ME_BAU_3_THANG_DAU',
        name: 'Mẹ bầu 3 tháng đầu',
        slug: 'me-bau-3-thang-dau',
        group: 'AUDIENCE',
        sortOrder: 1,
        status: 'ACTIVE',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const mockCategories: adminCatalogService.ServiceCategoryItem[] = [
  {
    id: 'cat-kham-thai',
    code: 'KHAM_THAI',
    name: 'Khám & Theo dõi Thai kỳ',
    slug: 'kham-theo-doi-thai-ky',
    description: 'Dịch vụ khám sản khoa định kỳ và theo dõi thai',
    sortOrder: 1,
    status: 'ACTIVE',
  },
];

const mockTags: adminCatalogService.CatalogTagItem[] = [
  {
    id: 'tag-1',
    code: 'ME_BAU_3_THANG_DAU',
    name: 'Mẹ bầu 3 tháng đầu',
    slug: 'me-bau-3-thang-dau',
    group: 'AUDIENCE',
    description: 'Thẻ tag phân loại tuần 1-13',
    sortOrder: 1,
    status: 'ACTIVE',
  },
];

const mockSurcharges: adminCatalogService.DoctorRankSurchargeItem[] = [
  {
    id: 'sur-01',
    rankCode: 'SPECIALIST_I',
    currency: 'VND',
    amountMinor: 100000,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    status: 'ACTIVE',
    version: 1,
  },
];

describe('AdminServicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(adminCatalogService, 'listAdminServices').mockResolvedValue({
      items: mockServices,
      total: 1,
    });
    vi.spyOn(adminCatalogService, 'getAdminService').mockResolvedValue(mockServices[0]);
    vi.spyOn(adminCatalogService, 'listAdminCategories').mockResolvedValue(mockCategories);
    vi.spyOn(adminCatalogService, 'listAdminTags').mockResolvedValue(mockTags);
    vi.spyOn(adminCatalogService, 'listRankSurcharges').mockResolvedValue(mockSurcharges);
    vi.spyOn(adminCatalogService, 'listServicePrices').mockResolvedValue([
      mockServices[0].prices[0],
    ]);
    vi.spyOn(adminDoctorsService, 'listSpecialties').mockResolvedValue([
      { id: 'sp-obgyn-01', code: 'OBGYN', name: 'Sản phụ khoa', status: 'ACTIVE' },
    ]);
    vi.spyOn(adminDoctorsService, 'listConsultationRanks').mockResolvedValue([
      { id: 'rk-01', code: 'SPECIALIST_I', name: 'Bác sĩ Chuyên khoa I (CKI)', experienceYearsMin: 5, status: 'ACTIVE' },
    ]);
    vi.spyOn(adminDoctorsService, 'listDoctors').mockResolvedValue({
      data: [],
    });
  });

  it('renders services table, stats cards and search toolbar', async () => {
    render(<AdminServicesPage />);

    expect(screen.getByText('Tổng số dịch vụ')).toBeInTheDocument();
    expect(await screen.findByText('Khám thai định kỳ tiêu chuẩn')).toBeInTheDocument();
    expect(screen.getByText('KHAM_THAI_01')).toBeInTheDocument();
    expect(screen.getByText(/250\.000/)).toBeInTheDocument();
  });

  it('opens detail drawer when clicking a service row', async () => {
    render(<AdminServicesPage />);

    const nameEl = await screen.findByText('Khám thai định kỳ tiêu chuẩn');
    const tr = nameEl.closest('tr') || nameEl;
    await userEvent.click(tr);

    expect(await screen.findByText('Bảng giá viện phí dịch vụ')).toBeInTheDocument();
    expect(screen.getByText('Lên lịch mức giá mới')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chỉnh sửa/i })).toBeInTheDocument();
  });

  it('opens create service modal when clicking Thêm dịch vụ mới', async () => {
    render(<AdminServicesPage />);

    const createBtn = await screen.findByRole('button', { name: /Thêm dịch vụ mới/i });
    await userEvent.click(createBtn);

    expect(await screen.findByText(/Thêm mới dịch vụ y tế & bảng giá/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên dịch vụ y tế/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mã dịch vụ y tế/i)).toBeInTheDocument();
  });

  it('navigates to categories tab and displays categories list', async () => {
    render(<AdminServicesPage />);

    const catTab = (await screen.findByText(/Nhóm danh mục \(/)).closest('.ant-tabs-tab')!;
    await userEvent.click(catTab);

    expect(await screen.findByText('KHAM_THAI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thêm nhóm dịch vụ/i })).toBeInTheDocument();
  });

  it('navigates to tags tab and displays tags list', async () => {
    render(<AdminServicesPage />);

    const tagTab = (await screen.findByText(/Thẻ tag dịch vụ/)).closest('.ant-tabs-tab')!;
    await userEvent.click(tagTab);

    expect(await screen.findByText('ME_BAU_3_THANG_DAU')).toBeInTheDocument();
    expect(screen.getByText('/me-bau-3-thang-dau')).toBeInTheDocument();
  });

  it('navigates to surcharges tab and displays rank surcharge list', async () => {
    render(<AdminServicesPage />);

    const surchargeTab = (await screen.findByText(/Hạng bác sĩ & Phụ thu/)).closest('.ant-tabs-tab')!;
    await userEvent.click(surchargeTab);

    expect(await screen.findByText('Bác sĩ Chuyên khoa I (CKI)')).toBeInTheDocument();
    expect(screen.getByText(/100\.000/)).toBeInTheDocument();
  });
});
