import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined,
  CalculatorOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  ColumnHeightOutlined,
  DashboardOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HeartFilled,
  HeartOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  MedicineBoxOutlined,
  PlayCircleOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type { Requester } from '../../../services/catalog';
import type { Appointment } from '../../../services/appointment';
import type { Encounter } from '../../../services/clinical';
import {
  listPrescriptions,
  prescriptionAction,
  listTreatmentPlans,
} from '../../../services/clinical';
import {
  generateEncounterReport,
  getEncounterReport,
  type MedicalReportPayload,
} from '../../../services/clinicalReport';
import { MedicalReportModal } from './MedicalReportModal';
import { ClinicalOrdersResultModal } from '../../../shared/components/portal/ClinicalOrdersResultModal';
import type { MyDoctor } from '../../../services/doctor';
import type { DoctorDeskRow } from './DoctorDeskTable';
import { DoctorClinicalResources } from './DoctorClinicalResources';
import { DoctorClinicalFiles } from './DoctorClinicalFiles';
import { DoctorClinicalOrders } from './DoctorClinicalOrders';
import { DoctorClinicalServiceOrders } from './DoctorClinicalServiceOrders';

import '../../../styles/doctor-consultation.css';

const { Text, Title, Paragraph } = Typography;

export interface PatientDemographic {
  name: string;
  phone: string;
  dob?: string;
  gender?: string;
  nationalId?: string;
  address?: string;
  emergencyContact?: string;
  avatarUrl?: string;
}

export interface DoctorConsultationDetailProps {
  appointment: DoctorDeskRow;
  encounter: Encounter | null;
  patientInfo?: PatientDemographic;
  allAppointments: Appointment[];
  allEncounters: Encounter[];
  doctor: MyDoctor | null;
  request: Requester;
  onBack: () => void;
  onReload: () => void;
}

export function DoctorConsultationDetail({
  appointment,
  encounter: initialEncounter,
  patientInfo,
  allAppointments,
  allEncounters,
  doctor,
  request,
  onBack,
  onReload,
}: DoctorConsultationDetailProps) {
  // Tabs cấp cao: 1. Khám bệnh toàn diện, 2. Tiền sử & Khám cũ, 3. File kết quả
  const [activeTab, setActiveTab] = useState('consultation');
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const refreshBlockedRef = useRef(false);
  const clinicalWriteQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [encounter, setEncounter] = useState<Encounter | null>(
    initialEncounter,
  );

  useEffect(() => {
    if (initialEncounter) {
      setEncounter(initialEncounter);
    }
  }, [initialEncounter]);

  // Sub-tab Xử trí (Kê đơn thuốc vs Cận lâm sàng)
  const [ordersSubTab, setOrdersSubTab] = useState<'prescriptions' | 'plans'>(
    'prescriptions',
  );

  // Modal xem chi tiết lượt khám cũ
  const [selectedPastVisit, setSelectedPastVisit] =
    useState<Appointment | null>(null);

  // Modal & File PDF Kết quả khám bệnh chính thức
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportDocumentId, setReportDocumentId] = useState<string | null>(null);
  const [reportFileName, setReportFileName] = useState<string>('');
  const [clsResultModalOpen, setClsResultModalOpen] = useState(false);

  // Vitals inputs
  const [systolic, setSystolic] = useState<number | null>(null);
  const [diastolic, setDiastolic] = useState<number | null>(null);
  const [bpText, setBpText] = useState<string>('');
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  // Vitals auto-save state
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'typing' | 'saving' | 'saved' | 'error'
  >('idle');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>('');
  const currentValuesRef = useRef({
    systolic,
    diastolic,
    heartRate,
    temperature,
    weight,
    height,
  });

  // Diagnosis input & auto-save state
  const [diagnosisDesc, setDiagnosisDesc] = useState('');
  const [diagSaveStatus, setDiagSaveStatus] = useState<
    'idle' | 'typing' | 'saving' | 'saved' | 'error'
  >('idle');
  const diagDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastSavedDiagHashRef = useRef<string>('');
  const currentDiagRef = useRef<string>('');
  const initializedDiagEncIdRef = useRef<string | null>(null);

  // Chief Complaint input & auto-save state
  const [chiefComplaintText, setChiefComplaintText] = useState('');
  const [ccSaveStatus, setCcSaveStatus] = useState<
    'idle' | 'typing' | 'saving' | 'saved' | 'error'
  >('idle');
  const ccDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCcRef = useRef<string>('');
  const initializedCcEncIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentCcRef.current = chiefComplaintText;
  }, [chiefComplaintText]);

  useEffect(() => {
    currentDiagRef.current = diagnosisDesc;
  }, [diagnosisDesc]);

  // Note input
  const [noteContent, setNoteContent] = useState('');

  const rawEncId = encounter?.id || appointment.encounterId;
  const encId = rawEncId ? String(rawEncId) : '';
  const version = Number(encounter?.version || 1);
  const latestVersionRef = useRef(version);
  useEffect(() => {
    latestVersionRef.current = version;
  }, [version]);

  const encState = String(
    encounter?.state ||
      (appointment.status === 'IN_CLINICAL_CARE' ? 'IN_PROGRESS' : 'DRAFT'),
  );

  const isFinalized =
    encState === 'FINALIZED' || appointment.status === 'COMPLETED';
  const canEdit =
    encState === 'IN_PROGRESS' && !isFinalized && !refreshError && !busy;
  const canStart =
    !refreshError &&
    encState === 'DRAFT' &&
    appointment.status === 'CHECKED_IN';
  const canFinalize =
    !isFinalized &&
    !refreshError &&
    ['IN_PROGRESS', 'READY_FOR_REVIEW'].includes(encState);

  // Nạp lại encounter chi tiết khi mount hoặc khi encId đổi
  useEffect(() => {
    let live = true;
    if (encId) {
      request<Encounter | { data: Encounter }>(
        `/api/medical-records/encounters/${encodeURIComponent(encId)}`,
      )
        .then((res: any) => {
          if (live && res) {
            setEncounter(res.data || res);
          }
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [encId, request]);

  const refreshEncounter = useCallback(async () => {
    const response = await request<Encounter | { data: Encounter }>(
      `/api/medical-records/encounters/${encodeURIComponent(encId)}`,
    );
    const current =
      (response as { data?: Encounter }).data ?? (response as Encounter);
    if (
      String(current.id || '') !== encId ||
      !current.state ||
      !Number.isInteger(Number(current.version))
    )
      throw new Error('INVALID_ENCOUNTER_RESPONSE');
    latestVersionRef.current = Number(current.version);
    setEncounter(current);
    refreshBlockedRef.current = false;
    setRefreshError(false);
    return current;
  }, [encId, request]);

  // Serialize autosaves so each write uses the version returned by the previous write.
  const saveClinicalAction = useCallback(
    (path: string, body: Record<string, unknown>, method = 'POST') => {
      const action = clinicalWriteQueueRef.current.then(async () => {
        if (!encId || refreshBlockedRef.current) return false;
        try {
          await request(
            `/api/medical-records/encounters/${encodeURIComponent(encId)}${path ? `/${path}` : ''}`,
            {
              method,
              body: JSON.stringify({
                ...body,
                expectedVersion: latestVersionRef.current,
              }),
            },
          );
        } catch (error) {
          refreshBlockedRef.current = true;
          setRefreshError(true);
          throw error;
        }
        try {
          await refreshEncounter();
        } catch {
          refreshBlockedRef.current = true;
          setRefreshError(true);
          message.warning(
            'Đã lưu, nhưng chưa tải lại được hồ sơ. Vui lòng tải lại trước khi tiếp tục.',
          );
        }
        return true;
      });
      clinicalWriteQueueRef.current = action.catch(() => undefined);
      return action;
    },
    [encId, request, refreshEncounter],
  );

  const sendAction = async (
    path: string,
    body: Record<string, unknown> = {},
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const saved = await saveClinicalAction(path, body);
      if (saved) {
        message.success('Thao tác thành công.');
        onReload();
      }
      return saved;
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra khi lưu dữ liệu.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // 1. Bắt đầu ca khám
  const handleStartEncounter = async () => {
    if (!(await sendAction('start'))) return;

    // Bắn realtime SSE cho lễ tân và bệnh nhân cập nhật tức thì trạng thái ĐANG KHÁM
    try {
      await request('/api/appointment/desk/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'appointment.clinical_started',
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          status: 'IN_CLINICAL_CARE',
          appointmentCode: appointment.appointmentCode,
          roomCode: appointment.roomCode,
          roomName: appointment.roomName,
          clinicalStartedAt: new Date().toISOString(),
        }),
      });
    } catch (sseErr) {
      console.warn(
        'Bắn realtime appointment.clinical_started thất bại:',
        sseErr,
      );
    }
  };

  // ─── TẬP HỢP DỮ LIỆU ĐỂ SINH BẢN IN Y TẾ A4 (PDF) ───
  const buildReportPayload = async (): Promise<MedicalReportPayload> => {
    let freshEnc: any = encounter;
    if (encId) {
      try {
        const res: any = await request(
          `/api/medical-records/encounters/${encodeURIComponent(encId)}`,
        );
        freshEnc = res?.data || res || encounter;
      } catch (e) {}
    }

    let presList: any[] = [];
    if (encId) {
      try {
        presList = await listPrescriptions(
          request,
          `encounterId=${encodeURIComponent(encId)}`,
        );
      } catch (e) {}
    }

    let planList: any[] = [];
    if (encId) {
      try {
        planList = await listTreatmentPlans(
          request,
          `encounterId=${encodeURIComponent(encId)}`,
        );
      } catch (e) {}
    }

    const activePlan =
      planList.find((p: any) => p.status === 'ACTIVE') || planList[0];

    const ordersList: any[] = Array.isArray(freshEnc?.orders)
      ? freshEnc.orders
      : [];
    const mappedOrders = ordersList.map((o: any) => {
      const hasResult = Boolean(
        o.structuredResult?.fileName ||
        o.structuredResult?.fileUrl ||
        o.resultNotes ||
        o.status === 'VERIFIED' ||
        o.status === 'RESULT_AVAILABLE' ||
        o.status === 'COMPLETED',
      );
      return {
        name:
          o.catalogServiceName ||
          o.serviceName ||
          o.testName ||
          'Dịch vụ cận lâm sàng',
        category: o.category || 'Cận lâm sàng',
        result:
          o.resultNotes ||
          (hasResult
            ? 'Đã có kết quả (Bình thường)'
            : 'Đã thực hiện / Chờ kết quả'),
        status: hasResult
          ? 'Đã có kết quả'
          : o.status === 'VERIFIED'
            ? 'Đã thực hiện'
            : 'Đã chỉ định',
      };
    });

    const issuedPres =
      presList.find((p: any) => p.status === 'ISSUED') || presList[0];
    const presItems: any[] = Array.isArray(issuedPres?.items)
      ? issuedPres.items
      : [];
    const mappedPrescriptions = presItems.map((it: any) => ({
      name:
        it.medicationNameSnapshot || it.medicationName || it.name || 'Thuốc',
      strength: it.strengthSnapshot || it.strength || '',
      quantity: it.quantity || 1,
      unit: it.unit || 'Viên',
      dosage: it.dosage || it.dose || '',
      frequency: it.frequency || '',
      instruction: it.instruction || '',
    }));

    const planItems: any[] = Array.isArray(activePlan?.items)
      ? activePlan.items
      : [];
    const mappedAdvice = planItems.map((it: any) => ({
      category: it.category || 'Chăm sóc thai kỳ',
      title: it.title || '',
      description: it.description || it.content || '',
    }));

    const vList = Array.isArray(freshEnc?.vitalSigns)
      ? freshEnc.vitalSigns
      : [];
    const curVital = vList.length > 0 ? vList[vList.length - 1] : null;
    const bpVal =
      systolic && diastolic
        ? `${systolic}/${diastolic}`
        : curVital?.bloodPressure || bpText || undefined;
    const hrVal = heartRate
      ? String(heartRate)
      : curVital?.heartRate
        ? String(curVital.heartRate)
        : undefined;
    const tempVal = temperature
      ? String(temperature)
      : curVital?.temperature
        ? String(curVital.temperature)
        : undefined;
    const wtVal = weight
      ? String(weight)
      : curVital?.weightKg
        ? String(curVital.weightKg)
        : undefined;
    const htVal = height
      ? String(height)
      : curVital?.heightCm
        ? String(curVital.heightCm)
        : undefined;
    const bmiVal =
      wtVal && htVal
        ? (
            Number(wtVal) /
            ((Number(htVal) / 100) * (Number(htVal) / 100))
          ).toFixed(1)
        : curVital?.bmi
          ? String(curVital.bmi)
          : undefined;

    const dList = Array.isArray(freshEnc?.diagnoses) ? freshEnc.diagnoses : [];
    const curDiag = dList.length > 0 ? dList[dList.length - 1] : null;
    const diagText =
      diagnosisDesc.trim() ||
      curDiag?.description ||
      'Khám thai định kỳ chuẩn y khoa - Thai phụ và thai nhi phát triển bình thường';

    const followUpDateStr = activePlan?.effectiveTo
      ? String(activePlan.effectiveTo)
      : undefined;

    return {
      appointmentCode: appointment.appointmentCode || '',
      encounterId: encId,
      patientId: appointment.patientId || 'patient-id',
      roomCode: appointment.roomCode || 'P.207',
      roomName: appointment.roomName || 'Phòng khám Sản Phụ khoa 207',
      examinationDate: dayjs().format('DD/MM/YYYY'),
      examinationTime: dayjs().format('HH:mm'),
      patientName: String(
        patientInfo?.name ||
          appointment.patientNameSnapshot ||
          appointment.patientName ||
          'Bệnh nhân',
      ),
      patientDob: patientInfo?.dob || undefined,
      patientGender: patientInfo?.gender || 'Nữ',
      patientPhone: String(
        patientInfo?.phone ||
          appointment.patientPhoneNumberSnapshot ||
          appointment.patientPhone ||
          '',
      ),
      patientNationalId: patientInfo?.nationalId || '',
      patientAddress: patientInfo?.address || 'Hà Nội',
      pregnancyWeek: undefined, // Chỉ hiển thị khi có hồ sơ thai kỳ thực tế trong DB
      vitals: {
        bloodPressure: bpVal,
        heartRate: hrVal,
        temperature: tempVal,
        weight: wtVal,
        height: htVal,
        bmi: bmiVal,
      },
      chiefComplaint:
        chiefComplaintText.trim() ||
        appointment.pricing?.serviceName ||
        'Khám thai định kỳ',
      clinicalExamination: undefined, // Form khám hiện tại không có ô nhập diễn biến khám lâm sàng
      primaryDiagnosis: diagText,
      doctorNotes: undefined, // Lời khuyên/dặn dò đã có đầy đủ ở mục Kế hoạch điều trị & Dặn dò (careAdvice) phía dưới
      clinicalOrders: mappedOrders,
      prescriptions: mappedPrescriptions,
      careAdvice: mappedAdvice,
      followUpDate: followUpDateStr
        ? dayjs(followUpDateStr).format('DD/MM/YYYY')
        : undefined,
      doctorName:
        doctor?.profile?.fullName ||
        (appointment.assignedDoctorName
          ? String(appointment.assignedDoctorName)
          : 'BS. Nguyễn Hồng Nhung'),
      finalizedAt: new Date().toISOString(),
    };
  };

  // 2. Hoàn tất ca khám
  const handleFinalize = async () => {
    if (!encId || busy || !canFinalize) return;
    setBusy(true);
    try {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (diagDebounceTimerRef.current)
        clearTimeout(diagDebounceTimerRef.current);
      if (ccDebounceTimerRef.current) clearTimeout(ccDebounceTimerRef.current);
      await clinicalWriteQueueRef.current;
      if (encState === 'IN_PROGRESS') {
        if (!(await performAutoSave(currentValuesRef.current))) return;
        if (!(await performAutoSaveDiagnosis(currentDiagRef.current))) return;
        if (!(await performAutoSaveChiefComplaint(currentCcRef.current)))
          return;
      }
      if (refreshBlockedRef.current) return;
      const current = await refreshEncounter();
      const base = `/api/medical-records/encounters/${encodeURIComponent(encId)}`;
      let nextVersion = Number(current.version);
      // Preserve automatic prescription issuance, and stop completion if issuing fails.
      const prescriptions = await listPrescriptions(
        request,
        `encounterId=${encodeURIComponent(encId)}`,
      );
      for (const draft of prescriptions.filter(
        (p) =>
          p.status === 'DRAFT' && Array.isArray(p.items) && p.items.length > 0,
      )) {
        await prescriptionAction(request, String(draft.id), 'issue', {
          version: draft.version,
        });
      }
      if (current.state === 'IN_PROGRESS') {
        const ready = await request<{ data: Encounter }>(
          `${base}/ready-for-review`,
          {
            method: 'POST',
            body: JSON.stringify({ expectedVersion: nextVersion }),
          },
        );
        if (
          ready.data?.state !== 'READY_FOR_REVIEW' ||
          !Number.isInteger(Number(ready.data?.version))
        )
          throw new Error(
            'Không xác định được trạng thái hồ sơ. Vui lòng tải lại.',
          );
        setEncounter(ready.data);
        nextVersion = Number(ready.data.version);
        latestVersionRef.current = nextVersion;
      }
      const result = await request<{ data: Encounter }>(`${base}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: nextVersion }),
      });
      if (result.data) setEncounter(result.data);
      message.success('Đã hoàn tất ca khám.');
      onReload();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Không thể hoàn tất ca khám.';
      message.error(
        detail.includes('REQUIRED_RESULTS_PENDING')
          ? 'Còn kết quả bắt buộc chưa được xác minh.'
          : detail,
      );
      await refreshEncounter().catch(() => {
        refreshBlockedRef.current = true;
        setRefreshError(true);
      });
      return;
    } finally {
      setBusy(false);
    }

    // Tự động sinh PDF bản thật và mở modal hiển thị cho bác sĩ
    try {
      const payload = await buildReportPayload();
      const reportRes = await generateEncounterReport(request, payload);
      if (reportRes && reportRes.documentId) {
        setReportDocumentId(reportRes.documentId);
        setReportFileName(reportRes.fileName);
        setIsReportModalOpen(true);
      }
    } catch (pdfErr) {
      console.warn('Sinh file PDF kết quả khám gặp lỗi:', pdfErr);
    }

    // Bắn realtime SSE cho lễ tân và bệnh nhân
    try {
      await request('/api/appointment/desk/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'appointment.completed',
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          status: 'COMPLETED',
          appointmentCode: appointment.appointmentCode,
          roomCode: appointment.roomCode,
          roomName: appointment.roomName,
          completedAt: new Date().toISOString(),
        }),
      });
    } catch (sseErr) {
      console.warn('Bắn realtime appointment.completed thất bại:', sseErr);
    }
  };

  // Mở xem lại hoặc tạo mới PDF kết quả khám bệnh
  const handleOpenReportPdf = async () => {
    setBusy(true);
    try {
      if (reportDocumentId) {
        setIsReportModalOpen(true);
        return;
      }
      const existing = await getEncounterReport(request, encId);
      if (existing && existing.documentId) {
        setReportDocumentId(existing.documentId);
        setReportFileName(existing.fileName);
        setIsReportModalOpen(true);
        return;
      }
      const payload = await buildReportPayload();
      const created = await generateEncounterReport(request, payload);
      if (created && created.documentId) {
        setReportDocumentId(created.documentId);
        setReportFileName(created.fileName);
        setIsReportModalOpen(true);
      } else {
        message.error('Không thể tạo file PDF phiếu khám.');
      }
    } catch (err: any) {
      message.error(
        err?.message || 'Có lỗi xảy ra khi tải phiếu kết quả khám.',
      );
    } finally {
      setBusy(false);
    }
  };

  // Danh sách sinh hiệu, chẩn đoán, ghi chú trong lượt khám này
  const vitalsList = Array.isArray(encounter?.vitalSigns)
    ? encounter.vitalSigns
    : [];
  const latestVital =
    vitalsList.length > 0 ? vitalsList[vitalsList.length - 1] : null;
  const diagnosesList = Array.isArray(encounter?.diagnoses)
    ? encounter.diagnoses
    : [];
  const latestDiagnosis =
    diagnosesList.length > 0 ? diagnosesList[diagnosesList.length - 1] : null;
  const notesList = Array.isArray(encounter?.notes) ? encounter.notes : [];

  // Theo dõi ID ca khám đã khởi tạo để tránh ghi đè khi đang nhập
  const initializedEncIdRef = useRef<string | null>(null);

  // Đồng bộ lý do khám & tình trạng ban đầu từ encounter (nếu có, không tự động điền sẵn chuỗi mặc định)
  useEffect(() => {
    if (encId && initializedCcEncIdRef.current !== encId) {
      if (encounter?.chiefComplaint) {
        initializedCcEncIdRef.current = encId;
        const text = String(encounter.chiefComplaint);
        setChiefComplaintText(text);
        currentCcRef.current = text;
      } else if (encounter || appointment) {
        initializedCcEncIdRef.current = encId;
        setChiefComplaintText('');
        currentCcRef.current = '';
      }
    }
  }, [encId, encounter?.chiefComplaint, encounter, appointment]);
  useEffect(() => {
    if (encId && initializedDiagEncIdRef.current !== encId) {
      if (latestDiagnosis && latestDiagnosis.description) {
        initializedDiagEncIdRef.current = encId;
        setDiagnosisDesc(latestDiagnosis.description);
        lastSavedDiagHashRef.current = latestDiagnosis.description.trim();
        setDiagSaveStatus('saved');
      } else if (encounter) {
        initializedDiagEncIdRef.current = encId;
        setDiagnosisDesc('');
        lastSavedDiagHashRef.current = '';
        setDiagSaveStatus('idle');
      }
    }
  }, [encId, latestDiagnosis, encounter]);

  // Đồng bộ giá trị sinh hiệu hiện có từ encounter (chỉ khi mở ca khám mới, không tự điền bừa)
  useEffect(() => {
    if (encId && initializedEncIdRef.current !== encId) {
      initializedEncIdRef.current = encId;
      if (latestVital) {
        const s = latestVital.systolic ?? null;
        const d = latestVital.diastolic ?? null;
        const hr = latestVital.heartRate ?? null;
        const t =
          latestVital.temperature != null
            ? Number(latestVital.temperature)
            : null;
        const w =
          latestVital.weight != null ? Number(latestVital.weight) : null;
        const h =
          (latestVital as any).height != null
            ? Number((latestVital as any).height)
            : null;

        setSystolic(s);
        setDiastolic(d);
        setBpText(
          s != null && d != null ? `${s}/${d}` : s != null ? `${s}` : '',
        );
        setHeartRate(hr);
        setTemperature(t);
        setWeight(w);
        setHeight(h);

        const initialPayload: Record<string, number> = {};
        if (s != null) initialPayload.systolic = s;
        if (d != null) initialPayload.diastolic = d;
        if (hr != null) initialPayload.heartRate = hr;
        if (t != null) initialPayload.temperature = t;
        if (w != null) initialPayload.weight = w;
        if (h != null) initialPayload.height = h;

        if (Object.keys(initialPayload).length > 0) {
          lastSavedHashRef.current = JSON.stringify(initialPayload);
          setSaveStatus('saved');
        } else {
          setSaveStatus('idle');
        }
      } else {
        setSystolic(null);
        setDiastolic(null);
        setHeartRate(null);
        setTemperature(null);
        setWeight(null);
        setHeight(null);
        lastSavedHashRef.current = '';
        setSaveStatus('idle');
      }
    }
  }, [encId, latestVital]);

  // Luôn cập nhật ref giá trị hiện tại
  useEffect(() => {
    currentValuesRef.current = {
      systolic,
      diastolic,
      heartRate,
      temperature,
      weight,
      height,
    };
  }, [systolic, diastolic, heartRate, temperature, weight, height]);

  // Kiểm tra tính hợp lệ sinh lý y khoa của từng chỉ số (không tự động sửa số của bác sĩ)
  const isSystolicInvalid =
    systolic != null && (systolic < 40 || systolic > 300);
  const isDiastolicInvalid =
    diastolic != null && (diastolic < 20 || diastolic > 200);
  const isBpMultipleSlashes = bpText.split('/').length > 2;
  const isHeartRateInvalid =
    heartRate != null && (heartRate < 20 || heartRate > 250);
  const isTemperatureInvalid =
    temperature != null && (temperature < 30 || temperature > 45);
  const isWeightInvalid = weight != null && (weight < 1 || weight > 500);
  const isHeightInvalid = height != null && (height < 50 || height > 250);

  const hasAnyInvalid =
    isSystolicInvalid ||
    isDiastolicInvalid ||
    isBpMultipleSlashes ||
    isHeartRateInvalid ||
    isTemperatureInvalid ||
    isWeightInvalid ||
    isHeightInvalid;

  // Hàm tự động lưu dấu hiệu sinh tồn
  const performAutoSave = useCallback(
    async (values: {
      systolic: number | null;
      diastolic: number | null;
      heartRate: number | null;
      temperature: number | null;
      weight: number | null;
      height: number | null;
    }) => {
      if (!canEdit || !encId) return false;

      // Nếu có bất kỳ trường nào ngoài dải hợp lệ, dừng lưu để bác sĩ chỉnh sửa (không tự sửa số)
      const hasInvalid =
        (values.systolic != null &&
          (values.systolic < 40 || values.systolic > 300)) ||
        (values.diastolic != null &&
          (values.diastolic < 20 || values.diastolic > 200)) ||
        (values.heartRate != null &&
          (values.heartRate < 20 || values.heartRate > 250)) ||
        (values.temperature != null &&
          (values.temperature < 30 || values.temperature > 45)) ||
        (values.weight != null && (values.weight < 1 || values.weight > 500)) ||
        (values.height != null && (values.height < 50 || values.height > 250));

      if (hasInvalid) {
        setSaveStatus('error');
        return false;
      }

      const payload: Record<string, number> = {};
      if (values.systolic != null)
        payload.systolic = Math.round(values.systolic);
      if (values.diastolic != null)
        payload.diastolic = Math.round(values.diastolic);
      if (values.heartRate != null)
        payload.heartRate = Math.round(values.heartRate);
      if (values.temperature != null)
        payload.temperature = Number(Number(values.temperature).toFixed(1));
      if (values.weight != null)
        payload.weight = Number(Number(values.weight).toFixed(1));
      if (values.height != null)
        payload.height = Number(Number(values.height).toFixed(1));

      if (Object.keys(payload).length === 0) return true;

      const hash = JSON.stringify(payload);
      if (hash === lastSavedHashRef.current) {
        setSaveStatus('saved');
        return true;
      }

      setSaveStatus('saving');
      try {
        if (!(await saveClinicalAction('vital-signs', payload))) return false;
        lastSavedHashRef.current = hash;
        setSaveStatus('saved');

        return true;
      } catch (err: any) {
        console.warn('Auto-save vital signs failed:', err);
        setSaveStatus('error');
        return false;
      }
    },
    [canEdit, encId, saveClinicalAction],
  );

  // Xử lý nhập huyết áp (cho phép nhập trực tiếp dạng "110/123", tự gõ dấu '/')
  const handleBpChange = (raw: string) => {
    // Chỉ cho phép số, khoảng trắng và dấu '/'
    const cleaned = raw.replace(/[^\d/\s]/g, '');
    setBpText(cleaned);

    const parts = cleaned.split('/');
    const sStr = parts[0]?.trim();
    const dStr = parts.length > 1 ? parts[1]?.trim() : '';

    const sVal = sStr && sStr !== '' ? Number(sStr) : null;
    const dVal = dStr && dStr !== '' ? Number(dStr) : null;

    setSystolic(sVal);
    setDiastolic(dVal);

    const nextValues = {
      ...currentValuesRef.current,
      systolic: sVal,
      diastolic: dVal,
    };
    currentValuesRef.current = nextValues;

    if (!canEdit) return;

    setSaveStatus('typing');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performAutoSave(nextValues);
    }, 900);
  };

  // Điều phối thay đổi chỉ số sinh tồn và kích hoạt debounce tự lưu
  const handleVitalChange = (
    field: 'systolic' | 'diastolic' | 'heartRate' | 'temperature' | 'weight',
    val: number | null,
  ) => {
    if (field === 'systolic') setSystolic(val);
    else if (field === 'diastolic') setDiastolic(val);
    else if (field === 'heartRate') setHeartRate(val);
    else if (field === 'temperature') setTemperature(val);
    else if (field === 'weight') setWeight(val);

    const nextValues = {
      ...currentValuesRef.current,
      [field]: val,
    };
    currentValuesRef.current = nextValues;

    if (!canEdit) return;

    setSaveStatus('typing');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performAutoSave(nextValues);
    }, 900);
  };

  const handleBlur = () => {
    if (saveStatus === 'typing') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      performAutoSave(currentValuesRef.current);
    }
  };

  const handleHeightChange = (val: number | null) => {
    setHeight(val);
    if (val && typeof window !== 'undefined' && appointment.patientId) {
      localStorage.setItem(
        `patient_height_${appointment.patientId}`,
        String(val),
      );
    }

    const nextValues = {
      ...currentValuesRef.current,
      height: val,
    };
    currentValuesRef.current = nextValues;

    if (!canEdit) return;

    setSaveStatus('typing');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performAutoSave(nextValues);
    }, 900);
  };

  // Hủy timer khi unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (diagDebounceTimerRef.current)
        clearTimeout(diagDebounceTimerRef.current);
      if (ccDebounceTimerRef.current) clearTimeout(ccDebounceTimerRef.current);
    };
  }, []);

  // Tự động lưu chẩn đoán bệnh
  const performAutoSaveDiagnosis = useCallback(
    async (text: string) => {
      if (!canEdit || !encId) return false;
      const trimmed = (text || '').trim();
      if (!trimmed) {
        setDiagSaveStatus('idle');
        return true;
      }
      if (trimmed === lastSavedDiagHashRef.current) {
        setDiagSaveStatus('saved');
        return true;
      }

      setDiagSaveStatus('saving');
      try {
        if (
          !(await saveClinicalAction('diagnoses', {
            code: 'KCB',
            description: trimmed,
          }))
        )
          return false;
        lastSavedDiagHashRef.current = trimmed;
        setDiagSaveStatus('saved');

        return true;
      } catch (err: any) {
        console.warn('Auto-save diagnosis failed:', err);
        setDiagSaveStatus('error');
        return false;
      }
    },
    [canEdit, encId, saveClinicalAction],
  );

  const handleDiagnosisChange = (val: string) => {
    setDiagnosisDesc(val);
    currentDiagRef.current = val;
    if (!canEdit) return;

    setDiagSaveStatus('typing');
    if (diagDebounceTimerRef.current)
      clearTimeout(diagDebounceTimerRef.current);
    diagDebounceTimerRef.current = setTimeout(() => {
      performAutoSaveDiagnosis(val);
    }, 900);
  };

  const handleDiagnosisBlur = () => {
    if (diagSaveStatus === 'typing') {
      if (diagDebounceTimerRef.current)
        clearTimeout(diagDebounceTimerRef.current);
      performAutoSaveDiagnosis(currentDiagRef.current);
    }
  };

  // Tự động lưu Lý do khám & Tình trạng tiếp nhận ban đầu
  const performAutoSaveChiefComplaint = useCallback(
    async (text: string) => {
      if (!canEdit || !encId) return false;
      const trimmed = (text || '').trim();
      setCcSaveStatus('saving');
      try {
        if (
          !(await saveClinicalAction('', { chiefComplaint: trimmed }, 'PATCH'))
        )
          return false;
        setCcSaveStatus('saved');
        setTimeout(() => setCcSaveStatus('idle'), 2000);
        return true;
      } catch (err: any) {
        console.warn('Auto-save chief complaint failed:', err);
        setCcSaveStatus('error');
        return false;
      }
    },
    [canEdit, encId, saveClinicalAction],
  );

  const handleChiefComplaintChange = (val: string) => {
    setChiefComplaintText(val);
    currentCcRef.current = val;
    if (!canEdit) return;

    setCcSaveStatus('typing');
    if (ccDebounceTimerRef.current) clearTimeout(ccDebounceTimerRef.current);
    ccDebounceTimerRef.current = setTimeout(() => {
      performAutoSaveChiefComplaint(val);
    }, 900);
  };

  const handleChiefComplaintBlur = () => {
    if (ccSaveStatus === 'typing') {
      if (ccDebounceTimerRef.current) clearTimeout(ccDebounceTimerRef.current);
      performAutoSaveChiefComplaint(currentCcRef.current);
    }
  };

  // 5. Lưu ghi chú chuyên môn
  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      message.warning('Vui lòng nhập nội dung ghi chú.');
      return;
    }
    if (!(await sendAction('notes', { content: noteContent.trim() }))) return;
    setNoteContent('');
  };

  // Lọc lịch sử các lần khám cũ của bệnh nhân này
  const patientId = appointment.patientId;
  const pastAppointments = useMemo(() => {
    return allAppointments.filter(
      (a) => a.patientId === patientId && a.id !== appointment.id,
    );
  }, [allAppointments, patientId, appointment.id]);

  // Tính tuổi bệnh nhân
  const patientAge = useMemo(() => {
    if (!patientInfo?.dob) return 28;
    const birth = new Date(patientInfo.dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    return age > 0 ? age : 28;
  }, [patientInfo?.dob]);

  // Tính BMI tự động (chỉ tính khi có cả cân nặng và chiều cao)
  const calculatedBMI = useMemo(() => {
    const w =
      weight != null
        ? weight
        : latestVital?.weight
          ? Number(latestVital.weight)
          : null;
    const h = height ? height / 100 : null;
    if (w && h && h > 0) {
      const val = Number(w) / (h * h);
      return val.toFixed(1);
    }
    return null;
  }, [latestVital?.weight, weight, height]);

  // Ảnh đại diện của bệnh nhân (từ hồ sơ hoặc local upload)
  const patientAvatarUrl = useMemo(() => {
    if (patientInfo?.avatarUrl) return patientInfo.avatarUrl;
    if (typeof window !== 'undefined') {
      const pId = appointment.patientId;
      if (pId) {
        const local = localStorage.getItem(`patient_avatar_${pId}`);
        if (local) return local;
      }
      const globalAv = localStorage.getItem('patient_avatar_url');
      if (globalAv) return globalAv;
    }
    return null;
  }, [patientInfo?.avatarUrl, appointment.patientId]);

  // Bảng danh sách các đợt khám cũ
  const pastVisitColumns: ColumnsType<Appointment> = [
    {
      title: 'Mã lịch hẹn',
      dataIndex: 'appointmentCode',
      key: 'appointmentCode',
      width: 170,
      render: (code, row) => (
        <a
          onClick={() => setSelectedPastVisit(row)}
          style={{ fontWeight: 700, color: '#0B5CAD', cursor: 'pointer' }}
        >
          {code}
        </a>
      ),
    },
    {
      title: 'Thời gian khám',
      key: 'time',
      width: 150,
      render: (_, row) => (
        <div>
          <strong>
            {row.startAt
              ? new Date(row.startAt).toLocaleDateString('vi-VN')
              : '—'}
          </strong>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {row.startAt
              ? new Date(row.startAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Dịch vụ y tế',
      key: 'service',
      render: (_, row) => (
        <div>
          <strong style={{ color: '#0f172a' }}>
            {row.pricing?.serviceName || 'Khám chuyên khoa'}
          </strong>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {row.roomCode || 'P.207'} - {row.roomName || 'Sản Phụ khoa'}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: (_, row) => (
        <Tag color={row.status === 'COMPLETED' ? 'green' : 'blue'}>
          {row.status === 'COMPLETED' ? '✓ Đã hoàn tất' : row.status}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          style={{ padding: 0, fontWeight: 600, color: '#0B5CAD' }}
          onClick={() => setSelectedPastVisit(row)}
        >
          Xem chi tiết ➔
        </Button>
      ),
    },
  ];

  return (
    <div className="doctor-consultation-container">
      {refreshError && (
        <Alert
          type="warning"
          showIcon
          message="Cần tải lại hồ sơ trước khi tiếp tục chỉnh sửa."
          action={
            <Button
              onClick={() =>
                refreshEncounter().catch(() =>
                  message.error('Chưa tải được hồ sơ. Vui lòng thử lại.'),
                )
              }
            >
              Tải lại hồ sơ
            </Button>
          }
        />
      )}
      {/* ─── THẺ HỒ SƠ KHÁM BỆNH & THÔNG TIN HÀNH CHÍNH (GỘP CHUNG 1 KHỐI DUY NHẤT) ─── */}
      <div className="consultation-patient-card">
        {/* Header Row: Nút Quay lại nổi bật, Thông tin bệnh nhân & Thao tác ca khám */}
        <div className="patient-card-header">
          <div className="patient-primary-info">
            {/* Nút Quay lại thiết kế sắc nét, nổi bật, đặt tại đầu thẻ hồ sơ */}
            <Button
              icon={
                <ArrowLeftOutlined style={{ fontSize: 14, fontWeight: 700 }} />
              }
              onClick={onBack}
              className="consultation-btn-back"
            >
              Quay lại
            </Button>

            <div className="back-btn-divider" />

            <div className="patient-avatar-box">
              {patientAvatarUrl ? (
                <img
                  src={patientAvatarUrl}
                  alt={
                    patientInfo?.name || appointment.patientName || 'Bệnh nhân'
                  }
                  className="patient-avatar-img"
                />
              ) : (
                <UserOutlined className="patient-avatar-icon" />
              )}
            </div>

            <div className="patient-title-block">
              <div className="patient-name-row">
                <h2 className="patient-fullname">
                  {patientInfo?.name || appointment.patientName || 'Bệnh nhân'}
                </h2>
                <span className="patient-sub-demographic">
                  {patientInfo?.gender || 'Nữ'} · {patientAge} tuổi (
                  {patientInfo?.dob
                    ? new Date(patientInfo.dob).toLocaleDateString('vi-VN')
                    : '—'}
                  )
                </span>
              </div>

              <div className="patient-service-row">
                <span className="service-text">
                  <strong>Dịch vụ y tế:</strong>{' '}
                  {appointment.pricing?.serviceName ||
                    'Khám thai chuyên gia & tư vấn dinh dưỡng cá thể hóa'}
                </span>
              </div>

              <div className="patient-payment-row">
                <span className="payment-text">
                  <CheckCircleOutlined
                    style={{ color: '#10b981', marginRight: 5 }}
                  />{' '}
                  Đã thanh toán viện phí tiếp đón
                </span>
              </div>
            </div>
          </div>

          {/* Right: STT Queue Box, Trạng thái & Nút thao tác (Đã bỏ nút Chuyển duyệt) */}
          <div className="patient-header-actions">
            {/* STT Queue Chip */}
            <div className="consultation-queue-chip">
              <span className="consultation-queue-tag">STT KHÁM</span>
              <strong className="consultation-queue-code">
                {appointment.ticketCode || '207-01'}
              </strong>
              <div className="consultation-queue-divider" />
              <span className="consultation-queue-room">
                Phòng {doctor?.roomCode || appointment.roomCode || 'P.207'}
              </span>
            </div>

            {/* Clinical Status Chip */}
            {canStart && (
              <span className="consultation-status-pill is-checked-in">
                👤 Đã check-in / Chờ khám
              </span>
            )}
            {canEdit && (
              <span className="consultation-status-pill is-in-care">
                🩺 Đang khám bệnh
              </span>
            )}
            {encState === 'READY_FOR_REVIEW' && (
              <span className="consultation-status-pill is-review">
                📤 Chờ duyệt
              </span>
            )}
            {isFinalized && (
              <span className="consultation-status-pill is-completed">
                ✓ Đã hoàn tất ca khám
              </span>
            )}

            {/* Nút bắt đầu khám bệnh */}
            {canStart && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={busy}
                style={{
                  background: '#10b981',
                  borderColor: '#10b981',
                  fontWeight: 700,
                  height: 38,
                }}
                onClick={handleStartEncounter}
              >
                Bắt đầu khám bệnh
              </Button>
            )}

            {/* Nút Hoàn tất ca khám */}
            {canFinalize && (
              <Popconfirm
                title="Xác nhận hoàn tất ca khám?"
                description="Hồ sơ bệnh án sẽ được khóa và lưu trữ chính thức."
                okText="Hoàn tất"
                cancelText="Hủy"
                onConfirm={handleFinalize}
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={busy}
                  style={{
                    background: '#0B5CAD',
                    borderColor: '#0B5CAD',
                    fontWeight: 700,
                    height: 38,
                  }}
                >
                  Hoàn tất ca khám
                </Button>
              </Popconfirm>
            )}

            {isFinalized && (
              <Space>
                <Tag
                  color="green"
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 8,
                    margin: 0,
                  }}
                >
                  ✓ Đã hoàn tất ca khám
                </Tag>
                <Button
                  icon={<ExperimentOutlined />}
                  onClick={() => setClsResultModalOpen(true)}
                  style={{
                    color: '#0d9488',
                    borderColor: '#99f6e4',
                    background: '#f0fdfa',
                    fontWeight: 700,
                    height: 38,
                    borderRadius: 8,
                  }}
                >
                  Xem Kết Quả Cận Lâm Sàng
                </Button>
                <Button
                  type="primary"
                  icon={<FilePdfOutlined />}
                  onClick={handleOpenReportPdf}
                  loading={busy}
                  style={{
                    background: '#0B5CAD',
                    borderColor: '#0B5CAD',
                    fontWeight: 700,
                    height: 38,
                    borderRadius: 8,
                    boxShadow: '0 2px 6px rgba(11, 92, 173, 0.25)',
                  }}
                >
                  Xem Phiếu Khám & Kết Quả (PDF)
                </Button>
              </Space>
            )}
          </div>
        </div>

        {/* Đường kẻ phân cách tinh tế */}
        <div className="patient-card-divider" />

        {/* 2-DÒNG: THÔNG TIN LỊCH HẸN VÀ ĐỊA CHỈ & NGƯỜI THÂN HIỂN THỊ ĐẦY ĐỦ */}
        <div className="patient-admin-box">
          {/* Dòng 1: 4 Cột thông tin cơ bản */}
          <div className="patient-admin-row-1">
            <div className="patient-admin-item">
              <span className="meta-label">MÃ LỊCH HẸN</span>
              <strong className="meta-val text-blue">
                {appointment.appointmentCode}
              </strong>
            </div>
            <div className="patient-admin-item">
              <span className="meta-label">KHUNG GIỜ KHÁM</span>
              <strong className="meta-val">
                {appointment.startAt
                  ? new Date(appointment.startAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}{' '}
                -{' '}
                {appointment.endAt
                  ? new Date(appointment.endAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}{' '}
                (
                {appointment.startAt
                  ? new Date(appointment.startAt).toLocaleDateString('vi-VN')
                  : 'Hôm nay'}
                )
              </strong>
            </div>
            <div className="patient-admin-item">
              <span className="meta-label">CCCD / ĐỊNH DANH</span>
              <strong className="meta-val">
                {patientInfo?.nationalId || '001196000112'}
              </strong>
            </div>
            <div className="patient-admin-item">
              <span className="meta-label">SỐ ĐIỆN THOẠI</span>
              <strong className="meta-val">
                {patientInfo?.phone || appointment.patientPhone || '0901234023'}
              </strong>
            </div>
          </div>

          <div className="admin-divider-line" />

          {/* Dòng 2: Địa chỉ thường trú và Người thân liên hệ xuống dòng mới, hiển thị đầy đủ không bị cắt ngắn */}
          <div className="patient-admin-row-2">
            <div className="patient-admin-item item-wide">
              <span className="meta-label">ĐỊA CHỈ THƯỜNG TRÚ</span>
              <span className="meta-val-full">
                {patientInfo?.address ||
                  '18 Lý Thường Kiệt, Phan Chu Trinh, Hoàn Kiếm, Hà Nội'}
              </span>
            </div>
            <div className="patient-admin-item item-wide">
              <span className="meta-label">NGƯỜI THÂN LIÊN HỆ</span>
              <span className="meta-val-full">
                {patientInfo?.emergencyContact ||
                  'Lê Quang Huy (Chồng - 0901234024)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. STREAMLINED MEDICAL WORKSPACE TABS ─── */}
      <div className="consultation-full-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          className="consultation-main-tabs"
          items={[
            /* ═════════════════════════════════════════════════════════════════════
               TAB 1: KHÁM BỆNH & KÊ TOA ĐIỀU TRỊ
               ═════════════════════════════════════════════════════════════════════ */
            {
              key: 'consultation',
              label: (
                <span style={{ fontWeight: 700 }}>
                  <MedicineBoxOutlined /> 1. Khám Bệnh & Kê Toa
                </span>
              ),
              children: (
                <div className="consultation-journey-layout">
                  {/* ─── DẤU HIỆU SINH TỒN & THỂ TRẠNG (HỢP NHẤT TRỰC TIẾP & TỰ ĐỘNG LƯU) ─── */}
                  <section
                    id="step-vitals"
                    className="consultation-step-section"
                  >
                    <div className="consultation-step-header">
                      <div className="step-header-left">
                        <span className="step-section-icon icon-blue">
                          <HeartOutlined />
                        </span>
                        <div className="step-header-text">
                          <h3>Dấu hiệu sinh tồn & Thể trạng</h3>
                          <p>
                            Ghi nhận chỉ số thể trạng thai phụ. Hệ thống tự động
                            tính BMI và lưu dữ liệu trực tiếp vào hồ sơ.
                          </p>
                        </div>
                      </div>

                      {/* Trạng thái tự động lưu */}
                      <div className="step-header-right">
                        {hasAnyInvalid ? (
                          <span
                            className="vitals-auto-status is-error"
                            title="Một số chỉ số ngoài giới hạn hợp lệ, chưa thể lưu"
                          >
                            <WarningOutlined /> Số liệu chưa hợp lệ
                          </span>
                        ) : saveStatus === 'typing' ? (
                          <span className="vitals-auto-status is-typing">
                            <EditOutlined /> Đang nhập liệu...
                          </span>
                        ) : saveStatus === 'saving' ? (
                          <span className="vitals-auto-status is-saving">
                            <LoadingOutlined spin /> Đang lưu hồ sơ...
                          </span>
                        ) : saveStatus === 'saved' ? (
                          <span className="vitals-auto-status is-saved">
                            <CheckCircleFilled /> Đã tự động lưu
                          </span>
                        ) : saveStatus === 'error' ? (
                          <span
                            className="vitals-auto-status is-error"
                            onClick={() =>
                              performAutoSave(currentValuesRef.current)
                            }
                            title="Nhấn để thử lưu lại"
                            style={{ cursor: 'pointer' }}
                          >
                            <WarningOutlined /> Chưa lưu được (Thử lại)
                          </span>
                        ) : (
                          <span className="vitals-auto-status is-idle">
                            <CheckCircleOutlined /> Tự động lưu
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Banner nhắc nhở bắt đầu ca khám khi chưa bắt đầu */}
                    {canStart && (
                      <div className="vitals-start-callout">
                        <div className="callout-msg">
                          <InfoCircleOutlined
                            style={{ color: '#0B5CAD', fontSize: 16 }}
                          />
                          <span>
                            Ca khám đang ở trạng thái <strong>Chờ khám</strong>.
                            Nhấn <strong>"Bắt đầu khám bệnh"</strong> để mở khóa
                            nhập các chỉ số và tự động lưu.
                          </span>
                        </div>
                        <Button
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          loading={busy}
                          onClick={handleStartEncounter}
                          style={{
                            background: '#0B5CAD',
                            fontWeight: 600,
                            borderRadius: 6,
                          }}
                        >
                          Bắt đầu khám bệnh ngay
                        </Button>
                      </div>
                    )}

                    {/* 6 Thẻ sinh hiệu hợp nhất trực tiếp (Vừa xem vừa nhập, tự động tính BMI) */}
                    <div className="vitals-unified-grid">
                      {/* 1. Huyết áp */}
                      <div
                        className={`vital-unified-card ${
                          isSystolicInvalid ||
                          isDiastolicInvalid ||
                          isBpMultipleSlashes
                            ? 'has-validation-error'
                            : ''
                        }`}
                      >
                        <div className="vital-card-top">
                          <div className="vital-card-title-group">
                            <span className="vital-card-icon icon-red">
                              <HeartFilled />
                            </span>
                            <span className="vital-card-title">Huyết áp</span>
                          </div>
                          <span className="vital-card-unit">mmHg</span>
                        </div>

                        <div className="vital-card-inputs">
                          <Input
                            className={`vital-input full-width ${
                              isSystolicInvalid ||
                              isDiastolicInvalid ||
                              isBpMultipleSlashes
                                ? 'input-error'
                                : ''
                            }`}
                            placeholder="120/80"
                            value={bpText}
                            onChange={(e) => handleBpChange(e.target.value)}
                            onBlur={handleBlur}
                            disabled={!canEdit}
                            title="Huyết áp tâm thu / tâm trương (ví dụ: 120/80 mmHg)"
                          />
                        </div>

                        {(isSystolicInvalid ||
                          isDiastolicInvalid ||
                          isBpMultipleSlashes) && (
                          <div className="vital-card-footer">
                            <span className="vital-eval-pill eval-danger">
                              {isSystolicInvalid
                                ? '⚠ Tâm thu: 40 - 300'
                                : isDiastolicInvalid
                                  ? '⚠ Tâm trương: 20 - 200'
                                  : '⚠ Định dạng: 120/80'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 2. Nhịp tim */}
                      <div
                        className={`vital-unified-card ${
                          isHeartRateInvalid ? 'has-validation-error' : ''
                        }`}
                      >
                        <div className="vital-card-top">
                          <div className="vital-card-title-group">
                            <span className="vital-card-icon icon-orange">
                              <ThunderboltOutlined />
                            </span>
                            <span className="vital-card-title">Nhịp tim</span>
                          </div>
                          <span className="vital-card-unit" title="nhịp/phút">
                            bpm
                          </span>
                        </div>

                        <div className="vital-card-inputs">
                          <InputNumber
                            className={`vital-input full-width ${isHeartRateInvalid ? 'input-error' : ''}`}
                            placeholder="75"
                            value={heartRate}
                            onChange={(val) =>
                              handleVitalChange('heartRate', val)
                            }
                            onBlur={handleBlur}
                            disabled={!canEdit}
                          />
                        </div>

                        {isHeartRateInvalid && (
                          <div className="vital-card-footer">
                            <span className="vital-eval-pill eval-danger">
                              ⚠ Giới hạn: 20 - 250
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 3. Thân nhiệt */}
                      <div
                        className={`vital-unified-card ${
                          isTemperatureInvalid ? 'has-validation-error' : ''
                        }`}
                      >
                        <div className="vital-card-top">
                          <div className="vital-card-title-group">
                            <span className="vital-card-icon icon-cyan">
                              <ExperimentOutlined />
                            </span>
                            <span className="vital-card-title">Thân nhiệt</span>
                          </div>
                          <span className="vital-card-unit">°C</span>
                        </div>

                        <div className="vital-card-inputs">
                          <InputNumber
                            className={`vital-input full-width ${isTemperatureInvalid ? 'input-error' : ''}`}
                            step={0.1}
                            placeholder="36.8"
                            value={temperature}
                            onChange={(val) =>
                              handleVitalChange('temperature', val)
                            }
                            onBlur={handleBlur}
                            disabled={!canEdit}
                          />
                        </div>

                        {isTemperatureInvalid && (
                          <div className="vital-card-footer">
                            <span className="vital-eval-pill eval-danger">
                              ⚠ Giới hạn: 30 - 45 °C
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 4. Cân nặng */}
                      <div
                        className={`vital-unified-card ${
                          isWeightInvalid ? 'has-validation-error' : ''
                        }`}
                      >
                        <div className="vital-card-top">
                          <div className="vital-card-title-group">
                            <span className="vital-card-icon icon-blue">
                              <DashboardOutlined />
                            </span>
                            <span className="vital-card-title">Cân nặng</span>
                          </div>
                          <span className="vital-card-unit">kg</span>
                        </div>

                        <div className="vital-card-inputs">
                          <InputNumber
                            className={`vital-input full-width ${isWeightInvalid ? 'input-error' : ''}`}
                            step={0.1}
                            placeholder="58.5"
                            value={weight}
                            onChange={(val) => handleVitalChange('weight', val)}
                            onBlur={handleBlur}
                            disabled={!canEdit}
                          />
                        </div>

                        {isWeightInvalid && (
                          <div className="vital-card-footer">
                            <span className="vital-eval-pill eval-danger">
                              ⚠ Giới hạn: 1 - 500 kg
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 5. Chiều cao */}
                      <div
                        className={`vital-unified-card ${
                          isHeightInvalid ? 'has-validation-error' : ''
                        }`}
                      >
                        <div className="vital-card-top">
                          <div className="vital-card-title-group">
                            <span className="vital-card-icon icon-purple">
                              <ColumnHeightOutlined />
                            </span>
                            <span className="vital-card-title">Chiều cao</span>
                          </div>
                          <span className="vital-card-unit">cm</span>
                        </div>

                        <div className="vital-card-inputs">
                          <InputNumber
                            className={`vital-input full-width ${isHeightInvalid ? 'input-error' : ''}`}
                            placeholder="160"
                            value={height}
                            onChange={handleHeightChange}
                            onBlur={handleBlur}
                            disabled={!canEdit}
                          />
                        </div>

                        {isHeightInvalid && (
                          <div className="vital-card-footer">
                            <span className="vital-eval-pill eval-danger">
                              ⚠ Giới hạn: 50 - 250 cm
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 6. Chỉ số BMI */}
                      <div className="vital-unified-card bmi-card">
                        <div className="vital-card-top">
                          <div className="vital-card-title-group">
                            <span className="vital-card-icon icon-green">
                              <CalculatorOutlined />
                            </span>
                            <span className="vital-card-title">Chỉ số BMI</span>
                          </div>
                          <span className="vital-card-unit">kg/m²</span>
                        </div>

                        <div className="vital-card-inputs">
                          <div className="vital-bmi-display">
                            <span className="bmi-number">
                              {calculatedBMI || '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ═════════════════════════════════════════════════════════════
                     BƯỚC 2: KHÁM LÂM SÀNG & CHỈ ĐỊNH CẬN LÂM SÀNG
                     ═════════════════════════════════════════════════════════════ */}
                  <section
                    id="step-exam-orders"
                    className="consultation-step-section"
                  >
                    <div className="consultation-step-header">
                      <div className="step-header-left">
                        <span className="step-section-icon icon-indigo">
                          <ExperimentOutlined />
                        </span>
                        <div className="step-header-text">
                          <h3>1. Khám lâm sàng & Chỉ định cận lâm sàng</h3>
                          <p>
                            Ghi nhận lý do khám, triệu chứng lâm sàng và ra y
                            lệnh chỉ định siêu âm, xét nghiệm trước khi ra chẩn
                            đoán
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Chief complaint & Initial Assessment box - Cho phép bác sĩ gõ/chỉnh sửa trực tiếp */}
                    <div className="chief-complaint-box">
                      <div className="cc-header">
                        <div className="cc-label">
                          <MedicineBoxOutlined
                            style={{ color: '#4f46e5', marginRight: 6 }}
                          />
                          LÝ DO KHÁM & TÌNH TRẠNG TIẾP NHẬN BAN ĐẦU:
                        </div>
                        <div className="cc-header-right">
                          {canEdit && (
                            <span className="cc-hint">
                              {ccSaveStatus === 'typing' ? (
                                <span
                                  style={{ color: '#ca8a04', fontWeight: 600 }}
                                >
                                  <EditOutlined /> Đang nhập liệu...
                                </span>
                              ) : ccSaveStatus === 'saving' ? (
                                <span
                                  style={{ color: '#4f46e5', fontWeight: 600 }}
                                >
                                  <LoadingOutlined /> Đang lưu...
                                </span>
                              ) : ccSaveStatus === 'saved' ? (
                                <span
                                  style={{ color: '#16a34a', fontWeight: 600 }}
                                >
                                  <CheckCircleOutlined /> Đã tự động lưu
                                </span>
                              ) : null}
                            </span>
                          )}
                        </div>
                      </div>

                      <Input.TextArea
                        rows={2}
                        value={chiefComplaintText}
                        onChange={(e) =>
                          handleChiefComplaintChange(e.target.value)
                        }
                        onBlur={handleChiefComplaintBlur}
                        disabled={!canEdit}
                        placeholder="Nhập lý do đến khám, triệu chứng ban đầu của thai phụ (VD: Khám thai định kỳ 18 tuần, mệt mỏi nhẹ, ra ít dịch nâu, không đau bụng...)"
                        className="cc-textarea"
                        autoSize={{ minRows: 2, maxRows: 5 }}
                      />
                    </div>

                    {/* Chỉ định Cận lâm sàng từ DB medical_services (kind = DIAGNOSTIC) */}
                    {encId ? (
                      <DoctorClinicalServiceOrders
                        request={request}
                        encounterId={String(encId)}
                        patientId={String(
                          encounter?.patientId || appointment.patientId || '',
                        )}
                        appointmentId={appointment.id}
                        appointmentCode={
                          appointment.appointmentCode ||
                          (appointment as any).code
                        }
                        encounterState={encState}
                        encounterVersion={
                          typeof encounter?.version === 'number'
                            ? encounter.version
                            : undefined
                        }
                        onOrderCreated={onReload}
                      />
                    ) : (
                      <Alert
                        message="Chưa tìm thấy hồ sơ ca khám để thực hiện chỉ định cận lâm sàng."
                        type="warning"
                      />
                    )}
                  </section>

                  {/* ═════════════════════════════════════════════════════════════
                     BƯỚC 2: CHẨN ĐOÁN XÁC ĐỊNH, KÊ ĐƠN THUỐC & KẾ HOẠCH ĐIỀU TRỊ
                     ═════════════════════════════════════════════════════════════ */}
                  <section
                    id="step-orders"
                    className="consultation-step-section"
                  >
                    <div className="consultation-step-header">
                      <div className="step-header-left">
                        <span className="step-section-icon icon-indigo">
                          <MedicineBoxOutlined />
                        </span>
                        <div className="step-header-text">
                          <h3>
                            2. Chẩn đoán xác định, Kê đơn thuốc & Kế hoạch điều
                            trị
                          </h3>
                          <p>
                            Ghi nhận chẩn đoán kết luận bệnh, kê đơn thuốc an
                            toàn thai kỳ FDA và lập kế hoạch dặn dò tái khám
                          </p>
                        </div>
                      </div>

                      {/* Trạng thái tự động lưu chẩn đoán */}
                      <div className="step-header-right">
                        {diagSaveStatus === 'typing' ? (
                          <span className="vitals-auto-status is-typing">
                            <EditOutlined /> Đang nhập chẩn đoán...
                          </span>
                        ) : diagSaveStatus === 'saving' ? (
                          <span className="vitals-auto-status is-saving">
                            <LoadingOutlined spin /> Đang lưu chẩn đoán...
                          </span>
                        ) : diagSaveStatus === 'saved' ? (
                          <span className="vitals-auto-status is-saved">
                            <CheckCircleFilled /> Đã tự động lưu chẩn đoán
                          </span>
                        ) : diagSaveStatus === 'error' ? (
                          <span
                            className="vitals-auto-status is-error"
                            onClick={() =>
                              performAutoSaveDiagnosis(currentDiagRef.current)
                            }
                            title="Nhấn để thử lưu lại"
                            style={{ cursor: 'pointer' }}
                          >
                            <WarningOutlined /> Chưa lưu được (Thử lại)
                          </span>
                        ) : (
                          <span className="vitals-auto-status is-idle">
                            <CheckCircleOutlined /> Tự động lưu chẩn đoán
                          </span>
                        )}
                      </div>
                    </div>

                    {/* VÙNG NHẬP CHẨN ĐOÁN & KẾT LUẬN CỦA BÁC SĨ (FULL WIDTH, ĐẸP MẮT) */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #e0e7ff',
                        borderRadius: 12,
                        padding: '16px 20px',
                        marginBottom: 20,
                        boxShadow: '0 1px 4px rgba(79, 70, 229, 0.05)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <EditOutlined
                            style={{ color: '#4f46e5', fontSize: 16 }}
                          />
                          <strong style={{ fontSize: 14.5, color: '#1e1b4b' }}>
                            Chẩn đoán lâm sàng & Kết luận của bác sĩ:
                          </strong>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: '#6366f1',
                            fontStyle: 'italic',
                          }}
                        >
                          (Hệ thống tự động lưu vào bệnh án khi gõ)
                        </span>
                      </div>

                      <Input.TextArea
                        rows={3}
                        placeholder="Nhập chẩn đoán lâm sàng, kết luận bệnh (ví dụ: Thai 18 tuần 4 ngày phát triển bình thường, tim thai đều rõ 145 bpm; Thiếu máu nhẹ thai kỳ; Chưa phát hiện bất thường hình thái thai...)"
                        value={diagnosisDesc}
                        onChange={(e) => handleDiagnosisChange(e.target.value)}
                        onBlur={handleDiagnosisBlur}
                        disabled={!canEdit}
                        style={{
                          fontSize: 14,
                          lineHeight: 1.6,
                          borderRadius: 8,
                          borderColor: '#cbd5e1',
                        }}
                      />
                    </div>

                    {/* KHỐI KÊ ĐƠN THUỐC & KẾ HOẠCH ĐIỀU TRỊ */}
                    {encId ? (
                      <DoctorClinicalOrders
                        request={request}
                        encounterId={String(encId)}
                        patientId={String(
                          encounter?.patientId || appointment.patientId || '',
                        )}
                        encounterState={encState}
                      />
                    ) : (
                      <Alert
                        message="Chưa tìm thấy hồ sơ ca khám để kê đơn và chỉ định điều trị."
                        type="warning"
                      />
                    )}

                    {/* Finalize Wrap-up Action Footer */}
                    <div
                      className="consultation-step-footer"
                      style={{ marginTop: 20 }}
                    >
                      <div className="footer-left-info">
                        <CheckCircleOutlined
                          style={{ color: '#10b981', fontSize: 20 }}
                        />
                        <div>
                          <strong>Hoàn tất ca khám bệnh</strong>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              color: '#64748b',
                            }}
                          >
                            Kiểm tra lại dấu hiệu sinh tồn, chẩn đoán, đơn thuốc
                            trước khi hoàn tất đóng bệnh án.
                          </p>
                        </div>
                      </div>

                      <div className="footer-right-actions">
                        <Button onClick={onBack}>Quay lại</Button>
                        {isFinalized && (
                          <>
                            <Button
                              icon={<ExperimentOutlined />}
                              onClick={() => setClsResultModalOpen(true)}
                              style={{
                                color: '#0d9488',
                                borderColor: '#99f6e4',
                                background: '#f0fdfa',
                                fontWeight: 700,
                              }}
                            >
                              Xem Kết Quả Cận Lâm Sàng
                            </Button>
                            <Button
                              type="primary"
                              icon={<FilePdfOutlined />}
                              loading={busy}
                              style={{ background: '#0B5CAD', fontWeight: 700 }}
                              onClick={handleOpenReportPdf}
                            >
                              Xem Phiếu Khám & Kết Quả (PDF)
                            </Button>
                          </>
                        )}
                        {canFinalize && (
                          <Popconfirm
                            title="Xác nhận hoàn tất ca khám?"
                            description="Hồ sơ bệnh án sẽ được khóa và lưu trữ chính thức."
                            okText="Hoàn tất"
                            cancelText="Hủy"
                            onConfirm={handleFinalize}
                          >
                            <Button
                              type="primary"
                              icon={<CheckCircleOutlined />}
                              loading={busy}
                              style={{ background: '#0B5CAD', fontWeight: 700 }}
                            >
                              Hoàn tất ca khám
                            </Button>
                          </Popconfirm>
                        )}
                        {canStart && (
                          <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            loading={busy}
                            style={{
                              background: '#10b981',
                              borderColor: '#10b981',
                              fontWeight: 700,
                            }}
                            onClick={handleStartEncounter}
                          >
                            Bắt đầu khám bệnh
                          </Button>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              ),
            },

            /* ═════════════════════════════════════════════════════════════════════
               TAB 2: TIỀN SỬ Y KHOA & LỊCH SỬ CÁC LẦN KHÁM CŨ
               ═════════════════════════════════════════════════════════════════════ */
            {
              key: 'history',
              label: (
                <span style={{ fontWeight: 700 }}>
                  <HistoryOutlined /> 2. Tiền Sử & Lịch Sử Khám Cũ (
                  {pastAppointments.length})
                </span>
              ),
              children: (
                <div className="history-tab-container">
                  {/* Section 1: Tiền sử bệnh nền mạn tính & can thiệp phẫu thuật */}
                  <div className="consultation-section-box">
                    <div className="consultation-section-title">
                      <SafetyCertificateOutlined style={{ color: '#10b981' }} />
                      Hồ sơ tiền sử y khoa & Bệnh nền:
                    </div>

                    <div className="history-profile-grid">
                      <div className="history-profile-card">
                        <span className="hp-title">
                          Bệnh lý mạn tính trước mang thai
                        </span>
                        <strong className="hp-val">
                          Không ghi nhận bệnh nền mạn tính
                        </strong>
                        <p className="hp-desc">
                          Huyết áp cơ bản bình thường, không có tiền sử đái tháo
                          đường, tim mạch hay bệnh lý tuyến giáp.
                        </p>
                      </div>

                      <div className="history-profile-card">
                        <span className="hp-title">
                          Tiền sử phẫu thuật & Can thiệp
                        </span>
                        <strong className="hp-val">
                          Chưa có vết mổ lấy thai cũ
                        </strong>
                        <p className="hp-desc">
                          Chưa từng phẫu thuật vùng chậu, bóc u xơ tử cung hay u
                          nang buồng trứng.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Danh sách các đợt khám trước tại bệnh viện */}
                  <div className="consultation-section-box">
                    <div className="consultation-section-title">
                      <HistoryOutlined style={{ color: '#0B5CAD' }} />
                      Lịch sử các lần khám trước tại viện (
                      {pastAppointments.length} lần):
                    </div>

                    {pastAppointments.length > 0 ? (
                      <div className="history-visits-table-wrap">
                        <Table<Appointment>
                          rowKey="id"
                          columns={pastVisitColumns}
                          dataSource={pastAppointments}
                          pagination={false}
                          size="middle"
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '36px 16px',
                          background: '#f8fafc',
                          borderRadius: 10,
                        }}
                      >
                        <FileDoneOutlined
                          style={{
                            fontSize: 36,
                            color: '#94a3b8',
                            marginBottom: 12,
                          }}
                        />
                        <Title
                          level={5}
                          style={{ margin: 0, color: '#334155' }}
                        >
                          Chưa có lịch sử khám cũ tại chuyên khoa
                        </Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Đây là đợt khám đầu tiên của bệnh nhân tại Bệnh viện
                          Phụ sản Tâm An Hospital.
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ─── MODAL XEM CHI TIẾT LƯỢT KHÁM CŨ ─── */}
      <Modal
        title={`Chi tiết lịch hẹn khám cũ: ${selectedPastVisit?.appointmentCode || ''}`}
        open={Boolean(selectedPastVisit)}
        onCancel={() => setSelectedPastVisit(null)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setSelectedPastVisit(null)}
          >
            Đóng
          </Button>,
        ]}
        width={700}
      >
        {selectedPastVisit && (
          <Descriptions
            bordered
            column={1}
            size="small"
            style={{ marginTop: 12 }}
          >
            <Descriptions.Item label="Mã lịch hẹn">
              <strong>{selectedPastVisit.appointmentCode}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian khám">
              {selectedPastVisit.startAt
                ? new Date(selectedPastVisit.startAt).toLocaleString('vi-VN')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Dịch vụ y tế">
              {selectedPastVisit.pricing?.serviceName || 'Khám chuyên khoa'}
            </Descriptions.Item>
            <Descriptions.Item label="Phòng khám">
              {selectedPastVisit.roomCode || 'P.207'} -{' '}
              {selectedPastVisit.roomName || 'Sản Phụ khoa'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color="green">✓ Đã hoàn tất</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Tóm tắt chẩn đoán & Kết luận cũ">
              Khám thai định kỳ chuẩn y khoa (Z34.8), thai nhi phát triển theo
              bách phân vị chuẩn, tim thai đều rõ 145 bpm, cử động thai tốt.
              Hướng dẫn thai phụ tiếp tục bổ sung vi chất và hẹn tái khám theo
              lịch.
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* MODAL XEM & IN PHIẾU KẾT QUẢ KHÁM BỆNH PDF CHUẨN A4 */}
      <MedicalReportModal
        open={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        documentId={reportDocumentId}
        encounterId={encId}
        appointmentCode={appointment.appointmentCode}
        patientName={String(
          patientInfo?.name ||
            appointment.patientNameSnapshot ||
            appointment.patientName ||
            '',
        )}
        fileName={reportFileName}
      />

      {/* MODAL XEM TẤT CẢ FILE KẾT QUẢ CHỈ ĐỊNH CẬN LÂM SÀNG */}
      <ClinicalOrdersResultModal
        open={clsResultModalOpen}
        onClose={() => setClsResultModalOpen(false)}
        encounterId={encId}
        appointmentCode={appointment?.appointmentCode}
        patientName={String(
          patientInfo?.name ||
            appointment.patientNameSnapshot ||
            appointment.patientName ||
            '',
        )}
      />
    </div>
  );
}
