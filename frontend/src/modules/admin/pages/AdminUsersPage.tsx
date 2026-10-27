import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  KeyOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
  type AdminUser,
  type CreateAdminUserPayload,
  type UpdateAdminUserPayload,
  type UserRole,
  type UserStatus,
} from '../../../services/adminUsers';
import {
  listDoctors,
  activateDoctor,
  deactivateDoctor,
} from '../../../services/adminDoctors';
import { registerUserEmailToCache } from '../../../services/auditInterceptor';
import { formatDateTime } from '../format';
import { StatusTag } from '../components/StatusTag';
import {
  AdminFeedbackModal,
  type AdminFeedbackState,
} from '../components/AdminFeedbackModal';

const ROLE_OPTIONS: Array<{ label: string; value: UserRole; color: string }> = [
  { label: 'Quản trị viên (ADMIN)', value: 'ADMIN', color: 'purple' },
  { label: 'Bác sĩ (DOCTOR)', value: 'DOCTOR', color: 'blue' },
  { label: 'Lễ tân (RECEPTIONIST)', value: 'RECEPTIONIST', color: 'cyan' },
  { label: 'Điều dưỡng (NURSE)', value: 'NURSE', color: 'orange' },
  { label: 'Bệnh nhân (PATIENT)', value: 'PATIENT', color: 'green' },
];

const STATUS_OPTIONS: Array<{ label: string; value: UserStatus }> = [
  { label: 'Hoạt động (ACTIVE)', value: 'ACTIVE' },
  { label: 'Tạm khóa (LOCKED)', value: 'LOCKED' },
];

export function AdminUsersPage() {
  const { request, user: currentUser } = useAuthSession();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Drawer detail state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  interface CreateUserFormValues {
    email: string;
    password: string;
    confirmPassword?: string;
    role: UserRole;
  }

  const [createForm] = Form.useForm<CreateUserFormValues>();
  const [editForm] = Form.useForm<UpdateAdminUserPayload>();

  const loadData = useCallback(async (
    overrideSearchTerm?: string,
    overrideRole?: string,
    overrideStatus?: string,
    overridePage?: number,
  ) => {
    setLoading(true);
    setError('');
    const s = overrideSearchTerm !== undefined ? overrideSearchTerm : searchTerm;
    const r = overrideRole !== undefined ? overrideRole : selectedRole;
    const st = overrideStatus !== undefined ? overrideStatus : selectedStatus;
    const p = overridePage !== undefined ? overridePage : page;
    try {
      const res = await listAdminUsers(request, {
        page: p,
        limit: pageSize,
        search: s,
        role: r,
        status: st,
      });
      setUsers(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách người dùng.';
      setError(msg);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [request, page, pageSize, searchTerm, selectedRole, selectedStatus]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleResetUsers = () => {
    setSearchTerm('');
    setSelectedRole(undefined);
    setSelectedStatus(undefined);
    setPage(1);
    void loadData('', undefined, undefined, 1);
  };

  // Notification feedback modal state (Thành công / Thất bại)
  const [feedbackModal, setFeedbackModal] = useState<{
    open: boolean;
    type: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);

  // Tự động đóng modal thông báo sau 2s (thành công) hoặc 2.5s (thất bại)
  useEffect(() => {
    if (!feedbackModal?.open) return;
    const duration = feedbackModal.type === 'error' ? 2500 : 2000;
    const timer = setTimeout(() => {
      setFeedbackModal(null);
    }, duration);
    return () => clearTimeout(timer);
  }, [feedbackModal]);

  const handleCreate = async (values: CreateUserFormValues) => {
    setSubmitting(true);
    try {
      const payload: CreateAdminUserPayload = {
        email: values.email.trim(),
        password: values.password,
        role: values.role,
        status: 'ACTIVE',
      };
      await createAdminUser(request, payload);
      createForm.resetFields();
      setCreateModalOpen(false);
      setFeedbackModal({
        open: true,
        type: 'success',
        title: 'Tạo tài khoản thành công!',
        description: `Tài khoản ${values.email} đã được khởi tạo thành công với trạng thái Hoạt động.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedbackModal({
        open: true,
        type: 'error',
        title: 'Tạo tài khoản thất bại!',
        description: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo người dùng mới.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (values: UpdateAdminUserPayload) => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const payload: UpdateAdminUserPayload = {};
      if (values.email && values.email.trim() !== editingUser.email) payload.email = values.email.trim();
      if (values.password && values.password.trim().length >= 8) payload.password = values.password.trim();

      registerUserEmailToCache(editingUser.id, values.email?.trim() || editingUser.email);
      const updated = await updateAdminUser(request, editingUser.id, payload);
      editForm.resetFields();
      setEditModalOpen(false);
      setEditingUser(null);
      if (selectedUser?.id === editingUser.id) {
        setSelectedUser(updated);
      }
      setFeedbackModal({
        open: true,
        type: 'success',
        title: 'Cập nhật thành công!',
        description: `Thông tin tài khoản ${updated.email} đã được cập nhật thành công.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedbackModal({
        open: true,
        type: 'error',
        title: 'Cập nhật thất bại!',
        description: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi cập nhật thông tin.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm status toggle modal state (Tạm khóa / Kích hoạt)
  const [confirmStatusModalOpen, setConfirmStatusModalOpen] = useState(false);
  const [userForStatusToggle, setUserForStatusToggle] = useState<AdminUser | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [statusToggleLoading, setStatusToggleLoading] = useState(false);

  const openConfirmStatusModal = (userItem: AdminUser) => {
    if (currentUser?.userId === userItem.id) {
      setFeedbackModal({
        open: true,
        type: 'error',
        title: 'Thao tác không được phép!',
        description: 'Bạn không thể tự khóa tài khoản quản trị của chính mình.',
      });
      return;
    }
    setUserForStatusToggle(userItem);
    setDeactivateReason('');
    setConfirmStatusModalOpen(true);
  };

  const handleToggleStatus = async () => {
    if (!userForStatusToggle) return;
    setStatusToggleLoading(true);
    const userItem = userForStatusToggle;
    registerUserEmailToCache(userItem.id, userItem.email);
    const isCurrentlyActive = userItem.status === 'ACTIVE';
    const nextStatus: UserStatus = isCurrentlyActive ? 'LOCKED' : 'ACTIVE';
    const actionText = isCurrentlyActive ? 'Tạm khóa' : 'Kích hoạt';

    if (isCurrentlyActive && (!deactivateReason || deactivateReason.trim().length < 3)) {
      setFeedbackModal({
        open: true,
        type: 'error',
        title: 'Thiếu lý do tạm khóa!',
        description: 'Vui lòng nhập lý do tạm khóa tài khoản (tối thiểu 3 ký tự).',
      });
      setStatusToggleLoading(false);
      return;
    }

    try {
      // Nếu là tài khoản DOCTOR: Đồng bộ trạng thái hồ sơ Bác sĩ tương ứng
      if (userItem.role === 'DOCTOR') {
        try {
          const [activeDocs, inactiveDocs] = await Promise.all([
            listDoctors(request, { status: 'ACTIVE', limit: 100 }),
            listDoctors(request, { status: 'INACTIVE', limit: 100 }),
          ]);
          const allDocs = [...(activeDocs.data ?? []), ...(inactiveDocs.data ?? [])];
          const doc = allDocs.find((d) => d.accountId === userItem.id);
          if (doc) {
            if (isCurrentlyActive) {
              await deactivateDoctor(request, doc.id, doc.version, deactivateReason.trim());
            } else {
              // Khi kích hoạt bác sĩ: Auth user cần ACTIVE trước để verifyAccount kiểm tra thành công!
              await updateAdminUser(request, userItem.id, {
                status: 'ACTIVE',
              });
              await activateDoctor(request, doc.id, doc.version);
            }
          }
        } catch (docErr) {
          console.error('Lỗi khi đồng bộ trạng thái bác sĩ:', docErr);
          throw new Error(
            `Đồng bộ trạng thái bác sĩ thất bại: ${
              docErr instanceof Error ? docErr.message : 'Không thể kết nối đến Doctor Service'
            }`,
          );
        }
      }

      const updated = await updateAdminUser(request, userItem.id, {
        status: nextStatus,
      });
      setConfirmStatusModalOpen(false);
      setUserForStatusToggle(null);
      if (selectedUser?.id === userItem.id) {
        setSelectedUser(updated);
      }
      setFeedbackModal({
        open: true,
        type: 'success',
        title: `${actionText} tài khoản thành công!`,
        description: `Tài khoản ${userItem.email} ${
          userItem.role === 'DOCTOR'
            ? 'và hồ sơ bác sĩ tương ứng'
            : userItem.role === 'PATIENT'
            ? 'và hồ sơ bệnh nhân tương ứng'
            : ''
        } đã được chuyển sang trạng thái ${isCurrentlyActive ? 'tạm khóa' : 'hoạt động'}.`,
      });
      void loadData();
    } catch (err: unknown) {
      setConfirmStatusModalOpen(false);
      setFeedbackModal({
        open: true,
        type: 'error',
        title: `${actionText} thất bại!`,
        description: err instanceof Error ? err.message : `Không thể ${actionText.toLowerCase()} tài khoản này.`,
      });
    } finally {
      setStatusToggleLoading(false);
    }
  };

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (record: AdminUser) => {
    setUserToDelete(record);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    const targetEmail = userToDelete.email;
    registerUserEmailToCache(userToDelete.id, targetEmail);
    try {
      await deleteAdminUser(request, userToDelete.id);
      setDeleteModalOpen(false);
      if (selectedUser?.id === userToDelete.id) {
        setDetailDrawerOpen(false);
        setSelectedUser(null);
      }
      setUserToDelete(null);
      setFeedbackModal({
        open: true,
        type: 'success',
        title: 'Xóa tài khoản thành công!',
        description: `Tài khoản ${targetEmail} đã được xóa hoàn toàn khỏi hệ thống.`,
      });
      void loadData();
    } catch (err: unknown) {
      setDeleteModalOpen(false);
      setFeedbackModal({
        open: true,
        type: 'error',
        title: 'Xóa tài khoản thất bại!',
        description: err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi xóa người dùng.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenDetail = (record: AdminUser) => {
    setSelectedUser(record);
    setDetailDrawerOpen(true);
  };

  const openEditModal = (record: AdminUser) => {
    setEditingUser(record);
    editForm.setFieldsValue({
      email: record.email,
      role: record.role,
      password: '',
    });
    setEditModalOpen(true);
  };

  const roleTag = (role: UserRole) => {
    const opt = ROLE_OPTIONS.find((r) => r.value === role);
    return <Tag color={opt?.color ?? 'default'} variant="filled">{opt?.label ?? role}</Tag>;
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: 'Người dùng',
      dataIndex: 'email',
      key: 'email',
      render: (email: string, record) => {
        const opt = ROLE_OPTIONS.find((r) => r.value === record.role);
        const initial = email ? email[0].toUpperCase() : 'U';
        return (
          <Space size="middle" align="center">
            <Avatar
              style={{
                backgroundColor: opt?.color
                  ? `var(--${opt.color}, #0d828a)`
                  : '#0d828a',
                verticalAlign: 'middle',
                fontWeight: 700,
              }}
            >
              {initial}
            </Avatar>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{email}</span>
                {currentUser?.userId === record.id && (
                  <Tag color="cyan" variant="outlined" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                    Bạn
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                ID: <span className="admin-code" style={{ padding: '0 4px', fontSize: 10 }}>{record.id.slice(0, 8)}…</span>
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (role: UserRole) => roleTag(role),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: UserStatus) => <StatusTag status={status} />,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 175,
      align: 'center',
      render: (_, record) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                icon={<EyeOutlined style={{ color: 'var(--accent)' }} />}
                onClick={() => handleOpenDetail(record)}
              />
            </Tooltip>
            {record.status === 'ACTIVE' ? (
              <Tooltip title={currentUser?.userId === record.id ? 'Không thể tự khóa chính mình' : 'Tạm khóa tài khoản'}>
                <Button
                  type="text"
                  icon={<PauseCircleOutlined style={{ color: '#fa8c16' }} />}
                  disabled={currentUser?.userId === record.id}
                  onClick={() => openConfirmStatusModal(record)}
                />
              </Tooltip>
            ) : (
              <Tooltip title="Kích hoạt tài khoản">
                <Button
                  type="text"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => openConfirmStatusModal(record)}
                />
              </Tooltip>
            )}
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<EditOutlined style={{ color: 'var(--deep)' }} />}
                onClick={() => openEditModal(record)}
              />
            </Tooltip>
            <Tooltip title={currentUser?.userId === record.id ? 'Không thể xóa chính mình' : 'Xóa'}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={currentUser?.userId === record.id}
                onClick={() => openDeleteModal(record)}
              />
            </Tooltip>
          </Space>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-table-card">
      <div className="admin-toolbar">
        <Space wrap size="middle">
          <Input
            placeholder="Tìm theo email…"
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            allowClear
            style={{ width: 260 }}
          />
          <Select
            placeholder="Lọc vai trò"
            allowClear
            value={selectedRole}
            onChange={(val) => {
              setSelectedRole(val);
              setPage(1);
            }}
            style={{ width: 180 }}
            options={[
              { label: 'Tất cả vai trò', value: '' },
              ...ROLE_OPTIONS.map((r) => ({ label: r.label, value: r.value })),
            ]}
          />
          <Select
            placeholder="Lọc trạng thái"
            allowClear
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setPage(1);
            }}
            style={{ width: 180 }}
            options={[
              { label: 'Tất cả trạng thái', value: '' },
              ...STATUS_OPTIONS.map((s) => ({ label: s.label, value: s.value })),
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={handleResetUsers} loading={loading}>
            Làm mới
          </Button>
        </Space>
        <Space>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            style={{ background: '#0284c7' }}
            onClick={() => {
              createForm.resetFields();
              setCreateModalOpen(true);
            }}
          >
            Thêm người dùng
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          title="Không thể tải dữ liệu"
          description={error}
          action={<Button size="small" onClick={() => void loadData()}>Thử lại</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table<AdminUser>
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        size="middle"
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => handleOpenDetail(record),
          className: `admin-row-clickable ${selectedUser?.id === record.id && detailDrawerOpen ? 'admin-row-selected' : ''}`,
        })}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (totalCount) => `Tổng số ${totalCount} người dùng`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* Modal Thêm người dùng */}
      <Modal
        title="Thêm người dùng mới"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ role: 'PATIENT' }}
          autoComplete="off"
          style={{ marginTop: 16 }}
        >
          {/* Chrome/Edge autofill prevention dummy fields */}
          <input type="text" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
          <input type="password" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />

          <Form.Item
            name="email"
            label="Địa chỉ Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không đúng định dạng' },
            ]}
          >
            <Input placeholder="ví dụ: bacsi@hospital.vn" autoComplete="off" name="new_user_email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
            ]}
          >
            <Input.Password placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" name="new_user_password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận lại mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp với mật khẩu'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Nhập lại mật khẩu ở trên" autoComplete="new-password" name="new_user_confirm_password" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai trò"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select options={ROLE_OPTIONS.map((r) => ({ label: r.label, value: r.value }))} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Tạo tài khoản
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa người dùng */}
      <Modal
        title={`Chỉnh sửa người dùng: ${editingUser?.email ?? ''}`}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingUser(null);
        }}
        footer={null}
        destroyOnClose
        centered
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          <Form.Item
            name="email"
            label="Địa chỉ Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không đúng định dạng' },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai trò"
            extra="Vai trò được gắn cố định với tài khoản và không thể thay đổi."
          >
            <Select disabled options={ROLE_OPTIONS.map((r) => ({ label: r.label, value: r.value }))} />
          </Form.Item>

          <Form.Item
            name="password"
            label="Đổi mật khẩu mới (tùy chọn)"
            rules={[{ min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' }]}
            extra="Để trống trường này nếu không muốn thay đổi mật khẩu hiện tại."
          >
            <Input.Password prefix={<KeyOutlined />} placeholder="Nhập mật khẩu mới nếu muốn đổi" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.password !== curr.password}
          >
            {({ getFieldValue }) => {
              const newPassword = getFieldValue('password');
              if (!newPassword || newPassword.trim().length === 0) return null;
              return (
                <Form.Item
                  name="confirmPassword"
                  label="Xác nhận mật khẩu mới"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Vui lòng xác nhận lại mật khẩu mới' },
                    ({ getFieldValue: getField }) => ({
                      validator(_, value) {
                        if (!value || getField('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp với mật khẩu mới'));
                      },
                    }),
                  ]}
                >
                  <Input.Password prefix={<KeyOutlined />} placeholder="Nhập lại mật khẩu mới ở trên" />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingUser(null);
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

      {/* Drawer Chi tiết thông tin người dùng */}
      <Drawer
        title="Chi tiết thông tin người dùng"
        placement="right"
        width={480}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        destroyOnClose
      >
        {selectedUser && (
          <div>
            {/* Header tóm tắt hồ sơ người dùng */}
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
                boxShadow: '0 2px 10px color-mix(in oklch, var(--deep) 4%, transparent)',
              }}
            >
              <Avatar
                size={54}
                style={{
                  backgroundColor: ROLE_OPTIONS.find((r) => r.value === selectedUser.role)?.color
                    ? `var(--${ROLE_OPTIONS.find((r) => r.value === selectedUser.role)?.color}, #0d828a)`
                    : '#0d828a',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {selectedUser.email ? selectedUser.email[0].toUpperCase() : 'U'}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Title
                  level={5}
                  style={{ margin: 0, wordBreak: 'break-all', color: 'var(--fg)', fontSize: 16 }}
                >
                  {selectedUser.email}
                </Typography.Title>
                <Space size={6} style={{ marginTop: 6 }} wrap>
                  {roleTag(selectedUser.role)}
                  <StatusTag status={selectedUser.status} />
                  {currentUser?.userId === selectedUser.id && (
                    <Tag color="cyan" variant="outlined">Bạn</Tag>
                  )}
                </Space>
              </div>
            </div>

            {/* Bảng chi tiết Descriptions */}
            <Descriptions
              title="Thông tin tài khoản"
              bordered
              column={1}
              size="middle"
              items={[
                {
                  key: 'id',
                  label: 'Mã người dùng',
                  children: (
                    <span className="admin-code" style={{ wordBreak: 'break-all' }}>
                      {selectedUser.id}
                    </span>
                  ),
                },
                {
                  key: 'email',
                  label: 'Địa chỉ Email',
                  children: (
                    <Typography.Text copyable style={{ fontWeight: 600 }}>
                      {selectedUser.email}
                    </Typography.Text>
                  ),
                },
                {
                  key: 'role',
                  label: 'Vai trò trong hệ thống',
                  children: roleTag(selectedUser.role),
                },
                {
                  key: 'status',
                  label: 'Trạng thái hoạt động',
                  children: <StatusTag status={selectedUser.status} />,
                },
                {
                  key: 'createdAt',
                  label: 'Thời gian đăng ký',
                  children: formatDateTime(selectedUser.createdAt),
                },
                {
                  key: 'updatedAt',
                  label: 'Cập nhật lần cuối',
                  children: formatDateTime(selectedUser.updatedAt),
                },
                {
                  key: 'lastLoginAt',
                  label: 'Lần đăng nhập gần nhất',
                  children: selectedUser.lastLoginAt ? (
                    formatDateTime(selectedUser.lastLoginAt)
                  ) : (
                    <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Chưa có lượt đăng nhập</span>
                  ),
                },
              ]}
            />

            <Divider style={{ margin: '24px 0 16px' }} />

            {/* Thao tác nhanh bên dưới: Tạm khóa / Kích hoạt, Chỉnh sửa, Xóa tài khoản */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {selectedUser.status === 'ACTIVE' ? (
                <Button
                  style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
                  icon={<PauseCircleOutlined />}
                  disabled={currentUser?.userId === selectedUser.id}
                  onClick={() => openConfirmStatusModal(selectedUser)}
                >
                  Tạm khóa
                </Button>
              ) : (
                <Button
                  style={{ color: '#52c41a', borderColor: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => openConfirmStatusModal(selectedUser)}
                >
                  Kích hoạt
                </Button>
              )}
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  const u = selectedUser;
                  setDetailDrawerOpen(false);
                  openEditModal(u);
                }}
              >
                Chỉnh sửa
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={currentUser?.userId === selectedUser.id}
                onClick={() => openDeleteModal(selectedUser)}
              >
                {currentUser?.userId === selectedUser.id ? 'Không thể xóa chính mình' : 'Xóa tài khoản'}
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal Xác nhận xóa người dùng */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Xác nhận xóa tài khoản</span>
          </Space>
        }
        open={deleteModalOpen}
        centered
        onCancel={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setUserToDelete(null);
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
                setUserToDelete(null);
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
            Bạn có chắc muốn xóa tài khoản <strong>{userToDelete?.email}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            Hành động này sẽ xóa vĩnh viễn tài khoản khỏi hệ thống và không thể hoàn tác.
          </p>
        </div>
      </Modal>

      {/* Modal Xác nhận Tạm khóa / Kích hoạt tài khoản */}
      <Modal
        title={
          <Space>
            {userForStatusToggle?.status === 'ACTIVE' ? (
              <PauseCircleOutlined style={{ color: '#fa8c16' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <span>
              {userForStatusToggle?.status === 'ACTIVE'
                ? 'Xác nhận tạm khóa tài khoản'
                : 'Xác nhận kích hoạt tài khoản'}
            </span>
          </Space>
        }
        open={confirmStatusModalOpen}
        centered
        onCancel={() => {
          if (!statusToggleLoading) {
            setConfirmStatusModalOpen(false);
            setUserForStatusToggle(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              type="primary"
              style={
                userForStatusToggle?.status === 'ACTIVE'
                  ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                  : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
              }
              loading={statusToggleLoading}
              disabled={statusToggleLoading || (userForStatusToggle?.status === 'ACTIVE' && deactivateReason.trim().length < 3)}
              onClick={() => void handleToggleStatus()}
            >
              {userForStatusToggle?.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}
            </Button>
            <Button
              disabled={statusToggleLoading}
              onClick={() => {
                setConfirmStatusModalOpen(false);
                setUserForStatusToggle(null);
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
            Bạn có chắc chắn muốn{' '}
            <strong>
              {userForStatusToggle?.status === 'ACTIVE' ? 'tạm khóa' : 'kích hoạt lại'}
            </strong>{' '}
            tài khoản <strong>{userForStatusToggle?.email}</strong> không?
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            {userForStatusToggle?.status === 'ACTIVE'
              ? 'Khi bị tạm khóa, người dùng sẽ không thể đăng nhập vào hệ thống cho đến khi được kích hoạt lại.'
              : 'Sau khi kích hoạt, người dùng sẽ có thể đăng nhập và sử dụng hệ thống bình thường.'}
          </p>
          {userForStatusToggle?.status === 'ACTIVE' && (
            <div style={{ marginTop: 14 }}>
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

      {/* Modal Thông báo (Thành công / Thất bại) với nét vẽ tự động đóng */}
      <AdminFeedbackModal
        feedback={feedbackModal}
        onClose={() => setFeedbackModal(null)}
      />
    </div>
  );
}
