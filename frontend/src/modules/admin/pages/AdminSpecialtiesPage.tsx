import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Card,
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
  AppstoreOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import {
  createSpecialty,
  deleteSpecialty,
  listDoctors,
  listSpecialties,
  updateSpecialty,
  type CreateSpecialtyPayload,
  type DoctorItem,
  type SpecialtyItem,
  type UpdateSpecialtyPayload,
} from '../../../services/adminDoctors';
import { formatDateTime } from '../format';
import { StatusTag } from '../components/StatusTag';
import {
  AdminFeedbackModal,
  type AdminFeedbackState,
} from '../components/AdminFeedbackModal';
import { registerSpecialtyToCache, registerSpecialtyBatchToCache } from '../../../services/auditInterceptor';

const { Title, Text, Paragraph } = Typography;

export function AdminSpecialtiesPage() {
  const { request } = useAuthSession();

  const [loading, setLoading] = useState(false);
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Modal create/edit/delete states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [specialtyToEdit, setSpecialtyToEdit] = useState<SpecialtyItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [specialtyToDelete, setSpecialtyToDelete] = useState<SpecialtyItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Drawer detail state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyItem | null>(null);

  // Forms
  const [createForm] = Form.useForm<CreateSpecialtyPayload>();
  const [editForm] = Form.useForm<UpdateSpecialtyPayload>();

  // Feedback modal
  const [feedback, setFeedback] = useState<AdminFeedbackState | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [specRes, docRes] = await Promise.all([
        listSpecialties(request, { limit: 100 }),
        listDoctors(request, { limit: 100 }),
      ]);
      const specList = Array.isArray(specRes) ? specRes : [];
      setSpecialties(specList);
      registerSpecialtyBatchToCache(specList);
      const docList = Array.isArray(docRes) ? docRes : (docRes?.data ?? []);
      setDoctors(docList);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleReset = () => {
    setSearchQuery('');
    setStatusFilter(undefined);
    void loadData();
  };

  // Filtered specialties
  const filteredSpecialties = useMemo(() => {
    return specialties.filter((sp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || sp.name.toLowerCase().includes(q) || sp.code.toLowerCase().includes(q);
      const matchStatus = !statusFilter || sp.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [specialties, searchQuery, statusFilter]);

  // Create handler
  const handleCreate = async (values: CreateSpecialtyPayload) => {
    setSubmitting(true);
    try {
      const created = await createSpecialty(request, values);
      registerSpecialtyToCache(created.id, created.name);

      // Chuyển chuyên khoa vừa tạo về trạng thái Tạm khóa (INACTIVE/Bản nháp)
      // Dùng suppressAudit=true để không bị sinh lặp log thừa, chỉ lưu duy nhất 1 log tạo chuyên khoa (SPECIALTY_CREATED)
      try {
        await updateSpecialty(request, created.id, { status: 'INACTIVE' }, { suppressAudit: true });
        created.status = 'INACTIVE';
      } catch (statusErr) {
        console.warn('Could not set initial draft status:', statusErr);
      }

      createForm.resetFields();
      setCreateModalOpen(false);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Tạo chuyên khoa thành công!',
        description: `Chuyên khoa "${created.name}" (${created.code}) đã được tạo ở trạng thái TẠM KHÓA (Bản nháp). Quản trị viên có thể kích hoạt để đưa vào hoạt động chính thức.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Tạo chuyên khoa thất bại!',
        description: err instanceof Error ? err.message : 'Không thể tạo chuyên khoa mới.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Edit handler
  const openEdit = (sp: SpecialtyItem) => {
    registerSpecialtyToCache(sp.id, sp.name);
    setSpecialtyToEdit(sp);
    editForm.setFieldsValue({
      name: sp.name,
      description: sp.description ?? '',
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: UpdateSpecialtyPayload) => {
    if (!specialtyToEdit) return;
    registerSpecialtyToCache(specialtyToEdit.id, values.name || specialtyToEdit.name);
    setSubmitting(true);
    try {
      const updated = await updateSpecialty(request, specialtyToEdit.id, values);
      registerSpecialtyToCache(updated.id, updated.name);
      editForm.resetFields();
      setEditModalOpen(false);
      setSpecialtyToEdit(null);
      if (selectedSpecialty?.id === specialtyToEdit.id) {
        setSelectedSpecialty(updated);
      }
      setFeedback({
        open: true,
        type: 'success',
        title: 'Cập nhật thành công!',
        description: `Thông tin chuyên khoa "${updated.name}" đã được cập nhật thành công.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: 'Cập nhật thất bại!',
        description: err instanceof Error ? err.message : 'Không thể cập nhật chuyên khoa.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const openDelete = (sp: SpecialtyItem) => {
    registerSpecialtyToCache(sp.id, sp.name);
    setSpecialtyToDelete(sp);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!specialtyToDelete) return;
    registerSpecialtyToCache(specialtyToDelete.id, specialtyToDelete.name);
    setSubmitting(true);
    const targetName = specialtyToDelete.name;
    try {
      await deleteSpecialty(request, specialtyToDelete.id);
      setDeleteModalOpen(false);
      if (selectedSpecialty?.id === specialtyToDelete.id) {
        setDetailDrawerOpen(false);
        setSelectedSpecialty(null);
      }
      setSpecialtyToDelete(null);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Xóa chuyên khoa thành công!',
        description: `Chuyên khoa "${targetName}" đã được xóa khỏi hệ thống.`,
      });
      void loadData();
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'Không thể xóa chuyên khoa.';
      const cleanMsg = rawMsg.replace(/CANNOT_DELETE_SPECIALTY_IN_USE:\s*/i, '');
      setFeedback({
        open: true,
        type: 'error',
        title: 'Xóa chuyên khoa thất bại!',
        description: cleanMsg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Status toggle confirmation modal state
  const [statusConfirmModalOpen, setStatusConfirmModalOpen] = useState(false);
  const [specialtyForStatusToggle, setSpecialtyForStatusToggle] = useState<SpecialtyItem | null>(null);
  const [statusToggleLoading, setStatusToggleLoading] = useState(false);

  // Open confirmation modal for status toggle (Pause / Activate) with constraint check
  const handleToggleStatus = (sp: SpecialtyItem) => {
    registerSpecialtyToCache(sp.id, sp.name);
    if (sp.status === 'ACTIVE') {
      const doctorsInSpecialty = doctors.filter((d) =>
        d.status === 'ACTIVE' && d.specialties?.some((s) => s.id === sp.id || s.code === sp.code),
      );
      if (doctorsInSpecialty.length > 0) {
        setFeedback({
          open: true,
          type: 'error',
          title: 'Không thể tạm khóa chuyên khoa!',
          description: `Hiện đang có ${doctorsInSpecialty.length} bác sĩ hoạt động thuộc chuyên khoa "${sp.name}". Vui lòng điều chuyển chuyên khoa của các bác sĩ trước khi tạm khóa.`,
        });
        return;
      }
    }
    setSpecialtyForStatusToggle(sp);
    setStatusConfirmModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!specialtyForStatusToggle) return;
    registerSpecialtyToCache(specialtyForStatusToggle.id, specialtyForStatusToggle.name);
    setStatusToggleLoading(true);
    const sp = specialtyForStatusToggle;
    const isActivating = sp.status !== 'ACTIVE';
    const nextStatus = isActivating ? 'ACTIVE' : 'INACTIVE';
    const actionText = isActivating ? 'Kích hoạt' : 'Tạm khóa';

    try {
      const updated = await updateSpecialty(request, sp.id, { status: nextStatus });
      registerSpecialtyToCache(updated.id, updated.name);
      setStatusConfirmModalOpen(false);
      setSpecialtyForStatusToggle(null);
      if (selectedSpecialty?.id === sp.id) {
        setSelectedSpecialty(updated);
      }
      setFeedback({
        open: true,
        type: 'success',
        title: `${actionText} chuyên khoa thành công!`,
        description: `Chuyên khoa "${sp.name}" đã được chuyển sang trạng thái ${isActivating ? 'HOẠT ĐỘNG' : 'TẠM KHÓA'}.`,
      });
      void loadData();
    } catch (err: unknown) {
      setFeedback({
        open: true,
        type: 'error',
        title: `${actionText} thất bại!`,
        description: err instanceof Error ? err.message : `Không thể ${actionText.toLowerCase()} chuyên khoa.`,
      });
    } finally {
      setStatusToggleLoading(false);
    }
  };

  // Doctors belonging to selected specialty in detail drawer
  const doctorsInSelectedSpecialty = useMemo(() => {
    if (!selectedSpecialty) return [];
    return doctors.filter((d) =>
      d.specialties?.some((s) => s.id === selectedSpecialty.id || s.code === selectedSpecialty.code),
    );
  }, [doctors, selectedSpecialty]);

  const columns: ColumnsType<SpecialtyItem> = [
    {
      title: 'Chuyên khoa',
      key: 'nameInfo',
      width: '26%',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <div>
            <span className="admin-code" style={{ fontWeight: 600, color: '#0284c7', fontSize: 12 }}>
              {record.code}
            </span>
          </div>
          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>{record.name}</span>
        </Space>
      ),
    },
    {
      title: 'Bác sĩ phụ trách',
      key: 'doctorCount',
      width: '15%',
      align: 'center',
      render: (_, record) => {
        const count = doctors.filter((d) =>
          d.specialties?.some((s) => s.id === record.id || s.code === record.code),
        ).length;
        return (
          <Tooltip title={`${count} bác sĩ phụ trách chuyên khoa này`}>
            <Space size={6}>
              <TeamOutlined style={{ color: count > 0 ? '#0284c7' : '#94a3b8' }} />
              <Badge
                count={count}
                showZero
                style={{ backgroundColor: count > 0 ? '#0284c7' : '#94a3b8' }}
              />
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: 'Mô tả chuyên khoa',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc?: string | null) =>
        desc ? (
          <Tooltip title={desc} placement="topLeft">
            <span style={{ color: '#475569', fontSize: 13 }}>{desc}</span>
          </Tooltip>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Chưa có mô tả</span>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status: string) => <StatusTag status={status} />,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                icon={<EyeOutlined style={{ color: 'var(--accent)' }} />}
                onClick={() => {
                  setSelectedSpecialty(record);
                  setDetailDrawerOpen(true);
                }}
              />
            </Tooltip>
            {record.status === 'ACTIVE' ? (
              <Tooltip title="Tạm khóa chuyên khoa">
                <Button
                  type="text"
                  icon={<PauseCircleOutlined style={{ color: '#fa8c16' }} />}
                  onClick={() => void handleToggleStatus(record)}
                />
              </Tooltip>
            ) : (
              <Tooltip title="Kích hoạt chuyên khoa">
                <Button
                  type="text"
                  icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => void handleToggleStatus(record)}
                />
              </Tooltip>
            )}
            <Tooltip title="Chỉnh sửa">
              <Button
                type="text"
                icon={<EditOutlined style={{ color: 'var(--deep)' }} />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
            <Tooltip title="Xóa chuyên khoa">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => openDelete(record)}
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
        {/* Toolbar */}
        <div className="admin-toolbar">
          <Space wrap size="middle">
            <Input
              placeholder="Tìm theo tên hoặc mã chuyên khoa…"
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ width: 280 }}
            />
            <Select
              placeholder="Lọc trạng thái"
              allowClear
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              style={{ width: 170 }}
              options={[
                { label: 'Tất cả trạng thái', value: '' },
                { label: 'Hoạt động (ACTIVE)', value: 'ACTIVE' },
                { label: 'Tạm khóa (INACTIVE)', value: 'INACTIVE' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={handleReset} loading={loading}>
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
                setCreateModalOpen(true);
              }}
            >
              Thêm chuyên khoa
            </Button>
          </Space>
        </div>

        {/* Table */}
        <Table<SpecialtyItem>
          rowKey="id"
          columns={columns}
          dataSource={filteredSpecialties}
          loading={loading}
          size="middle"
          onRow={(record) => ({
            onClick: () => {
              setSelectedSpecialty(record);
              setDetailDrawerOpen(true);
            },
            className: 'admin-row-clickable',
          })}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng cộng ${total} chuyên khoa`,
          }}
        />
      </div>

      {/* Modal Thêm chuyên khoa mới */}
      <Modal
        title="Thêm chuyên khoa mới"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label="Mã chuyên khoa (Viết hoa, không dấu)"
            rules={[
              { required: true, message: 'Vui lòng nhập mã chuyên khoa' },
              { pattern: /^[A-Z0-9_]+$/, message: 'Mã chuyên khoa chỉ bao gồm chữ in hoa, số và dấu gạch dưới' },
            ]}
          >
            <Input placeholder="ví dụ: OBGYN, PEDIATRICS, CARDIOLOGY" />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên chuyên khoa"
            rules={[{ required: true, message: 'Vui lòng nhập tên chuyên khoa' }]}
          >
            <Input placeholder="ví dụ: Sản Phụ Khoa, Nhi Khoa" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả chuyên khoa">
            <Input.TextArea rows={3} placeholder="Mô tả phạm vi khám chữa bệnh của chuyên khoa..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Tạo chuyên khoa
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa chuyên khoa */}
      <Modal
        title={`Chỉnh sửa chuyên khoa: ${specialtyToEdit?.name ?? ''}`}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setSpecialtyToEdit(null);
        }}
        footer={null}
        destroyOnClose
        centered
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Tên chuyên khoa"
            rules={[{ required: true, message: 'Vui lòng nhập tên chuyên khoa' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Mô tả chuyên khoa">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setEditModalOpen(false);
                  setSpecialtyToEdit(null);
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

      {/* Modal Xác nhận xóa chuyên khoa */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>Xác nhận xóa chuyên khoa</span>
          </Space>
        }
        open={deleteModalOpen}
        centered
        onCancel={() => {
          if (!submitting) {
            setDeleteModalOpen(false);
            setSpecialtyToDelete(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              danger
              type="primary"
              loading={submitting}
              onClick={() => void handleConfirmDelete()}
            >
              Xóa
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                setDeleteModalOpen(false);
                setSpecialtyToDelete(null);
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
            Bạn có chắc chắn muốn xóa chuyên khoa <strong>{specialtyToDelete?.name}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            Hành động này sẽ xóa chuyên khoa khỏi hệ thống. Chỉ xóa được chuyên khoa khi không có bác sĩ nào trực thuộc.
          </p>
        </div>
      </Modal>

      {/* Modal Xác nhận tạm khóa / kích hoạt chuyên khoa */}
      <Modal
        title={
          <Space>
            {specialtyForStatusToggle?.status === 'ACTIVE' ? (
              <PauseCircleOutlined style={{ color: '#fa8c16' }} />
            ) : (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
            <span>
              {specialtyForStatusToggle?.status === 'ACTIVE'
                ? 'Xác nhận tạm khóa chuyên khoa'
                : 'Xác nhận kích hoạt chuyên khoa'}
            </span>
          </Space>
        }
        open={statusConfirmModalOpen}
        centered
        onCancel={() => {
          if (!statusToggleLoading) {
            setStatusConfirmModalOpen(false);
            setSpecialtyForStatusToggle(null);
          }
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button
              type="primary"
              style={
                specialtyForStatusToggle?.status === 'ACTIVE'
                  ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
                  : { backgroundColor: '#52c41a', borderColor: '#52c41a' }
              }
              loading={statusToggleLoading}
              onClick={() => void handleConfirmToggleStatus()}
            >
              {specialtyForStatusToggle?.status === 'ACTIVE' ? 'Tạm khóa' : 'Kích hoạt'}
            </Button>
            <Button
              disabled={statusToggleLoading}
              onClick={() => {
                setStatusConfirmModalOpen(false);
                setSpecialtyForStatusToggle(null);
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
              {specialtyForStatusToggle?.status === 'ACTIVE' ? 'tạm khóa' : 'kích hoạt lại'}
            </strong>{' '}
            chuyên khoa <strong>{specialtyForStatusToggle?.name}</strong>?
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>
            {specialtyForStatusToggle?.status === 'ACTIVE'
              ? 'Khi tạm khóa, chuyên khoa này sẽ không hiển thị cho bệnh nhân đặt lịch khám mới.'
              : 'Sau khi kích hoạt, chuyên khoa này sẽ hoạt động trở lại bình thường trên toàn hệ thống.'}
          </p>
        </div>
      </Modal>

      {/* Drawer Chi tiết chuyên khoa & Bác sĩ trực thuộc */}
      <Drawer
        title="Chi tiết chuyên khoa"
        placement="right"
        width={580}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        destroyOnClose
      >
        {selectedSpecialty && (
          <div>
            <Descriptions
              bordered
              column={1}
              size="middle"
              items={[
                {
                  key: 'code',
                  label: 'Mã chuyên khoa',
                  children: <span className="admin-code">{selectedSpecialty.code}</span>,
                },
                {
                  key: 'name',
                  label: 'Tên chuyên khoa',
                  children: <strong>{selectedSpecialty.name}</strong>,
                },
                {
                  key: 'status',
                  label: 'Trạng thái hoạt động',
                  children: <StatusTag status={selectedSpecialty.status} />,
                },
                {
                  key: 'description',
                  label: 'Mô tả chuyên khoa',
                  children: selectedSpecialty.description || <span style={{ color: 'var(--muted)' }}>Chưa có mô tả</span>,
                },
                {
                  key: 'doctorCount',
                  label: 'Số lượng bác sĩ trực thuộc',
                  children: (
                    <Tag color="blue" icon={<TeamOutlined />}>
                      {doctorsInSelectedSpecialty.length} bác sĩ
                    </Tag>
                  ),
                },
              ]}
            />

            <Divider style={{ margin: '20px 0 16px' }}>Danh sách bác sĩ trực thuộc ({doctorsInSelectedSpecialty.length})</Divider>

            {doctorsInSelectedSpecialty.length > 0 ? (
              <Table<DoctorItem>
                size="small"
                rowKey="id"
                dataSource={doctorsInSelectedSpecialty}
                pagination={false}
                columns={[
                  {
                    title: 'Bác sĩ',
                    key: 'doc',
                    render: (_, d) => (
                      <Space>
                        <Avatar style={{ backgroundColor: '#0284c7' }}>
                          {(d.profile?.fullName || 'B')[0].toUpperCase()}
                        </Avatar>
                        <div>
                          <div style={{ fontWeight: 600 }}>{d.profile?.fullName}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.profile?.professionalTitle || 'Bác sĩ'}</div>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    title: 'Số CCHN',
                    dataIndex: 'licenseNumber',
                    key: 'licenseNumber',
                    render: (cchn?: string) => (
                      <span className="admin-code">{cchn || 'Chưa cấp'}</span>
                    ),
                  },
                  {
                    title: 'Trạng thái',
                    dataIndex: 'status',
                    key: 'status',
                    render: (st: string) => <StatusTag status={st} />,
                  },
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                Chưa có bác sĩ nào được phân công vào chuyên khoa này.
              </div>
            )}

            <Divider style={{ margin: '24px 0 16px' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              {selectedSpecialty.status === 'ACTIVE' ? (
                <Button
                  style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
                  icon={<PauseCircleOutlined />}
                  onClick={() => void handleToggleStatus(selectedSpecialty)}
                >
                  Tạm khóa
                </Button>
              ) : (
                <Button
                  style={{ color: '#52c41a', borderColor: '#52c41a' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => void handleToggleStatus(selectedSpecialty)}
                >
                  Kích hoạt
                </Button>
              )}
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  const s = selectedSpecialty;
                  setDetailDrawerOpen(false);
                  openEdit(s);
                }}
              >
                Chỉnh sửa
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  const s = selectedSpecialty;
                  setDetailDrawerOpen(false);
                  openDelete(s);
                }}
              >
                Xóa chuyên khoa
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* AdminFeedbackModal */}
      <AdminFeedbackModal
        feedback={feedback}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}

export default AdminSpecialtiesPage;
