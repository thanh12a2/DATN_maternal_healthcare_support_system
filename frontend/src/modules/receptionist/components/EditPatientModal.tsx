import {
  CalendarOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Button,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import type { Requester } from '../../../services/catalog';
import {
  updatePatientProfile,
  type DeskPatient,
} from '../../../services/receptionDesk';

interface Props {
  open: boolean;
  patient: DeskPatient | null;
  request: Requester;
  onClose: () => void;
  onSuccess: (updated: DeskPatient) => void;
}

export function EditPatientModal({
  open,
  patient,
  request,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && patient) {
      const emergency = patient.emergencyContacts?.[0];
      form.setFieldsValue({
        fullName: patient.fullName,
        dateOfBirth: patient.dateOfBirth ? dayjs(patient.dateOfBirth) : null,
        phoneNumber: patient.phone || '',
        nationalId: patient.nationalId || (patient.nationalIdMasked ? '' : ''),
        address: patient.address || '',
        emergencyId: emergency?.id,
        emergencyFullName: emergency?.fullName || '',
        emergencyRelationship: emergency?.relationship || 'Người thân',
        emergencyPhone: emergency?.phone || '',
      });
    }
  }, [open, patient, form]);

  const handleFinish = async (values: any) => {
    if (!patient) return;
    setSubmitting(true);
    try {
      const dobStr = values.dateOfBirth
        ? dayjs(values.dateOfBirth).format('YYYY-MM-DD')
        : '1995-01-01';

      const updated = await updatePatientProfile(request, {
        patientId: patient.id,
        version: patient.version || 1,
        fullName: values.fullName,
        dateOfBirth: dobStr,
        phoneNumber: values.phoneNumber,
        nationalId: values.nationalId,
        address: values.address,
        emergencyContact: values.emergencyFullName
          ? {
              id: values.emergencyId,
              fullName: values.emergencyFullName,
              relationship: values.emergencyRelationship,
              phoneNumber: values.emergencyPhone,
            }
          : undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi cập nhật hồ sơ bệnh nhân:', err);
      // Giữ modal mở để người dùng xem thông báo lỗi từ Ant App message
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined style={{ color: '#0B5CAD', fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            Chỉnh sửa thông tin hành chính bệnh nhân
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      centered
      width={640}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        style={{ marginTop: 16 }}
      >
        <Form.Item name="emergencyId" hidden>
          <Input />
        </Form.Item>

        <Typography.Text
          strong
          style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}
        >
          1. Thông tin cá nhân cơ bản
        </Typography.Text>

        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={14}>
            <Form.Item
              name="fullName"
              label="Họ và tên"
              rules={[
                { required: true, message: 'Vui lòng nhập họ và tên' },
                { min: 2, message: 'Tối thiểu 2 ký tự' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Ví dụ: Hoàng Thùy Dương"
              />
            </Form.Item>
          </Col>

          <Col span={10}>
            <Form.Item
              name="dateOfBirth"
              label="Ngày sinh"
              rules={[{ required: true, message: 'Vui lòng chọn ngày sinh' }]}
            >
              <DatePicker
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                placeholder="Chọn ngày sinh"
                maxDate={dayjs()}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="phoneNumber"
              label="Số điện thoại"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại' },
                {
                  pattern: /^(0|\+84)\d{9,10}$/,
                  message: 'Số điện thoại không đúng định dạng (10 số)',
                },
              ]}
            >
              <Input
                prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Ví dụ: 0901234009"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="nationalId"
              label="Số CCCD / Định danh (12 số)"
              rules={[
                {
                  pattern: /^\d{9,12}$/,
                  message: 'CCCD phải gồm 9 đến 12 chữ số',
                },
              ]}
            >
              <Input
                prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Ví dụ: 001196000105"
                maxLength={12}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="address"
          label={
            <span>
              <EnvironmentOutlined style={{ color: '#0B5CAD', marginRight: 4 }} />
              Địa chỉ thường trú
            </span>
          }
        >
          <Input.TextArea
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành..."
            rows={2}
          />
        </Form.Item>

        <Divider style={{ margin: '16px 0 12px 0' }} />

        <Typography.Text
          strong
          style={{ fontSize: 13, color: '#64748b', textTransform: 'uppercase' }}
        >
          2. Người liên hệ khẩn cấp
        </Typography.Text>

        <Row gutter={16} style={{ marginTop: 8 }}>
          <Col span={10}>
            <Form.Item name="emergencyFullName" label="Họ tên người thân">
              <Input placeholder="Ví dụ: Hoàng Văn Nam" />
            </Form.Item>
          </Col>

          <Col span={6}>
            <Form.Item name="emergencyRelationship" label="Mối quan hệ">
              <Select
                placeholder="Chọn"
                options={[
                  { value: 'Bố đẻ', label: 'Bố đẻ' },
                  { value: 'Mẹ đẻ', label: 'Mẹ đẻ' },
                  { value: 'Chồng', label: 'Chồng' },
                  { value: 'Vợ', label: 'Vợ' },
                  { value: 'Con', label: 'Con' },
                  { value: 'Anh/Chị/Em', label: 'Anh/Chị/Em' },
                  { value: 'Người giám hộ', label: 'Người giám hộ' },
                  { value: 'Người thân', label: 'Người thân khác' },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              name="emergencyPhone"
              label="SĐT người thân"
              rules={[
                {
                  pattern: /^(0|\+84)\d{9,10}$/,
                  message: 'SĐT không đúng định dạng',
                },
              ]}
            >
              <Input
                prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                placeholder="0901234010"
              />
            </Form.Item>
          </Col>
        </Row>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            marginTop: 20,
            borderTop: '1px solid #f1f5f9',
            paddingTop: 16,
          }}
        >
          <Button onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            style={{
              backgroundColor: '#0B5CAD',
              borderRadius: 6,
              fontWeight: 600,
              padding: '0 20px',
            }}
          >
            Lưu thay đổi
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
