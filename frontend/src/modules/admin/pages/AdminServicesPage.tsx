import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DollarCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  MedicineBoxOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import {
  activateCategory,
  activateService,
  activateTag,
  cancelPrice,
  cancelRankSurcharge,
  createCategory,
  createService,
  createTag,
  deactivateCategory,
  deactivateService,
  deactivateTag,
  deleteCategory,
  deleteService,
  deleteTag,
  getAdminService,
  listAdminCategories,
  listAdminServices,
  listAdminTags,
  listRankSurcharges,
  listServicePrices,
  scheduleBasePrice,
  scheduleRankSurcharge,
  updateCategory,
  updateService,
  updateTag,
  type BasePriceItem,
  type CatalogStatus,
  type CatalogTagItem,
  type CreateCategoryPayload,
  type CreateServicePayload,
  type CreateTagPayload,
  type DoctorRankSelectionPolicy,
  type DoctorRankSurchargeItem,
  type MedicalServiceItem,
  type MedicalServiceKind,
  type ScheduleBasePricePayload,
  type ScheduleRankSurchargePayload,
  type ServiceCategoryItem,
  type TagGroup,
  type UpdateCategoryPayload,
  type UpdateServicePayload,
  type UpdateTagPayload,
} from '../../../services/adminCatalog';
import {
  createConsultationRank,
  deleteConsultationRank,
  listConsultationRanks,
  listDoctors,
  listSpecialties,
  updateConsultationRank,
  type ConsultationRankItem,
  type CreateConsultationRankPayload,
  type DoctorItem,
  type SpecialtyItem,
  type UpdateConsultationRankPayload,
} from '../../../services/adminDoctors';
import { formatMoneyMinor } from '../format';
import { StatusTag } from '../components/StatusTag';
import {
  AdminFeedbackModal,
  type AdminFeedbackState,
} from '../components/AdminFeedbackModal';

const { Title, Text, Paragraph } = Typography;

const KIND_CONFIG: Record<MedicalServiceKind, { label: string; color: string }> = {
  CONSULTATION: { label: 'Khám bệnh', color: 'blue' },
  DIAGNOSTIC: { label: 'Chẩn đoán hình ảnh', color: 'purple' },
  PROCEDURE: { label: 'Thủ thuật', color: 'orange' },
  PACKAGE: { label: 'Gói thai sản', color: 'magenta' },
  VACCINATION: { label: 'Tiêm chủng', color: 'cyan' },
  OTHER: { label: 'Khác', color: 'default' },
};

const POLICY_CONFIG: Record<DoctorRankSelectionPolicy, { label: string; color: string }> = {
  NOT_REQUIRED: { label: 'Không phân biệt hạng', color: 'default' },
  BASIC_INCLUDED: { label: 'Đã gồm phí cơ bản', color: 'cyan' },
  RANK_UPGRADE_ALLOWED: { label: 'Cho phép phụ thu theo hạng', color: 'gold' },
};

const TAG_GROUP_CONFIG: Record<TagGroup, { label: string; color: string }> = {
  AUDIENCE: { label: 'Đối tượng mẹ bầu', color: 'pink' },
  FEATURE: { label: 'Công nghệ / Tính năng', color: 'geekblue' },
  LABEL: { label: 'Nhãn nổi bật', color: 'green' },
  AGE: { label: 'Độ tuổi', color: 'purple' },
  GENDER: { label: 'Giới tính', color: 'volcano' },
};

export interface MergedRankItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  experienceYearsMin?: number;
  rankStatus: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  rankCreatedAt?: string;
  rankUpdatedAt?: string;

  // Fields from doctor_rank_surcharges in DB
  surchargeId?: string;
  amountMinor?: number;
  currency?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  surchargeStatus?: string;
  surchargeVersion?: number;
  surchargeCreatedAt?: string;
  surchargeUpdatedAt?: string;
  allSurcharges: DoctorRankSurchargeItem[];

  rawRank?: ConsultationRankItem;
  rawSurcharge?: DoctorRankSurchargeItem;
}

export function getRankDisplayName(code: string, ranks: ConsultationRankItem[]): string {
  const r = ranks.find((item) => item.code === code);
  return r ? r.name : code;
}

export function renderPriceStatusTag(status?: string, effectiveFrom?: string, effectiveTo?: string | null) {
  if (!status) return <Tag color="default">Chưa thiết lập</Tag>;
  const now = new Date();
  const from = effectiveFrom ? new Date(effectiveFrom) : null;
  const to = effectiveTo ? new Date(effectiveTo) : null;

  if (status === 'CANCELLED') {
    return <Tag color="error">Đã hủy</Tag>;
  }
  if (status === 'EXPIRED' || (to && to <= now)) {
    return <Tag color="default">Hết hiệu lực</Tag>;
  }
  if ((from && from > now) || status === 'SCHEDULED') {
    return <Tag color="orange">Đã lên lịch</Tag>;
  }
  return <Tag color="green">Đang áp dụng</Tag>;
}

export function AdminServicesPage() {
  const { request, user } = useAuthSession();

  // Tab state
  const [activeTab, setActiveTab] = useState<'services' | 'categories' | 'tags' | 'surcharges'>('services');

  // Specialties list from doctor service
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);

  // ------------------------------------------------------------------
  // TAB 1: DỊCH VỤ & BẢNG GIÁ
  // ------------------------------------------------------------------
  const [services, setServices] = useState<MedicalServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesTotal, setServicesTotal] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals & Drawers
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<MedicalServiceItem | null>(null);
  const [servicePrices, setServicePrices] = useState<BasePriceItem[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<MedicalServiceItem | null>(null);
  const [submittingService, setSubmittingService] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<MedicalServiceItem | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  // Modal xác nhận kích hoạt / tạm ngưng dịch vụ
  const [toggleStatusModalOpen, setToggleStatusModalOpen] = useState(false);
  const [serviceToToggle, setServiceToToggle] = useState<MedicalServiceItem | null>(null);
  const [togglingService, setTogglingService] = useState(false);

  // Lên lịch giá Modal
  const [schedulePriceModalOpen, setSchedulePriceModalOpen] = useState(false);
  const [serviceForPricing, setServiceForPricing] = useState<MedicalServiceItem | null>(null);
  const [submittingPrice, setSubmittingPrice] = useState(false);

  const [createServiceForm] = Form.useForm<CreateServicePayload>();
  const [editServiceForm] = Form.useForm<UpdateServicePayload>();
  const [schedulePriceForm] = Form.useForm<ScheduleBasePricePayload>();

  // ------------------------------------------------------------------
  // TAB 2: NHÓM DỊCH VỤ (CATEGORIES)
  // ------------------------------------------------------------------
  const [categories, setCategories] = useState<ServiceCategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);

  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);
  const [editCategoryModalOpen, setEditCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<ServiceCategoryItem | null>(null);
  const [deleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ServiceCategoryItem | null>(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // Modal xác nhận kích hoạt / tạm khóa nhóm dịch vụ
  const [toggleCategoryModalOpen, setToggleCategoryModalOpen] = useState(false);
  const [categoryToToggle, setCategoryToToggle] = useState<ServiceCategoryItem | null>(null);
  const [togglingCategory, setTogglingCategory] = useState(false);

  // Drawer Chi tiết nhóm dịch vụ
  const [detailCategoryDrawerOpen, setDetailCategoryDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryItem | null>(null);
  const [categoryServices, setCategoryServices] = useState<MedicalServiceItem[]>([]);
  const [loadingCategoryServices, setLoadingCategoryServices] = useState(false);

  const [createCategoryForm] = Form.useForm<CreateCategoryPayload>();
  const [editCategoryForm] = Form.useForm<UpdateCategoryPayload>();

  // ------------------------------------------------------------------
  // TAB 3: THẺ TAGS
  // ------------------------------------------------------------------
  const [tags, setTags] = useState<CatalogTagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagGroupFilter, setTagGroupFilter] = useState<string>('ALL');
  const [tagPage, setTagPage] = useState(1);
  const [tagPageSize, setTagPageSize] = useState(10);

  const [createTagModalOpen, setCreateTagModalOpen] = useState(false);
  const [editTagModalOpen, setEditTagModalOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<CatalogTagItem | null>(null);
  const [deleteTagModalOpen, setDeleteTagModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<CatalogTagItem | null>(null);
  const [submittingTag, setSubmittingTag] = useState(false);

  // Modal xác nhận kích hoạt / tạm khóa thẻ tag
  const [toggleTagModalOpen, setToggleTagModalOpen] = useState(false);
  const [tagToToggle, setTagToToggle] = useState<CatalogTagItem | null>(null);
  const [togglingTag, setTogglingTag] = useState(false);

  // Drawer Chi tiết thẻ tag
  const [detailTagDrawerOpen, setDetailTagDrawerOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<CatalogTagItem | null>(null);
  const [tagServices, setTagServices] = useState<MedicalServiceItem[]>([]);
  const [loadingTagServices, setLoadingTagServices] = useState(false);

  const [createTagForm] = Form.useForm<CreateTagPayload>();
  const [editTagForm] = Form.useForm<UpdateTagPayload>();

  // ------------------------------------------------------------------
  // TAB 4: HẠNG BÁC SĨ & PHỤ THU HẠNG BÁC SĨ (RANKS & SURCHARGES)
  // ------------------------------------------------------------------
  const [consultationRanks, setConsultationRanks] = useState<ConsultationRankItem[]>([]);
  const [ranksLoading, setRanksLoading] = useState(false);
  const [doctorsList, setDoctorsList] = useState<DoctorItem[]>([]);
  const [createRankModalOpen, setCreateRankModalOpen] = useState(false);
  const [editRankModalOpen, setEditRankModalOpen] = useState(false);
  const [rankToEdit, setRankToEdit] = useState<ConsultationRankItem | null>(null);
  const [deleteRankModalOpen, setDeleteRankModalOpen] = useState(false);
  const [rankToDelete, setRankToDelete] = useState<ConsultationRankItem | null>(null);
  const [toggleRankModalOpen, setToggleRankModalOpen] = useState(false);
  const [rankToToggle, setRankToToggle] = useState<ConsultationRankItem | null>(null);
  const [detailRankDrawerOpen, setDetailRankDrawerOpen] = useState(false);
  const [selectedMergedRank, setSelectedMergedRank] = useState<MergedRankItem | null>(null);
  const [rankSearchQuery, setRankSearchQuery] = useState('');
  const [rankStatusFilter, setRankStatusFilter] = useState<string | undefined>(undefined);
  const [rankPage, setRankPage] = useState(1);
  const [rankPageSize, setRankPageSize] = useState(10);
  const [submittingRank, setSubmittingRank] = useState(false);

  const [createRankForm] = Form.useForm<CreateConsultationRankPayload>();
  const [editRankForm] = Form.useForm<UpdateConsultationRankPayload>();

  const [surcharges, setSurcharges] = useState<DoctorRankSurchargeItem[]>([]);
  const [surchargesLoading, setSurchargesLoading] = useState(false);
  const [createSurchargeModalOpen, setCreateSurchargeModalOpen] = useState(false);
  const [rankForSurcharge, setRankForSurcharge] = useState<MergedRankItem | null>(null);
  const [submittingSurcharge, setSubmittingSurcharge] = useState(false);
  const [createSurchargeForm] = Form.useForm<ScheduleRankSurchargePayload>();

  // Notification feedback
  const [feedback, setFeedback] = useState<AdminFeedbackState | null>(null);

  // Tổng số dịch vụ đang hoạt động thực tế trên toàn hệ thống (tính trên toàn DB, không bị giới hạn trang)
  const [activeServicesTotal, setActiveServicesTotal] = useState<number>(0);

  const loadActiveCount = useCallback(async () => {
    try {
      const res = await listAdminServices(request, { status: 'ACTIVE', limit: 1 });
      setActiveServicesTotal(res.total);
    } catch {
      // ignore
    }
  }, [request]);

  // ------------------------------------------------------------------
  // DATA LOADERS
  // ------------------------------------------------------------------

  const loadSpecialties = useCallback(async () => {
    try {
      const res = await listSpecialties(request, { limit: 100 });
      setSpecialties(res);
    } catch {
      // ignore
    }
  }, [request]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const data = await listAdminCategories(request);
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCategoriesLoading(false);
    }
  }, [request]);

  const loadTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const data = await listAdminTags(request);
      setTags(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTagsLoading(false);
    }
  }, [request]);

  const loadSurcharges = useCallback(async () => {
    setSurchargesLoading(true);
    try {
      const data = await listRankSurcharges(request);
      setSurcharges(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSurchargesLoading(false);
    }
  }, [request]);

  const loadRanksAndDoctors = useCallback(async () => {
    setRanksLoading(true);
    try {
      const [ranksRes, docsRes] = await Promise.all([
        listConsultationRanks(request),
        listDoctors(request, { limit: 100 }),
      ]);
      setConsultationRanks(Array.isArray(ranksRes) ? ranksRes : []);
      setDoctorsList(Array.isArray(docsRes) ? docsRes : (docsRes as any)?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRanksLoading(false);
    }
  }, [request]);

  const loadServices = useCallback(
    async (
      targetPage = page,
      targetLimit = pageSize,
      targetSearch = searchQuery,
      targetCategory = categoryFilter,
      targetKind = kindFilter,
      targetStatus = statusFilter,
    ) => {
      setServicesLoading(true);
      try {
        const res = await listAdminServices(request, {
          q: targetSearch.trim() || undefined,
          kind: targetKind ? (targetKind as MedicalServiceKind) : undefined,
          category: targetCategory || undefined,
          status: targetStatus ? (targetStatus as CatalogStatus) : undefined,
          page: targetPage,
          limit: targetLimit,
        });
        setServices(res.items);
        setServicesTotal(res.total);
        void loadActiveCount();
      } catch (err) {
        console.error(err);
      } finally {
        setServicesLoading(false);
      }
    },
    [request, page, pageSize, searchQuery, categoryFilter, kindFilter, statusFilter, loadActiveCount],
  );

  const handleResetServices = () => {
    setSearchQuery('');
    setCategoryFilter(undefined);
    setKindFilter(undefined);
    setStatusFilter(undefined);
    setPage(1);
    void loadServices(1, pageSize, '', undefined, undefined, undefined);
  };

  useEffect(() => {
    loadSpecialties();
    loadCategories();
    loadTags();
    loadSurcharges();
    loadRanksAndDoctors();
    loadActiveCount();
  }, [loadSpecialties, loadCategories, loadTags, loadSurcharges, loadRanksAndDoctors, loadActiveCount]);

  useEffect(() => {
    loadServices(page, pageSize);
  }, [loadServices, page, pageSize]);

  // Load prices when drawer opens
  const openDetailDrawer = async (svc: MedicalServiceItem) => {
    setSelectedService(svc);
    setDetailDrawerOpen(true);
    setLoadingPrices(true);
    try {
      const full = await getAdminService(request, svc.id);
      setSelectedService(full);
      const prices = await listServicePrices(request, svc.id);
      setServicePrices(prices);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPrices(false);
    }
  };

  // ------------------------------------------------------------------
  // SERVICE ACTIONS
  // ------------------------------------------------------------------

  const handleCreateService = async (values: CreateServicePayload) => {
    setSubmittingService(true);
    try {
      await createService(request, values);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Thêm mới dịch vụ thành công!',
        description: `Dịch vụ "${values.name}" (${values.code}) đã được tạo thành công trên hệ thống.`,
      });
      setCreateModalOpen(false);
      createServiceForm.resetFields();
      await loadServices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi tạo dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Thêm dịch vụ thất bại!', description: msg });
    } finally {
      setSubmittingService(false);
    }
  };

  const handleOpenEditService = (svc: MedicalServiceItem) => {
    setServiceToEdit(svc);
    const categoryIds = (svc.categories || []).map((c) => c.id);
    const tagIds = (svc.tags || []).map((t) => t.id);

    editServiceForm.setFieldsValue({
      code: svc.code,
      name: svc.name,
      summary: svc.summary ?? undefined,
      description: svc.description ?? undefined,
      kind: svc.kind,
      specialtyId: svc.specialtyId ?? undefined,
      bookingEnabled: svc.bookingEnabled,
      doctorRankSelectionPolicy: svc.doctorRankSelectionPolicy,
      categoryIds,
      tagIds,
      status: svc.status,
    });
    setEditModalOpen(true);
  };

  const handleUpdateService = async (values: UpdateServicePayload) => {
    if (!serviceToEdit) return;
    setSubmittingService(true);
    try {
      await updateService(request, serviceToEdit.id, values);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Cập nhật dịch vụ thành công!',
        description: `Thông tin dịch vụ "${values.name || serviceToEdit.name}" đã được cập nhật thành công.`,
      });
      setEditModalOpen(false);
      setServiceToEdit(null);
      await loadServices();
      if (selectedService?.id === serviceToEdit.id) {
        const refreshed = await getAdminService(request, serviceToEdit.id);
        setSelectedService(refreshed);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi cập nhật dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Cập nhật thất bại!', description: msg });
    } finally {
      setSubmittingService(false);
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    setDeletingService(true);
    const name = serviceToDelete.name;
    try {
      await deleteService(request, serviceToDelete.id);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa dịch vụ thành công!',
        description: `Dịch vụ "${name}" đã được xóa khỏi danh mục dịch vụ.`,
      });
      setDeleteModalOpen(false);
      setServiceToDelete(null);
      await loadServices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xóa dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Xóa dịch vụ thất bại!', description: msg });
    } finally {
      setDeletingService(false);
    }
  };

  const handleRequestToggleServiceStatus = (svc: MedicalServiceItem) => {
    setServiceToToggle(svc);
    setToggleStatusModalOpen(true);
  };

  const handleConfirmToggleServiceStatus = async () => {
    if (!serviceToToggle) return;
    setTogglingService(true);
    try {
      if (serviceToToggle.status === 'ACTIVE') {
        await deactivateService(request, serviceToToggle.id);
        setFeedback({
          open: true,
          type: 'success',
          title: 'Tạm khóa dịch vụ thành công!',
          description: `Dịch vụ "${serviceToToggle.name}" đã được chuyển sang trạng thái tạm khóa.`,
        });
      } else {
        await activateService(request, serviceToToggle.id);
        setFeedback({
          open: true,
          type: 'success',
          title: 'Kích hoạt dịch vụ thành công!',
          description: `Dịch vụ "${serviceToToggle.name}" đã được kích hoạt hoạt động trở lại.`,
        });
      }
      setToggleStatusModalOpen(false);
      setServiceToToggle(null);
      await loadServices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể thay đổi trạng thái dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Đổi trạng thái thất bại!', description: msg });
    } finally {
      setTogglingService(false);
    }
  };

  // Pricing actions
  const handleOpenSchedulePrice = (svc: MedicalServiceItem) => {
    setServiceForPricing(svc);
    schedulePriceForm.resetFields();
    schedulePriceForm.setFieldsValue({
      status: 'ACTIVE',
    });
    setSchedulePriceModalOpen(true);
  };

  const handleSchedulePrice = async (values: ScheduleBasePricePayload) => {
    if (!serviceForPricing) return;
    setSubmittingPrice(true);
    try {
      const payload: ScheduleBasePricePayload = {
        amountMinor: values.amountMinor,
        status: values.status,
        effectiveFrom: values.status === 'SCHEDULED' && values.effectiveFrom 
          ? values.effectiveFrom 
          : new Date().toISOString(),
        effectiveTo: values.status === 'SCHEDULED' && values.effectiveTo 
          ? values.effectiveTo 
          : undefined,
      };
      await scheduleBasePrice(request, serviceForPricing.id, payload);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Thiết lập biểu phí thành công!',
        description: `Mức giá viện phí mới đã được áp dụng cho dịch vụ "${serviceForPricing.name}".`,
      });
      setSchedulePriceModalOpen(false);
      setServiceForPricing(null);
      await loadServices();
      if (selectedService?.id === serviceForPricing.id) {
        const prices = await listServicePrices(request, serviceForPricing.id);
        setServicePrices(prices);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể lên lịch giá.';
      setFeedback({ open: true, type: 'error', title: 'Thiết lập giá thất bại!', description: msg });
    } finally {
      setSubmittingPrice(false);
    }
  };

  const handleCancelPrice = async (priceId: string) => {
    try {
      await cancelPrice(request, priceId);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Hủy mức giá thành công!',
        description: 'Mức giá viện phí đã được hủy áp dụng.',
      });
      if (selectedService) {
        const prices = await listServicePrices(request, selectedService.id);
        setServicePrices(prices);
      }
      await loadServices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể hủy mức giá.';
      setFeedback({ open: true, type: 'error', title: 'Hủy giá thất bại!', description: msg });
    }
  };

  // ------------------------------------------------------------------
  // CATEGORY ACTIONS
  // ------------------------------------------------------------------

  const handleCreateCategory = async (values: CreateCategoryPayload) => {
    setSubmittingCategory(true);
    try {
      await createCategory(request, { ...values, status: 'DRAFT' });
      setFeedback({
        open: true,
        type: 'success',
        title: 'Thêm nhóm dịch vụ thành công!',
        description: `Nhóm danh mục "${values.name}" (${values.code}) đã được tạo ở trạng thái Bản nháp.`,
      });
      setCreateCategoryModalOpen(false);
      createCategoryForm.resetFields();
      await loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi tạo nhóm dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Thêm nhóm thất bại!', description: msg });
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleOpenEditCategory = (cat: ServiceCategoryItem) => {
    setCategoryToEdit(cat);
    editCategoryForm.setFieldsValue({
      code: cat.code,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? undefined,
      parentId: cat.parentId ?? undefined,
      sortOrder: cat.sortOrder,
    });
    setEditCategoryModalOpen(true);
  };

  const handleUpdateCategory = async (values: UpdateCategoryPayload) => {
    if (!categoryToEdit) return;
    setSubmittingCategory(true);
    try {
      await updateCategory(request, categoryToEdit.id, values);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Cập nhật nhóm dịch vụ thành công!',
        description: `Thông tin nhóm "${values.name || categoryToEdit.name}" đã được cập nhật.`,
      });
      setEditCategoryModalOpen(false);
      setCategoryToEdit(null);
      await loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi cập nhật nhóm dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Cập nhật nhóm thất bại!', description: msg });
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setSubmittingCategory(true);
    const name = categoryToDelete.name;
    try {
      await deleteCategory(request, categoryToDelete.id);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa nhóm dịch vụ thành công!',
        description: `Nhóm "${name}" đã được xóa khỏi hệ thống.`,
      });
      setDeleteCategoryModalOpen(false);
      setCategoryToDelete(null);
      await loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa nhóm dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Xóa nhóm thất bại!', description: msg });
    } finally {
      setSubmittingCategory(false);
    }
  };

  const openDetailCategoryDrawer = async (cat: ServiceCategoryItem) => {
    setSelectedCategory(cat);
    setDetailCategoryDrawerOpen(true);
    setLoadingCategoryServices(true);
    try {
      const res = await listAdminServices(request, {
        category: cat.id,
        limit: 100,
      });
      setCategoryServices(res.items);
    } catch (err) {
      console.error(err);
      // Fallback to local services in state
      setCategoryServices(services.filter((s) => s.categories?.some((c) => c.id === cat.id)));
    } finally {
      setLoadingCategoryServices(false);
    }
  };

  const openDetailTagDrawer = async (tag: CatalogTagItem) => {
    setSelectedTag(tag);
    setDetailTagDrawerOpen(true);
    setLoadingTagServices(true);
    try {
      const res = await listAdminServices(request, {
        tag: tag.id,
        limit: 100,
      });
      setTagServices(res.items);
    } catch (err) {
      console.error(err);
      // Fallback to local services in state
      setTagServices(services.filter((s) => s.tags?.some((t) => t.id === tag.id)));
    } finally {
      setLoadingTagServices(false);
    }
  };

  const handleRequestToggleCategoryStatus = (cat: ServiceCategoryItem) => {
    setCategoryToToggle(cat);
    setToggleCategoryModalOpen(true);
  };

  const handleConfirmToggleCategoryStatus = async () => {
    if (!categoryToToggle) return;
    setTogglingCategory(true);
    try {
      if (categoryToToggle.status === 'ACTIVE') {
        await deactivateCategory(request, categoryToToggle.id);
        setFeedback({
          open: true,
          type: 'success',
          title: 'Tạm khóa nhóm thành công!',
          description: `Nhóm danh mục "${categoryToToggle.name}" đã được chuyển sang tạm khóa.`,
        });
      } else {
        await activateCategory(request, categoryToToggle.id);
        setFeedback({
          open: true,
          type: 'success',
          title: 'Kích hoạt nhóm thành công!',
          description: `Nhóm danh mục "${categoryToToggle.name}" đã được kích hoạt hoạt động.`,
        });
      }
      setToggleCategoryModalOpen(false);
      setCategoryToToggle(null);
      await loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đổi trạng thái nhóm dịch vụ.';
      setFeedback({ open: true, type: 'error', title: 'Đổi trạng thái thất bại!', description: msg });
    } finally {
      setTogglingCategory(false);
    }
  };

  // ------------------------------------------------------------------
  // TAG ACTIONS
  // ------------------------------------------------------------------

  const handleCreateTag = async (values: CreateTagPayload) => {
    setSubmittingTag(true);
    try {
      await createTag(request, { ...values, group: values.group || 'LABEL', status: 'DRAFT' });
      setFeedback({
        open: true,
        type: 'success',
        title: 'Thêm thẻ tag thành công!',
        description: `Thẻ tag "${values.name}" (${values.code}) đã được tạo ở trạng thái Bản nháp.`,
      });
      setCreateTagModalOpen(false);
      createTagForm.resetFields();
      await loadTags();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi tạo thẻ tag.';
      setFeedback({ open: true, type: 'error', title: 'Thêm thẻ tag thất bại!', description: msg });
    } finally {
      setSubmittingTag(false);
    }
  };

  const handleOpenEditTag = (t: CatalogTagItem) => {
    setTagToEdit(t);
    editTagForm.setFieldsValue({
      code: t.code,
      name: t.name,
      slug: t.slug,
      group: t.group || 'LABEL',
      description: t.description ?? undefined,
      sortOrder: t.sortOrder,
    });
    setEditTagModalOpen(true);
  };

  const handleUpdateTag = async (values: UpdateTagPayload) => {
    if (!tagToEdit) return;
    setSubmittingTag(true);
    try {
      await updateTag(request, tagToEdit.id, { ...values, group: values.group || tagToEdit.group || 'LABEL' });
      setFeedback({
        open: true,
        type: 'success',
        title: 'Cập nhật thẻ tag thành công!',
        description: `Thẻ tag "${values.name || tagToEdit.name}" đã được cập nhật.`,
      });
      setEditTagModalOpen(false);
      setTagToEdit(null);
      await loadTags();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi cập nhật thẻ tag.';
      setFeedback({ open: true, type: 'error', title: 'Cập nhật tag thất bại!', description: msg });
    } finally {
      setSubmittingTag(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    setSubmittingTag(true);
    const name = tagToDelete.name;
    try {
      await deleteTag(request, tagToDelete.id);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa thẻ tag thành công!',
        description: `Thẻ tag "${name}" đã được xóa khỏi hệ thống.`,
      });
      setDeleteTagModalOpen(false);
      setTagToDelete(null);
      await loadTags();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa thẻ tag.';
      setFeedback({ open: true, type: 'error', title: 'Xóa thẻ tag thất bại!', description: msg });
    } finally {
      setSubmittingTag(false);
    }
  };

  const handleRequestToggleTagStatus = (t: CatalogTagItem) => {
    setTagToToggle(t);
    setToggleTagModalOpen(true);
  };

  const handleConfirmToggleTagStatus = async () => {
    if (!tagToToggle) return;
    setTogglingTag(true);
    try {
      if (tagToToggle.status === 'ACTIVE') {
        await deactivateTag(request, tagToToggle.id);
        setFeedback({
          open: true,
          type: 'success',
          title: 'Tạm khóa thẻ tag thành công!',
          description: `Thẻ tag "${tagToToggle.name}" đã được tạm khóa.`,
        });
      } else {
        await activateTag(request, tagToToggle.id);
        setFeedback({
          open: true,
          type: 'success',
          title: 'Kích hoạt thẻ tag thành công!',
          description: `Thẻ tag "${tagToToggle.name}" đã được kích hoạt hoạt động.`,
        });
      }
      setToggleTagModalOpen(false);
      setTagToToggle(null);
      await loadTags();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đổi trạng thái tag.';
      setFeedback({ open: true, type: 'error', title: 'Đổi trạng thái thất bại!', description: msg });
    } finally {
      setTogglingTag(false);
    }
  };

  // ------------------------------------------------------------------
  // SURCHARGE ACTIONS
  // ------------------------------------------------------------------

  const handleScheduleSurcharge = async (values: ScheduleRankSurchargePayload) => {
    setSubmittingSurcharge(true);
    try {
      const targetRankCode = rankForSurcharge?.code || values.rankCode;
      if (!targetRankCode) {
        throw new Error('Vui lòng chọn hạng bác sĩ cần áp dụng phụ thu.');
      }

      let fromIso: string;
      if (values.status === 'SCHEDULED' && values.effectiveFrom) {
        fromIso = new Date(values.effectiveFrom).toISOString();
      } else {
        fromIso = new Date().toISOString();
      }

      let toIso: string | undefined = undefined;
      if (values.status === 'SCHEDULED' && values.effectiveTo) {
        toIso = new Date(values.effectiveTo).toISOString();
      }

      const payload: ScheduleRankSurchargePayload = {
        rankCode: targetRankCode,
        amountMinor: values.amountMinor,
        currency: values.currency || 'VND',
        status: values.status,
        effectiveFrom: fromIso,
        effectiveTo: toIso,
      };
      await scheduleRankSurcharge(request, payload);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Thiết lập phụ thu thành công!',
        description: `Biểu phí phụ thu theo hạng bác sĩ (${targetRankCode}) đã được thiết lập.`,
      });
      setCreateSurchargeModalOpen(false);
      setRankForSurcharge(null);
      createSurchargeForm.resetFields();
      await loadSurcharges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể thiết lập phụ thu.';
      setFeedback({ open: true, type: 'error', title: 'Thiết lập phụ thu thất bại!', description: msg });
    } finally {
      setSubmittingSurcharge(false);
    }
  };

  const handleCancelSurcharge = async (surchargeId: string) => {
    try {
      await cancelRankSurcharge(request, surchargeId);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Hủy phụ thu thành công!',
        description: 'Biểu phí phụ thu theo hạng bác sĩ đã được hủy áp dụng.',
      });
      await loadSurcharges();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể hủy mức phụ thu.';
      setFeedback({ open: true, type: 'error', title: 'Hủy phụ thu thất bại!', description: msg });
    }
  };

  const openScheduleSurchargeForRank = (record: MergedRankItem) => {
    setRankForSurcharge(record);
    createSurchargeForm.resetFields();
    createSurchargeForm.setFieldsValue({
      rankCode: record.code,
      amountMinor: record.amountMinor ?? 0,
      currency: record.currency || 'VND',
      status: 'ACTIVE',
    });
    setCreateSurchargeModalOpen(true);
  };

  const openNewSurchargeModal = () => {
    setRankForSurcharge(null);
    createSurchargeForm.resetFields();
    createSurchargeForm.setFieldsValue({
      rankCode: consultationRanks[0]?.code || 'BASIC',
      amountMinor: 0,
      currency: 'VND',
      status: 'ACTIVE',
    });
    setCreateSurchargeModalOpen(true);
  };

  const mergedRankData: MergedRankItem[] = useMemo(() => {
    const surchargeByRank = new Map<string, DoctorRankSurchargeItem[]>();
    surcharges.forEach((s) => {
      const list = surchargeByRank.get(s.rankCode) || [];
      list.push(s);
      surchargeByRank.set(s.rankCode, list);
    });

    const result: MergedRankItem[] = [];
    const handledRankCodes = new Set<string>();

    consultationRanks.forEach((rank) => {
      handledRankCodes.add(rank.code);
      const rankSurcharges = surchargeByRank.get(rank.code) || [];
      const activeSurcharge =
        rankSurcharges.find((s) => s.status === 'ACTIVE') ||
        rankSurcharges.find((s) => s.status === 'SCHEDULED') ||
        rankSurcharges[0];

      result.push({
        id: rank.id,
        code: rank.code,
        name: rank.name,
        description: rank.description,
        experienceYearsMin: rank.experienceYearsMin,
        rankStatus: rank.status,
        rankCreatedAt: rank.createdAt,
        rankUpdatedAt: rank.updatedAt,
        surchargeId: activeSurcharge?.id,
        amountMinor: activeSurcharge?.amountMinor,
        currency: activeSurcharge?.currency || 'VND',
        effectiveFrom: activeSurcharge?.effectiveFrom,
        effectiveTo: activeSurcharge?.effectiveTo,
        surchargeStatus: activeSurcharge?.status,
        surchargeVersion: activeSurcharge?.version,
        surchargeCreatedAt: activeSurcharge?.createdAt,
        surchargeUpdatedAt: activeSurcharge?.updatedAt,
        allSurcharges: rankSurcharges,
        rawRank: rank,
        rawSurcharge: activeSurcharge,
      });
    });

    // Trả về danh sách chuẩn từ bảng consultation_ranks trong DB.
    // Các phụ thu trong doctor_rank_surcharges sẽ được map tương ứng vào từng hạng.
    return result;
  }, [consultationRanks, surcharges]);

  const filteredCategories = useMemo(() => {
    return categories.filter(
      (c) =>
        !categorySearch.trim() ||
        c.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(categorySearch.toLowerCase()),
    );
  }, [categories, categorySearch]);

  const filteredTags = useMemo(() => {
    return tags.filter(
      (t) =>
        !tagSearch.trim() ||
        t.name.toLowerCase().includes(tagSearch.toLowerCase()) ||
        t.code.toLowerCase().includes(tagSearch.toLowerCase()),
    );
  }, [tags, tagSearch]);

  const filteredMergedRanks = useMemo(() => {
    return mergedRankData.filter((item) => {
      const q = rankSearchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q);
      const matchStatus = !rankStatusFilter || item.rankStatus === rankStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [mergedRankData, rankSearchQuery, rankStatusFilter]);

  const activeSelectedRank = useMemo(() => {
    if (!selectedMergedRank) return null;
    return mergedRankData.find((item) => item.code === selectedMergedRank.code) || selectedMergedRank;
  }, [mergedRankData, selectedMergedRank]);

  // ------------------------------------------------------------------
  // TABLE COLUMNS CONFIG
  // ------------------------------------------------------------------

  // 1. Services Columns
  const serviceColumns: ColumnsType<MedicalServiceItem> = [
    {
      title: 'Dịch vụ',
      key: 'nameInfo',
      render: (_, record) => {
        return (
          <Space direction="vertical" size={2}>
            <Space>
              <span className="admin-code" style={{ fontWeight: 600, color: '#0284c7' }}>
                {record.code}
              </span>
              {record.bookingEnabled ? (
                <Tooltip title="Cho phép đặt khám trực tuyến">
                  <Tag color="success" style={{ margin: 0, fontSize: 11 }}>Đặt lịch</Tag>
                </Tooltip>
              ) : null}
            </Space>
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{record.name}</span>
          </Space>
        );
      },
    },
    {
      title: 'Phân loại',
      dataIndex: 'kind',
      key: 'kind',
      width: 140,
      render: (kind: MedicalServiceKind) => {
        const conf = KIND_CONFIG[kind] || { label: kind, color: 'default' };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: 'Chuyên khoa',
      dataIndex: 'specialtyId',
      key: 'specialtyId',
      width: 150,
      render: (specId?: string) => {
        if (!specId) return <span style={{ color: '#94a3b8' }}>Chung</span>;
        const spec = specialties.find((s) => s.id === specId);
        return <span>{spec?.name ?? specId.slice(0, 8)}</span>;
      },
    },
    {
      title: 'Giá viện phí',
      key: 'price',
      width: 140,
      align: 'right',
      render: (_, record) => {
        const now = new Date();
        // Tìm giá hiện tại đang có hiệu lực (effectiveFrom <= now và (effectiveTo null hoặc > now) và status là ACTIVE)
        const currentPrice = record.prices?.find(
          (p) =>
            p.status === 'ACTIVE' &&
            new Date(p.effectiveFrom) <= now &&
            (!p.effectiveTo || new Date(p.effectiveTo) > now),
        );
        // Tìm giá được lên lịch trong tương lai (effectiveFrom > now)
        const upcomingPrice = record.prices?.find(
          (p) =>
            (p.status === 'SCHEDULED' || p.status === 'ACTIVE') &&
            new Date(p.effectiveFrom) > now,
        );
        // Fallback: giá active mới nhất
        const activePrice = currentPrice ?? record.prices?.find((p) => p.status === 'ACTIVE') ?? upcomingPrice;

        if (!activePrice) return <span style={{ color: '#94a3b8' }}>Chưa có giá</span>;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%', textAlign: 'right' }}>
            <span style={{ fontWeight: 700, color: '#0f766e', fontSize: 14 }}>
              {formatMoneyMinor(activePrice.amountMinor, activePrice.currency)}
            </span>
            {upcomingPrice && upcomingPrice.id !== activePrice.id ? (
              <Tooltip
                title={`Mức giá mới ${formatMoneyMinor(
                  upcomingPrice.amountMinor,
                  upcomingPrice.currency,
                )} sẽ bắt đầu áp dụng từ ${new Date(upcomingPrice.effectiveFrom).toLocaleString('vi-VN')}`}
              >
                <Tag color="orange" style={{ margin: 0, fontSize: 10, cursor: 'pointer' }}>
                  Sắp đổi: {formatMoneyMinor(upcomingPrice.amountMinor, upcomingPrice.currency)}
                </Tag>
              </Tooltip>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: CatalogStatus) => <StatusTag status={status} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Xem chi tiết & lịch sử giá">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetailDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa dịch vụ">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#0284c7' }} />}
              onClick={() => handleOpenEditService(record)}
            />
          </Tooltip>
          <Tooltip title="Lên lịch mức giá mới">
            <Button
              type="text"
              size="small"
              icon={<DollarCircleOutlined style={{ color: '#0f766e' }} />}
              onClick={() => handleOpenSchedulePrice(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}>
            <Button
              type="text"
              size="small"
              icon={
                record.status === 'ACTIVE' ? (
                  <PauseCircleOutlined style={{ color: '#f59e0b' }} />
                ) : (
                  <CheckCircleOutlined style={{ color: '#10b981' }} />
                )
              }
              onClick={() => handleRequestToggleServiceStatus(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa dịch vụ">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setServiceToDelete(record);
                setDeleteModalOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 2. Categories Columns
  const categoryColumns: ColumnsType<ServiceCategoryItem> = [
    {
      title: 'Mã nhóm',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (c: string) => <span className="admin-code" style={{ fontWeight: 600 }}>{c}</span>,
    },
    {
      title: 'Tên nhóm danh mục',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, row) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{text}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>/{row.slug}</span>
        </Space>
      ),
    },
    {
      title: 'Số dịch vụ',
      dataIndex: 'servicesCount',
      key: 'servicesCount',
      width: 140,
      align: 'center',
      render: (count?: number) => (
        <Tag color="cyan" style={{ borderRadius: 12, padding: '0 10px' }}>
          {count ?? 0} dịch vụ
        </Tag>
      ),
    },
    {
      title: 'Thứ tự',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 90,
      align: 'center',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (status: CatalogStatus) => <StatusTag status={status} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space size={6} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Xem chi tiết nhóm">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: '#0284c7' }} />}
              onClick={() => openDetailCategoryDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#0284c7' }} />}
              onClick={() => handleOpenEditCategory(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}>
            <Button
              type="text"
              size="small"
              icon={
                record.status === 'ACTIVE' ? (
                  <PauseCircleOutlined style={{ color: '#fa8c16' }} />
                ) : (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                )
              }
              onClick={() => handleRequestToggleCategoryStatus(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa nhóm">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setCategoryToDelete(record);
                setDeleteCategoryModalOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 3. Tags Columns
  const tagColumns: ColumnsType<CatalogTagItem> = [
    {
      title: 'Mã tag',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (c: string) => <span className="admin-code" style={{ fontWeight: 600 }}>{c}</span>,
    },
    {
      title: 'Tên thẻ tag',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, row) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{text}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>/{row.slug}</span>
        </Space>
      ),
    },
    {
      title: 'Số dịch vụ gắn tag',
      dataIndex: 'servicesCount',
      key: 'servicesCount',
      width: 160,
      align: 'center',
      render: (count?: number) => (
        <Tag color="purple" style={{ borderRadius: 12, padding: '0 10px' }}>
          {count ?? 0} dịch vụ
        </Tag>
      ),
    },
    {
      title: 'Thứ tự',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 90,
      align: 'center',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (status: CatalogStatus) => <StatusTag status={status} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space size={6} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Xem chi tiết thẻ tag">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ color: '#0284c7' }} />}
              onClick={() => openDetailTagDrawer(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#0284c7' }} />}
              onClick={() => handleOpenEditTag(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}>
            <Button
              type="text"
              size="small"
              icon={
                record.status === 'ACTIVE' ? (
                  <PauseCircleOutlined style={{ color: '#fa8c16' }} />
                ) : (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                )
              }
              onClick={() => handleRequestToggleTagStatus(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa tag">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                setTagToDelete(record);
                setDeleteTagModalOpen(true);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ------------------------------------------------------------------
  // HẠNG BÁC SĨ (RANKS) ACTIONS & COLUMNS
  // ------------------------------------------------------------------
  const handleCreateRank = async (values: CreateConsultationRankPayload) => {
    setSubmittingRank(true);
    try {
      const { surchargeMinor, ...rankPayload } = values;
      // Khi thêm mới, mặc định hạng bác sĩ luôn ở trạng thái bản nháp (DRAFT)
      const created = await createConsultationRank(request, {
        ...rankPayload,
        status: 'DRAFT',
      });

      // Nếu có nhập số tiền phụ thu khám, tự động tạo phụ thu cho hạng bác sĩ
      if (surchargeMinor !== undefined && surchargeMinor !== null) {
        try {
          await scheduleRankSurcharge(request, {
            rankCode: created.code,
            amountMinor: surchargeMinor,
            currency: 'VND',
            status: 'SCHEDULED',
            effectiveFrom: new Date().toISOString(),
          });
        } catch (surchargeErr) {
          console.error('Không thể tạo phụ thu ban đầu:', surchargeErr);
        }
      }

      createRankForm.resetFields();
      setCreateRankModalOpen(false);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Thêm hạng bác sĩ thành công!',
        description: `Hạng "${created.name}" (${created.code}) đã được lưu vào bản nháp. Bạn có thể kiểm tra và kích hoạt áp dụng bất kỳ lúc nào.`,
      });
      void loadRanksAndDoctors();
      void loadSurcharges();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Thêm hạng thất bại!',
        description: err instanceof Error ? err.message : 'Không thể thêm hạng bác sĩ.',
      });
    } finally {
      setSubmittingRank(false);
    }
  };

  const openEditRank = (record: ConsultationRankItem) => {
    setRankToEdit(record);
    editRankForm.setFieldsValue({
      name: record.name,
      experienceYearsMin: record.experienceYearsMin,
      description: record.description ?? '',
    });
    setEditRankModalOpen(true);
  };

  const handleEditRank = async (values: UpdateConsultationRankPayload) => {
    if (!rankToEdit) return;
    setSubmittingRank(true);
    try {
      const { surchargeMinor, ...rankPayload } = values;
      const updated = await updateConsultationRank(request, rankToEdit.id, rankPayload);

      editRankForm.resetFields();
      setEditRankModalOpen(false);
      setRankToEdit(null);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Cập nhật hạng bác sĩ thành công!',
        description: `Thông tin hạng "${updated.name}" đã được cập nhật thành công.`,
      });
      void loadRanksAndDoctors();
      void loadSurcharges();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Cập nhật hạng thất bại!',
        description: err instanceof Error ? err.message : 'Không thể cập nhật hạng bác sĩ.',
      });
    } finally {
      setSubmittingRank(false);
    }
  };

  const openDeleteRank = (record: ConsultationRankItem) => {
    setRankToDelete(record);
    setDeleteRankModalOpen(true);
  };

  const handleConfirmDeleteRank = async () => {
    if (!rankToDelete) return;
    const doctorsInRank = doctorsList.filter((d) => d.consultationRank === rankToDelete.code);
    if (doctorsInRank.length > 0) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Không thể xóa hạng bác sĩ!',
        description: `Hiện đang có ${doctorsInRank.length} bác sĩ giữ hạng "${rankToDelete.name}". Vui lòng điều chỉnh hạng của bác sĩ trước khi xóa.`,
      });
      setDeleteRankModalOpen(false);
      setRankToDelete(null);
      return;
    }

    setSubmittingRank(true);
    const targetName = rankToDelete.name;
    try {
      await deleteConsultationRank(request, rankToDelete.id);
      setDeleteRankModalOpen(false);
      if (selectedMergedRank?.id === rankToDelete.id || selectedMergedRank?.code === rankToDelete.code) {
        setDetailRankDrawerOpen(false);
        setSelectedMergedRank(null);
      }
      setRankToDelete(null);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa hạng bác sĩ thành công!',
        description: `Hạng "${targetName}" đã được xóa khỏi hệ thống.`,
      });
      void loadRanksAndDoctors();
      void loadSurcharges();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Xóa hạng thất bại!',
        description: err instanceof Error ? err.message : 'Không thể xóa hạng bác sĩ.',
      });
    } finally {
      setSubmittingRank(false);
    }
  };

  const openToggleRankModal = (rk: ConsultationRankItem) => {
    if (rk.status === 'ACTIVE') {
      const doctorsInRank = doctorsList.filter(
        (d) => d.status === 'ACTIVE' && d.consultationRank === rk.code,
      );
      if (doctorsInRank.length > 0) {
        setFeedback({
          open: true,
          type: 'error',
          title: 'Không thể tạm khóa hạng bác sĩ!',
          description: `Hiện đang có ${doctorsInRank.length} bác sĩ hoạt động giữ hạng "${rk.name}". Vui lòng cập nhật lại hạng bác sĩ trước khi tạm khóa.`,
        });
        return;
      }
    }
    setRankToToggle(rk);
    setToggleRankModalOpen(true);
  };

  const handleConfirmToggleRankStatus = async () => {
    if (!rankToToggle) return;
    setSubmittingRank(true);
    const targetRank = rankToToggle;
    const isActivating = targetRank.status !== 'ACTIVE';
    try {
      await updateConsultationRank(request, targetRank.id, {
        status: isActivating ? 'ACTIVE' : 'INACTIVE',
      });
      setToggleRankModalOpen(false);
      setRankToToggle(null);
      setFeedback({
        open: true,
        type: 'success',
        title: isActivating ? 'Kích hoạt hạng bác sĩ thành công!' : 'Tạm khóa hạng bác sĩ thành công!',
        description: isActivating
          ? `Hạng "${targetRank.name}" đã được kích hoạt áp dụng trở lại.`
          : `Hạng "${targetRank.name}" đã được chuyển sang trạng thái tạm khóa.`,
      });
      void loadRanksAndDoctors();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: isActivating ? 'Kích hoạt thất bại!' : 'Tạm khóa thất bại!',
        description: err instanceof Error ? err.message : 'Không thể thay đổi trạng thái hạng bác sĩ.',
      });
    } finally {
      setSubmittingRank(false);
    }
  };

  // 4. Merged Rank & Surcharge Columns (Danh mục Hạng bác sĩ & Biểu phí phụ thu)
  const mergedRankColumns: ColumnsType<MergedRankItem> = [
    {
      title: 'Mã định danh',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => <span className="admin-code">{code}</span>,
    },
    {
      title: 'Tên hạng bác sĩ',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string, record) => (
        <div>
          <strong style={{ color: 'var(--deep)', fontSize: 14 }}>{name}</strong>
          {record.description && (
            <div
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 2,
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={record.description}
            >
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Phụ thu khám',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 160,
      align: 'right',
      render: (amount: number | undefined, record) => {
        if (amount === undefined || amount === null) {
          return <Tag color="default">Chưa thiết lập</Tag>;
        }
        return (
          <Space direction="vertical" size={0} align="end">
            <span style={{ fontWeight: 700, color: '#0f766e', fontSize: 14 }}>
              {formatMoneyMinor(amount, record.currency || 'VND')}
            </span>
            {record.surchargeStatus && (
              <div style={{ marginTop: 2 }}>
                {renderPriceStatusTag(record.surchargeStatus, record.effectiveFrom, record.effectiveTo)}
              </div>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Kinh nghiệm tối thiểu',
      dataIndex: 'experienceYearsMin',
      key: 'experienceYearsMin',
      width: 160,
      align: 'center',
      render: (years?: number | null) => (years ? `${years} năm` : 'Không yêu cầu'),
    },
    {
      title: 'Bác sĩ đạt hạng',
      key: 'doctorCount',
      width: 130,
      align: 'center',
      render: (_, record) => {
        const count = doctorsList.filter((d) => d.consultationRank === record.code).length;
        return (
          <Badge
            count={count}
            showZero
            style={{ backgroundColor: count > 0 ? '#722ed1' : '#94a3b8' }}
          />
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'rankStatus',
      key: 'rankStatus',
      width: 120,
      align: 'center',
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 230,
      align: 'center',
      render: (_, record) => {
        const rankItem: ConsultationRankItem = record.rawRank || {
          id: record.id,
          code: record.code,
          name: record.name,
          description: record.description,
          experienceYearsMin: record.experienceYearsMin ?? 0,
          status: record.rankStatus || 'ACTIVE',
          createdAt: record.rankCreatedAt || '',
          updatedAt: record.rankUpdatedAt || '',
        };

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Space size={6}>
              <Tooltip title="Xem chi tiết Hạng & Phụ thu">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined style={{ color: 'var(--accent)' }} />}
                  onClick={() => {
                    setSelectedMergedRank(record);
                    setDetailRankDrawerOpen(true);
                  }}
                />
              </Tooltip>
              <Tooltip title="Thiết lập / Cập nhật phụ thu">
                <Button
                  type="text"
                  size="small"
                  icon={<DollarCircleOutlined style={{ color: '#0f766e' }} />}
                  onClick={() => openScheduleSurchargeForRank(record)}
                />
              </Tooltip>
              <Tooltip
                title={record.rankStatus === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}
              >
                <Button
                  type="text"
                  size="small"
                  icon={
                    record.rankStatus === 'ACTIVE' ? (
                      <PauseCircleOutlined style={{ color: '#fa8c16' }} />
                    ) : (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    )
                  }
                  onClick={() => openToggleRankModal(rankItem)}
                />
              </Tooltip>
              <Tooltip title="Chỉnh sửa hạng">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: 'var(--deep)' }} />}
                  onClick={() => openEditRank(rankItem)}
                />
              </Tooltip>
              <Tooltip title="Xóa hạng">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => openDeleteRank(rankItem)}
                />
              </Tooltip>
            </Space>
          </div>
        );
      },
    },
  ];

  // Price history columns in drawer
  const priceHistoryColumns: ColumnsType<BasePriceItem> = [
    {
      title: 'Mức giá',
      dataIndex: 'amountMinor',
      key: 'amountMinor',
      width: 140,
      render: (amount: number, row) => (
        <span style={{ fontWeight: 700, color: '#0f766e', fontSize: 14 }}>
          {formatMoneyMinor(amount, row?.currency || 'VND')}
        </span>
      ),
    },
    {
      title: 'Áp dụng từ',
      dataIndex: 'effectiveFrom',
      key: 'effectiveFrom',
      width: 150,
      render: (d: string) => <span style={{ fontSize: 13 }}>{new Date(d).toLocaleString('vi-VN')}</span>,
    },
    {
      title: 'Đến ngày',
      dataIndex: 'effectiveTo',
      key: 'effectiveTo',
      width: 150,
      render: (d?: string | null) => (
        <span style={{ fontSize: 13 }}>{d ? new Date(d).toLocaleString('vi-VN') : 'Hiện tại (Vô thời hạn)'}</span>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 140,
      align: 'center',
      render: (_, row: BasePriceItem) => renderPriceStatusTag(row.status, row.effectiveFrom, row.effectiveTo),
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 90,
      align: 'center',
      render: (_, row) => {
        if (!row || row.status === 'CANCELLED') return null;
        return (
          <Button size="small" danger type="link" onClick={() => handleCancelPrice(row.id)}>
            Hủy giá
          </Button>
        );
      },
    },
  ];

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Space align="center">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MedicineBoxOutlined style={{ fontSize: 20, color: '#0284c7' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Tổng số dịch vụ</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{servicesTotal}</div>
            </div>
          </Space>
        </Card>

        <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Space align="center">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ApartmentOutlined style={{ fontSize: 20, color: '#0f766e' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Nhóm danh mục</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f766e' }}>{categories.length}</div>
            </div>
          </Space>
        </Card>

        <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Space align="center">
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TagsOutlined style={{ fontSize: 20, color: '#9333ea' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Thẻ tag phân loại</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#9333ea' }}>{tags.length}</div>
            </div>
          </Space>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as typeof activeTab)}
          items={[
            {
              key: 'services',
              label: (
                <span>
                  <MedicineBoxOutlined /> Dịch vụ & Bảng giá
                </span>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Search and Filters */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <Space wrap size={8}>
                      <Input
                        placeholder="Tìm kiếm dịch vụ..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPage(1);
                        }}
                        onPressEnter={() => {
                          setPage(1);
                          void loadServices(1, pageSize, searchQuery, categoryFilter, kindFilter, statusFilter);
                        }}
                        style={{ width: 220 }}
                        allowClear
                      />
                      <Select
                        placeholder="Lọc nhóm danh mục"
                        value={categoryFilter}
                        onChange={(val) => {
                          setCategoryFilter(val);
                          setPage(1);
                        }}
                        style={{ width: 200 }}
                        allowClear
                        options={categories.map((c) => ({ label: c.name, value: c.code }))}
                      />
                      <Select
                        placeholder="Lọc loại hình"
                        value={kindFilter}
                        onChange={(val) => {
                          setKindFilter(val);
                          setPage(1);
                        }}
                        style={{ width: 170 }}
                        allowClear
                        options={[
                          { label: 'Khám bệnh', value: 'CONSULTATION' },
                          { label: 'Chẩn đoán hình ảnh', value: 'DIAGNOSTIC' },
                          { label: 'Thủ thuật', value: 'PROCEDURE' },
                          { label: 'Gói thai sản', value: 'PACKAGE' },
                          { label: 'Tiêm chủng', value: 'VACCINATION' },
                          { label: 'Khác', value: 'OTHER' },
                        ]}
                      />
                      <Select
                        placeholder="Lọc trạng thái"
                        value={statusFilter}
                        onChange={(val) => {
                          setStatusFilter(val);
                          setPage(1);
                        }}
                        style={{ width: 170 }}
                        allowClear
                        options={[
                          { label: 'Hoạt động (ACTIVE)', value: 'ACTIVE' },
                          { label: 'Bản nháp (DRAFT)', value: 'DRAFT' },
                          { label: 'Tạm ngưng (INACTIVE)', value: 'INACTIVE' },
                          { label: 'Lưu trữ (ARCHIVED)', value: 'ARCHIVED' },
                        ]}
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={handleResetServices}
                        loading={servicesLoading}
                      >
                        Làm mới
                      </Button>
                    </Space>

                    <Button
                      id="btn-add-service"
                      type="primary"
                      icon={<PlusOutlined />}
                      style={{ background: '#0284c7' }}
                      onClick={() => {
                        createServiceForm.resetFields();
                        createServiceForm.setFieldsValue({
                          kind: 'CONSULTATION',
                          doctorRankSelectionPolicy: 'NOT_REQUIRED',
                          bookingEnabled: true,
                          status: 'ACTIVE',
                        });
                        setCreateModalOpen(true);
                      }}
                    >
                      Thêm dịch vụ mới
                    </Button>
                  </div>

                  {/* Services Table */}
                  <Table
                    columns={serviceColumns}
                    dataSource={services}
                    rowKey="id"
                    loading={servicesLoading}
                    pagination={{
                      current: page,
                      pageSize: pageSize,
                      total: servicesTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (tot) => `Tổng cộng ${tot} dịch vụ`,
                      onChange: (newPage, newPageSize) => {
                        setPage(newPage);
                        setPageSize(newPageSize);
                      },
                    }}
                    onRow={(record) => ({
                      onClick: () => openDetailDrawer(record),
                      style: { cursor: 'pointer' },
                    })}
                  />
                </div>
              ),
            },
            {
              key: 'categories',
              label: (
                <span>
                  <ApartmentOutlined /> Nhóm danh mục ({categories.length})
                </span>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={10}>
                      <Input
                        placeholder="Tìm kiếm nhóm danh mục..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        style={{ width: 280 }}
                        allowClear
                      />
                      <Button icon={<ReloadOutlined />} onClick={() => loadCategories()}>
                        Làm mới
                      </Button>
                    </Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      style={{ background: '#0284c7' }}
                      onClick={() => {
                        createCategoryForm.resetFields();
                        createCategoryForm.setFieldsValue({ status: 'ACTIVE', sortOrder: categories.length + 1 });
                        setCreateCategoryModalOpen(true);
                      }}
                    >
                      Thêm nhóm dịch vụ
                    </Button>
                  </div>

                  <Table
                    columns={categoryColumns}
                    dataSource={filteredCategories}
                    rowKey="id"
                    loading={categoriesLoading}
                    pagination={{
                      current: categoryPage,
                      pageSize: categoryPageSize,
                      total: filteredCategories.length,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (tot) => `Tổng cộng ${tot} nhóm danh mục`,
                      onChange: (newPage, newPageSize) => {
                        setCategoryPage(newPage);
                        setCategoryPageSize(newPageSize);
                      },
                    }}
                    onRow={(record) => ({
                      onClick: () => openDetailCategoryDrawer(record),
                      style: { cursor: 'pointer' },
                    })}
                  />
                </div>
              ),
            },
            {
              key: 'tags',
              label: (
                <span>
                  <TagsOutlined /> Thẻ tag dịch vụ ({tags.length})
                </span>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={10}>
                      <Input
                        placeholder="Tìm kiếm thẻ tag..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={tagSearch}
                        onChange={(e) => {
                          setTagSearch(e.target.value);
                          setTagPage(1);
                        }}
                        style={{ width: 280 }}
                        allowClear
                      />
                      <Button icon={<ReloadOutlined />} onClick={() => loadTags()}>
                        Làm mới
                      </Button>
                    </Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      style={{ background: '#0284c7' }}
                      onClick={() => {
                        createTagForm.resetFields();
                        createTagForm.setFieldsValue({ group: 'LABEL', status: 'ACTIVE', sortOrder: tags.length + 1 });
                        setCreateTagModalOpen(true);
                      }}
                    >
                      Thêm thẻ tag
                    </Button>
                  </div>

                  <Table
                    columns={tagColumns}
                    dataSource={filteredTags}
                    rowKey="id"
                    loading={tagsLoading}
                    pagination={{
                      current: tagPage,
                      pageSize: tagPageSize,
                      total: filteredTags.length,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (tot) => `Tổng cộng ${tot} thẻ tag`,
                      onChange: (newPage, newPageSize) => {
                        setTagPage(newPage);
                        setTagPageSize(newPageSize);
                      },
                    }}
                    onRow={(record) => ({
                      onClick: () => openDetailTagDrawer(record),
                      style: { cursor: 'pointer' },
                    })}
                  />
                </div>
              ),
            },
            {
              key: 'surcharges',
              label: (
                <span>
                  <TrophyOutlined /> Hạng bác sĩ & Phụ thu ({mergedRankData.length})
                </span>
              ),
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* THANH CÔNG CỤ TÌM KIẾM, LỌC & THAO TÁC */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Space size={10} wrap>
                      <Input
                        placeholder="Tìm theo tên hạng, mã định danh..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={rankSearchQuery}
                        onChange={(e) => {
                          setRankSearchQuery(e.target.value);
                          setRankPage(1);
                        }}
                        allowClear
                        style={{ width: 280 }}
                      />
                      <Select
                        placeholder="Lọc trạng thái"
                        value={rankStatusFilter}
                        onChange={(val) => {
                          setRankStatusFilter(val);
                          setRankPage(1);
                        }}
                        allowClear
                        style={{ width: 150 }}
                        options={[
                          { label: 'Tất cả trạng thái', value: '' },
                          { label: 'Hoạt động', value: 'ACTIVE' },
                          { label: 'Bản nháp', value: 'DRAFT' },
                          { label: 'Tạm khóa', value: 'INACTIVE' },
                        ]}
                      />
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                          void loadRanksAndDoctors();
                          void loadSurcharges();
                        }}
                      >
                        Làm mới
                      </Button>
                    </Space>

                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      style={{ background: '#0284c7' }}
                      onClick={() => {
                        createRankForm.resetFields();
                        setCreateRankModalOpen(true);
                      }}
                    >
                      Thêm hạng bác sĩ
                    </Button>
                  </div>

                  {/* BẢNG GỘP DUY NHẤT */}
                  <Table<MergedRankItem>
                    columns={mergedRankColumns}
                    dataSource={filteredMergedRanks}
                    rowKey="code"
                    loading={ranksLoading || surchargesLoading}
                    size="middle"
                    pagination={{
                      current: rankPage,
                      pageSize: rankPageSize,
                      total: filteredMergedRanks.length,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      showTotal: (tot) => `Tổng cộng ${tot} hạng bác sĩ`,
                      onChange: (newPage, newPageSize) => {
                        setRankPage(newPage);
                        setRankPageSize(newPageSize);
                      },
                    }}
                    onRow={(record) => ({
                      onClick: (e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('.ant-tooltip')) return;
                        setSelectedMergedRank(record);
                        setDetailRankDrawerOpen(true);
                      },
                      style: { cursor: 'pointer' },
                    })}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* DRAWER: CHI TIẾT DỊCH VỤ                                           */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title={
          selectedService ? (
            <Space>
              <MedicineBoxOutlined style={{ color: '#0284c7' }} />
              <span>{selectedService.name}</span>
            </Space>
          ) : (
            'Chi tiết dịch vụ'
          )
        }
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={680}
        extra={
          selectedService ? (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailDrawerOpen(false);
                  handleOpenEditService(selectedService);
                }}
              >
                Chỉnh sửa
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedService ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Mã dịch vụ" span={1}>
                <span className="admin-code" style={{ fontWeight: 600, color: '#0284c7' }}>
                  {selectedService.code}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={1}>
                {selectedService.status === 'ACTIVE' ? (
                  <Badge status="success" text="Đang hoạt động" />
                ) : (
                  <Badge status="error" text={selectedService.status} />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Tên đầy đủ" span={2}>
                <span style={{ fontWeight: 600 }}>{selectedService.name}</span>
              </Descriptions.Item>

              <Descriptions.Item label="Loại hình" span={1}>
                <Tag color={KIND_CONFIG[selectedService.kind]?.color}>
                  {KIND_CONFIG[selectedService.kind]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Chuyên khoa" span={1}>
                {specialties.find((s) => s.id === selectedService.specialtyId)?.name || 'Chung'}
              </Descriptions.Item>

              <Descriptions.Item label="Đặt khám online" span={1}>
                {selectedService.bookingEnabled ? (
                  <Tag color="success">Bật hỗ trợ</Tag>
                ) : (
                  <Tag color="default">Chưa bật</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Chính sách phụ thu" span={2}>
                <Tag color={POLICY_CONFIG[selectedService.doctorRankSelectionPolicy]?.color}>
                  {POLICY_CONFIG[selectedService.doctorRankSelectionPolicy]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nhóm danh mục" span={2}>
                <Space wrap>
                  {(selectedService.categories || []).map((c) => (
                    <Tag key={c.id} color="cyan">
                      {c.name}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Thẻ tag" span={2}>
                <Space wrap>
                  {selectedService.tags && selectedService.tags.length > 0 ? (
                    selectedService.tags.map((t) => (
                      <Tag key={t.id} color="purple">
                        {t.name}
                      </Tag>
                    ))
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Chưa gắn tag</span>
                  )}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {selectedService.summary ? (
              <div>
                <Title level={5} style={{ marginBottom: 6 }}>Tóm tắt dịch vụ</Title>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, color: '#334155' }}>
                  {selectedService.summary}
                </div>
              </div>
            ) : null}

            {selectedService.description ? (
              <div>
                <Title level={5} style={{ marginBottom: 6 }}>Mô tả quy trình chi tiết</Title>
                <Paragraph style={{ whiteSpace: 'pre-line', color: '#475569' }}>
                  {selectedService.description}
                </Paragraph>
              </div>
            ) : null}

            <Divider style={{ margin: '12px 0' }} />

            {/* Bảng lịch sử viện phí */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Title level={5} style={{ margin: 0 }}>
                  <DollarCircleOutlined style={{ color: '#0f766e', marginRight: 6 }} />
                  Bảng giá viện phí dịch vụ
                </Title>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  style={{ background: '#0f766e' }}
                  onClick={() => handleOpenSchedulePrice(selectedService)}
                >
                  Lên lịch mức giá mới
                </Button>
              </div>

              <Table
                columns={priceHistoryColumns}
                dataSource={servicePrices}
                rowKey="id"
                loading={loadingPrices}
                pagination={false}
                size="small"
              />
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* DRAWER: CHI TIẾT NHÓM DANH MỤC                                    */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title={
          selectedCategory ? (
            <Space>
              <ApartmentOutlined style={{ color: '#0284c7' }} />
              <span>{selectedCategory.name}</span>
            </Space>
          ) : (
            'Chi tiết nhóm danh mục'
          )
        }
        open={detailCategoryDrawerOpen}
        onClose={() => setDetailCategoryDrawerOpen(false)}
        width={680}
        extra={
          selectedCategory ? (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailCategoryDrawerOpen(false);
                  handleOpenEditCategory(selectedCategory);
                }}
              >
                Chỉnh sửa
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedCategory ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Mã nhóm" span={1}>
                <span className="admin-code" style={{ fontWeight: 600, color: '#0284c7' }}>
                  {selectedCategory.code}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={1}>
                <StatusTag status={selectedCategory.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Tên nhóm danh mục" span={2}>
                <span style={{ fontWeight: 600 }}>{selectedCategory.name}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Đường dẫn (Slug)" span={1}>
                <span style={{ color: '#64748b' }}>/{selectedCategory.slug}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Thứ tự hiển thị" span={1}>
                <span style={{ fontWeight: 600 }}>{selectedCategory.sortOrder}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả" span={2}>
                {selectedCategory.description ? (
                  <span style={{ color: '#475569' }}>{selectedCategory.description}</span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Chưa có mô tả chi tiết</span>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '8px 0' }} />

            {/* Danh sách các dịch vụ thuộc nhóm này */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Title level={5} style={{ margin: 0 }}>
                  <MedicineBoxOutlined style={{ color: '#0284c7', marginRight: 6 }} />
                  Danh sách dịch vụ y tế thuộc nhóm ({categoryServices.length})
                </Title>
              </div>

              <Table
                dataSource={categoryServices}
                rowKey="id"
                loading={loadingCategoryServices}
                pagination={{ pageSize: 5, size: 'small' }}
                size="small"
                columns={[
                  {
                    title: 'Mã DV',
                    dataIndex: 'code',
                    key: 'code',
                    width: 110,
                    render: (c: string) => <span className="admin-code">{c}</span>,
                  },
                  {
                    title: 'Tên dịch vụ',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text: string, row: MedicalServiceItem) => (
                      <Space direction="vertical" size={2}>
                        <span
                          style={{ fontWeight: 600, color: '#0284c7', cursor: 'pointer' }}
                          onClick={() => {
                            setDetailCategoryDrawerOpen(false);
                            openDetailDrawer(row);
                          }}
                        >
                          {text}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {KIND_CONFIG[row.kind]?.label || row.kind}
                        </span>
                      </Space>
                    ),
                  },
                  {
                    title: 'Trạng thái',
                    dataIndex: 'status',
                    key: 'status',
                    width: 110,
                    align: 'center',
                    render: (status: CatalogStatus) => <StatusTag status={status} />,
                  },
                  {
                    title: 'Thao tác',
                    key: 'action',
                    width: 80,
                    align: 'center',
                    render: (_, row: MedicalServiceItem) => (
                      <Tooltip title="Xem chi tiết dịch vụ">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined style={{ color: '#0284c7' }} />}
                          onClick={() => {
                            setDetailCategoryDrawerOpen(false);
                            openDetailDrawer(row);
                          }}
                        />
                      </Tooltip>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* DRAWER: CHI TIẾT THẺ TAG                                          */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title={
          selectedTag ? (
            <Space>
              <TagsOutlined style={{ color: '#7c3aed' }} />
              <span>{selectedTag.name}</span>
            </Space>
          ) : (
            'Chi tiết thẻ tag'
          )
        }
        open={detailTagDrawerOpen}
        onClose={() => setDetailTagDrawerOpen(false)}
        width={680}
        extra={
          selectedTag ? (
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailTagDrawerOpen(false);
                  handleOpenEditTag(selectedTag);
                }}
              >
                Chỉnh sửa
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedTag ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Mã thẻ tag" span={1}>
                <span className="admin-code" style={{ fontWeight: 600, color: '#7c3aed' }}>
                  {selectedTag.code}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={1}>
                <StatusTag status={selectedTag.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Tên thẻ tag" span={2}>
                <span style={{ fontWeight: 600 }}>{selectedTag.name}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Đường dẫn (Slug)" span={1}>
                <span style={{ color: '#64748b' }}>/{selectedTag.slug}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Nhóm phân loại tag" span={1}>
                <Tag color="purple">{selectedTag.group || 'LABEL'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Thứ tự hiển thị" span={1}>
                <span style={{ fontWeight: 600 }}>{selectedTag.sortOrder}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Số dịch vụ gắn tag" span={1}>
                <Tag color="purple" style={{ borderRadius: 12 }}>
                  {tagServices.length || selectedTag.servicesCount || 0} dịch vụ
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mô tả" span={2}>
                {selectedTag.description ? (
                  <span style={{ color: '#475569' }}>{selectedTag.description}</span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Chưa có mô tả chi tiết</span>
                )}
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '8px 0' }} />

            {/* Danh sách các dịch vụ gắn thẻ tag này */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Title level={5} style={{ margin: 0 }}>
                  <MedicineBoxOutlined style={{ color: '#7c3aed', marginRight: 6 }} />
                  Danh sách dịch vụ y tế gắn thẻ tag ({tagServices.length})
                </Title>
              </div>

              <Table
                dataSource={tagServices}
                rowKey="id"
                loading={loadingTagServices}
                pagination={{ pageSize: 5, size: 'small' }}
                size="small"
                columns={[
                  {
                    title: 'Mã DV',
                    dataIndex: 'code',
                    key: 'code',
                    width: 110,
                    render: (c: string) => <span className="admin-code">{c}</span>,
                  },
                  {
                    title: 'Tên dịch vụ',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text: string, row: MedicalServiceItem) => (
                      <Space direction="vertical" size={2}>
                        <span
                          style={{ fontWeight: 600, color: '#0284c7', cursor: 'pointer' }}
                          onClick={() => {
                            setDetailTagDrawerOpen(false);
                            openDetailDrawer(row);
                          }}
                        >
                          {text}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          {KIND_CONFIG[row.kind]?.label || row.kind}
                        </span>
                      </Space>
                    ),
                  },
                  {
                    title: 'Trạng thái',
                    dataIndex: 'status',
                    key: 'status',
                    width: 110,
                    align: 'center',
                    render: (status: CatalogStatus) => <StatusTag status={status} />,
                  },
                  {
                    title: 'Thao tác',
                    key: 'action',
                    width: 80,
                    align: 'center',
                    render: (_, row: MedicalServiceItem) => (
                      <Tooltip title="Xem chi tiết dịch vụ">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined style={{ color: '#0284c7' }} />}
                          onClick={() => {
                            setDetailTagDrawerOpen(false);
                            openDetailDrawer(row);
                          }}
                        />
                      </Tooltip>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: THÊM DỊCH VỤ MỚI (CÂN ĐỐI 2 CỘT, RỘNG 820px)                */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            <MedicineBoxOutlined style={{ color: '#0284c7' }} />
            <span>Thêm mới dịch vụ y tế & bảng giá</span>
          </Space>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createServiceForm.submit()}
        confirmLoading={submittingService}
        okText="Tạo dịch vụ"
        cancelText="Hủy bỏ"
        width={820}
        okButtonProps={{ style: { background: '#0284c7' } }}
        destroyOnClose
      >
        <Form
          form={createServiceForm}
          layout="vertical"
          onFinish={handleCreateService}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Form.Item
              name="code"
              label="Mã dịch vụ y tế"
              rules={[
                { required: true, message: 'Vui lòng nhập mã dịch vụ' },
                { min: 2, max: 50, message: 'Độ dài từ 2 đến 50 ký tự' },
              ]}
            >
              <Input placeholder="VD: PRENATAL_BASIC, US_5D_HD" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              name="name"
              label="Tên dịch vụ y tế"
              rules={[
                { required: true, message: 'Vui lòng nhập tên dịch vụ' },
                { min: 2, max: 200, message: 'Độ dài từ 2 đến 200 ký tự' },
              ]}
            >
              <Input placeholder="VD: Khám thai định kỳ cơ bản" />
            </Form.Item>


            <Form.Item
              name="kind"
              label="Loại hình dịch vụ"
              rules={[{ required: true, message: 'Vui lòng chọn loại hình' }]}
            >
              <Select
                options={[
                  { label: 'Khám bệnh (Consultation)', value: 'CONSULTATION' },
                  { label: 'Chẩn đoán hình ảnh (Diagnostic)', value: 'DIAGNOSTIC' },
                  { label: 'Thủ thuật (Procedure)', value: 'PROCEDURE' },
                  { label: 'Gói thai sản (Package)', value: 'PACKAGE' },
                  { label: 'Tiêm chủng (Vaccination)', value: 'VACCINATION' },
                  { label: 'Khác (Other)', value: 'OTHER' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="categoryIds"
              label="Nhóm danh mục"
              rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 nhóm danh mục' }]}
            >
              <Select
                mode="multiple"
                placeholder="Chọn một hoặc nhiều nhóm danh mục..."
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>

            <Form.Item name="specialtyId" label="Chuyên khoa liên kết">
              <Select
                placeholder="Chọn chuyên khoa (nếu có)..."
                allowClear
                options={specialties.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Form.Item>

            <Form.Item name="tagIds" label="Thẻ tag phân loại">
              <Select
                mode="multiple"
                placeholder="Chọn các thẻ tag liên quan..."
                options={tags.map((t) => ({ label: t.name, value: t.id }))}
              />
            </Form.Item>



            <Form.Item
              name="initialPriceMinor"
              label="Mức giá cơ bản ban đầu (VND)"
              rules={[{ type: 'number', min: 0, message: 'Mức giá không âm' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="VD: 250000"
                formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(val) => val?.replace(/,/g, '') as unknown as number}
                addonAfter="đ"
              />
            </Form.Item>

            <Form.Item
              name="doctorRankSelectionPolicy"
              label="Chính sách phụ thu theo Hạng bác sĩ"
            >
              <Select
                options={[
                  { label: 'Không phân biệt hạng bác sĩ', value: 'NOT_REQUIRED' },
                  { label: 'Đã bao gồm hạng cơ bản (BASIC)', value: 'BASIC_INCLUDED' },
                  { label: 'Cho phép phụ thu theo hạng bác sĩ', value: 'RANK_UPGRADE_ALLOWED' },
                ]}
              />
            </Form.Item>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 8px 0' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#334155' }}>Cho phép đặt khám trực tuyến:</span>
                <div style={{ fontSize: 12, color: '#64748b' }}>Hiển thị trên cổng đặt hẹn cho bệnh nhân</div>
              </div>
              <Form.Item name="bookingEnabled" valuePropName="checked" noStyle>
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>
            </div>
          </div>

          <Form.Item name="summary" label="Tóm tắt giới thiệu ngắn gọn" style={{ marginTop: 12 }}>
            <Input.TextArea rows={2} maxLength={500} showCount placeholder="Mô tả tóm tắt 1-2 câu về dịch vụ..." />
          </Form.Item>

          <Form.Item name="description" label="Quy trình và mô tả chi tiết dịch vụ">
            <Input.TextArea rows={3} maxLength={3000} showCount placeholder="Chi tiết các bước thực hiện, lưu ý chuẩn bị..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: CHỈNH SỬA DỊCH VỤ                                          */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#0284c7' }} />
            <span>Chỉnh sửa thông tin dịch vụ</span>
          </Space>
        }
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editServiceForm.submit()}
        confirmLoading={submittingService}
        okText="Lưu thay đổi"
        cancelText="Hủy bỏ"
        width={820}
        okButtonProps={{ style: { background: '#0284c7' } }}
        destroyOnClose
      >
        <Form
          form={editServiceForm}
          layout="vertical"
          onFinish={handleUpdateService}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Form.Item
              name="code"
              label="Mã dịch vụ"
              rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
            >
              <Input style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              name="name"
              label="Tên dịch vụ y tế"
              rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
            >
              <Input />
            </Form.Item>


            <Form.Item name="kind" label="Loại hình dịch vụ">
              <Select
                options={[
                  { label: 'Khám bệnh', value: 'CONSULTATION' },
                  { label: 'Chẩn đoán hình ảnh', value: 'DIAGNOSTIC' },
                  { label: 'Thủ thuật', value: 'PROCEDURE' },
                  { label: 'Gói thai sản', value: 'PACKAGE' },
                  { label: 'Tiêm chủng', value: 'VACCINATION' },
                  { label: 'Khác', value: 'OTHER' },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="categoryIds"
              label="Nhóm danh mục"
              rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 nhóm danh mục' }]}
            >
              <Select
                mode="multiple"
                placeholder="Chọn một hoặc nhiều nhóm danh mục..."
                options={categories.map((c) => ({ label: c.name, value: c.id }))}
              />
            </Form.Item>

            <Form.Item name="specialtyId" label="Chuyên khoa liên kết">
              <Select
                allowClear
                options={specialties.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Form.Item>

            <Form.Item name="tagIds" label="Thẻ tag phân loại">
              <Select
                mode="multiple"
                options={tags.map((t) => ({ label: t.name, value: t.id }))}
              />
            </Form.Item>


            <Form.Item name="doctorRankSelectionPolicy" label="Chính sách phụ thu theo Hạng">
              <Select
                options={[
                  { label: 'Không phân biệt hạng bác sĩ', value: 'NOT_REQUIRED' },
                  { label: 'Đã bao gồm hạng cơ bản (BASIC)', value: 'BASIC_INCLUDED' },
                  { label: 'Cho phép phụ thu theo hạng bác sĩ', value: 'RANK_UPGRADE_ALLOWED' },
                ]}
              />
            </Form.Item>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 8px 0' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#334155' }}>Cho phép đặt trực tuyến:</span>
              </div>
              <Form.Item name="bookingEnabled" valuePropName="checked" noStyle>
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>
            </div>
          </div>

          <Form.Item name="summary" label="Tóm tắt giới thiệu">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>

          <Form.Item name="description" label="Quy trình và mô tả chi tiết">
            <Input.TextArea rows={3} maxLength={3000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: LÊN LỊCH GIÁ MỚI CHO DỊCH VỤ                               */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            <DollarCircleOutlined style={{ color: '#0f766e' }} />
            <span>Thiết lập biểu phí viện phí dịch vụ</span>
          </Space>
        }
        open={schedulePriceModalOpen}
        centered
        onCancel={() => setSchedulePriceModalOpen(false)}
        onOk={() => schedulePriceForm.submit()}
        confirmLoading={submittingPrice}
        okText="Áp dụng mức giá"
        cancelText="Hủy"
        width={520}
        okButtonProps={{ style: { background: '#0f766e' } }}
        destroyOnClose
      >
        <Form
          form={schedulePriceForm}
          layout="vertical"
          onFinish={handleSchedulePrice}
          style={{ marginTop: 16 }}
        >
          {serviceForPricing ? (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 12, color: '#166534', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Dịch vụ áp dụng
              </div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 15, marginTop: 2 }}>
                {serviceForPricing.name}
              </div>
            </div>
          ) : null}

          <Form.Item
            name="amountMinor"
            label="Mức giá viện phí mới (VND)"
            rules={[{ required: true, message: 'Vui lòng nhập mức giá' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              size="large"
              placeholder="VD: 300000"
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => val?.replace(/,/g, '') as unknown as number}
              addonAfter="đ"
            />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái giá" initialValue="ACTIVE">
            <Select
              options={[
                { label: 'Áp dụng ngay', value: 'ACTIVE' },
                { label: 'Lên lịch áp dụng', value: 'SCHEDULED' },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}
          >
            {({ getFieldValue }) =>
              getFieldValue('status') === 'SCHEDULED' ? (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '14px 14px 2px',
                    marginBottom: 16,
                  }}
                >
                  <Form.Item
                    name="effectiveFrom"
                    label="Thời điểm bắt đầu có hiệu lực"
                    rules={[
                      { required: true, message: 'Vui lòng chọn thời điểm hiệu lực' },
                      () => ({
                        validator(_, value) {
                          if (!value) return Promise.resolve();
                          if (new Date(value).getTime() < Date.now() - 60000) {
                            return Promise.reject(new Error('Thời điểm hiệu lực không được ở trong quá khứ'));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Input
                      type="datetime-local"
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    />
                  </Form.Item>

                  <Form.Item
                    name="effectiveTo"
                    label="Thời điểm kết thúc (Để trống nếu áp dụng vô thời hạn)"
                    dependencies={['effectiveFrom']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value) return Promise.resolve();
                          const from = getFieldValue('effectiveFrom');
                          if (from && new Date(value) <= new Date(from)) {
                            return Promise.reject(new Error('Thời điểm kết thúc phải sau thời điểm bắt đầu'));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Input
                      type="datetime-local"
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    />
                  </Form.Item>
                </div>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: XÁC NHẬN KÍCH HOẠT / TẠM KHÓA DỊCH VỤ                       */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            {serviceToToggle?.status === 'ACTIVE' ? (
              <PauseCircleOutlined style={{ color: '#fa8c16' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <span>
              {serviceToToggle?.status === 'ACTIVE'
                ? 'Xác nhận tạm khóa dịch vụ'
                : 'Xác nhận kích hoạt dịch vụ'}
            </span>
          </Space>
        }
        open={toggleStatusModalOpen}
        centered
        onCancel={() => {
          if (!togglingService) {
            setToggleStatusModalOpen(false);
            setServiceToToggle(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              type="primary"
              style={
                serviceToToggle?.status === 'ACTIVE'
                  ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                  : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
              }
              loading={togglingService}
              disabled={togglingService}
              onClick={handleConfirmToggleServiceStatus}
            >
              {serviceToToggle?.status === 'ACTIVE' ? 'Xác nhận tạm khóa' : 'Kích hoạt'}
            </Button>
            <Button
              disabled={togglingService}
              onClick={() => {
                setToggleStatusModalOpen(false);
                setServiceToToggle(null);
              }}
            >
              Hủy
            </Button>
          </div>
        }
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            {serviceToToggle?.status === 'ACTIVE' ? (
              <>
                Bạn có chắc chắn muốn tạm khóa dịch vụ <strong>{serviceToToggle?.name}</strong> không?
              </>
            ) : (
              <>
                Bạn có chắc chắn muốn kích hoạt dịch vụ <strong>{serviceToToggle?.name}</strong> không?
              </>
            )}
          </p>
          <p style={{ margin: '0', fontSize: 13, color: 'var(--muted)' }}>
            {serviceToToggle?.status === 'ACTIVE'
              ? 'Khi bị tạm khóa, dịch vụ sẽ không hiển thị cho bệnh nhân đặt lịch trực tuyến cho đến khi được kích hoạt lại.'
              : 'Sau khi kích hoạt, dịch vụ sẽ sẵn sàng hiển thị và cho phép đặt lịch bình thường.'}
          </p>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: XÓA DỊCH VỤ                                                */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ef4444' }} />
            <span>Xác nhận xóa dịch vụ y tế</span>
          </Space>
        }
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleDeleteService}
        confirmLoading={deletingService}
        okText="Xác nhận xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>
          Bạn có chắc chắn muốn xóa dịch vụ <strong>{serviceToDelete?.name}</strong> (Mã: {serviceToDelete?.code})?
        </p>
        <p style={{ color: '#64748b', fontSize: 13 }}>
          * Nếu dịch vụ đã từng có lịch hẹn hoặc hóa đơn liên quan, hệ thống sẽ tự động chuyển sang trạng thái <strong>Lưu trữ (ARCHIVED)</strong> để bảo toàn toàn vẹn dữ liệu lịch sử khám bệnh.
        </p>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: THÊM / SỬA NHÓM DỊCH VỤ (CATEGORIES)                       */}
      {/* ------------------------------------------------------------------ */}
      {/* ------------------------------------------------------------------ */}
      {/* MODAL: THÊM NHÓM DỊCH VỤ (CATEGORIES)                             */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title="Thêm mới nhóm dịch vụ"
        open={createCategoryModalOpen}
        onCancel={() => setCreateCategoryModalOpen(false)}
        onOk={() => createCategoryForm.submit()}
        confirmLoading={submittingCategory}
        okText="Thêm nhóm"
        cancelText="Hủy"
        width={580}
        okButtonProps={{ style: { background: '#0284c7' } }}
        destroyOnClose
      >
        <Form
          form={createCategoryForm}
          layout="vertical"
          onFinish={handleCreateCategory}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              name="code"
              label="Mã nhóm danh mục"
              rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
            >
              <Input placeholder="VD: KHAM_THAI, SIEU_AM" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              name="name"
              label="Tên nhóm danh mục"
              rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
            >
              <Input placeholder="VD: Khám thai & Quản lý thai kỳ" />
            </Form.Item>

            <Form.Item name="slug" label="Đường dẫn (Slug)">
              <Input placeholder="Tự sinh nếu để trống" />
            </Form.Item>

            <Form.Item name="sortOrder" label="Thứ tự hiển thị">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Mô tả nhóm dịch vụ">
            <Input.TextArea rows={3} placeholder="Mô tả chi tiết nhóm dịch vụ..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: SỬA NHÓM DỊCH VỤ                                            */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title="Chỉnh sửa nhóm dịch vụ"
        open={editCategoryModalOpen}
        onCancel={() => {
          setEditCategoryModalOpen(false);
          setCategoryToEdit(null);
        }}
        onOk={() => editCategoryForm.submit()}
        confirmLoading={submittingCategory}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={580}
        okButtonProps={{ style: { background: '#0284c7' } }}
        destroyOnClose
      >
        <Form
          form={editCategoryForm}
          layout="vertical"
          onFinish={handleUpdateCategory}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              name="code"
              label="Mã nhóm danh mục"
              rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
            >
              <Input style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              name="name"
              label="Tên nhóm danh mục"
              rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item name="slug" label="Đường dẫn (Slug)">
              <Input />
            </Form.Item>

            <Form.Item name="sortOrder" label="Thứ tự hiển thị">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Mô tả nhóm dịch vụ">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      {/* ------------------------------------------------------------------ */}
      {/* MODAL: XÁC NHẬN KÍCH HOẠT / TẠM KHÓA NHÓM DỊCH VỤ                 */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            {categoryToToggle?.status === 'ACTIVE' ? (
              <PauseCircleOutlined style={{ color: '#fa8c16' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <span>
              {categoryToToggle?.status === 'ACTIVE'
                ? 'Xác nhận tạm khóa nhóm danh mục'
                : 'Xác nhận kích hoạt nhóm danh mục'}
            </span>
          </Space>
        }
        open={toggleCategoryModalOpen}
        centered
        onCancel={() => {
          if (!togglingCategory) {
            setToggleCategoryModalOpen(false);
            setCategoryToToggle(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              type="primary"
              style={
                categoryToToggle?.status === 'ACTIVE'
                  ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                  : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
              }
              loading={togglingCategory}
              disabled={togglingCategory}
              onClick={handleConfirmToggleCategoryStatus}
            >
              {categoryToToggle?.status === 'ACTIVE' ? 'Xác nhận tạm khóa' : 'Kích hoạt'}
            </Button>
            <Button
              disabled={togglingCategory}
              onClick={() => {
                setToggleCategoryModalOpen(false);
                setCategoryToToggle(null);
              }}
            >
              Hủy
            </Button>
          </div>
        }
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            {categoryToToggle?.status === 'ACTIVE' ? (
              <>
                Bạn có chắc chắn muốn tạm khóa nhóm danh mục <strong>{categoryToToggle?.name}</strong> không?
              </>
            ) : (
              <>
                Bạn có chắc chắn muốn kích hoạt nhóm danh mục <strong>{categoryToToggle?.name}</strong> không?
              </>
            )}
          </p>
          <p style={{ margin: '0', fontSize: 13, color: 'var(--muted)' }}>
            {categoryToToggle?.status === 'ACTIVE'
              ? 'Khi bị tạm khóa, nhóm danh mục này sẽ tạm thời bị ẩn khỏi danh sách lựa chọn của người dùng.'
              : 'Sau khi kích hoạt, nhóm danh mục sẽ hiển thị và hoạt động bình thường.'}
          </p>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: XÓA NHÓM DỊCH VỤ                                            */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title="Xác nhận xóa nhóm dịch vụ"
        open={deleteCategoryModalOpen}
        centered
        onCancel={() => setDeleteCategoryModalOpen(false)}
        onOk={handleDeleteCategory}
        confirmLoading={submittingCategory}
        okText="Xóa nhóm"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>
          Bạn có chắc chắn muốn xóa nhóm danh mục <strong>{categoryToDelete?.name}</strong>?
        </p>
        <p style={{ color: '#ef4444', fontSize: 13 }}>
          * Nhóm danh mục chỉ có thể xóa khi không còn dịch vụ nào trực thuộc và không chứa nhóm con.
        </p>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: THÊM THẺ TAG (TAGS)                                         */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title="Thêm mới thẻ tag"
        open={createTagModalOpen}
        onCancel={() => setCreateTagModalOpen(false)}
        onOk={() => createTagForm.submit()}
        confirmLoading={submittingTag}
        okText="Thêm thẻ tag"
        cancelText="Hủy"
        width={560}
        okButtonProps={{ style: { background: '#0284c7' } }}
        destroyOnClose
      >
        <Form
          form={createTagForm}
          layout="vertical"
          onFinish={handleCreateTag}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              name="code"
              label="Mã thẻ tag"
              rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
            >
              <Input placeholder="VD: SIEU_AM_5D" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              name="name"
              label="Tên thẻ tag"
              rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
            >
              <Input placeholder="VD: Công nghệ siêu âm 5D" />
            </Form.Item>

            <Form.Item name="slug" label="Đường dẫn (Slug)">
              <Input placeholder="Tự sinh nếu để trống" />
            </Form.Item>

            <Form.Item name="sortOrder" label="Thứ tự hiển thị">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Mô tả thẻ tag">
            <Input.TextArea rows={2} placeholder="Ý nghĩa và mục đích sử dụng thẻ tag..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: SỬA THẺ TAG (TAGS)                                          */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title="Chỉnh sửa thẻ tag"
        open={editTagModalOpen}
        onCancel={() => {
          setEditTagModalOpen(false);
          setTagToEdit(null);
        }}
        onOk={() => editTagForm.submit()}
        confirmLoading={submittingTag}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={560}
        okButtonProps={{ style: { background: '#0284c7' } }}
        destroyOnClose
      >
        <Form
          form={editTagForm}
          layout="vertical"
          onFinish={handleUpdateTag}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              name="code"
              label="Mã thẻ tag"
              rules={[{ required: true, message: 'Vui lòng nhập mã' }]}
            >
              <Input style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              name="name"
              label="Tên thẻ tag"
              rules={[{ required: true, message: 'Vui lòng nhập tên' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item name="slug" label="Đường dẫn (Slug)">
              <Input />
            </Form.Item>

            <Form.Item name="sortOrder" label="Thứ tự hiển thị">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Mô tả thẻ tag">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: XÁC NHẬN KÍCH HOẠT / TẠM KHÓA THẺ TAG                       */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            {tagToToggle?.status === 'ACTIVE' ? (
              <PauseCircleOutlined style={{ color: '#fa8c16' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <span>
              {tagToToggle?.status === 'ACTIVE'
                ? 'Xác nhận tạm khóa thẻ tag'
                : 'Xác nhận kích hoạt thẻ tag'}
            </span>
          </Space>
        }
        open={toggleTagModalOpen}
        centered
        onCancel={() => {
          if (!togglingTag) {
            setToggleTagModalOpen(false);
            setTagToToggle(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              type="primary"
              style={
                tagToToggle?.status === 'ACTIVE'
                  ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                  : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
              }
              loading={togglingTag}
              disabled={togglingTag}
              onClick={handleConfirmToggleTagStatus}
            >
              {tagToToggle?.status === 'ACTIVE' ? 'Xác nhận tạm khóa' : 'Kích hoạt'}
            </Button>
            <Button
              disabled={togglingTag}
              onClick={() => {
                setToggleTagModalOpen(false);
                setTagToToggle(null);
              }}
            >
              Hủy
            </Button>
          </div>
        }
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            {tagToToggle?.status === 'ACTIVE' ? (
              <>
                Bạn có chắc chắn muốn tạm khóa thẻ tag <strong>{tagToToggle?.name}</strong> không?
              </>
            ) : (
              <>
                Bạn có chắc chắn muốn kích hoạt thẻ tag <strong>{tagToToggle?.name}</strong> không?
              </>
            )}
          </p>
          <p style={{ margin: '0', fontSize: 13, color: 'var(--muted)' }}>
            {tagToToggle?.status === 'ACTIVE'
              ? 'Khi bị tạm khóa, thẻ tag này sẽ tạm thời không hiển thị ở bộ lọc tìm kiếm.'
              : 'Sau khi kích hoạt, thẻ tag sẽ hiển thị và hoạt động bình thường.'}
          </p>
        </div>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: XÓA THẺ TAG                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title="Xác nhận xóa thẻ tag"
        open={deleteTagModalOpen}
        centered
        onCancel={() => setDeleteTagModalOpen(false)}
        onOk={handleDeleteTag}
        confirmLoading={submittingTag}
        okText="Xóa thẻ tag"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>
          Bạn có chắc chắn muốn xóa thẻ tag <strong>{tagToDelete?.name}</strong>?
        </p>
        <p style={{ color: '#64748b', fontSize: 13 }}>
          * Thẻ tag sẽ được tự động gỡ khỏi tất cả dịch vụ y tế đang liên kết.
        </p>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: THIẾT LẬP PHỤ THU HẠNG BÁC SĨ                              */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        title={
          <Space>
            <TrophyOutlined style={{ color: '#0284c7' }} />
            <span>Thiết lập phụ thu theo hạng bác sĩ</span>
          </Space>
        }
        open={createSurchargeModalOpen}
        centered
        onCancel={() => {
          setCreateSurchargeModalOpen(false);
          setRankForSurcharge(null);
        }}
        onOk={() => createSurchargeForm.submit()}
        confirmLoading={submittingSurcharge}
        okText="Áp dụng mức phụ thu"
        cancelText="Hủy"
        width={520}
        okButtonProps={{ style: { background: '#0284c7' } }}
        destroyOnClose
      >
        <Form
          form={createSurchargeForm}
          layout="vertical"
          onFinish={handleScheduleSurcharge}
          style={{ marginTop: 16 }}
        >
          {rankForSurcharge ? (
            <>
              <Form.Item name="rankCode" hidden initialValue={rankForSurcharge.code}>
                <Input type="hidden" />
              </Form.Item>
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 18,
                }}
              >
                <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Hạng bác sĩ áp dụng
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 15, marginTop: 2 }}>
                  {rankForSurcharge.name} <span style={{ color: '#64748b', fontSize: 13, fontWeight: 400 }}>({rankForSurcharge.code})</span>
                </div>
              </div>
            </>
          ) : (
            <Form.Item
              name="rankCode"
              label="Hạng chuyên môn bác sĩ"
              rules={[{ required: true, message: 'Vui lòng chọn hạng bác sĩ' }]}
            >
              <Select
                placeholder="Chọn hạng bác sĩ..."
                options={consultationRanks.map((r) => ({
                  label: `${r.name} (${r.code})`,
                  value: r.code,
                }))}
              />
            </Form.Item>
          )}

          <Form.Item
            name="amountMinor"
            label="Mức phụ thu khám mới (VND)"
            rules={[{ required: true, message: 'Vui lòng nhập mức phụ thu' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              size="large"
              placeholder="VD: 150000"
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => val?.replace(/,/g, '') as unknown as number}
              addonAfter="đ"
            />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái áp dụng" initialValue="ACTIVE">
            <Select
              options={[
                { label: 'Áp dụng ngay', value: 'ACTIVE' },
                { label: 'Lên lịch áp dụng', value: 'SCHEDULED' },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}
          >
            {({ getFieldValue }) =>
              getFieldValue('status') === 'SCHEDULED' ? (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '14px 14px 2px',
                    marginBottom: 16,
                  }}
                >
                  <Form.Item
                    name="effectiveFrom"
                    label="Thời điểm bắt đầu có hiệu lực"
                    rules={[
                      { required: true, message: 'Vui lòng chọn thời điểm hiệu lực' },
                      () => ({
                        validator(_, value) {
                          if (!value) return Promise.resolve();
                          if (new Date(value).getTime() < Date.now() - 60000) {
                            return Promise.reject(new Error('Thời điểm hiệu lực không được ở trong quá khứ'));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Input
                      type="datetime-local"
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    />
                  </Form.Item>

                  <Form.Item
                    name="effectiveTo"
                    label="Thời điểm kết thúc (Để trống nếu áp dụng vô thời hạn)"
                    dependencies={['effectiveFrom']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value) return Promise.resolve();
                          const from = getFieldValue('effectiveFrom');
                          if (from && new Date(value) <= new Date(from)) {
                            return Promise.reject(new Error('Thời điểm kết thúc phải sau thời điểm bắt đầu'));
                          }
                          return Promise.resolve();
                        },
                      }),
                    ]}
                  >
                    <Input
                      type="datetime-local"
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    />
                  </Form.Item>
                </div>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* DRAWER: CHI TIẾT HẠNG BÁC SĨ & BIỂU PHÍ PHỤ THU                    */}
      {/* ------------------------------------------------------------------ */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              size={40}
              style={{ backgroundColor: '#722ed1', color: '#fff', fontSize: 16, fontWeight: 700 }}
            >
              HBS
            </Avatar>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {activeSelectedRank?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Mã hạng: <span className="admin-code">{activeSelectedRank?.code}</span>
              </div>
            </div>
          </div>
        }
        placement="right"
        width={680}
        open={detailRankDrawerOpen}
        onClose={() => {
          setDetailRankDrawerOpen(false);
          setSelectedMergedRank(null);
        }}
        destroyOnClose
      >
        {activeSelectedRank && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* PHẦN 1: THÔNG TIN HẠNG BÁC SĨ (consultation_ranks) */}
              <div>
                <Typography.Title level={5} style={{ marginBottom: 12, color: 'var(--deep)' }}>
                  1. Thông tin Hạng bác sĩ tư vấn (bảng consultation_ranks)
                </Typography.Title>
                <Descriptions
                  bordered
                  column={2}
                  size="small"
                  items={[
                    {
                      key: 'code',
                      label: 'Mã hạng (code)',
                      children: <span className="admin-code" style={{ fontWeight: 600 }}>{activeSelectedRank.code}</span>,
                    },
                    {
                      key: 'name',
                      label: 'Tên hạng bác sĩ (name)',
                      children: <strong>{activeSelectedRank.name}</strong>,
                    },
                    {
                      key: 'experienceYearsMin',
                      label: 'Kinh nghiệm tối thiểu (experience_years_min)',
                      children: activeSelectedRank.experienceYearsMin ? `${activeSelectedRank.experienceYearsMin} năm` : 'Không yêu cầu',
                    },
                    {
                      key: 'status',
                      label: 'Trạng thái hạng (status)',
                      children: <StatusTag status={activeSelectedRank.rankStatus} />,
                    },
                    {
                      key: 'doctorCount',
                      label: 'Bác sĩ đạt hạng',
                      children: (
                        <Tag color="purple" style={{ fontWeight: 600 }}>
                          {doctorsList.filter((d) => d.consultationRank === activeSelectedRank.code).length} bác sĩ
                        </Tag>
                      ),
                    },
                    {
                      key: 'description',
                      label: 'Mô tả & Tiêu chuẩn',
                      span: 2,
                      children: activeSelectedRank.description || 'Chưa có mô tả tiêu chuẩn.',
                    },
                  ]}
                />
              </div>

              {/* PHẦN 2: THÔNG TIN BIỂU PHÍ PHỤ THU (doctor_rank_surcharges - CHUẨN DB) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Typography.Title level={5} style={{ margin: 0, color: '#0f766e' }}>
                    2. Biểu phí phụ thu theo hạng (bảng doctor_rank_surcharges)
                  </Typography.Title>
                  <Button
                    size="small"
                    icon={<DollarCircleOutlined />}
                    style={{ borderColor: '#0f766e', color: '#0f766e' }}
                    onClick={() => openScheduleSurchargeForRank(activeSelectedRank)}
                  >
                    Thiết lập / Đổi mức phụ thu
                  </Button>
                </div>

                <Descriptions
                  bordered
                  column={2}
                  size="small"
                  items={[
                    {
                      key: 'id',
                      label: 'ID bản ghi [PK uuid]',
                      children: <span className="admin-code" style={{ fontSize: 11 }}>{activeSelectedRank.surchargeId || 'Chưa thiết lập'}</span>,
                    },
                    {
                      key: 'rank_code',
                      label: 'Mã hạng (rank_code)',
                      children: <span className="admin-code">{activeSelectedRank.code}</span>,
                    },
                    {
                      key: 'amount_minor',
                      label: 'Mức phụ thu (amount_minor)',
                      children: (
                        <strong style={{ color: '#0f766e', fontSize: 15 }}>
                          {activeSelectedRank.amountMinor !== undefined
                            ? formatMoneyMinor(activeSelectedRank.amountMinor, activeSelectedRank.currency || 'VND')
                            : 'Chưa thiết lập'}
                        </strong>
                      ),
                    },
                    {
                      key: 'currency',
                      label: 'Tiền tệ (currency)',
                      children: <Tag color="blue">{activeSelectedRank.currency || 'VND'}</Tag>,
                    },
                    {
                      key: 'effective_from',
                      label: 'Hiệu lực từ (effective_from)',
                      children: activeSelectedRank.effectiveFrom
                        ? new Date(activeSelectedRank.effectiveFrom).toLocaleString('vi-VN')
                        : '-',
                    },
                    {
                      key: 'effective_to',
                      label: 'Đến ngày (effective_to)',
                      children: activeSelectedRank.effectiveTo
                        ? new Date(activeSelectedRank.effectiveTo).toLocaleString('vi-VN')
                        : 'Vô thời hạn',
                    },
                    {
                      key: 'status',
                      label: 'Trạng thái phụ thu (status)',
                      children: renderPriceStatusTag(
                        activeSelectedRank.surchargeStatus,
                        activeSelectedRank.effectiveFrom,
                        activeSelectedRank.effectiveTo,
                      ),
                    },
                    {
                      key: 'version',
                      label: 'Phiên bản (version)',
                      children: <span>Version {activeSelectedRank.surchargeVersion ?? 1}</span>,
                    },
                    {
                      key: 'created_at',
                      label: 'Ngày tạo (created_at)',
                      children: activeSelectedRank.surchargeCreatedAt
                        ? new Date(activeSelectedRank.surchargeCreatedAt).toLocaleString('vi-VN')
                        : '-',
                    },
                    {
                      key: 'updated_at',
                      label: 'Cập nhật (updated_at)',
                      children: activeSelectedRank.surchargeUpdatedAt
                        ? new Date(activeSelectedRank.surchargeUpdatedAt).toLocaleString('vi-VN')
                        : '-',
                    },
                  ]}
                />
              </div>

              {/* PHẦN 3: LỊCH SỬ CÁC ĐỢT PHỤ THU CỦA HẠNG NÀY */}
              {activeSelectedRank.allSurcharges.length > 0 && (
                <div>
                  <Typography.Title level={5} style={{ marginBottom: 10, color: 'var(--deep)' }}>
                    3. Lịch sử biểu phí phụ thu ({activeSelectedRank.allSurcharges.length})
                  </Typography.Title>
                  <Table<DoctorRankSurchargeItem>
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={activeSelectedRank.allSurcharges}
                    columns={[
                      {
                        title: 'Mức phụ thu (amount_minor)',
                        dataIndex: 'amountMinor',
                        render: (amount: number, row) => (
                          <strong style={{ color: '#0f766e' }}>
                            {formatMoneyMinor(amount, row.currency || 'VND')}
                          </strong>
                        ),
                      },
                      {
                        title: 'Hiệu lực từ',
                        dataIndex: 'effectiveFrom',
                        render: (d: string) => new Date(d).toLocaleDateString('vi-VN'),
                      },
                      {
                        title: 'Đến ngày',
                        dataIndex: 'effectiveTo',
                        render: (d?: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : 'Vô thời hạn'),
                      },
                      {
                        title: 'Trạng thái',
                        dataIndex: 'status',
                        align: 'center',
                        render: (st: string, row) => renderPriceStatusTag(st, row.effectiveFrom, row.effectiveTo),
                      },
                      {
                        title: 'Thao tác',
                        key: 'action',
                        align: 'center',
                        render: (_, s) => {
                          if (s.status === 'CANCELLED') return <span style={{ color: '#94a3b8' }}>-</span>;
                          return (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => void handleCancelSurcharge(s.id)}
                            >
                              Hủy
                            </Button>
                          );
                        },
                      },
                    ]}
                  />
                </div>
              )}

              {/* PHẦN 4: DANH SÁCH BÁC SĨ ĐẠT HẠNG NÀY */}
              <div>
                <Typography.Title level={5} style={{ marginBottom: 12 }}>
                  4. Danh sách bác sĩ đạt hạng này ({doctorsList.filter((d) => d.consultationRank === activeSelectedRank.code).length})
                </Typography.Title>
                {(() => {
                  const doctorsInRank = doctorsList.filter((d) => d.consultationRank === activeSelectedRank.code);
                  if (doctorsInRank.length === 0) {
                    return (
                      <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 13 }}>
                        Chưa có bác sĩ nào đạt hạng này.
                      </p>
                    );
                  }
                  return (
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={doctorsInRank}
                      columns={[
                        {
                          title: 'Bác sĩ',
                          render: (_, d) => (
                            <Space>
                              <Avatar size="small" style={{ backgroundColor: '#0284c7' }}>
                                {(d.profile?.fullName || 'B')[0].toUpperCase()}
                              </Avatar>
                              <strong>{d.profile?.professionalTitle ? `${d.profile.professionalTitle} ` : ''}{d.profile?.fullName}</strong>
                            </Space>
                          ),
                        },
                        {
                          title: 'Số CCHN',
                          dataIndex: 'licenseNumber',
                          render: (l: string) =>
                            l && l.trim() ? (
                              <span className="admin-code">{l}</span>
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa cấp</span>
                            ),
                        },
                        {
                          title: 'Trạng thái',
                          dataIndex: 'status',
                          render: (st: string) => <Tag color={st === 'ACTIVE' ? 'green' : 'volcano'}>{st === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}</Tag>,
                        },
                      ]}
                    />
                  );
                })()}
              </div>
            </div>

            <Divider style={{ margin: '16px 0 12px' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <Button
                icon={<DollarCircleOutlined />}
                style={{ borderColor: '#0f766e', color: '#0f766e' }}
                onClick={() => openScheduleSurchargeForRank(activeSelectedRank)}
              >
                Cập nhật phụ thu
              </Button>
              {activeSelectedRank.rawRank && (
                <>
                  {activeSelectedRank.rankStatus === 'ACTIVE' ? (
                    <Button
                      style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
                      icon={<PauseCircleOutlined />}
                      onClick={() => {
                        const rk = activeSelectedRank.rawRank!;
                        setDetailRankDrawerOpen(false);
                        openToggleRankModal(rk);
                      }}
                    >
                      Tạm khóa áp dụng
                    </Button>
                  ) : (
                    <Button
                      style={{ color: '#52c41a', borderColor: '#52c41a' }}
                      icon={<CheckCircleOutlined />}
                      onClick={() => {
                        const rk = activeSelectedRank.rawRank!;
                        setDetailRankDrawerOpen(false);
                        openToggleRankModal(rk);
                      }}
                    >
                      Kích hoạt áp dụng
                    </Button>
                  )}
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => {
                      const rk = activeSelectedRank.rawRank!;
                      setDetailRankDrawerOpen(false);
                      openEditRank(rk);
                    }}
                  >
                    Chỉnh sửa hạng
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      const rk = activeSelectedRank.rawRank!;
                      setDetailRankDrawerOpen(false);
                      openDeleteRank(rk);
                    }}
                  >
                    Xóa hạng
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal Thêm hạng bác sĩ */}
      <Modal
        title="Thêm hạng bác sĩ mới"
        open={createRankModalOpen}
        centered
        onCancel={() => {
          if (!submittingRank) {
            setCreateRankModalOpen(false);
            createRankForm.resetFields();
          }
        }}
        onOk={() => void createRankForm.submit()}
        confirmLoading={submittingRank}
        okText="Thêm hạng bác sĩ"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form
          form={createRankForm}
          layout="vertical"
          onFinish={(values) => void handleCreateRank(values)}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="code"
            label="Mã định danh hạng"
            normalize={(val) => (typeof val === 'string' ? val.toUpperCase().trim() : val)}
            rules={[
              { required: true, message: 'Vui lòng nhập mã định danh' },
              {
                pattern: /^[A-Z0-9_]+$/,
                message: 'Mã định danh chỉ gồm chữ in hoa, số và dấu gạch dưới (VD: SPECIALIST_III)',
              },
            ]}
          >
            <Input placeholder="Ví dụ: SPECIALIST_III, SENIOR_CONSULTANT..." style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên hạng bác sĩ"
            rules={[{ required: true, message: 'Vui lòng nhập tên hạng bác sĩ' }]}
          >
            <Input placeholder="Ví dụ: Bác sĩ Chuyên khoa III, Chuyên gia cao cấp..." />
          </Form.Item>

          <Form.Item
            name="surchargeMinor"
            label="Tiền phụ thu khám (VNĐ)"
            rules={[{ required: true, message: 'Vui lòng nhập tiền phụ thu khám' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={10000}
              placeholder="Nhập 0 nếu không áp dụng phụ thu"
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => Number((val ?? '').replace(/,/g, '')) as any}
              addonAfter="VNĐ"
            />
          </Form.Item>

          <Form.Item
            name="experienceYearsMin"
            label="Số năm kinh nghiệm tối thiểu yêu cầu"
            rules={[{ required: true, message: 'Vui lòng nhập số năm kinh nghiệm' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={60} addonAfter="năm" />
          </Form.Item>

          <Form.Item name="description" label="Tiêu chuẩn & Mô tả hạng">
            <Input.TextArea rows={3} placeholder="Mô tả tiêu chuẩn, chứng chỉ hoặc quy định áp dụng..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa hạng bác sĩ */}
      <Modal
        title={`Chỉnh sửa hạng bác sĩ: ${rankToEdit?.name || ''}`}
        open={editRankModalOpen}
        centered
        onCancel={() => {
          if (!submittingRank) {
            setEditRankModalOpen(false);
            setRankToEdit(null);
            editRankForm.resetFields();
          }
        }}
        onOk={() => void editRankForm.submit()}
        confirmLoading={submittingRank}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form
          form={editRankForm}
          layout="vertical"
          onFinish={(values) => void handleEditRank(values)}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="Tên hạng bác sĩ"
            rules={[{ required: true, message: 'Vui lòng nhập tên hạng bác sĩ' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="experienceYearsMin"
            label="Số năm kinh nghiệm tối thiểu"
          >
            <InputNumber style={{ width: '100%' }} min={0} max={60} addonAfter="năm" />
          </Form.Item>

          <Form.Item name="description" label="Tiêu chuẩn & Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Xác nhận xóa hạng bác sĩ */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Xác nhận xóa hạng bác sĩ</span>
          </Space>
        }
        open={deleteRankModalOpen}
        centered
        onCancel={() => {
          if (!submittingRank) {
            setDeleteRankModalOpen(false);
            setRankToDelete(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              danger
              type="primary"
              loading={submittingRank}
              onClick={() => void handleConfirmDeleteRank()}
            >
              Xóa
            </Button>
            <Button
              disabled={submittingRank}
              onClick={() => {
                setDeleteRankModalOpen(false);
                setRankToDelete(null);
              }}
            >
              Hủy
            </Button>
          </div>
        }
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ margin: '0 0 8px', fontSize: 14 }}>
            Bạn có chắc muốn xóa hạng bác sĩ <strong>{rankToDelete?.name}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            Hành động này sẽ xóa hạng bác sĩ khỏi hệ thống. Chỉ xóa được khi không có bác sĩ nào giữ hạng này.
          </p>
        </div>
      </Modal>

      {/* Modal Xác nhận tạm khóa / kích hoạt hạng bác sĩ */}
      <Modal
        title={
          <Space>
            {rankToToggle?.status === 'ACTIVE' ? (
              <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <span>
              {rankToToggle?.status === 'ACTIVE'
                ? 'Xác nhận tạm khóa hạng bác sĩ'
                : 'Xác nhận kích hoạt hạng bác sĩ'}
            </span>
          </Space>
        }
        open={toggleRankModalOpen}
        centered
        onCancel={() => {
          if (!submittingRank) {
            setToggleRankModalOpen(false);
            setRankToToggle(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              type="primary"
              style={
                rankToToggle?.status === 'ACTIVE'
                  ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                  : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
              }
              loading={submittingRank}
              disabled={submittingRank}
              onClick={() => void handleConfirmToggleRankStatus()}
            >
              {rankToToggle?.status === 'ACTIVE' ? 'Xác nhận tạm khóa' : 'Kích hoạt'}
            </Button>
            <Button
              disabled={submittingRank}
              onClick={() => {
                setToggleRankModalOpen(false);
                setRankToToggle(null);
              }}
            >
              Hủy
            </Button>
          </div>
        }
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            {rankToToggle?.status === 'ACTIVE' ? (
              <>
                Bạn có chắc chắn muốn tạm khóa hạng bác sĩ <strong>{rankToToggle?.name}</strong> không?
              </>
            ) : (
              <>
                Bạn có chắc chắn muốn kích hoạt hạng bác sĩ <strong>{rankToToggle?.name}</strong> không?
              </>
            )}
          </p>
          <p style={{ margin: '0', fontSize: 13, color: 'var(--muted)' }}>
            {rankToToggle?.status === 'ACTIVE'
              ? 'Khi bị tạm khóa, hạng bác sĩ này sẽ không thể được gán mới cho bác sĩ khác trong hệ thống.'
              : 'Sau khi kích hoạt, hạng bác sĩ sẽ sẵn sàng được lựa chọn và áp dụng bình thường.'}
          </p>
        </div>
      </Modal>

      {/* Modal Thông báo (Thành công / Thất bại) với nét vẽ tự động đóng */}
      <AdminFeedbackModal
        feedback={feedback}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
export default AdminServicesPage;
