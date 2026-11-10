import React, { useEffect, useState, useMemo } from 'react';
import {
  MedicineBoxOutlined,
  CalendarOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  LoadingOutlined,
  FormOutlined,
  ScheduleOutlined,
  TagOutlined,
  CheckOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Table,
  DatePicker,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { Requester } from '../../../services/catalog';
import {
  listPrescriptions,
  createPrescription,
  updatePrescription,
  listTreatmentPlans,
  createTreatmentPlan,
  updateTreatmentPlan,
  treatmentPlanAction,
  listMedications,
  listTreatmentPlanTemplates,
} from '../../../services/clinical';
import type {
  Medication,
  Prescription,
  TreatmentPlan,
  TreatmentPlanTemplate,
} from '../../../services/clinical';
import '../../../styles/doctor-clinical-orders.css';

interface DoctorClinicalOrdersProps {
  request: Requester;
  encounterId: string;
  patientId: string;
  encounterState: string;
}

function formatFollowUpDateDisplay(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = dayjs(dateStr);
  if (!d.isValid()) return null;
  const dayNames = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy',
  ];
  const dayName = dayNames[d.day()];
  const formatted = d.format('DD/MM/YYYY');
  const today = dayjs().startOf('day');
  const target = d.startOf('day');
  const diffDays = target.diff(today, 'day');
  let relativeText = '';
  if (diffDays === 0) relativeText = 'Hôm nay';
  else if (diffDays === 1) relativeText = 'Ngày mai';
  else if (diffDays > 1) {
    if (diffDays % 7 === 0) {
      relativeText = `sau ${diffDays / 7} tuần (${diffDays} ngày)`;
    } else {
      relativeText = `sau ${diffDays} ngày`;
    }
  } else if (diffDays < 0) {
    relativeText = `quá hạn ${Math.abs(diffDays)} ngày`;
  }
  return {
    dayName,
    formatted,
    relativeText,
    diffDays,
  };
}

export function DoctorClinicalOrders({
  request,
  encounterId,
  patientId,
  encounterState,
}: DoctorClinicalOrdersProps) {
  const canEdit = encounterState === 'IN_PROGRESS';

  // ─── STATE ĐƠN THUỐC ───
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [medCatalog, setMedCatalog] = useState<Medication[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Modal thêm thuốc
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [savingMed, setSavingMed] = useState(false);
  const [selectedMedCode, setSelectedMedCode] = useState<string>('');
  const [medForm] = Form.useForm();

  // ─── STATE KẾ HOẠCH ĐIỀU TRỊ & DẶN DÒ ───
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [templates, setTemplates] = useState<TreatmentPlanTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Modal thêm dặn dò riêng
  const [customPlanModalOpen, setCustomPlanModalOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [completingItemId, setCompletingItemId] = useState<string | null>(null);
  const [customPlanForm] = Form.useForm();

  // State cục bộ ngày tái khám (Optimistic UI tức thì không độ trễ)
  const [localFollowUpDate, setLocalFollowUpDate] = useState<
    string | null | undefined
  >(undefined);

  // ─── LOAD DỮ LIỆU ĐƠN THUỐC ───
  const fetchPrescriptions = async () => {
    if (!encounterId) return;
    setPrescriptionsLoading(true);
    try {
      const data = await listPrescriptions(
        request,
        `encounterId=${encodeURIComponent(encounterId)}`,
      );
      setPrescriptions(data || []);
    } catch (err: any) {
      console.warn('Tải đơn thuốc thất bại:', err);
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  // ─── LOAD DANH MỤC THUỐC VIỆN ───
  const fetchMedCatalog = async () => {
    if (medCatalog.length > 0) return;
    setCatalogLoading(true);
    try {
      const data = await listMedications(request);
      setMedCatalog(data || []);
    } catch (err: any) {
      console.warn('Tải danh mục thuốc thất bại:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  // ─── LOAD KẾ HOẠCH ĐIỀU TRỊ ───
  const fetchPlans = async () => {
    if (!encounterId) return;
    setPlansLoading(true);
    try {
      const data = await listTreatmentPlans(
        request,
        `encounterId=${encodeURIComponent(encounterId)}`,
      );
      setPlans(data || []);
      const primary =
        (data || []).find(
          (p: any) => p.status === 'ACTIVE' || p.status === 'DRAFT',
        ) || (data || [])[0];
      if (primary?.effectiveTo) {
        setLocalFollowUpDate(String(primary.effectiveTo));
      }
    } catch (err: any) {
      console.warn('Tải kế hoạch điều trị thất bại:', err);
    } finally {
      setPlansLoading(false);
    }
  };

  // ─── LOAD MẪU DẶN DÒ TỪ DATABASE (treatment_plan_templates) ───
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await listTreatmentPlanTemplates(request);
      setTemplates(data || []);
    } catch (err: any) {
      console.warn('Tải mẫu dặn dò thất bại:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    void fetchPrescriptions();
    void fetchPlans();
    void fetchMedCatalog();
    void fetchTemplates();
  }, [encounterId]);

  // Đơn thuốc chính của ca khám này
  const activePrescription = useMemo(() => {
    return (
      prescriptions.find((p) => p.status === 'DRAFT') ||
      prescriptions.find((p) => p.status === 'ISSUED') ||
      prescriptions[0] ||
      null
    );
  }, [prescriptions]);

  // Kế hoạch điều trị chính của ca khám này
  const activePlan = useMemo(() => {
    return (
      plans.find((p) => p.status === 'ACTIVE') ||
      plans.find((p) => p.status === 'DRAFT') ||
      plans[0] ||
      null
    );
  }, [plans]);

  // Danh sách thuốc trong đơn hiện tại
  const medicationItems = useMemo(() => {
    if (!activePrescription || !Array.isArray(activePrescription.items))
      return [];
    return activePrescription.items as any[];
  }, [activePrescription]);

  // Danh sách lời dặn trong kế hoạch hiện tại
  const planItems = useMemo(() => {
    if (!activePlan || !Array.isArray(activePlan.items)) return [];
    return activePlan.items as any[];
  }, [activePlan]);

  // Thuốc đang chọn trong modal
  const currentSelectedMed = useMemo(() => {
    return medCatalog.find((m) => m.code === selectedMedCode) || null;
  }, [medCatalog, selectedMedCode]);

  // ─── XỬ LÝ CHỌN THUỐC TỪ DANH MỤC ───
  const handleSelectMedication = (code: string) => {
    setSelectedMedCode(code);
    const med = medCatalog.find((m) => m.code === code);
    if (med) {
      medForm.setFieldsValue({
        medicationName: med.name,
        dose: med.defaultDose || '1 viên',
        route: med.route || 'Uống',
        frequency: med.defaultFrequency || '1 lần/ngày',
        durationDays: 30,
        instruction:
          med.defaultInstruction || 'Uống sau ăn 30 phút với nhiều nước.',
      });
    }
  };

  // ─── MỞ MODAL THÊM THUỐC ───
  const handleOpenAddMedModal = () => {
    medForm.resetFields();
    setSelectedMedCode('');
    setMedModalOpen(true);
    void fetchMedCatalog();
  };

  // ─── LƯU THUỐC VÀO ĐƠN ───
  const handleSaveMedication = async (values: any) => {
    if (!patientId || !encounterId) {
      message.error('Thiếu thông tin bệnh nhân hoặc ca khám.');
      return;
    }

    setSavingMed(true);
    try {
      const med = currentSelectedMed;
      const newItem = {
        medicationCode: selectedMedCode || null,
        medicationName: med ? med.name : values.medicationName,
        strength: med ? med.strength : null,
        dosageForm: med ? med.dosageForm : null,
        dose: values.dose?.trim() || '1 viên',
        route: values.route?.trim() || 'Uống',
        frequency: values.frequency?.trim() || '1 lần/ngày',
        durationDays: values.durationDays ? Number(values.durationDays) : null,
        instruction: values.instruction?.trim() || '',
      };

      if (!activePrescription) {
        await createPrescription(request, {
          encounterId,
          patientId,
          items: [newItem],
        });
        message.success(`Đã thêm thuốc "${newItem.medicationName}" vào đơn.`);
      } else {
        const existingItems = Array.isArray(activePrescription.items)
          ? activePrescription.items
          : [];
        await updatePrescription(request, String(activePrescription.id), {
          version: activePrescription.version,
          items: [...existingItems, newItem],
        });
        message.success(`Đã thêm thuốc "${newItem.medicationName}" vào đơn.`);
      }

      setMedModalOpen(false);
      await fetchPrescriptions();
    } catch (err: any) {
      message.error(err?.message || 'Không thể lưu thuốc vào đơn.');
    } finally {
      setSavingMed(false);
    }
  };

  // ─── XÓA THUỐC KHỎI ĐƠN ───
  const handleDeleteMedication = async (index: number) => {
    if (!activePrescription) return;
    try {
      const existingItems = Array.isArray(activePrescription.items)
        ? [...activePrescription.items]
        : [];
      existingItems.splice(index, 1);
      await updatePrescription(request, String(activePrescription.id), {
        version: activePrescription.version,
        items: existingItems,
      });
      message.success('Đã xóa thuốc khỏi đơn.');
      await fetchPrescriptions();
    } catch (err: any) {
      message.error(err?.message || 'Không thể xóa thuốc.');
    }
  };

  // ─── THÊM NHANH TỪ MẪU DẶN DÒ DB (treatment_plan_templates) ───
  const handleApplyTemplate = async (template: TreatmentPlanTemplate) => {
    if (!patientId || !encounterId) return;

    // Kiểm tra xem lời dặn này đã có trong danh sách chưa
    const isExisted = planItems.some(
      (it) =>
        it.title === template.title || it.description === template.content,
    );
    if (isExisted) {
      message.info(`Lời dặn "${template.title}" đã có trong kế hoạch.`);
      return;
    }

    try {
      const newItem = {
        type: 'CARE_INSTRUCTION',
        title: template.title,
        description: template.content,
      };

      if (!activePlan) {
        await createTreatmentPlan(request, {
          encounterId,
          patientId,
          title: 'Kế hoạch theo dõi & Chăm sóc thai kỳ',
          summary:
            'Dặn dò chế độ dinh dưỡng, theo dõi thai máy và lịch hẹn tái khám.',
          items: [newItem],
        });
        message.success(`Đã thêm dặn dò "${template.title}".`);
      } else {
        const existingItems = Array.isArray(activePlan.items)
          ? activePlan.items
          : [];
        await updateTreatmentPlan(request, String(activePlan.id), {
          reason: 'Bác sĩ cập nhật kế hoạch chăm sóc',
          version: activePlan.version,
          title: activePlan.title || 'Kế hoạch theo dõi & Chăm sóc thai kỳ',
          summary: activePlan.summary || 'Kế hoạch theo dõi thai kỳ',
          items: [...existingItems, newItem],
        });
        message.success(`Đã thêm dặn dò "${template.title}".`);
      }

      await fetchPlans();
    } catch (err: any) {
      message.error(err?.message || 'Không thể áp dụng mẫu dặn dò.');
    }
  };

  // ─── THÊM LỜI DẶN TỰ DO CÁ NHÂN HÓA ───
  const handleSaveCustomPlan = async (values: any) => {
    if (!patientId || !encounterId) return;

    setSavingPlan(true);
    try {
      const newItem = {
        type: 'CARE_INSTRUCTION',
        title: values.title?.trim(),
        description: values.description?.trim() || '',
      };

      if (!activePlan) {
        await createTreatmentPlan(request, {
          encounterId,
          patientId,
          title: 'Kế hoạch theo dõi & Chăm sóc thai kỳ',
          summary: 'Dặn dò thai kỳ cá thể hóa.',
          items: [newItem],
        });
        message.success(`Đã thêm dặn dò "${newItem.title}".`);
      } else {
        const existingItems = Array.isArray(activePlan.items)
          ? activePlan.items
          : [];
        await updateTreatmentPlan(request, String(activePlan.id), {
          reason: 'Bác sĩ cập nhật kế hoạch chăm sóc',
          version: activePlan.version,
          title: activePlan.title || 'Kế hoạch theo dõi & Chăm sóc thai kỳ',
          summary: activePlan.summary || 'Kế hoạch theo dõi thai kỳ',
          items: [...existingItems, newItem],
        });
        message.success(`Đã thêm dặn dò "${newItem.title}".`);
      }

      setCustomPlanModalOpen(false);
      customPlanForm.resetFields();
      await fetchPlans();
    } catch (err: any) {
      message.error(err?.message || 'Không thể lưu dặn dò.');
    } finally {
      setSavingPlan(false);
    }
  };

  // ─── XÓA DẶN DÒ KHỎI KẾ HOẠCH ───
  const handleDeletePlanItem = async (index: number) => {
    if (!activePlan) return;
    try {
      const existingItems = Array.isArray(activePlan.items)
        ? [...activePlan.items]
        : [];
      existingItems.splice(index, 1);
      await updateTreatmentPlan(request, String(activePlan.id), {
        reason: 'Bác sĩ cập nhật kế hoạch chăm sóc',
        version: activePlan.version,
        title: activePlan.title || 'Kế hoạch theo dõi thai kỳ',
        summary: activePlan.summary || '',
        items: existingItems,
      });
      message.success('Đã xóa dặn dò.');
      await fetchPlans();
    } catch (err: any) {
      message.error(err?.message || 'Không thể xóa dặn dò.');
    }
  };

  // ─── CẬP NHẬT NGÀY HẸN TÁI KHÁM ───
  const handleUpdateFollowUpDate = async (
    daysToAdd: number | null,
    customDate?: string,
  ) => {
    if (!encounterId) return;
    try {
      let targetDate: string | null = null;
      if (customDate !== undefined) {
        targetDate = customDate ? customDate : null;
      } else if (daysToAdd !== null) {
        targetDate = dayjs().add(daysToAdd, 'day').format('YYYY-MM-DD');
      }

      // Cập nhật state cục bộ ngay lập tức để giao diện hiển thị tức thì
      setLocalFollowUpDate(targetDate);

      const defaultItem = {
        type: 'APPOINTMENT',
        title: `Tái khám thai định kỳ (${targetDate ? dayjs(targetDate).format('DD/MM/YYYY') : 'Theo lịch hẹn'})`,
        description:
          'Khám kiểm tra định kỳ, theo dõi cử động thai và đánh giá các chỉ số phát triển của thai nhi.',
        dueAt: targetDate ? `${targetDate}T08:00:00+07:00` : undefined,
      };

      if (!activePlan) {
        const createRes: any = await createTreatmentPlan(request, {
          encounterId,
          patientId,
          title: 'Kế hoạch theo dõi & Chăm sóc thai kỳ',
          summary: 'Dặn dò chế độ dinh dưỡng và lịch hẹn tái khám.',
          effectiveTo: targetDate,
          items: targetDate ? [defaultItem] : [],
        });
        const created = createRes?.data || createRes;
        if (created && created.id) {
          setPlans([created]);
        }
      } else {
        await updateTreatmentPlan(request, String(activePlan.id), {
          reason: 'Bác sĩ cập nhật kế hoạch chăm sóc',
          version: activePlan.version,
          title: activePlan.title || 'Kế hoạch theo dõi thai kỳ',
          summary: activePlan.summary || '',
          effectiveTo: targetDate,

          items: activePlan.items || [],
        });
      }

      setPlans((prev) => {
        if (!prev.length && targetDate) {
          return [
            {
              id: 'temp-plan',
              title: 'Kế hoạch theo dõi thai kỳ',
              effectiveTo: targetDate,
              version: 1,
              status: 'ACTIVE',
              items: [defaultItem],
            } as any,
          ];
        }
        return prev.map((p) =>
          p.id === activePlan?.id
            ? {
                ...p,
                effectiveTo: targetDate,
                version: Number(p.version || 1) + 1,
              }
            : p,
        );
      });

      message.success(
        targetDate
          ? `Đã đặt lịch hẹn tái khám: ${dayjs(targetDate).format('DD/MM/YYYY')}`
          : 'Đã hủy lịch hẹn tái khám.',
      );
      await fetchPlans();
    } catch (err: any) {
      console.error('Lỗi cập nhật lịch hẹn tái khám:', err);
      message.error(err?.message || 'Không thể cập nhật ngày tái khám.');
    }
  };

  // Render FDA pregnancy category
  const renderPregnancyTag = (category?: string) => {
    if (!category) return null;
    const cat = category.toUpperCase().replace('CATEGORY_', '');
    if (cat === 'A') {
      return (
        <span
          className="fda-badge badge-cat-a"
          title="An toàn tuyệt đối cho thai phụ"
        >
          FDA A · An toàn
        </span>
      );
    }
    if (cat === 'B') {
      return (
        <span
          className="fda-badge badge-cat-b"
          title="Thận trọng, thường an toàn"
        >
          FDA B · Thận trọng
        </span>
      );
    }
    if (cat === 'C') {
      return (
        <span
          className="fda-badge badge-cat-c"
          title="Cân nhắc kỹ lợi ích và nguy cơ"
        >
          FDA C · Cân nhắc
        </span>
      );
    }
    if (cat === 'D') {
      return (
        <span
          className="fda-badge badge-cat-d"
          title="Có bằng chứng nguy cơ cho thai"
        >
          FDA D · Nguy cơ
        </span>
      );
    }
    if (cat === 'X') {
      return (
        <span
          className="fda-badge badge-cat-x"
          title="Chống chỉ định tuyệt đối cho thai kỳ"
        >
          FDA X · Chống chỉ định
        </span>
      );
    }
    return <span className="fda-badge badge-cat-b">FDA {cat}</span>;
  };

  // Cột bảng cho Đơn thuốc
  const medicationColumns: ColumnsType<any> = [
    {
      title: 'STT',
      key: 'index',
      width: 55,
      align: 'center',
      render: (_text, _record, index) => (
        <span className="table-row-index">
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Tên thuốc & Hoạt chất',
      key: 'name',
      width: 280,
      render: (_text, item) => {
        const catalogEntry = medCatalog.find(
          (m) => m.code === item.medicationCode,
        );
        return (
          <div className="table-med-name-cell">
            <strong className="table-med-title">{item.medicationName}</strong>
            <span className="table-med-subtitle">
              {[item.strength, item.dosageForm, catalogEntry?.activeIngredient]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        );
      },
    },
    {
      title: 'An toàn thai kỳ (FDA)',
      key: 'pregnancySafety',
      width: 150,
      align: 'center',
      render: (_text, item) => {
        const catalogEntry = medCatalog.find(
          (m) => m.code === item.medicationCode,
        );
        return renderPregnancyTag(catalogEntry?.pregnancyCategory);
      },
    },
    {
      title: 'Liều & Đường dùng',
      key: 'doseRoute',
      width: 160,
      render: (_text, item) => (
        <span className="table-dose-cell">
          <strong>{item.dose || '1 viên'}</strong> · {item.route || 'Uống'}
        </span>
      ),
    },
    {
      title: 'Tần suất & Số ngày',
      key: 'frequencyDuration',
      width: 170,
      render: (_text, item) => (
        <span className="table-freq-cell">
          <strong>{item.frequency || '1 lần/ngày'}</strong>
          {item.durationDays && (
            <span className="table-duration-badge">
              ({item.durationDays} ngày)
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'Hướng dẫn sử dụng dành cho thai phụ',
      dataIndex: 'instruction',
      key: 'instruction',
      render: (text) => (
        <span className="table-instruction-cell">
          {text || 'Dùng theo chỉ dẫn của bác sĩ.'}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 75,
      align: 'center',
      render: (_text, _item, index) => {
        if (!canEdit) return null;
        return (
          <Popconfirm
            title="Xóa thuốc này khỏi đơn?"
            onConfirm={() => void handleDeleteMedication(index)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Xóa thuốc"
            />
          </Popconfirm>
        );
      },
    },
  ];

  // Gom nhóm template từ DB theo category
  const categorizedTemplates = useMemo(() => {
    return {
      diet: templates.filter((t) => t.category === 'DIET'),
      fetal: templates.filter((t) => t.category === 'FETAL_MONITORING'),
      maternal: templates.filter((t) => t.category === 'MATERNAL_HEALTH'),
      emergency: templates.filter((t) => t.category === 'EMERGENCY_WARNING'),
    };
  }, [templates]);

  return (
    <div className="clinical-orders-workbench">
      <div className="clinical-orders-stack">
        {/* ========================================================================= */}
        {/* PHẦN 1: ĐƠN THUỐC ĐIỀU TRỊ THAI KỲ                                         */}
        {/* ========================================================================= */}
        <div className="clinical-orders-card prescriptions-column">
          <div className="orders-card-header">
            <div className="card-header-title">
              <span className="header-icon-wrap icon-blue">
                <MedicineBoxOutlined />
              </span>
              <div className="header-title-text">
                <h4>Đơn thuốc điều trị thai kỳ</h4>
                <div className="header-badges">
                  <Tag
                    color="blue"
                    style={{ fontWeight: 700, borderRadius: 12 }}
                  >
                    {medicationItems.length} thuốc
                  </Tag>
                  {medicationItems.length > 0 && (
                    <Tag
                      color="success"
                      icon={<CheckCircleOutlined />}
                      style={{ fontWeight: 600, borderRadius: 12 }}
                    >
                      Đã tự động lưu
                    </Tag>
                  )}
                </div>
              </div>
            </div>

            <div className="card-header-actions">
              {canEdit && (
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleOpenAddMedModal}
                  style={{ background: '#0B5CAD', fontWeight: 600 }}
                >
                  Thêm thuốc
                </Button>
              )}
            </div>
          </div>

          <div className="orders-card-body">
            {prescriptionsLoading ? (
              <div className="orders-loading-state">
                <LoadingOutlined
                  spin
                  style={{ fontSize: 24, color: '#0B5CAD' }}
                />
                <span>Đang tải đơn thuốc...</span>
              </div>
            ) : medicationItems.length > 0 ? (
              <div className="orders-table-wrapper">
                <Table
                  dataSource={medicationItems.map((item, idx) => ({
                    ...item,
                    key: item.id || idx,
                  }))}
                  columns={medicationColumns}
                  pagination={false}
                  size="middle"
                  className="orders-clean-table"
                />
              </div>
            ) : (
              <div className="orders-empty-state-horizontal">
                <span className="empty-icon-wrap icon-blue">
                  <MedicineBoxOutlined />
                </span>
                <div className="empty-text-wrap">
                  <strong>Chưa có thuốc trong đơn ca khám này</strong>
                  <p>
                    Bác sĩ có thể nhấn nút <b>"Thêm thuốc"</b> ở góc trên để kê
                    các loại thuốc an toàn cho thai kỳ từ danh mục dược phẩm
                    chuẩn của bệnh viện.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PHẦN 2: KẾ HOẠCH ĐIỀU TRỊ, DẶN DÒ THAI KỲ & LỊCH TÁI KHÁM                  */}
        {/* ========================================================================= */}
        <div
          className="clinical-orders-card plans-column"
          style={{ marginTop: 16 }}
        >
          <div className="orders-card-header">
            <div className="card-header-title">
              <span className="header-icon-wrap icon-purple">
                <ScheduleOutlined />
              </span>
              <div className="header-title-text">
                <h4>Kế hoạch điều trị & Dặn dò chăm sóc thai kỳ</h4>
                <div className="header-badges">
                  <Tag
                    color="purple"
                    style={{ fontWeight: 700, borderRadius: 12 }}
                  >
                    {planItems.length} dặn dò
                  </Tag>
                  {Boolean(activePlan?.effectiveTo) && (
                    <Tag
                      color="cyan"
                      icon={<CalendarOutlined />}
                      style={{ fontWeight: 600, borderRadius: 12 }}
                    >
                      Hẹn tái khám:{' '}
                      {dayjs(String(activePlan.effectiveTo)).format(
                        'DD/MM/YYYY',
                      )}
                    </Tag>
                  )}
                </div>
              </div>
            </div>

            <div className="card-header-actions">
              {canEdit && (
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setCustomPlanModalOpen(true)}
                  style={{ fontWeight: 600 }}
                >
                  Thêm dặn dò riêng
                </Button>
              )}
            </div>
          </div>

          <div className="orders-card-body" style={{ padding: '16px 20px' }}>
            {/* ─── CÁC PHƯƠNG ÁN DẶN DÒ CÓ SẴN TRONG DATABASE ─── */}
            {canEdit && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 9 }}
                >
                  {/* Nhóm Dinh dưỡng */}
                  {categorizedTemplates.diet.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#059669',
                          minWidth: 120,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        🥗 Dinh dưỡng:
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          flex: 1,
                        }}
                      >
                        {categorizedTemplates.diet.map((t) => {
                          const isAdded = planItems.some(
                            (it) =>
                              it.title === t.title ||
                              it.description === t.content,
                          );
                          return (
                            <Tag
                              key={t.id}
                              onClick={() =>
                                !isAdded && void handleApplyTemplate(t)
                              }
                              style={{
                                cursor: isAdded ? 'default' : 'pointer',
                                borderRadius: 16,
                                fontWeight: 600,
                                fontSize: 12,
                                padding: '3px 10px',
                                margin: 0,
                                background: isAdded ? '#d1fae5' : '#f0fdf4',
                                borderColor: isAdded ? '#10b981' : '#bbf7d0',
                                color: isAdded ? '#047857' : '#15803d',
                                boxShadow: isAdded
                                  ? 'none'
                                  : '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease',
                              }}
                              title={
                                isAdded
                                  ? 'Đã có trong kế hoạch dặn dò'
                                  : t.content
                              }
                            >
                              {isAdded ? (
                                <span>
                                  <CheckOutlined style={{ marginRight: 4 }} />
                                  {t.title}
                                </span>
                              ) : (
                                <span>+ {t.title}</span>
                              )}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Nhóm Thai máy & Thai nhi */}
                  {categorizedTemplates.fetal.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#0284c7',
                          minWidth: 120,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        👶 Thai máy & thai nhi:
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          flex: 1,
                        }}
                      >
                        {categorizedTemplates.fetal.map((t) => {
                          const isAdded = planItems.some(
                            (it) =>
                              it.title === t.title ||
                              it.description === t.content,
                          );
                          return (
                            <Tag
                              key={t.id}
                              onClick={() =>
                                !isAdded && void handleApplyTemplate(t)
                              }
                              style={{
                                cursor: isAdded ? 'default' : 'pointer',
                                borderRadius: 16,
                                fontWeight: 600,
                                fontSize: 12,
                                padding: '3px 10px',
                                margin: 0,
                                background: isAdded ? '#e0f2fe' : '#f0f9ff',
                                borderColor: isAdded ? '#38bdf8' : '#bae6fd',
                                color: isAdded ? '#0369a1' : '#0284c7',
                                boxShadow: isAdded
                                  ? 'none'
                                  : '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease',
                              }}
                              title={
                                isAdded
                                  ? 'Đã có trong kế hoạch dặn dò'
                                  : t.content
                              }
                            >
                              {isAdded ? (
                                <span>
                                  <CheckOutlined style={{ marginRight: 4 }} />
                                  {t.title}
                                </span>
                              ) : (
                                <span>+ {t.title}</span>
                              )}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Nhóm Sức khỏe mẹ & Huyết áp */}
                  {categorizedTemplates.maternal.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#d97706',
                          minWidth: 120,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        🩺 Sức khỏe mẹ:
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          flex: 1,
                        }}
                      >
                        {categorizedTemplates.maternal.map((t) => {
                          const isAdded = planItems.some(
                            (it) =>
                              it.title === t.title ||
                              it.description === t.content,
                          );
                          return (
                            <Tag
                              key={t.id}
                              onClick={() =>
                                !isAdded && void handleApplyTemplate(t)
                              }
                              style={{
                                cursor: isAdded ? 'default' : 'pointer',
                                borderRadius: 16,
                                fontWeight: 600,
                                fontSize: 12,
                                padding: '3px 10px',
                                margin: 0,
                                background: isAdded ? '#fef3c7' : '#fffbeb',
                                borderColor: isAdded ? '#f59e0b' : '#fde68a',
                                color: isAdded ? '#b45309' : '#d97706',
                                boxShadow: isAdded
                                  ? 'none'
                                  : '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease',
                              }}
                              title={
                                isAdded
                                  ? 'Đã có trong kế hoạch dặn dò'
                                  : t.content
                              }
                            >
                              {isAdded ? (
                                <span>
                                  <CheckOutlined style={{ marginRight: 4 }} />
                                  {t.title}
                                </span>
                              ) : (
                                <span>+ {t.title}</span>
                              )}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Nhóm Cấp cứu & Cảnh báo nguy hiểm */}
                  {categorizedTemplates.emergency.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#dc2626',
                          minWidth: 120,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        🚨 Cảnh báo nguy hiểm:
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          flex: 1,
                        }}
                      >
                        {categorizedTemplates.emergency.map((t) => {
                          const isAdded = planItems.some(
                            (it) =>
                              it.title === t.title ||
                              it.description === t.content,
                          );
                          return (
                            <Tag
                              key={t.id}
                              onClick={() =>
                                !isAdded && void handleApplyTemplate(t)
                              }
                              style={{
                                cursor: isAdded ? 'default' : 'pointer',
                                borderRadius: 16,
                                fontWeight: 600,
                                fontSize: 12,
                                padding: '3px 10px',
                                margin: 0,
                                background: isAdded ? '#fee2e2' : '#fef2f2',
                                borderColor: isAdded ? '#ef4444' : '#fecaca',
                                color: isAdded ? '#b91c1c' : '#dc2626',
                                boxShadow: isAdded
                                  ? 'none'
                                  : '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease',
                              }}
                              title={
                                isAdded
                                  ? 'Đã có trong kế hoạch dặn dò'
                                  : t.content
                              }
                            >
                              {isAdded ? (
                                <span>
                                  <CheckOutlined style={{ marginRight: 4 }} />
                                  {t.title}
                                </span>
                              ) : (
                                <span>+ {t.title}</span>
                              )}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── DANH SÁCH LỜI DẶN HIỆN CÓ ─── */}
            {planItems.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {planItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '10px 14px',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#64748b',
                            fontSize: 12,
                          }}
                        >
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <strong style={{ color: '#1e293b', fontSize: 13.5 }}>
                          {item.title}
                        </strong>
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: '#475569',
                          lineHeight: 1.5,
                        }}
                      >
                        {item.description || '—'}
                      </div>
                    </div>

                    {canEdit && (
                      <Popconfirm
                        title="Xóa lời dặn này?"
                        onConfirm={() => void handleDeletePlanItem(idx)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          title="Xóa dặn dò"
                        />
                      </Popconfirm>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '16px 0 20px',
                  color: '#64748b',
                }}
              >
                <ScheduleOutlined
                  style={{ fontSize: 32, color: '#cbd5e1', marginBottom: 6 }}
                />
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  Chưa có hướng dẫn dặn dò nào được lập
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Nhấp vào các thẻ gợi ý phía trên hoặc nhấn nút "Thêm dặn dò
                  riêng" để ghi chú chế độ theo dõi cho thai phụ.
                </div>
              </div>
            )}

            {/* ─── HẸN NGÀY TÁI KHÁM TIẾP THEO (THIẾT KẾ RÕ RÀNG, DỄ NHÌN) ─── */}
            {(() => {
              const followUpDateStr =
                localFollowUpDate !== undefined
                  ? localFollowUpDate
                  : activePlan?.effectiveTo
                    ? String(activePlan.effectiveTo)
                    : null;
              const dateInfo = formatFollowUpDateDisplay(followUpDateStr);
              const isScheduled = Boolean(dateInfo);

              const today = dayjs().startOf('day');
              const targetDay = followUpDateStr
                ? dayjs(followUpDateStr).startOf('day')
                : null;
              const diffDays = targetDay ? targetDay.diff(today, 'day') : null;

              return (
                <div
                  style={{
                    background: isScheduled ? '#f0fdf4' : '#f8fafc',
                    border: `1px solid ${isScheduled ? '#86efac' : '#e2e8f0'}`,
                    borderLeft: `5px solid ${isScheduled ? '#16a34a' : '#94a3b8'}`,
                    borderRadius: 10,
                    padding: '14px 18px',
                    marginTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 14,
                    boxShadow: isScheduled
                      ? '0 1px 4px rgba(22, 163, 74, 0.08)'
                      : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Cột trái: Thông tin lịch hẹn nổi bật */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: isScheduled ? '#dcfce7' : '#e2e8f0',
                        color: isScheduled ? '#15803d' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      <CalendarOutlined />
                    </div>

                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#1e293b',
                          }}
                        >
                          LỊCH HẸN TÁI KHÁM TIẾP THEO:
                        </span>
                        {isScheduled && dateInfo ? (
                          <Tag
                            color="success"
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              margin: 0,
                            }}
                          >
                            ✓ {dateInfo.relativeText}
                          </Tag>
                        ) : (
                          <Tag
                            color="default"
                            style={{
                              fontSize: 11.5,
                              borderRadius: 4,
                              margin: 0,
                            }}
                          >
                            Chưa đặt lịch hẹn
                          </Tag>
                        )}
                      </div>

                      <div style={{ marginTop: 3 }}>
                        {isScheduled && dateInfo ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 16,
                                fontWeight: 800,
                                color: '#15803d',
                              }}
                            >
                              {dateInfo.dayName}, {dateInfo.formatted}
                            </span>
                            {canEdit && (
                              <Button
                                type="link"
                                size="small"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() =>
                                  void handleUpdateFollowUpDate(null, '')
                                }
                                style={{
                                  padding: 0,
                                  height: 'auto',
                                  fontSize: 12,
                                  marginLeft: 6,
                                }}
                              >
                                Hủy hẹn
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            Chọn nhanh khoảng thời gian bên phải hoặc chọn ngày
                            cụ thể để hẹn thai phụ tái khám
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: Bộ nút chọn nhanh tiện lợi cho bác sĩ */}
                  {canEdit && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#475569',
                          marginRight: 2,
                        }}
                      >
                        Chọn nhanh:
                      </span>
                      <Button
                        size="small"
                        type={diffDays === 7 ? 'primary' : 'default'}
                        onClick={() => void handleUpdateFollowUpDate(7)}
                        style={{
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          backgroundColor:
                            diffDays === 7 ? '#16a34a' : undefined,
                          borderColor: diffDays === 7 ? '#16a34a' : undefined,
                        }}
                      >
                        + 1 tuần
                      </Button>
                      <Button
                        size="small"
                        type={diffDays === 14 ? 'primary' : 'default'}
                        onClick={() => void handleUpdateFollowUpDate(14)}
                        style={{
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          backgroundColor:
                            diffDays === 14 ? '#16a34a' : undefined,
                          borderColor: diffDays === 14 ? '#16a34a' : undefined,
                        }}
                      >
                        + 2 tuần
                      </Button>
                      <Button
                        size="small"
                        type={diffDays === 28 ? 'primary' : 'default'}
                        onClick={() => void handleUpdateFollowUpDate(28)}
                        style={{
                          borderRadius: 6,
                          fontSize: 12.5,
                          fontWeight: 600,
                          backgroundColor:
                            diffDays === 28 ? '#16a34a' : undefined,
                          borderColor: diffDays === 28 ? '#16a34a' : undefined,
                        }}
                      >
                        + 4 tuần
                      </Button>

                      <Divider
                        type="vertical"
                        style={{ margin: '0 4px', height: 20 }}
                      />

                      <DatePicker
                        placeholder="Chọn ngày cụ thể"
                        size="small"
                        format="DD/MM/YYYY"
                        allowClear={true}
                        onChange={(date) => {
                          void handleUpdateFollowUpDate(
                            null,
                            date ? date.format('YYYY-MM-DD') : '',
                          );
                        }}
                        value={followUpDateStr ? dayjs(followUpDateStr) : null}
                        style={{ width: 145, borderRadius: 6 }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ─── MODAL THÊM THUỐC ─── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MedicineBoxOutlined style={{ color: '#0B5CAD' }} />
            <span>Kê thuốc mới vào đơn ca khám</span>
          </div>
        }
        open={medModalOpen}
        onCancel={() => setMedModalOpen(false)}
        onOk={() => medForm.submit()}
        okText="Thêm vào đơn"
        cancelText="Hủy"
        confirmLoading={savingMed}
        width={650}
      >
        <Form
          form={medForm}
          layout="vertical"
          onFinish={handleSaveMedication}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="medicationName"
            label="Chọn thuốc an toàn thai kỳ từ danh mục bệnh viện"
            rules={[
              { required: true, message: 'Vui lòng chọn hoặc nhập tên thuốc.' },
            ]}
          >
            <Select
              showSearch
              placeholder="Gõ tên thuốc hoặc hoạt chất..."
              optionFilterProp="children"
              loading={catalogLoading}
              onChange={handleSelectMedication}
              style={{ width: '100%' }}
              size="large"
            >
              {medCatalog.map((med) => (
                <Select.Option key={med.code} value={med.code}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      <strong>{med.name}</strong> (
                      {med.strength || med.dosageForm || 'Thuốc chuẩn'})
                    </span>
                    {renderPregnancyTag(med.pregnancyCategory)}
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {currentSelectedMed && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}
                >
                  {currentSelectedMed.name} · {currentSelectedMed.strength}
                </span>
                {renderPregnancyTag(currentSelectedMed.pregnancyCategory)}
              </div>
            </div>
          )}

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Form.Item
              name="dose"
              label="Liều dùng một lần"
              rules={[{ required: true, message: 'Nhập liều dùng.' }]}
            >
              <Input placeholder="VD: 1 viên, 1 ống 5ml..." />
            </Form.Item>

            <Form.Item name="route" label="Đường dùng">
              <Select>
                <Select.Option value="Uống">Uống trực tiếp</Select.Option>
                <Select.Option value="Đặt âm đạo">Đặt âm đạo</Select.Option>
                <Select.Option value="Tiêm bắp">Tiêm bắp</Select.Option>
                <Select.Option value="Tiêm tĩnh mạch">
                  Tiêm tĩnh mạch
                </Select.Option>
                <Select.Option value="Bôi ngoài da">Bôi ngoài da</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Form.Item
              name="frequency"
              label="Tần suất dùng"
              rules={[{ required: true, message: 'Nhập tần suất.' }]}
            >
              <Input placeholder="VD: 1 lần/ngày, 2 lần/ngày sau ăn..." />
            </Form.Item>

            <Form.Item name="durationDays" label="Số ngày dùng thuốc">
              <InputNumber
                min={1}
                max={90}
                style={{ width: '100%' }}
                placeholder="Số ngày (VD: 30)"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="instruction"
            label="Hướng dẫn sử dụng dành riêng cho thai phụ"
          >
            <Input.TextArea
              rows={2}
              placeholder="VD: Uống sau ăn sáng 30 phút, uống với nhiều nước..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── MODAL THÊM DẶN DÒ RIÊNG ─── */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FormOutlined style={{ color: '#7c3aed' }} />
            <span>Thêm Lời Dặn Chăm Sóc Thai Kỳ Riêng</span>
          </div>
        }
        open={customPlanModalOpen}
        onCancel={() => setCustomPlanModalOpen(false)}
        onOk={() => customPlanForm.submit()}
        okText="Thêm dặn dò"
        cancelText="Hủy"
        confirmLoading={savingPlan}
        width={560}
      >
        <Form
          form={customPlanForm}
          layout="vertical"
          onFinish={handleSaveCustomPlan}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="Tiêu đề lời dặn"
            rules={[
              { required: true, message: 'Vui lòng nhập tiêu đề lời dặn' },
            ]}
          >
            <Input placeholder="VD: Chế độ nghỉ ngơi dưỡng thai; Hạn chế ngồi xổm..." />
          </Form.Item>

          <Form.Item
            name="description"
            label="Nội dung chi tiết lời dặn của bác sĩ"
            rules={[
              { required: true, message: 'Vui lòng nhập nội dung chi tiết' },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Nhập nội dung dặn dò chi tiết dành cho thai phụ..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
