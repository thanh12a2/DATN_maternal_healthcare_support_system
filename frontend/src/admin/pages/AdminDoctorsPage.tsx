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
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  MailOutlined,
  MedicineBoxOutlined,
  PauseCircleOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../app/AuthSessionProvider';
import {
  activateDoctor,
  createDoctor,
  deactivateDoctor,
  deleteDoctor,
  getDoctor,
  linkDoctorSpecialty,
  unlinkDoctorSpecialty,
  listConsultationRanks,
  listDoctors,
  listSpecialties,
  updateDoctor,
  type ConsultationRankItem,
  type CreateDoctorPayload,
  type DoctorConsultationRank,
  type DoctorItem,
  type DoctorStatus,
  type SpecialtyItem,
  type UpdateDoctorPayload,
} from '../../services/adminDoctors';
import { formatDateTime, formatPhoneNumber } from '../format';
import { StatusTag } from '../components/StatusTag';
import {
  AdminFeedbackModal,
  type AdminFeedbackState,
} from '../components/AdminFeedbackModal';
import { DoctorPhotoUpload } from '../components/DoctorPhotoUpload';
import { listAdminUsers, getAdminUser, deleteAdminUser, updateAdminUser, type AdminUser } from '../../services/adminUsers';
import { registerDoctorBatchToCache, registerDoctorToCache, setDoctorContext } from '../../services/auditInterceptor';

const RANK_LABELS: Record<string, string> = {
  BASIC: 'Bác sĩ đa khoa',
  SPECIALIST_I: 'Bác sĩ CKI',
  SPECIALIST_II: 'Bác sĩ CKII',
  MASTER: 'Thạc sĩ y khoa',
  ASSOC_PROFESSOR: 'Phó Giáo sư',
  PROFESSOR: 'Giáo sư',
  EXPERT: 'Chuyên gia cao cấp',
  HEAD_DOCTOR: 'Bác sĩ Trưởng khoa',
};

const STATUS_OPTIONS: Array<{ label: string; value: DoctorStatus; color: string }> = [
  { label: 'Hoạt động (ACTIVE)', value: 'ACTIVE', color: 'green' },
  { label: 'Bản nháp (DRAFT)', value: 'DRAFT', color: 'default' },
  { label: 'Tạm khóa (INACTIVE)', value: 'INACTIVE', color: 'warning' },
];

const SEED_DOCTOR_PHONES: Record<string, string> = {
  'dr.hongtam@antam.local': '0903112001',
  'dr.quocviet@antam.local': '0903112002',
  'dr.thuha@antam.local': '0903112003',
  'dr.hoangnam@antam.local': '0903112004',
  'dr.bichngoc@antam.local': '0903112005',
  'dr.phuongthao@antam.local': '0903112006',
  'dr.minhduc@antam.local': '0903112007',
  'dr.kimoanh@antam.local': '0903112008',
};

function getDoctorPhone(doctor?: Partial<DoctorItem> | null): string | undefined {
  if (!doctor) return undefined;
  if (doctor.phoneNumber && doctor.phoneNumber.trim()) return doctor.phoneNumber.trim();
  if (typeof window !== 'undefined') {
    if (doctor.id) {
      const p1 = localStorage.getItem(`doctor_phone_${doctor.id}`);
      if (p1 && p1.trim()) return p1.trim();
    }
    if (doctor.accountId) {
      const p2 = localStorage.getItem(`doctor_phone_${doctor.accountId}`);
      if (p2 && p2.trim()) return p2.trim();
    }
  }
  if (doctor.email && SEED_DOCTOR_PHONES[doctor.email]) {
    return SEED_DOCTOR_PHONES[doctor.email];
  }
  return undefined;
}

function getDoctorPhoto(doctor: DoctorItem): string | undefined {
  if (typeof window !== 'undefined') {
    if (doctor.id) {
      const saved = localStorage.getItem(`doctor_avatar_${doctor.id}`);
      if (saved) return saved;
    }
    if (doctor.accountId) {
      const saved = localStorage.getItem(`doctor_avatar_${doctor.accountId}`);
      if (saved) return saved;
    }
  }
  return doctor.profile?.photoUrl || undefined;
}

function saveDoctorPhone(doctorId?: string | null, accountId?: string | null, phone?: string | null) {
  if (typeof window === 'undefined') return;
  const p = phone?.trim();
  if (p) {
    if (doctorId) localStorage.setItem(`doctor_phone_${doctorId}`, p);
    if (accountId) localStorage.setItem(`doctor_phone_${accountId}`, p);
  } else {
    if (doctorId) localStorage.removeItem(`doctor_phone_${doctorId}`);
    if (accountId) localStorage.removeItem(`doctor_phone_${accountId}`);
  }
}

function saveDoctorPhoto(doctorId?: string | null, accountId?: string | null, photoUrl?: string | null) {
  if (typeof window === 'undefined') return;
  const p = photoUrl?.trim();
  if (p) {
    if (doctorId) localStorage.setItem(`doctor_avatar_${doctorId}`, p);
    if (accountId) localStorage.setItem(`doctor_avatar_${accountId}`, p);
  } else {
    if (doctorId) localStorage.removeItem(`doctor_avatar_${doctorId}`);
    if (accountId) localStorage.removeItem(`doctor_avatar_${accountId}`);
  }
}

export function AdminDoctorsPage() {
  const { request, user } = useAuthSession();

  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [consultationRanks, setConsultationRanks] = useState<ConsultationRankItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorItem | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  // Detail drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<DoctorItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Status toggle modal state (Tạm khóa / Kích hoạt)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTargetDoctor, setStatusTargetDoctor] = useState<DoctorItem | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Feedback modal
  const [feedback, setFeedback] = useState<AdminFeedbackState | null>(null);

  const [createForm] = Form.useForm<CreateDoctorPayload & { specialtyId?: string }>();
  const [editForm] = Form.useForm<UpdateDoctorPayload & { specialtyId?: string }>();

  // Danh sách các enum hợp lệ mà backend NestJS DoctorService chấp nhận
  const VALID_BACKEND_RANKS = useMemo<DoctorConsultationRank[]>(
    () => [
      'BASIC',
      'SPECIALIST_I',
      'SPECIALIST_II',
      'MASTER',
      'ASSOC_PROFESSOR',
      'PROFESSOR',
      'EXPERT',
      'HEAD_DOCTOR',
    ],
    [],
  );

  // Lấy các hạng tư vấn đang có trong database (ACTIVE)
  const availableRankOptions = useMemo(() => {
    const list = Array.isArray(consultationRanks) ? consultationRanks : [];
    // Lấy tất cả các hạng đang ACTIVE trong DB
    const activeRanks = list.filter((r) => r.status === 'ACTIVE');

    if (activeRanks.length > 0) {
      return activeRanks.map((r) => ({
        label: `${r.name} (${r.code})`,
        value: r.code as DoctorConsultationRank,
      }));
    }

    // Fallback mặc định khi DB chưa load kịp
    return [
      { label: 'Bác sĩ đa khoa (BASIC)', value: 'BASIC' as DoctorConsultationRank },
      { label: 'Bác sĩ CKI (SPECIALIST_I)', value: 'SPECIALIST_I' as DoctorConsultationRank },
      { label: 'Bác sĩ CKII (SPECIALIST_II)', value: 'SPECIALIST_II' as DoctorConsultationRank },
      { label: 'Thạc sĩ y khoa (MASTER)', value: 'MASTER' as DoctorConsultationRank },
    ];
  }, [consultationRanks]);

  const loadSpecialties = useCallback(async () => {
    try {
      const res = await listSpecialties(request, { limit: 100 });
      setSpecialties(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch {
      // ignore
    }
  }, [request]);

  const loadRanks = useCallback(async () => {
    try {
      const res = await listConsultationRanks(request);
      setConsultationRanks(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch {
      // ignore
    }
  }, [request]);

  useEffect(() => {
    void loadSpecialties();
    void loadRanks();
  }, [loadSpecialties, loadRanks]);

  // Load danh sách bác sĩ
  const loadData = useCallback(async (
    q?: string,
    st?: string,
    sp?: string,
  ) => {
    setLoading(true);
    setError('');
    const qTerm = q !== undefined ? q : searchTerm;
    const sTerm = st !== undefined ? st : selectedStatus;
    const spTerm = sp !== undefined ? sp : selectedSpecialty;

    try {
      const res = await listDoctors(request, {
        limit: 100,
        status: sTerm,
        specialtyId: spTerm,
        q: qTerm.trim() || undefined,
      });
      const doctorList = (res.data ?? []).map((d) => {
        const photo = getDoctorPhoto(d);
        if (photo && d.profile && d.profile.photoUrl !== photo) {
          return {
            ...d,
            profile: {
              ...d.profile,
              photoUrl: photo,
            },
          };
        }
        return d;
      });
      setDoctors(doctorList);
      registerDoctorBatchToCache(doctorList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách bác sĩ.';
      if (!msg.includes('longer than') && !msg.includes('2 character')) {
        setError(msg);
      }
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, [request, selectedStatus, selectedSpecialty, searchTerm]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleResetDoctors = () => {
    setSearchTerm('');
    setSelectedStatus(undefined);
    setSelectedSpecialty(undefined);
    setError('');
    void loadData('', undefined, undefined);
  };

  // Xem chi tiết bác sĩ
  const handleOpenDetail = async (record: DoctorItem) => {
    const initialPhone = getDoctorPhone(record);
    setSelectedDoctor({
      ...record,
      phoneNumber: initialPhone,
    });
    setDetailDrawerOpen(true);
    try {
      const full = await getDoctor(request, record.id);
      let accountEmail = record.email ?? null;

      if (full.accountId) {
        try {
          const authUser = await getAdminUser(request, full.accountId);
          if (authUser?.email) {
            accountEmail = authUser.email;
          }
        } catch {
          // ignore error if cannot fetch auth account
        }
      }

      const resolvedPhone = getDoctorPhone({ ...full, email: accountEmail ?? full.email });
      const resolvedPhoto = getDoctorPhoto(full);

      setSelectedDoctor({
        ...full,
        email: accountEmail,
        phoneNumber: resolvedPhone,
        profile: {
          ...full.profile,
          photoUrl: resolvedPhoto || full.profile?.photoUrl,
        },
      });
    } catch {
      // giữ nguyên record ban đầu nếu gọi full bị lỗi
    }
  };

  // Mở modal chỉnh sửa
  const openEditModal = async (record: DoctorItem) => {
    let currentDoctor = record;
    try {
      const fresh = await getDoctor(request, record.id);
      if (fresh) currentDoctor = fresh;
    } catch {
      // ignore
    }
    const resolvedPhoto = getDoctorPhoto(currentDoctor);
    setEditingDoctor(currentDoctor);
    setEditPhotoUrl(resolvedPhoto);
    const primarySpecialtyId =
      currentDoctor.specialties?.find((s) => s.isPrimary)?.id ?? currentDoctor.specialties?.[0]?.id;
    let resolvedEmail = currentDoctor.email || undefined;
    let resolvedPhone = getDoctorPhone(currentDoctor);

    // Điền ngay thông tin sơ bộ trước
    editForm.setFieldsValue({
      email: resolvedEmail,
      phoneNumber: resolvedPhone,
      licenseNumber: currentDoctor.licenseNumber,
      consultationRank: currentDoctor.consultationRank,
      specialtyId: primarySpecialtyId,
      profile: {
        fullName: currentDoctor.profile?.fullName,
        professionalTitle: currentDoctor.profile?.professionalTitle ?? '',
        biography: currentDoctor.profile?.biography ?? '',
        practiceStartYear: currentDoctor.profile?.practiceStartYear ?? undefined,
        photoUrl: currentDoctor.profile?.photoUrl ?? '',
      },
    } as any);
    setEditModalOpen(true);

    // Nếu record chưa có email hoặc phone, gọi API lấy thêm từ auth-service
    if (!resolvedEmail && record.accountId) {
      try {
        const authUser = await getAdminUser(request, record.accountId);
        if (authUser?.email) {
          resolvedEmail = authUser.email;
          if (!resolvedPhone) {
            resolvedPhone = getDoctorPhone({ ...record, email: authUser.email });
          }
          editForm.setFieldsValue({
            email: resolvedEmail,
            phoneNumber: resolvedPhone,
          } as any);
          setEditingDoctor((prev) => (prev ? { ...prev, email: resolvedEmail, phoneNumber: resolvedPhone } : prev));
        }
      } catch {
        // ignore
      }
    }
  };

  // Mở modal xóa bác sĩ
  const openDeleteModal = (record: DoctorItem) => {
    setDoctorToDelete(record);
    setDeleteModalOpen(true);
  };

  // Mở modal đổi trạng thái (Tạm khóa / Kích hoạt)
  const openStatusModal = (record: DoctorItem) => {
    setStatusTargetDoctor(record);
    setDeactivateReason('');
    setStatusModalOpen(true);
  };

  // Xử lý tạo mới bác sĩ
  const handleCreate = async (values: CreateDoctorPayload & { specialtyId?: string }) => {
    // Kiểm tra validation giữa Hạng tư vấn và Năm bắt đầu hành nghề
    const createRankCode = values.consultationRank;
    const createStartYear =
      values.profile?.practiceStartYear !== undefined && values.profile?.practiceStartYear !== null
        ? Number(values.profile.practiceStartYear)
        : undefined;

    if (createRankCode && createStartYear) {
      const rankConfig = consultationRanks.find((r) => r.code === createRankCode);
      if (rankConfig && rankConfig.experienceYearsMin > 0) {
        const currentYear = new Date().getFullYear();
        const actualExperienceYears = Math.max(0, currentYear - createStartYear);
        const minYears = rankConfig.experienceYearsMin;

        if (actualExperienceYears < minYears) {
          setFeedback({
            open: true,
            type: 'error',
            title: 'Tạo bác sĩ thất bại!',
            description: `Hạng được chọn yêu cầu tối thiểu ${minYears} năm kinh nghiệm, nhưng bác sĩ hiện chỉ có ${actualExperienceYears} năm (hành nghề từ năm ${createStartYear}).`,
          });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const created = await createDoctor(request, {
        email: values.email,
        phoneNumber: values.phoneNumber,
        licenseNumber: values.licenseNumber,
        consultationRank: values.consultationRank,
        profile: {
          fullName: values.profile.fullName,
          professionalTitle: values.profile.professionalTitle || undefined,
          biography: values.profile.biography || undefined,
          practiceStartYear: values.profile.practiceStartYear || undefined,
        },
      });

      registerDoctorToCache(created.id, values.email || created.profile.fullName);
      if (created.accountId && values.email) {
        registerDoctorToCache(created.accountId, values.email);
      }

      const createMatchedSpec = values.specialtyId ? specialties.find((s) => s.id === values.specialtyId) : undefined;
      setDoctorContext(created.id, {
        phoneNumber: values.phoneNumber,
        specialtyName: createMatchedSpec ? `${createMatchedSpec.name} (${createMatchedSpec.code})` : undefined,
      });

      if (values.specialtyId) {
        try {
          await linkDoctorSpecialty(request, created.id, values.specialtyId, true);
        } catch (linkErr) {
          console.warn('Could not link specialty immediately:', linkErr);
        }
      }

      if (values.phoneNumber) {
        saveDoctorPhone(created.id, created.accountId, values.phoneNumber);
      }

      createForm.resetFields();
      setCreateModalOpen(false);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Tạo bác sĩ thành công!',
        description: `Bác sĩ ${created.profile.fullName} đã được thêm vào hệ thống cùng tài khoản đăng nhập (${values.email}).`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Tạo bác sĩ thất bại!',
        description: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo bác sĩ mới.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý cập nhật thông tin bác sĩ
  const handleEdit = async (values: UpdateDoctorPayload & { specialtyId?: string }) => {
    if (!editingDoctor) return;

    // Kiểm tra validation 2 chiều giữa Hạng tư vấn và Năm bắt đầu hành nghề
    const targetRankCode = values.consultationRank ?? editingDoctor.consultationRank;
    const targetPracticeStartYear =
      values.profile?.practiceStartYear !== undefined && values.profile?.practiceStartYear !== null
        ? Number(values.profile.practiceStartYear)
        : editingDoctor.profile?.practiceStartYear;

    if (targetRankCode && targetPracticeStartYear) {
      const rankConfig = consultationRanks.find((r) => r.code === targetRankCode);
      if (rankConfig && rankConfig.experienceYearsMin > 0) {
        const currentYear = new Date().getFullYear();
        const actualExperienceYears = Math.max(0, currentYear - targetPracticeStartYear);
        const minYears = rankConfig.experienceYearsMin;

        if (actualExperienceYears < minYears) {
          const isRankChanged =
            values.consultationRank !== undefined &&
            values.consultationRank !== editingDoctor.consultationRank;
          const isYearChanged =
            values.profile?.practiceStartYear !== undefined &&
            values.profile?.practiceStartYear !== editingDoctor.profile?.practiceStartYear;

          let errorMessage: string;
          if (isRankChanged && !isYearChanged) {
            errorMessage = `Hạng được chọn yêu cầu tối thiểu ${minYears} năm kinh nghiệm, nhưng bác sĩ hiện chỉ có ${actualExperienceYears} năm (hành nghề từ năm ${targetPracticeStartYear}).`;
          } else if (isYearChanged && !isRankChanged) {
            errorMessage = `Năm bắt đầu hành nghề (${targetPracticeStartYear}) không thỏa mãn điều kiện kinh nghiệm tối thiểu (${minYears} năm) của hạng hiện tại (${rankConfig.name}).`;
          } else {
            errorMessage = `Hạng được chọn yêu cầu tối thiểu ${minYears} năm kinh nghiệm, nhưng bác sĩ hiện chỉ có ${actualExperienceYears} năm (hành nghề từ năm ${targetPracticeStartYear}).`;
          }

          setFeedback({
            open: true,
            type: 'error',
            title: 'Cập nhật thất bại!',
            description: errorMessage,
          });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const finalPhotoUrl =
        editPhotoUrl !== undefined ? editPhotoUrl : values.profile?.photoUrl;

      const payload: UpdateDoctorPayload = {
        consultationRank: values.consultationRank,
        licenseNumber: values.licenseNumber,
        profile: {
          fullName: values.profile?.fullName,
          professionalTitle: values.profile?.professionalTitle || undefined,
          biography: values.profile?.biography || undefined,
          practiceStartYear: values.profile?.practiceStartYear || undefined,
          photoUrl: finalPhotoUrl || undefined,
        },
      };

      const targetEmail = values.email || editingDoctor.email || editingDoctor.profile?.fullName || '';
      if (targetEmail) {
        registerDoctorToCache(editingDoctor.id, targetEmail);
      }

      // Lưu context (SĐT, Tên chuyên khoa) để Audit Log tự động gắn kèm
      const matchedSpecialty = values.specialtyId ? specialties.find((s) => s.id === values.specialtyId) : undefined;
      setDoctorContext(editingDoctor.id, {
        phoneNumber: values.phoneNumber !== undefined ? values.phoneNumber : (editingDoctor.phoneNumber || undefined),
        specialtyName: matchedSpecialty ? `${matchedSpecialty.name} (${matchedSpecialty.code})` : undefined,
      });

      const updated = await updateDoctor(request, editingDoctor.id, editingDoctor.version, payload);

      if (values.specialtyId) {
        try {
          // 1. Gán chuyên khoa mới làm chuyên khoa chính
          await linkDoctorSpecialty(request, editingDoctor.id, values.specialtyId, true);

          // 2. Hủy liên kết tất cả các chuyên khoa cũ khác để bác sĩ chỉ có duy nhất 1 chuyên khoa
          const oldSpecialties = editingDoctor.specialties || [];
          for (const oldSpec of oldSpecialties) {
            if (oldSpec.id !== values.specialtyId) {
              try {
                await unlinkDoctorSpecialty(request, editingDoctor.id, oldSpec.id);
              } catch (unlinkErr) {
                console.warn(`Could not unlink old specialty ${oldSpec.id}:`, unlinkErr);
              }
            }
          }
        } catch (linkErr) {
          console.warn('Could not update specialty link:', linkErr);
        }
      }

      // Cập nhật số điện thoại và ảnh đại diện
      if (values.phoneNumber !== undefined) {
        saveDoctorPhone(editingDoctor.id, editingDoctor.accountId, values.phoneNumber);
      }
      if (finalPhotoUrl !== undefined) {
        saveDoctorPhoto(editingDoctor.id, editingDoctor.accountId, finalPhotoUrl);
      }

      // Cập nhật email nếu có thay đổi và có accountId
      let finalEmail = values.email || editingDoctor.email;
      if (values.email && values.email !== editingDoctor.email && editingDoctor.accountId) {
        try {
          await updateAdminUser(request, editingDoctor.accountId, { email: values.email.trim() }, { suppressAudit: true });
          finalEmail = values.email.trim();
        } catch (authErr) {
          console.warn('Could not update auth email:', authErr);
        }
      }

      editForm.resetFields();
      setEditModalOpen(false);
      setEditingDoctor(null);
      setEditPhotoUrl(undefined);
      if (selectedDoctor?.id === editingDoctor.id) {
        setSelectedDoctor({
          ...updated,
          email: finalEmail,
          phoneNumber: values.phoneNumber !== undefined ? values.phoneNumber : selectedDoctor.phoneNumber,
          profile: {
            ...updated.profile,
            photoUrl: finalPhotoUrl || updated.profile?.photoUrl,
          },
        });
      }
      setFeedback({
        open: true,
        type: 'success',
        title: 'Cập nhật thành công!',
        description: `Thông tin bác sĩ ${updated.profile?.fullName} đã được cập nhật thành công.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Cập nhật thất bại!',
        description: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi cập nhật thông tin bác sĩ.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý xác nhận xóa bác sĩ
  const handleConfirmDelete = async () => {
    if (!doctorToDelete) return;
    setDeleting(true);
    try {
      const delEmail = doctorToDelete.email || doctorToDelete.profile?.fullName || '';
      if (delEmail) {
        registerDoctorToCache(doctorToDelete.id, delEmail);
      }
      await deleteDoctor(request, doctorToDelete.id);
      if (doctorToDelete.accountId) {
        try {
          await deleteAdminUser(request, doctorToDelete.accountId, { suppressAudit: true });
        } catch (authErr) {
          console.warn('Could not delete auth user account directly:', authErr);
        }
      }
      const name = doctorToDelete.profile?.fullName || 'Bác sĩ';
      setDeleteModalOpen(false);
      if (selectedDoctor?.id === doctorToDelete.id) {
        setDetailDrawerOpen(false);
        setSelectedDoctor(null);
      }
      setDoctorToDelete(null);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa bác sĩ thành công!',
        description: `Hồ sơ bác sĩ ${name} và tài khoản đăng nhập đã được xóa hoàn toàn khỏi hệ thống.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Xóa bác sĩ thất bại!',
        description: err instanceof Error ? err.message : 'Không thể xóa hồ sơ bác sĩ.',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Xử lý kích hoạt hoặc tạm khóa hoạt động bác sĩ (Đồng bộ tài khoản Auth)
  const handleToggleStatus = async () => {
    if (!statusTargetDoctor) return;
    setTogglingStatus(true);
    const isActivating = statusTargetDoctor.status !== 'ACTIVE';
      if (!isActivating && (!deactivateReason || deactivateReason.trim().length < 3)) {
        setFeedback({
          open: true,
          type: 'error',
          title: 'Thiếu lý do tạm khóa!',
          description: 'Vui lòng nhập lý do tạm khóa bác sĩ (tối thiểu 3 ký tự).',
        });
        setTogglingStatus(false);
        return;
      }

    try {
      const docEmail = statusTargetDoctor.email || statusTargetDoctor.profile?.fullName || '';
      if (docEmail) {
        registerDoctorToCache(statusTargetDoctor.id, docEmail);
      }

      let updated: DoctorItem;
      if (isActivating) {
        // Nếu kích hoạt bác sĩ: Phải mở khóa tài khoản Auth sang ACTIVE trước
        // để bước verifyAccount(doctor.accountId) trong backend doctor-service kiểm tra thành công!
        // Thêm suppressAudit: true để không sinh ra log trùng "Kích hoạt tài khoản" bên cạnh "Kích hoạt bác sĩ"
        if (statusTargetDoctor.accountId) {
          try {
            await updateAdminUser(request, statusTargetDoctor.accountId, { status: 'ACTIVE' }, { suppressAudit: true });
          } catch (authErr) {
            console.warn('Could not pre-activate auth user account:', authErr);
          }
        }
        updated = await activateDoctor(request, statusTargetDoctor.id, statusTargetDoctor.version);
      } else {
        updated = await deactivateDoctor(
          request,
          statusTargetDoctor.id,
          statusTargetDoctor.version,
          deactivateReason.trim(),
        );
        // Nếu tạm khóa bác sĩ: Sau khi tạm khóa bác sĩ, đồng bộ khóa tài khoản Auth sang LOCKED
        // Thêm suppressAudit: true để không sinh ra log trùng "Khóa tài khoản" bên cạnh "Tạm khóa bác sĩ"
        if (statusTargetDoctor.accountId) {
          try {
            await updateAdminUser(request, statusTargetDoctor.accountId, { status: 'LOCKED' }, { suppressAudit: true });
          } catch (authErr) {
            console.warn('Could not sync auth user account status to LOCKED:', authErr);
          }
        }
      }

      setStatusModalOpen(false);
      if (selectedDoctor?.id === statusTargetDoctor.id) {
        setSelectedDoctor(updated);
      }
      setStatusTargetDoctor(null);
      const docName = updated.profile?.fullName || statusTargetDoctor.profile?.fullName || 'Bác sĩ';
      setFeedback({
        open: true,
        type: 'success',
        title: isActivating ? 'Kích hoạt bác sĩ thành công!' : 'Tạm khóa bác sĩ thành công!',
        description: `Trạng thái của bác sĩ ${docName} và tài khoản đăng nhập đã được chuyển sang ${
          isActivating ? 'HOẠT ĐỘNG' : 'TẠM KHÓA'
        }.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: isActivating ? 'Kích hoạt thất bại!' : 'Tạm khóa thất bại!',
        description: err instanceof Error ? err.message : 'Không thể thay đổi trạng thái bác sĩ.',
      });
    } finally {
      setTogglingStatus(false);
    }
  };

  const columns: ColumnsType<DoctorItem> = [
    {
      title: 'Bác sĩ',
      key: 'name',
      render: (_, record) => (
        <Space size="middle" align="center">
          <Avatar
            size={42}
            src={record.profile?.photoUrl}
            style={{ backgroundColor: '#0284c7', verticalAlign: 'middle', fontWeight: 700 }}
          >
            {record.profile?.fullName ? record.profile.fullName[0].toUpperCase() : 'B'}
          </Avatar>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>
                {record.profile?.fullName}
              </span>
              {record.profile?.professionalTitle && (
                <Tag color="blue" variant="filled" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                  {record.profile.professionalTitle}
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Mã: <span className="admin-code" style={{ padding: '0 4px', fontSize: 10 }}>{record.id.slice(0, 8)}…</span>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Số CCHN',
      dataIndex: 'licenseNumber',
      key: 'licenseNumber',
      width: 140,
      render: (licenseNumber: string) =>
        licenseNumber && licenseNumber.trim() ? (
          <span className="admin-code" style={{ fontWeight: 600 }}>{licenseNumber}</span>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa cấp</span>
        ),
    },
    {
      title: 'Chuyên khoa',
      key: 'specialties',
      width: 180,
      render: (_, record) => {
        if (!record.specialties || record.specialties.length === 0) {
          return <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa phân chuyên khoa</span>;
        }
        return (
          <Space wrap size={[4, 4]}>
            {record.specialties.map((s) => (
              <Tag key={s.id} color="cyan" variant="filled">
                {s.name}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: DoctorStatus) => <StatusTag status={status} />,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 175,
      align: 'center',
      render: (_, record) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                icon={<EyeOutlined style={{ color: 'var(--accent)' }} />}
                onClick={() => void handleOpenDetail(record)}
              />
            </Tooltip>
            {record.status === 'ACTIVE' ? (
              <Tooltip title="Tạm khóa bác sĩ">
                <Button
                  type="text"
                  icon={<PauseCircleOutlined style={{ color: '#fa8c16' }} />}
                  onClick={() => openStatusModal(record)}
                />
              </Tooltip>
            ) : (
              <Tooltip title="Kích hoạt bác sĩ">
                <Button
                  type="text"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => openStatusModal(record)}
                />
              </Tooltip>
            )}
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<EditOutlined style={{ color: 'var(--deep)' }} />}
                onClick={() => void openEditModal(record)}
              />
            </Tooltip>
            <Tooltip title="Xóa bác sĩ">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => openDeleteModal(record)}
              />
            </Tooltip>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Main Table Card */}
      <div className="admin-table-card">
        {/* Search and Action Bar */}
        <div className="admin-toolbar">
          <Space wrap size="middle">
            <Input
              placeholder="Tìm theo tên bác sĩ, số CCHN..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onPressEnter={() => void loadData()}
              style={{ width: 260 }}
              allowClear
            />
            {specialties.length > 0 && (
              <Select
                placeholder="Lọc chuyên khoa"
                value={selectedSpecialty}
                onChange={(val) => {
                  setSelectedSpecialty(val);
                }}
                allowClear
                style={{ width: 200 }}
              >
                {specialties.map((sp) => (
                  <Select.Option key={sp.id} value={sp.id}>
                    {sp.name}
                  </Select.Option>
                ))}
              </Select>
            )}
            <Select
              placeholder="Lọc trạng thái"
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              allowClear
              style={{ width: 170 }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  <Space>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor:
                          opt.value === 'ACTIVE'
                            ? '#52c41a'
                            : opt.value === 'INACTIVE'
                            ? '#ff4d4f'
                            : '#8c8c8c',
                      }}
                    />
                    <span>{opt.label}</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={handleResetDoctors} loading={loading}>
              Làm mới
            </Button>
          </Space>

          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ background: '#0284c7' }}
              onClick={() => {
                createForm.resetFields();
                createForm.setFieldsValue({
                  consultationRank: availableRankOptions[0]?.value || ('BASIC' as DoctorConsultationRank),
                });
                setCreateModalOpen(true);
              }}
            >
              Thêm bác sĩ
            </Button>
          </Space>
        </div>

        {error && (
          <Alert
            type="error"
            showIcon
            title="Không thể tải danh sách bác sĩ"
            description={error}
            action={<Button size="small" onClick={() => void loadData()}>Thử lại</Button>}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Main Doctors Table */}
        <Table<DoctorItem>
          rowKey="id"
          columns={columns}
          dataSource={doctors}
          loading={loading}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (totalCount) => `Tổng cộng ${totalCount} bác sĩ`,
          }}
          onRow={(record) => ({
            onClick: (e) => {
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('.ant-tooltip')) return;
              void handleOpenDetail(record);
            },
            className: 'admin-row-clickable',
          })}
        />
      </div>

      {/* Drawer Chi tiết bác sĩ */}
      <Drawer
        title="Hồ sơ chi tiết bác sĩ"
        placement="right"
        width={540}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        destroyOnClose
      >
        {selectedDoctor && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 18px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <Avatar
                size={64}
                src={selectedDoctor.profile?.photoUrl}
                style={{ backgroundColor: '#0284c7', fontSize: 24, fontWeight: 700 }}
              >
                {selectedDoctor.profile?.fullName ? selectedDoctor.profile.fullName[0].toUpperCase() : 'B'}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Typography.Title level={5} style={{ margin: 0, color: 'var(--fg)', fontSize: 17 }}>
                    {selectedDoctor.profile?.fullName}
                  </Typography.Title>
                  {selectedDoctor.profile?.professionalTitle && (
                    <Tag color="blue" variant="filled" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
                      {selectedDoctor.profile.professionalTitle}
                    </Tag>
                  )}
                </div>
                <Space size={6} style={{ marginTop: 8 }} wrap>
                  <Tag color="purple">
                    {consultationRanks.find((r) => r.code === selectedDoctor.consultationRank)?.name ||
                      RANK_LABELS[selectedDoctor.consultationRank] ||
                      selectedDoctor.consultationRank}
                  </Tag>
                  <StatusTag status={selectedDoctor.status} />
                </Space>
              </div>
            </div>

            <Descriptions
              title="Thông tin hành nghề & Liên hệ"
              bordered
              column={1}
              size="middle"
              items={[
                {
                  key: 'email',
                  label: 'Email',
                  children: selectedDoctor.email ? (
                    <Space size={6}>
                      <MailOutlined style={{ color: '#1677ff' }} />
                      <strong style={{ color: '#1677ff' }}>{selectedDoctor.email}</strong>
                    </Space>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Chưa cập nhật</span>
                  ),
                },
                {
                  key: 'phone',
                  label: 'Số điện thoại',
                  children: selectedDoctor.phoneNumber ? (
                    <Tag color="green" icon={<PhoneOutlined />} style={{ fontSize: 13, fontWeight: 600 }}>
                      {formatPhoneNumber(selectedDoctor.phoneNumber)}
                    </Tag>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Chưa cập nhật</span>
                  ),
                },
                {
                  key: 'licenseNumber',
                  label: 'Số CCHN',
                  children: (
                    <span className="admin-code" style={{ fontWeight: 600 }}>
                      {selectedDoctor.licenseNumber || 'Chưa cấp'}
                    </span>
                  ),
                },
                {
                  key: 'consultationRank',
                  label: 'Hạng tư vấn',
                  children: (
                    <Tag color="purple">
                      {consultationRanks.find((r) => r.code === selectedDoctor.consultationRank)?.name ||
                        RANK_LABELS[selectedDoctor.consultationRank] ||
                        selectedDoctor.consultationRank}
                    </Tag>
                  ),
                },
                {
                  key: 'specialties',
                  label: 'Chuyên khoa',
                  children:
                    selectedDoctor.specialties && selectedDoctor.specialties.length > 0 ? (
                      <Space wrap>
                        {selectedDoctor.specialties.map((s) => (
                          <Tag key={s.id} color="cyan">{s.name}</Tag>
                        ))}
                      </Space>
                    ) : (
                      'Chưa phân chuyên khoa'
                    ),
                },
                {
                  key: 'practiceStartYear',
                  label: 'Năm bắt đầu hành nghề',
                  children: selectedDoctor.profile?.practiceStartYear
                    ? `${selectedDoctor.profile.practiceStartYear} (Khoảng ${new Date().getFullYear() - selectedDoctor.profile.practiceStartYear} năm kinh nghiệm)`
                    : 'Chưa cập nhật',
                },
                {
                  key: 'biography',
                  label: 'Giới thiệu',
                  children: selectedDoctor.profile?.biography || 'Chưa cập nhật',
                },
              ]}
            />

            <Divider style={{ margin: '24px 0 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {selectedDoctor.status === 'ACTIVE' ? (
                <Button
                  style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
                  icon={<PauseCircleOutlined />}
                  onClick={() => openStatusModal(selectedDoctor)}
                >
                  Tạm khóa
                </Button>
              ) : (
                <Button
                  style={{ color: '#52c41a', borderColor: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => openStatusModal(selectedDoctor)}
                >
                  Kích hoạt
                </Button>
              )}
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  const d = selectedDoctor;
                  setDetailDrawerOpen(false);
                  void openEditModal(d);
                }}
              >
                Chỉnh sửa
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  const d = selectedDoctor;
                  setDetailDrawerOpen(false);
                  openDeleteModal(d);
                }}
              >
                Xóa bác sĩ
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal Thêm bác sĩ mới */}
      <Modal
        title="Thêm bác sĩ mới"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
        width={620}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ consultationRank: availableRankOptions[0]?.value || 'BASIC' }}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name={['profile', 'fullName']}
              label="Họ và tên bác sĩ"
              rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
            >
              <Input placeholder="ví dụ: Nguyễn Văn A" />
            </Form.Item>

            <Form.Item
              name={['profile', 'professionalTitle']}
              label="Học hàm / Học vị"
            >
              <Input placeholder="ví dụ: ThS. BS, PGS. TS" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="email"
              label="Email đăng nhập"
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không đúng định dạng' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="bacsi@antam.vn" />
            </Form.Item>

            <Form.Item
              name="phoneNumber"
              label="Số điện thoại"
              rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="0901234567" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="licenseNumber"
              label="Số chứng chỉ hành nghề"
              rules={[{ required: true, message: 'Vui lòng nhập số CCHN' }]}
            >
              <Input placeholder="ví dụ: VN-123456" />
            </Form.Item>

            <Form.Item
              name="consultationRank"
              label="Hạng tư vấn"
              rules={[{ required: true, message: 'Vui lòng chọn hạng' }]}
            >
              <Select options={availableRankOptions} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="specialtyId"
              label="Chuyên khoa chính"
              rules={[{ required: true, message: 'Vui lòng chọn chuyên khoa' }]}
            >
              <Select
                placeholder="Chọn chuyên khoa"
                options={specialties.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Form.Item>

            <Form.Item
              name={['profile', 'practiceStartYear']}
              label="Năm bắt đầu hành nghề"
            >
              <InputNumber
                min={1970}
                max={new Date().getFullYear()}
                style={{ width: '100%' }}
                placeholder="ví dụ: 2012"
              />
            </Form.Item>
          </div>

          <Form.Item name={['profile', 'biography']} label="Tiểu sử / Quá trình công tác">
            <Input.TextArea rows={3} placeholder="Mô tả quá trình đào tạo và kinh nghiệm công tác..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Tạo bác sĩ
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa thông tin bác sĩ */}
      <Modal
        title={`Chỉnh sửa hồ sơ: ${editingDoctor?.profile?.fullName ?? ''}`}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingDoctor(null);
        }}
        footer={null}
        destroyOnClose
        centered
        width={620}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          {/* Avatar Upload */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <Form.Item name={['profile', 'photoUrl']} noStyle>
              <DoctorPhotoUpload
                value={editPhotoUrl ?? editingDoctor?.profile?.photoUrl ?? undefined}
                doctorName={editingDoctor?.profile?.fullName}
                onChange={(newUrl) => {
                  setEditPhotoUrl(newUrl);
                  editForm.setFieldValue(['profile', 'photoUrl'], newUrl);
                }}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name={['profile', 'fullName']}
              label="Họ và tên bác sĩ"
              rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item name={['profile', 'professionalTitle']} label="Học hàm / Học vị">
              <Input placeholder="ví dụ: BSCKI, ThS.BS..." />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="email"
              label="Email đăng nhập"
              rules={[{ type: 'email', message: 'Email không đúng định dạng' }]}
            >
              <Input prefix={<MailOutlined />} placeholder="bacsi@antam.vn" />
            </Form.Item>

            <Form.Item
              name="phoneNumber"
              label="Số điện thoại"
            >
              <Input prefix={<PhoneOutlined />} placeholder="0901234567" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="licenseNumber"
              label="Số CCHN"
              rules={[{ required: true, message: 'Vui lòng nhập số CCHN' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="consultationRank"
              label="Hạng tư vấn"
              rules={[{ required: true, message: 'Vui lòng chọn hạng' }]}
            >
              <Select options={availableRankOptions} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="specialtyId" label="Chuyên khoa chính">
              <Select
                placeholder="Chọn chuyên khoa"
                options={specialties.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Form.Item>

            <Form.Item
              name={['profile', 'practiceStartYear']}
              label="Năm bắt đầu hành nghề"
            >
              <InputNumber
                min={1970}
                max={new Date().getFullYear()}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>

          <Form.Item name={['profile', 'biography']} label="Tiểu sử / Quá trình công tác">
            <Input.TextArea rows={3} placeholder="Mô tả tiểu sử bác sĩ" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingDoctor(null);
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Lưu thay đổi
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Xác nhận Xóa bác sĩ */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Xác nhận xóa bác sĩ</span>
          </Space>
        }
        open={deleteModalOpen}
        centered
        onCancel={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setDoctorToDelete(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              danger
              type="primary"
              loading={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              Xóa
            </Button>
            <Button
              disabled={deleting}
              onClick={() => {
                setDeleteModalOpen(false);
                setDoctorToDelete(null);
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
            Bạn có chắc muốn xóa hồ sơ bác sĩ{' '}
            <strong>{doctorToDelete?.profile?.fullName || 'Bác sĩ'}</strong> (CCHN:{' '}
            {doctorToDelete?.licenseNumber})?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#cf1322', fontWeight: 500 }}>
            ⚠️ Thao tác này sẽ xóa vĩnh viễn hồ sơ bác sĩ và tài khoản người dùng đăng nhập trong Quản lý người dùng.
          </p>
        </div>
      </Modal>

      {/* Modal Tạm khóa / Kích hoạt bác sĩ */}
      <Modal
        title={
          <Space>
            {statusTargetDoctor?.status === 'ACTIVE' ? (
              <PauseCircleOutlined style={{ color: '#fa8c16' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <span>
              {statusTargetDoctor?.status === 'ACTIVE'
                ? 'Xác nhận tạm khóa bác sĩ'
                : 'Xác nhận kích hoạt bác sĩ'}
            </span>
          </Space>
        }
        open={statusModalOpen}
        centered
        onCancel={() => {
          if (!togglingStatus) {
            setStatusModalOpen(false);
            setStatusTargetDoctor(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              type="primary"
              style={
                statusTargetDoctor?.status === 'ACTIVE'
                  ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                  : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
              }
              loading={togglingStatus}
              disabled={togglingStatus || (statusTargetDoctor?.status === 'ACTIVE' && deactivateReason.trim().length < 3)}
              onClick={() => void handleToggleStatus()}
            >
              {statusTargetDoctor?.status === 'ACTIVE' ? 'Xác nhận tạm khóa' : 'Kích hoạt'}
            </Button>
            <Button
              disabled={togglingStatus}
              onClick={() => {
                setStatusModalOpen(false);
                setStatusTargetDoctor(null);
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
            {statusTargetDoctor?.status === 'ACTIVE' ? (
              <>
                Bạn có chắc muốn tạm khóa đối với bác sĩ{' '}
                <strong>{statusTargetDoctor?.profile.fullName}</strong>?
              </>
            ) : (
              <>
                Kích hoạt bác sĩ <strong>{statusTargetDoctor?.profile.fullName}</strong> để bắt đầu nhận lịch hẹn khám?
              </>
            )}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)' }}>
            {statusTargetDoctor?.status === 'ACTIVE'
              ? 'Khi tạm khóa bác sĩ, tài khoản đăng nhập của bác sĩ trong hệ thống cũng sẽ được chuyển sang trạng thái Tạm khóa.'
              : 'Sau khi kích hoạt, tài khoản của bác sĩ cũng sẽ được kích hoạt để đăng nhập và làm việc bình thường.'}
          </p>
          {statusTargetDoctor?.status === 'ACTIVE' && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
                Lý do tạm khóa (tối thiểu 3 ký tự):
              </label>
              <Input
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="Nhập lý do tạm khóa..."
              />
            </div>
          )}
        </div>
      </Modal>

      {/* AdminFeedbackModal */}
      <AdminFeedbackModal
        feedback={feedback}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}

export default AdminDoctorsPage;
