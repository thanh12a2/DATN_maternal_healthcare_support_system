import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
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
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  IdcardOutlined,
  MailOutlined,
  PauseCircleOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthSession } from '../../app/AuthSessionProvider';
import {
  createPatient,
  updatePatient,
  deletePatient,
  getPatient,
  searchPatients,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  reorderEmergencyContacts,
  type CreatePatientPayload,
  type PatientItem,
  type PatientEmergencyContact,
  type UpdatePatientPayload,
} from '../../services/adminPatients';
import { formatDateTime, formatPhoneNumber } from '../format';
import { updateAdminUser } from '../../services/adminUsers';
import { DoctorPhotoUpload } from '../components/DoctorPhotoUpload';
import { StatusTag } from '../components/StatusTag';
import {
  AdminFeedbackModal,
  type AdminFeedbackState,
} from '../components/AdminFeedbackModal';

export function AdminPatientsPage() {
  const { request } = useAuthSession();

  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [error, setError] = useState('');

  // Drawer detail state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientItem | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<PatientItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Status toggle modal state (Tạm khóa / Kích hoạt)
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTargetPatient, setStatusTargetPatient] = useState<PatientItem | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Animated feedback modal state (Stroke Check / Cross)
  const [feedback, setFeedback] = useState<AdminFeedbackState | null>(null);

  // Emergency contact modal state (Thêm / Chỉnh sửa người liên hệ)
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PatientEmergencyContact | null>(null);
  const [submittingContact, setSubmittingContact] = useState(false);
  const [reorderingContact, setReorderingContact] = useState(false);
  const [contactForm] = Form.useForm<{
    fullName: string;
    relationship: string;
    phoneNumber: string;
    isPrimary?: boolean;
  }>();

  const [createForm] = Form.useForm<{
    fullName: string;
    email: string;
    dateOfBirth: dayjs.Dayjs;
    phoneNumber: string;
    nationalId: string;
    address: string;
    photoUrl?: string;
  }>();

  const [editForm] = Form.useForm<{
    fullName: string;
    email: string;
    dateOfBirth: dayjs.Dayjs;
    phoneNumber: string;
    nationalId: string;
    address: string;
    photoUrl?: string;
  }>();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = searchQuery.trim();
      const isOnlyDigits = /^\d+$/.test(q);
      const res = await searchPatients(request, {
        page,
        limit: pageSize,
        query: q || undefined,
        phoneNumber: isOnlyDigits && q.length >= 10 && q.length <= 11 ? q : undefined,
        nationalId: isOnlyDigits && q.length === 12 ? q : undefined,
        fullName: !isOnlyDigits && q.length >= 2 ? q : undefined,
      });
      setPatients(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách bệnh nhân.';
      setError(msg);
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [request, page, pageSize, searchQuery]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Xem chi tiết bệnh nhân
  const handleOpenDetail = async (record: PatientItem) => {
    setSelectedPatient(record);
    setDetailDrawerOpen(true);
    try {
      const full = await getPatient(request, record.id);
      setSelectedPatient(full);
    } catch {
      // Giữ nguyên record ban đầu nếu gọi full bị lỗi
    }
  };

  // Mở modal chỉnh sửa
  const openEditModal = (record: PatientItem) => {
    setEditingPatient(record);
    const savedAvatar = typeof window !== 'undefined' ? localStorage.getItem(`patient_avatar_${record.id}`) : null;
    editForm.setFieldsValue({
      fullName: record.fullName,
      email: record.email ?? '',
      dateOfBirth: record.dateOfBirth ? dayjs(record.dateOfBirth) : undefined,
      phoneNumber: formatPhoneNumber(record.phoneNumber),
      nationalId: record.nationalId || record.nationalIdMasked || '',
      address: record.address ?? '',
      photoUrl: savedAvatar || undefined,
    });
    setEditModalOpen(true);
  };

  // Mở modal xóa bệnh nhân
  const openDeleteModal = (record: PatientItem) => {
    setPatientToDelete(record);
    setDeleteModalOpen(true);
  };

  // Mở modal đổi trạng thái (Tạm khóa / Kích hoạt)
  const openStatusModal = (record: PatientItem) => {
    setStatusTargetPatient(record);
    setDeactivateReason('');
    setStatusModalOpen(true);
  };

  // Xử lý kích hoạt hoặc tạm khóa tài khoản bệnh nhân
  const handleToggleStatus = async () => {
    if (!statusTargetPatient) return;
    if (!statusTargetPatient.authAccountId) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Chưa có tài khoản đăng nhập!',
        description: 'Bệnh nhân này đang ở dạng hồ sơ nháp (chưa có tài khoản). Vui lòng cập nhật email để tạo tài khoản trước.',
      });
      return;
    }
    setTogglingStatus(true);
    const isTargetLocked = statusTargetPatient.status === 'LOCKED' || statusTargetPatient.status === 'INACTIVE';
    const nextStatus = isTargetLocked ? 'ACTIVE' : 'LOCKED';
    const actionText = isTargetLocked ? 'Kích hoạt' : 'Tạm khóa';

    if (!isTargetLocked && (!deactivateReason || deactivateReason.trim().length < 3)) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Thiếu lý do tạm khóa!',
        description: 'Vui lòng nhập lý do tạm khóa bệnh nhân (tối thiểu 3 ký tự).',
      });
      setTogglingStatus(false);
      return;
    }

    try {
      await updateAdminUser(request, statusTargetPatient.authAccountId, { status: nextStatus });
      const targetName = statusTargetPatient.fullName;
      const targetId = statusTargetPatient.id;
      setStatusModalOpen(false);
      setStatusTargetPatient(null);
      if (selectedPatient?.id === targetId) {
        setSelectedPatient((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
      setFeedback({
        open: true,
        type: 'success',
        title: `${actionText} bệnh nhân thành công!`,
        description: `Hồ sơ và tài khoản của bệnh nhân ${targetName} đã được chuyển sang trạng thái ${
          nextStatus === 'LOCKED' ? 'TẠM KHÓA' : 'HOẠT ĐỘNG'
        }.`,
      });
      void loadData();
    } catch (err: unknown) {
      setStatusModalOpen(false);
      setFeedback({
        open: true,
        type: 'error',
        title: `${actionText} thất bại!`,
        description: err instanceof Error ? err.message : `Không thể ${actionText.toLowerCase()} tài khoản bệnh nhân này.`,
      });
    } finally {
      setTogglingStatus(false);
    }
  };

  // Xử lý tạo mới bệnh nhân
  const handleCreate = async (values: {
    fullName: string;
    email: string;
    dateOfBirth: dayjs.Dayjs;
    phoneNumber: string;
    nationalId: string;
    address: string;
    photoUrl?: string;
  }) => {
    setSubmitting(true);
    try {
      const payload: CreatePatientPayload = {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
        phoneNumber: formatPhoneNumber(values.phoneNumber),
        nationalId: values.nationalId.trim(),
        address: values.address.trim(),
      };
      const created = await createPatient(request, payload);
      if (typeof window !== 'undefined' && values.photoUrl && created.id) {
        localStorage.setItem(`patient_avatar_${created.id}`, values.photoUrl);
      }

      // Đưa tài khoản về Bản nháp (LOCKED/DRAFT) ngay sau khi tạo, đợi admin kích hoạt
      if (created.authAccountId) {
        try {
          await updateAdminUser(request, created.authAccountId, { status: 'LOCKED' });
        } catch (lockErr) {
          console.warn('Could not set initial patient account status to LOCKED:', lockErr);
        }
      }

      createForm.resetFields();
      setCreateModalOpen(false);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Tạo hồ sơ bệnh nhân thành công!',
        description: `Bệnh nhân ${created.fullName} đã được thêm vào hệ thống ở trạng thái "Bản nháp". Bạn có thể xem lại thông tin và bấm nút "Kích hoạt" khi sẵn sàng.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Tạo hồ sơ thất bại!',
        description: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo hồ sơ bệnh nhân.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý cập nhật thông tin bệnh nhân
  const handleEdit = async (values: {
    fullName: string;
    email: string;
    dateOfBirth: dayjs.Dayjs;
    phoneNumber: string;
    nationalId: string;
    address: string;
    photoUrl?: string;
  }) => {
    if (!editingPatient) return;
    setSubmitting(true);
    try {
      const payload: UpdatePatientPayload = {
        fullName: values.fullName.trim(),
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : undefined,
        phoneNumber: formatPhoneNumber(values.phoneNumber),
        nationalId: values.nationalId.trim(),
        address: values.address.trim(),
        version: editingPatient.version,
      };
      const updated = await updatePatient(request, editingPatient.id, payload);

      // Cập nhật email trong tài khoản auth-service nếu có tài khoản liên kết
      if (values.email && values.email.trim() && values.email.trim() !== (editingPatient.email || '')) {
        if (editingPatient.authAccountId) {
          try {
            await updateAdminUser(request, editingPatient.authAccountId, { email: values.email.trim() });
          } catch {
            // bỏ qua nếu cập nhật tài khoản auth thất bại
          }
        }
      }

      // Lưu ảnh đại diện vào localStorage theo patientId
      if (typeof window !== 'undefined') {
        if (values.photoUrl) {
          localStorage.setItem(`patient_avatar_${editingPatient.id}`, values.photoUrl);
        } else {
          localStorage.removeItem(`patient_avatar_${editingPatient.id}`);
        }
      }

      editForm.resetFields();
      setEditModalOpen(false);
      setEditingPatient(null);
      if (selectedPatient?.id === editingPatient.id) {
        setSelectedPatient({ ...updated, email: values.email.trim() });
      }
      setFeedback({
        open: true,
        type: 'success',
        title: 'Cập nhật thành công!',
        description: `Thông tin bệnh nhân ${updated.fullName} đã được cập nhật thành công.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Cập nhật thất bại!',
        description: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi cập nhật hồ sơ bệnh nhân.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý xác nhận xóa bệnh nhân
  const handleConfirmDelete = async () => {
    if (!patientToDelete) return;
    setDeleting(true);
    try {
      await deletePatient(request, patientToDelete.id);
      const name = patientToDelete.fullName;
      setDeleteModalOpen(false);
      if (selectedPatient?.id === patientToDelete.id) {
        setDetailDrawerOpen(false);
        setSelectedPatient(null);
      }
      setPatientToDelete(null);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa hồ sơ bệnh nhân thành công!',
        description: `Hồ sơ bệnh nhân ${name} đã được xóa hoàn toàn khỏi hệ thống.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Xóa bệnh nhân thất bại!',
        description: err instanceof Error ? err.message : 'Không thể xóa hồ sơ bệnh nhân.',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Emergency contact handlers
  const openCreateContact = () => {
    setEditingContact(null);
    contactForm.resetFields();
    contactForm.setFieldsValue({
      isPrimary: false,
    });
    setContactModalOpen(true);
  };

  const openEditContact = (c: PatientEmergencyContact) => {
    setEditingContact(c);
    contactForm.setFieldsValue({
      fullName: c.fullName,
      relationship: c.relationship,
      phoneNumber: formatPhoneNumber(c.phoneNumber),
      isPrimary: c.isPrimary,
    });
    setContactModalOpen(true);
  };

  const handleSubmitContact = async (values: {
    fullName: string;
    relationship: string;
    phoneNumber: string;
    isPrimary?: boolean;
  }) => {
    if (!selectedPatient) return;
    setSubmittingContact(true);
    try {
      const payload = {
        fullName: values.fullName.trim(),
        relationship: values.relationship.trim(),
        phoneNumber: formatPhoneNumber(values.phoneNumber),
        isPrimary: values.isPrimary ?? false,
      };

      if (editingContact) {
        await updateEmergencyContact(request, selectedPatient.id, editingContact.id, payload);
      } else {
        await createEmergencyContact(request, selectedPatient.id, payload);
      }

      setContactModalOpen(false);
      setEditingContact(null);
      contactForm.resetFields();

      // Refresh drawer data
      const refreshed = await getPatient(request, selectedPatient.id);
      setSelectedPatient(refreshed);
      void loadData();

      setFeedback({
        open: true,
        type: 'success',
        title: editingContact ? 'Cập nhật người liên hệ thành công!' : 'Thêm người liên hệ thành công!',
        description: `Thông tin người liên hệ (${values.fullName}) đã được lưu vào hồ sơ bệnh nhân.`,
      });
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Thao tác thất bại!',
        description: err instanceof Error ? err.message : 'Không thể lưu thông tin người liên hệ.',
      });
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!selectedPatient) return;
    try {
      await deleteEmergencyContact(request, selectedPatient.id, contactId);
      const refreshed = await getPatient(request, selectedPatient.id);
      setSelectedPatient(refreshed);
      void loadData();
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa người liên hệ thành công!',
        description: `Người liên hệ (${contactName}) đã được xóa khỏi hồ sơ.`,
      });
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Xóa người liên hệ thất bại!',
        description: err instanceof Error ? err.message : 'Không thể xóa người liên hệ.',
      });
    }
  };

  const handleMoveContact = async (currentIndex: number, direction: -1 | 1) => {
    if (!selectedPatient || !selectedPatient.emergencyContacts) return;
    const list = [...selectedPatient.emergencyContacts];
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    [list[currentIndex], list[targetIndex]] = [list[targetIndex], list[currentIndex]];
    const newContactIds = list.map((c) => c.id);

    setReorderingContact(true);
    try {
      await reorderEmergencyContacts(request, selectedPatient.id, newContactIds);
      const refreshed = await getPatient(request, selectedPatient.id);
      setSelectedPatient(refreshed);
      void loadData();
      setFeedback({
        open: true,
        type: 'success',
        title: 'Đã cập nhật thứ tự ưu tiên!',
        description: 'Thứ tự ưu tiên của danh bạ người liên hệ khẩn cấp đã được cập nhật thành công.',
      });
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Thay đổi thứ tự thất bại!',
        description: err instanceof Error ? err.message : 'Không thể cập nhật thứ tự ưu tiên liên hệ.',
      });
    } finally {
      setReorderingContact(false);
    }
  };
  const columns: ColumnsType<PatientItem> = [
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_, record) => {
        const name = record.fullName || 'Bệnh nhân';
        const words = name.trim().split(/\s+/);
        const initial = words.length > 0 ? words[words.length - 1].charAt(0).toUpperCase() : 'B';

        const savedAvatar = typeof window !== 'undefined' ? localStorage.getItem(`patient_avatar_${record.id}`) : null;
        return (
          <Space orientation="horizontal" size={12}>
            <Avatar
              size={42}
              src={savedAvatar || undefined}
              style={{
                backgroundColor: '#52c41a',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                verticalAlign: 'middle',
                flexShrink: 0,
              }}
            >
              {initial}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{record.fullName}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Mã: <span className="admin-code">{record.id.slice(0, 8)}...</span>
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Email đăng nhập',
      dataIndex: 'email',
      key: 'email',
      render: (email?: string | null) =>
        email ? (
          <Space size={6}>
            <MailOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 500 }}>{email}</span>
          </Space>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa có</span>
        ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      width: 170,
      render: (phone?: string) => {
        const formatted = formatPhoneNumber(phone);
        return formatted ? (
          <Tag color="green" icon={<PhoneOutlined />} style={{ fontSize: 13, fontWeight: 500, padding: '2px 8px' }}>
            {formatted}
          </Tag>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa có</span>
        );
      },
    },
    {
      title: 'Số CCCD / Định danh',
      key: 'nationalId',
      width: 145,
      render: (_, record) => {
        const nid = record.nationalId || record.nationalIdMasked;
        return nid ? (
          <span className="admin-code" style={{ fontWeight: 600 }}>{nid}</span>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Chưa cập nhật</span>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      align: 'center',
      render: (_, record) => {
        const rawStatus = record.status || (record.authAccountId ? 'ACTIVE' : 'DRAFT');
        return <StatusTag status={rawStatus} />;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      align: 'center',
      render: (_, record) => {
        const isLocked = record.status === 'LOCKED' || record.status === 'INACTIVE';
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Space size="small">
              <Tooltip title="Xem chi tiết">
                <Button
                  type="text"
                  icon={<EyeOutlined style={{ color: 'var(--accent)' }} />}
                  onClick={() => void handleOpenDetail(record)}
                />
              </Tooltip>
              {record.authAccountId && (
                isLocked ? (
                  <Tooltip title="Kích hoạt bệnh nhân">
                    <Button
                      type="text"
                      icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      onClick={() => openStatusModal(record)}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title="Tạm khóa bệnh nhân">
                    <Button
                      type="text"
                      icon={<PauseCircleOutlined style={{ color: '#fa8c16' }} />}
                      onClick={() => openStatusModal(record)}
                    />
                  </Tooltip>
                )
              )}
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<EditOutlined style={{ color: 'var(--deep)' }} />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
            <Tooltip title="Xóa bệnh nhân">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => openDeleteModal(record)}
              />
            </Tooltip>
          </Space>
        </div>
      );
    },
  },
];

  return (
    <div className="admin-table-card">
      {/* Search and Action Bar */}
      <div className="admin-toolbar">
        <Space wrap size="middle">
          <Input
            placeholder="Tra cứu theo họ tên, số điện thoại hoặc số CCCD..."
            prefix={<SearchOutlined style={{ color: '#1677ff' }} />}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            onPressEnter={() => {
              setPage(1);
              void loadData();
            }}
            style={{ width: 420 }}
            allowClear
          />
          <Select
            placeholder="Lọc trạng thái"
            allowClear
            value={selectedStatus || undefined}
            onChange={(val) => {
              setSelectedStatus(val ?? '');
              setPage(1);
            }}
            style={{ width: 170 }}
            options={[
              { label: 'Tất cả trạng thái', value: '' },
              { label: 'Hoạt động', value: 'ACTIVE' },
              { label: 'Tạm khóa', value: 'LOCKED' },
              { label: 'Bản nháp', value: 'DRAFT' },
            ]}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchQuery('');
              setSelectedStatus('');
              setPage(1);
              void loadData();
            }}
            loading={loading}
          >
            Làm mới
          </Button>
        </Space>

        <Space size={10}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ background: '#0284c7' }}
            onClick={() => {
              createForm.resetFields();
              setCreateModalOpen(true);
            }}
          >
            Thêm bệnh nhân
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Lỗi tải dữ liệu"
          description={error}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Main Patients Table */}
      {(() => {
        const displayedPatients = selectedStatus
          ? patients.filter((p) => {
              const st = p.status || (p.authAccountId ? 'ACTIVE' : 'DRAFT');
              if (selectedStatus === 'LOCKED') return st === 'LOCKED' || st === 'INACTIVE';
              return st === selectedStatus;
            })
          : patients;
        return (
          <Table<PatientItem>
            rowKey="id"
            columns={columns}
            dataSource={displayedPatients}
            loading={loading}
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize,
              total: selectedStatus ? displayedPatients.length : total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
              showTotal: (totalCount) => `Tổng cộng ${totalCount} bệnh nhân`,
            }}
            onRow={(record) => ({
              onClick: (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('.ant-tooltip')) return;
                void handleOpenDetail(record);
              },
              style: { cursor: 'pointer' },
            })}
          />
        );
      })()}

      {/* Drawer Chi tiết bệnh nhân (trượt từ phải sang) */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              size={48}
              src={typeof window !== 'undefined' && selectedPatient ? localStorage.getItem(`patient_avatar_${selectedPatient.id}`) || undefined : undefined}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#52c41a' }}
            >
              {selectedPatient?.fullName?.charAt(0)?.toUpperCase()}
            </Avatar>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>
                  {selectedPatient?.fullName}
                </span>
                <StatusTag status={selectedPatient?.status || (selectedPatient?.authAccountId ? 'ACTIVE' : 'DRAFT')} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                SĐT: <span className="admin-code">{formatPhoneNumber(selectedPatient?.phoneNumber)}</span>
              </div>
            </div>
          </div>
        }
        placement="right"
        width={560}
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedPatient(null);
        }}
        destroyOnClose
      >
        {selectedPatient && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              <Descriptions
                bordered
                column={1}
                size="small"
                labelStyle={{ width: '38%', fontWeight: 600, color: 'var(--fg-muted)' }}
              >
                <Descriptions.Item label="Mã bệnh nhân">
                  <span className="admin-code" style={{ wordBreak: 'break-all' }}>
                    {selectedPatient.id}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Họ và tên">
                  <strong>{selectedPatient.fullName}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <StatusTag status={selectedPatient.status || (selectedPatient.authAccountId ? 'ACTIVE' : 'DRAFT')} />
                </Descriptions.Item>
                <Descriptions.Item label="Email đăng nhập">
                  {selectedPatient.email ? (
                    <Space size={6}>
                      <MailOutlined style={{ color: '#1677ff' }} />
                      <strong style={{ color: '#1677ff' }}>{selectedPatient.email}</strong>
                    </Space>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Chưa liên kết</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                  <Tag color="green" icon={<PhoneOutlined />} style={{ fontSize: 13, fontWeight: 600 }}>
                    {formatPhoneNumber(selectedPatient.phoneNumber)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">
                  {selectedPatient.dateOfBirth ? (
                    <span>
                      {dayjs(selectedPatient.dateOfBirth).format('DD/MM/YYYY')} (
                      {dayjs().diff(dayjs(selectedPatient.dateOfBirth), 'year')} tuổi)
                    </span>
                  ) : (
                    'Chưa cập nhật'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Số CCCD / Định danh">
                  {selectedPatient.nationalId || selectedPatient.nationalIdMasked ? (
                    <span className="admin-code" style={{ fontWeight: 600 }}>
                      {selectedPatient.nationalId || selectedPatient.nationalIdMasked}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>Chưa cập nhật</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ cư trú">
                  {selectedPatient.address || 'Chưa cập nhật'}
                </Descriptions.Item>
                <Descriptions.Item label="Phiên bản hồ sơ">
                  v{selectedPatient.version}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày tạo hồ sơ">
                  {formatDateTime(selectedPatient.createdAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Cập nhật lần cuối">
                  {formatDateTime(selectedPatient.updatedAt)}
                </Descriptions.Item>
              </Descriptions>

              {/* Danh sách người liên hệ khẩn cấp */}
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    Người liên hệ khẩn cấp ({selectedPatient.emergencyContacts?.length || 0})
                  </Typography.Title>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    style={{ background: '#0284c7' }}
                    onClick={openCreateContact}
                  >
                    Thêm người liên hệ
                  </Button>
                </div>
                {selectedPatient.emergencyContacts && selectedPatient.emergencyContacts.length > 0 ? (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={selectedPatient.emergencyContacts}
                    columns={[
                      {
                        title: 'Ưu tiên',
                        key: 'priority',
                        width: 70,
                        align: 'center',
                        render: (_, __, index) => (
                          <Tag color={index === 0 ? 'gold' : 'default'} style={{ fontWeight: 600, margin: 0 }}>
                            #{index + 1}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Họ tên',
                        dataIndex: 'fullName',
                        render: (name) => <strong>{name}</strong>,
                      },
                      {
                        title: 'Quan hệ',
                        dataIndex: 'relationship',
                        render: (rel) => <Tag color="cyan">{rel}</Tag>,
                      },
                      {
                        title: 'Số điện thoại',
                        dataIndex: 'phoneNumber',
                        render: (p) => <span className="admin-code">{formatPhoneNumber(p)}</span>,
                      },
                      {
                        title: 'Thao tác',
                        key: 'action',
                        width: 140,
                        align: 'center',
                        render: (_, rec, index) => {
                          const total = selectedPatient.emergencyContacts?.length || 0;
                          return (
                            <Space size={4}>
                              <Tooltip title="Tăng mức độ ưu tiên (lên trước)">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<ArrowUpOutlined />}
                                  disabled={index === 0 || reorderingContact}
                                  onClick={() => void handleMoveContact(index, -1)}
                                />
                              </Tooltip>
                              <Tooltip title="Giảm mức độ ưu tiên (xuống sau)">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<ArrowDownOutlined />}
                                  disabled={index === total - 1 || reorderingContact}
                                  onClick={() => void handleMoveContact(index, 1)}
                                />
                              </Tooltip>
                              <Tooltip title="Chỉnh sửa">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined style={{ color: 'var(--deep)' }} />}
                                  disabled={reorderingContact}
                                  onClick={() => openEditContact(rec)}
                                />
                              </Tooltip>
                              <Tooltip title="Xóa người liên hệ">
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  disabled={reorderingContact}
                                  onClick={() => void handleDeleteContact(rec.id, rec.fullName)}
                                />
                              </Tooltip>
                            </Space>
                          );
                        },
                      },
                    ]}
                  />
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
                    Chưa có người liên hệ khẩn cấp được đăng ký. Bấm "Thêm người liên hệ" để thêm mới.
                  </div>
                )}
              </div>
            </div>

            <Divider style={{ margin: '16px 0 12px' }} />

            {/* Footer actions inside Drawer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailDrawerOpen(false);
                  openEditModal(selectedPatient);
                }}
              >
                Chỉnh sửa
              </Button>

              {selectedPatient.authAccountId && (
                (selectedPatient.status === 'LOCKED' || selectedPatient.status === 'INACTIVE') ? (
                  <Button
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                    icon={<CheckCircleOutlined />}
                    onClick={() => openStatusModal(selectedPatient)}
                  >
                    Kích hoạt tài khoản
                  </Button>
                ) : (
                  <Button
                    style={{ backgroundColor: '#fa8c16', borderColor: '#fa8c16', color: '#fff' }}
                    icon={<PauseCircleOutlined />}
                    onClick={() => openStatusModal(selectedPatient)}
                  >
                    Tạm khóa tài khoản
                  </Button>
                )
              )}

              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => openDeleteModal(selectedPatient)}
              >
                Xóa hồ sơ
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal Thêm bệnh nhân (Căn giữa màn hình) */}
      <Modal
        title={
          <Space>
            <UserOutlined style={{ color: '#52c41a' }} />
            <span>Thêm bệnh nhân mới</span>
          </Space>
        }
        open={createModalOpen}
        centered
        width={760}
        onCancel={() => {
          if (!submitting) {
            setCreateModalOpen(false);
            createForm.resetFields();
          }
        }}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText="Tạo hồ sơ"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => void handleCreate(values)}
          style={{ marginTop: 16 }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="fullName"
              label="Họ và tên bệnh nhân"
              rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
            >
              <Input placeholder="Ví dụ: Nguyễn Thị Mai" />
            </Form.Item>

            <Form.Item
              name="phoneNumber"
              label="Số điện thoại (Mật khẩu ban đầu)"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại' },
                { pattern: /^[0-9+ ]{8,15}$/, message: 'Số điện thoại không hợp lệ' },
              ]}
            >
              <Input prefix={<PhoneOutlined style={{ color: '#52c41a' }} />} placeholder="Ví dụ: 0987654321" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="email"
              label="Email đăng nhập"
              rules={[
                { required: true, message: 'Vui lòng nhập email bệnh nhân' },
                { type: 'email', message: 'Email không đúng định dạng' },
              ]}
            >
              <Input prefix={<MailOutlined style={{ color: '#1677ff' }} />} placeholder="Ví dụ: mai.nguyen@gmail.com" />
            </Form.Item>

            <Form.Item
              name="dateOfBirth"
              label="Ngày sinh"
              rules={[{ required: true, message: 'Vui lòng chọn ngày sinh' }]}
            >
              <DatePicker
                format="DD/MM/YYYY"
                placeholder="Chọn ngày sinh"
                style={{ width: '100%' }}
                disabledDate={(current) => current && current > dayjs().endOf('day')}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="nationalId"
              label="Số CCCD / Định danh"
              rules={[
                { required: true, message: 'Vui lòng nhập số CCCD / Định danh' },
                { pattern: /^\d{9,12}$/, message: 'Số CCCD gồm 9 đến 12 chữ số' },
              ]}
            >
              <Input prefix={<IdcardOutlined style={{ color: '#fa8c16' }} />} placeholder="Ví dụ: 001201012345" />
            </Form.Item>

            <Form.Item
              name="address"
              label="Địa chỉ cư trú"
              rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cư trú' }]}
            >
              <Input placeholder="Số nhà, đường, phường/xã, quận/huyện..." />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa bệnh nhân (Căn giữa màn hình) */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#1677ff' }} />
            <span>Chỉnh sửa hồ sơ bệnh nhân</span>
          </Space>
        }
        open={editModalOpen}
        centered
        width={760}
        onCancel={() => {
          if (!submitting) {
            setEditModalOpen(false);
            setEditingPatient(null);
            editForm.resetFields();
          }
        }}
        onOk={() => editForm.submit()}
        confirmLoading={submitting}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => void handleEdit(values)}
          style={{ marginTop: 16 }}
        >
          {/* Ảnh đại diện bệnh nhân với căn chỉnh khung hình */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.fullName !== curr.fullName}
          >
            {({ getFieldValue }) => (
              <Form.Item name="photoUrl" noStyle>
                <DoctorPhotoUpload
                  doctorName={getFieldValue('fullName')}
                />
              </Form.Item>
            )}
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <Form.Item
              name="fullName"
              label="Họ và tên bệnh nhân"
              rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
            >
              <Input placeholder="Họ và tên" />
            </Form.Item>

            <Form.Item
              name="phoneNumber"
              label="Số điện thoại"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại' },
                { pattern: /^[0-9+ ]{8,15}$/, message: 'Số điện thoại không hợp lệ' },
              ]}
            >
              <Input prefix={<PhoneOutlined style={{ color: '#52c41a' }} />} placeholder="Số điện thoại" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="email"
              label="Email đăng nhập"
              rules={[
                { required: true, message: 'Vui lòng nhập email bệnh nhân' },
                { type: 'email', message: 'Email không đúng định dạng' },
              ]}
            >
              <Input prefix={<MailOutlined style={{ color: '#1677ff' }} />} placeholder="Ví dụ: benhnhan@gmail.com" />
            </Form.Item>

            <Form.Item
              name="dateOfBirth"
              label="Ngày sinh"
              rules={[{ required: true, message: 'Vui lòng chọn ngày sinh' }]}
            >
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                disabledDate={(current) => current && current > dayjs().endOf('day')}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="nationalId"
              label="Số CCCD / Định danh"
              rules={[
                { required: true, message: 'Vui lòng nhập số CCCD / Định danh' },
                { pattern: /^\d{9,12}$/, message: 'Số CCCD gồm 9 đến 12 chữ số' },
              ]}
            >
              <Input prefix={<IdcardOutlined style={{ color: '#fa8c16' }} />} placeholder="Số CCCD" />
            </Form.Item>

            <Form.Item
              name="address"
              label="Địa chỉ cư trú"
              rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cư trú' }]}
            >
              <Input placeholder="Địa chỉ thường trú" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Modal Xác nhận Xóa bệnh nhân (Căn giữa màn hình, Nút Xóa đỏ bên trái, Hủy bên phải) */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Xác nhận xóa hồ sơ bệnh nhân</span>
          </Space>
        }
        open={deleteModalOpen}
        centered
        onCancel={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setPatientToDelete(null);
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
                setPatientToDelete(null);
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
            Bạn có chắc muốn xóa hồ sơ bệnh nhân{' '}
            <strong>{patientToDelete?.fullName}</strong> (SĐT: {patientToDelete?.phoneNumber})?
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            Hành động này sẽ xóa vĩnh viễn hồ sơ bệnh nhân cùng danh bạ người thân khẩn cấp khỏi hệ thống.
          </p>
        </div>
      </Modal>

      {/* Modal Xác nhận Tạm khóa / Kích hoạt bệnh nhân */}
      {(() => {
        const isTargetLocked = statusTargetPatient?.status === 'LOCKED' || statusTargetPatient?.status === 'INACTIVE';
        return (
          <Modal
            title={
              <Space>
                {!isTargetLocked ? (
                  <PauseCircleOutlined style={{ color: '#fa8c16' }} />
                ) : (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                )}
                <span>
                  {!isTargetLocked
                    ? 'Xác nhận tạm khóa bệnh nhân'
                    : 'Xác nhận kích hoạt bệnh nhân'}
                </span>
              </Space>
            }
            open={statusModalOpen}
            centered
            onCancel={() => {
              if (!togglingStatus) {
                setStatusModalOpen(false);
                setStatusTargetPatient(null);
              }
            }}
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button
                  type="primary"
                  style={
                    !isTargetLocked
                      ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                      : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
                  }
                  loading={togglingStatus}
                  disabled={togglingStatus || (!isTargetLocked && deactivateReason.trim().length < 3)}
                  onClick={() => void handleToggleStatus()}
                >
                  {!isTargetLocked ? 'Xác nhận tạm khóa' : 'Kích hoạt'}
                </Button>
                <Button
                  disabled={togglingStatus}
                  onClick={() => {
                    setStatusModalOpen(false);
                    setStatusTargetPatient(null);
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
                {!isTargetLocked ? (
                  <>
                    Bạn có chắc muốn tạm khóa tài khoản của bệnh nhân{' '}
                    <strong>{statusTargetPatient?.fullName}</strong> ({statusTargetPatient?.email})?
                  </>
                ) : (
                  <>
                    Kích hoạt lại tài khoản của bệnh nhân{' '}
                    <strong>{statusTargetPatient?.fullName}</strong> ({statusTargetPatient?.email})?
                  </>
                )}
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)' }}>
                {!isTargetLocked
                  ? 'Khi bị tạm khóa, bệnh nhân sẽ không thể đăng nhập vào cổng thông tin bệnh nhân cho đến khi được kích hoạt lại.'
                  : 'Sau khi kích hoạt, bệnh nhân có thể đăng nhập và đặt lịch hẹn khám bình thường.'}
              </p>
              {!isTargetLocked && (
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
        );
      })()}

      {/* Modal Thêm / Chỉnh sửa Người liên hệ khẩn cấp */}
      <Modal
        title={
          <Space>
            <UserOutlined style={{ color: '#0284c7' }} />
            <span>{editingContact ? 'Chỉnh sửa người liên hệ' : 'Thêm người liên hệ khẩn cấp'}</span>
          </Space>
        }
        open={contactModalOpen}
        centered
        onCancel={() => {
          if (!submittingContact) {
            setContactModalOpen(false);
            setEditingContact(null);
            contactForm.resetFields();
          }
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={contactForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={(values) => void handleSubmitContact(values)}
        >
          <Form.Item
            name="fullName"
            label="Họ và tên người liên hệ"
            rules={[{ required: true, message: 'Vui lòng nhập họ và tên người liên hệ' }]}
          >
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item
            name="relationship"
            label="Mối quan hệ với bệnh nhân"
            rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập mối quan hệ' }]}
          >
            <Select
              placeholder="Chọn hoặc nhập mối quan hệ"
              options={[
                { label: 'Chồng', value: 'Chồng' },
                { label: 'Vợ', value: 'Vợ' },
                { label: 'Bố đẻ', value: 'Bố đẻ' },
                { label: 'Mẹ đẻ', value: 'Mẹ đẻ' },
                { label: 'Bố chồng', value: 'Bố chồng' },
                { label: 'Mẹ chồng', value: 'Mẹ chồng' },
                { label: 'Anh/Chị/Em', value: 'Anh/Chị/Em' },
                { label: 'Người thân khác', value: 'Người thân khác' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label="Số điện thoại liên hệ"
            rules={[
              { required: true, message: 'Vui lòng nhập số điện thoại' },
              {
                pattern: /^(0|\+84)[3|5|7|8|9][0-9]{8}$/,
                message: 'Số điện thoại không hợp lệ (Ví dụ: 0901234567)',
              },
            ]}
          >
            <Input placeholder="0901234567" />
          </Form.Item>

          <Form.Item
            name="isPrimary"
            valuePropName="checked"
          >
            <Select
              style={{ display: 'none' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                disabled={submittingContact}
                onClick={() => {
                  setContactModalOpen(false);
                  setEditingContact(null);
                  contactForm.resetFields();
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" loading={submittingContact} style={{ background: '#0284c7' }}>
                {editingContact ? 'Lưu thay đổi' : 'Thêm người liên hệ'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Thông báo (Thành công / Thất bại) với nét vẽ tự động đóng */}
      <AdminFeedbackModal
        feedback={feedback}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
