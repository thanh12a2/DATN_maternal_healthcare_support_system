import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ExperimentOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  SyncOutlined,
  FileSearchOutlined,
  DeleteOutlined,
  UploadOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {
  Button,
  Tag,
  Modal,
  Select,
  Input,
  message,
  Table,
  Popconfirm,
  Tooltip,
  Radio,
  Image,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Requester, CatalogService } from '../../../services/catalog';
import { listCatalogServices } from '../../../services/catalog';
import {
  getEncounter,
  createServiceOrder,
  deleteServiceOrder,
  removeServiceOrderCharge,
  updateServiceOrderResult,
} from '../../../services/clinical';
import { listReceptionInvoices } from '../../../services/operations';
import { toInvoice, type DeskInvoice } from '../../../services/receptionDesk';
import {
  getStoredAccessToken,
  subscribeToRealtimeStream,
} from '../../../services/realtimeStream';
import { useAuthSession } from '../../../app/AuthSessionProvider';

interface DoctorClinicalServiceOrdersProps {
  request: Requester;
  encounterId: string;
  patientId: string;
  appointmentId?: string;
  appointmentCode?: string;
  encounterState: string;
  encounterVersion?: number;
  onOrderCreated?: () => void;
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result.split(',')[1] ?? '')
        : reject(new Error('Không đọc được file.'));
    reader.onerror = () => reject(new Error('Không đọc được file.'));
    reader.readAsDataURL(file);
  });

export function DoctorClinicalServiceOrders({
  request,
  encounterId,
  patientId,
  appointmentId,
  appointmentCode,
  encounterState,
  encounterVersion,
  onOrderCreated,
}: DoctorClinicalServiceOrdersProps) {
  const { stream } = useAuthSession();
  const canEdit = encounterState === 'IN_PROGRESS';

  const [allServices, setAllServices] = useState<CatalogService[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Hóa đơn cận lâm sàng phát sinh
  const [suppInvoice, setSuppInvoice] = useState<DeskInvoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Thêm chỉ định inline (không cần mở modal to)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [orderClinicalNotes, setOrderClinicalNotes] = useState<string>('');
  const [savingOrder, setSavingOrder] = useState(false);

  // Xóa chỉ định
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  // Upload file kết quả cho từng order
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const targetUploadOrderRef = useRef<any | null>(null);

  // Xem trước file kết quả
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    fileName: string;
    mediaType: string;
    url: string;
    orderTitle?: string;
  } | null>(null);

  // Modal thanh toán tại phòng khám cho bác sĩ (Point-of-Care)
  const [doctorPayModalOpen, setDoctorPayModalOpen] = useState(false);
  const [doctorPaying, setDoctorPaying] = useState(false);
  const [doctorPayMethod, setDoctorPayMethod] = useState<'CASH' | 'VIETQR'>(
    'CASH',
  );

  // Tải danh mục dịch vụ cận lâm sàng (DIAGNOSTIC & PROCEDURE)
  const fetchCatalog = async () => {
    setCatalogLoading(true);
    try {
      const all = await listCatalogServices(request);
      setAllServices(all || []);
      const diagnosticServices = (all || []).filter(
        (s) => s.kind === 'DIAGNOSTIC' || s.kind === 'PROCEDURE',
      );
      setCatalogServices(diagnosticServices);
    } catch (err: any) {
      console.warn('Tải danh mục cận lâm sàng thất bại:', err);
    } finally {
      setCatalogLoading(false);
    }
  };

  // Tải danh sách chỉ định của ca khám hiện tại
  const fetchOrders = async () => {
    if (!encounterId) return;
    setOrdersLoading(true);
    try {
      const enc = await getEncounter(request, encounterId);
      const encData = (enc as any)?.data || enc;
      const orderList = Array.isArray(encData?.orders) ? encData.orders : [];
      setOrders(orderList);
    } catch (err: any) {
      console.warn('Tải danh sách chỉ định cận lâm sàng thất bại:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  // Tải hóa đơn phát sinh cận lâm sàng để nắm bắt trạng thái thanh toán
  const fetchSupplementaryInvoice = async () => {
    if (!appointmentId) return;
    setInvoiceLoading(true);
    try {
      const rawInvoices = await listReceptionInvoices(request, {
        appointmentId,
      }).catch(() => []);
      const deskInvoices = rawInvoices
        .map((inv) => toInvoice(inv as Record<string, unknown> | undefined))
        .filter((inv): inv is DeskInvoice => inv !== null);
      let supp = deskInvoices.find((i) => i.type === 'SUPPLEMENTARY') || null;

      // Tự động đồng bộ sang billing nếu ca khám đã có y lệnh mà chưa có hóa đơn phát sinh hoặc thiếu dòng
      if (orders.length > 0 && (!supp || supp.lines.length < orders.length)) {
        for (const ord of orders) {
          const svc = serviceMap.get(ord.catalogServiceId);
          const price = svc?.prices?.[0]?.amountMinor
            ? Number(svc.prices[0].amountMinor)
            : 0;
          await request('/api/billing/invoices/service-order', {
            method: 'POST',
            body: JSON.stringify({
              appointmentId,
              patientId,
              encounterId,
              orderId: ord.id,
              serviceId: ord.catalogServiceId,
              serviceName:
                svc?.name ||
                ord.catalogServiceName ||
                ord.serviceName ||
                'Dịch vụ cận lâm sàng',
              amountMinor: price,
            }),
          }).catch(() => null);
        }
        const freshRaw = await listReceptionInvoices(request, {
          appointmentId,
        }).catch(() => []);
        const freshInvs = freshRaw
          .map((inv) => toInvoice(inv as Record<string, unknown> | undefined))
          .filter((inv): inv is DeskInvoice => inv !== null);
        supp = freshInvs.find((i) => i.type === 'SUPPLEMENTARY') || supp;
      }

      setSuppInvoice(supp);
    } catch (err: any) {
      console.warn('Tải thông tin hóa đơn CLS thất bại:', err);
    } finally {
      setInvoiceLoading(false);
    }
  };

  useEffect(() => {
    void fetchCatalog();
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [encounterId]);

  useEffect(() => {
    void fetchSupplementaryInvoice();
  }, [appointmentId, orders.length]);

  // Lắng nghe SSE Realtime: Nếu quầy lễ tân hoặc phòng khác thanh toán, tự động cập nhật ngay tức thì
  useEffect(() => {
    if (!appointmentId && !appointmentCode) return;
    const unsubscribe = subscribeToRealtimeStream({
      url: '/api/appointment/desk/stream',
      getToken: getStoredAccessToken,
      streamFn: stream,
      onEvent: (event) => {
        const isMatch =
          (appointmentId &&
            (event.appointmentId === appointmentId ||
              event.appointmentCode === appointmentId)) ||
          (appointmentCode &&
            (event.appointmentId === appointmentCode ||
              event.appointmentCode === appointmentCode));
        if (isMatch) {
          void fetchOrders();
          void fetchSupplementaryInvoice();
        }
      },
    });
    return () => {
      unsubscribe();
    };
  }, [appointmentId, appointmentCode, encounterId, stream]);

  // Map service ID -> CatalogService để tra cứu nhanh thông tin & giá (tra từ allServices)
  const serviceMap = useMemo(() => {
    const map = new Map<string, CatalogService>();
    for (const s of allServices.length ? allServices : catalogServices) {
      if (s.id) map.set(s.id, s);
    }
    return map;
  }, [allServices, catalogServices]);

  // Dịch vụ đang chọn ở thanh thêm nhanh
  const selectedService = useMemo(() => {
    return serviceMap.get(selectedServiceId) || null;
  }, [serviceMap, selectedServiceId]);

  // Giá dịch vụ đang chọn
  const selectedServicePrice = useMemo(() => {
    if (
      !selectedService ||
      !selectedService.prices ||
      !selectedService.prices.length
    )
      return null;
    const activePrice =
      selectedService.prices.find((p) => p.status === 'ACTIVE') ||
      selectedService.prices[0];
    return activePrice?.amountMinor ? Number(activePrice.amountMinor) : null;
  }, [selectedService]);

  // Kiểm tra xem hóa đơn chỉ định đã thanh toán hay chưa
  const isSuppPaid = Boolean(
    suppInvoice &&
    suppInvoice.paid >= suppInvoice.total &&
    suppInvoice.total > 0,
  );

  // Tổng tiền cần thu của các chỉ định (dựa vào suppInvoice hoặc ước tính từ danh sách y lệnh)
  const unpaidTotal = useMemo(() => {
    if (suppInvoice && suppInvoice.balance > 0) return suppInvoice.balance;
    if (suppInvoice && isSuppPaid) return 0;
    return orders.reduce((sum, ord) => {
      const svc = serviceMap.get(ord.catalogServiceId);
      const price = svc?.prices?.[0]?.amountMinor
        ? Number(svc.prices[0].amountMinor)
        : 0;
      return sum + price;
    }, 0);
  }, [suppInvoice, isSuppPaid, orders, serviceMap]);

  const handleOpenDoctorPayModal = async () => {
    if (
      (!suppInvoice || suppInvoice.lines.length < orders.length) &&
      orders.length > 0
    ) {
      await fetchSupplementaryInvoice();
    }
    setDoctorPayMethod('CASH');
    setDoctorPayModalOpen(true);
  };

  // Xử lý Thêm nhanh chỉ định cận lâm sàng (Inline - không cần modal)
  const handleInlineCreateOrder = async () => {
    if (!encounterId || !selectedServiceId) {
      message.error('Vui lòng chọn dịch vụ cận lâm sàng.');
      return;
    }

    setSavingOrder(true);
    try {
      const encRes = await getEncounter(request, encounterId).catch(() => null);
      const encData = (encRes as any)?.data || encRes;
      const latestVersion =
        typeof encData?.version === 'number'
          ? encData.version
          : (encounterVersion ?? 1);

      const svc = serviceMap.get(selectedServiceId);
      const svcCode = String(svc?.code || '');
      const stageCode = svcCode.includes('US')
        ? 'ULTRASOUND'
        : svcCode.includes('NIPT') || svcCode.includes('TEST')
          ? 'LAB_TEST'
          : 'DIAGNOSTIC';

      const orderRes = await createServiceOrder(request, encounterId, {
        catalogServiceId: selectedServiceId,
        stageCode,
        requiredResult: true,
        billableSnapshot: true,
        expectedVersion: latestVersion,
        clinicalNotes: orderClinicalNotes.trim() || undefined,
      });

      // Tự động đồng bộ sang hóa đơn cận lâm sàng phát sinh cho Quầy thu ngân / Lễ tân
      const newOrderId = (orderRes as any)?.data?.id || (orderRes as any)?.id;
      if (appointmentId && newOrderId) {
        await request('/api/billing/invoices/service-order', {
          method: 'POST',
          body: JSON.stringify({
            appointmentId,
            patientId,
            encounterId,
            orderId: newOrderId,
            serviceId: selectedServiceId,
            serviceName: svc?.name || 'Dịch vụ cận lâm sàng',
            amountMinor: selectedServicePrice || 0,
          }),
        }).catch((billingErr) => {
          console.warn(
            'Lỗi khi tự động đồng bộ hóa đơn CLS sang Billing:',
            billingErr,
          );
        });

        // Bắn sự kiện realtime cho Lễ tân cập nhật ngay lập tức mà không cần tải lại trang
        await request('/api/appointment/desk/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            eventType: 'appointment.order_created',
            appointmentId,
            appointmentCode,
            patientId,
            status: 'IN_CLINICAL_CARE',
          }),
        }).catch(() => null);
      }

      message.success(
        `Đã thêm chỉ định "${svc?.name || 'Cận lâm sàng'}". Hóa đơn viện phí phát sinh đã cập nhật!`,
      );
      setSelectedServiceId('');
      setOrderClinicalNotes('');
      await fetchOrders();
      await fetchSupplementaryInvoice();
      if (onOrderCreated) onOrderCreated();
    } catch (err: any) {
      console.error('Lỗi khi chỉ định cận lâm sàng:', err);
      message.error(err?.message || 'Không thể tạo chỉ định cận lâm sàng.');
    } finally {
      setSavingOrder(false);
    }
  };

  // Xử lý Xóa / Bỏ chỉ định nếu ấn nhầm (Khi chưa thanh toán)
  const handleDeleteOrder = async (record: any) => {
    const orderId = record.id;
    if (!orderId) return;

    if (isSuppPaid) {
      message.error(
        'Chỉ định này đã được thanh toán viện phí, không thể xóa bỏ.',
      );
      return;
    }

    setDeletingOrderId(orderId);
    try {
      // 1. Xóa order trong medical-record-service
      await deleteServiceOrder(request, orderId);

      // 2. Xóa dòng tiền tương ứng trong hóa đơn phát sinh
      await removeServiceOrderCharge(request, orderId).catch((err) => {
        console.warn('Xóa dòng viện phí cận lâm sàng:', err);
      });

      // 3. Broadcast realtime cho quầy tiếp đón / thu ngân cập nhật lại hóa đơn
      if (appointmentId || appointmentCode) {
        await request('/api/appointment/desk/broadcast', {
          method: 'POST',
          body: JSON.stringify({
            eventType: 'appointment.order_deleted',
            appointmentId,
            appointmentCode,
            patientId,
            status: 'IN_CLINICAL_CARE',
            orderId,
          }),
        }).catch(() => null);
      }

      message.success('Đã xóa bỏ chỉ định cận lâm sàng thành công.');
      await fetchOrders();
      await fetchSupplementaryInvoice();
      if (onOrderCreated) onOrderCreated();
    } catch (err: any) {
      console.error('Lỗi khi xóa chỉ định:', err);
      message.error(err?.message || 'Không thể xóa chỉ định cận lâm sàng.');
    } finally {
      setDeletingOrderId(null);
    }
  };

  // Mở hộp chọn file upload kết quả cho chỉ định cụ thể
  const handleTriggerUpload = (record: any) => {
    targetUploadOrderRef.current = record;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Xử lý khi người dùng chọn file upload kết quả
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const targetOrder = targetUploadOrderRef.current;
    if (!files || files.length === 0 || !targetOrder) return;

    const file = files[0];
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExts.includes(ext)) {
      message.error(
        'Chỉ chấp nhận file định dạng PDF, JPG, PNG hoặc Word (.doc, .docx).',
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      message.error('Dung lượng tệp vượt quá 15 MB.');
      return;
    }

    setUploadingOrderId(targetOrder.id);
    try {
      // 1. Lưu file lên document-service
      const b64 = await fileToBase64(file);
      const docPath = `/api/documents/clinical-results/${encodeURIComponent(encounterId)}`;
      const docRes = await request<{ data: any }>(docPath, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          mediaType:
            file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
          contentBase64: b64,
        }),
      });

      const docItem = docRes?.data || docRes;
      const docId =
        docItem?.id || (Array.isArray(docItem) ? docItem[0]?.id : '');

      // 2. Gắn kết quả vào order và cập nhật trạng thái sang RESULT_AVAILABLE
      const structuredResult = {
        fileId: docId,
        fileName: file.name,
        mediaType:
          file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        fileUrl: `/api/documents/clinical-results/${encodeURIComponent(encounterId)}/${encodeURIComponent(docId)}/content`,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      };

      await updateServiceOrderResult(request, targetOrder.id, structuredResult);

      const svc = serviceMap.get(targetOrder.catalogServiceId);
      message.success(
        `Đã tải lên kết quả cho "${svc?.name || 'chỉ định'}" thành công!`,
      );

      await fetchOrders();
      if (onOrderCreated) onOrderCreated();
    } catch (err: any) {
      console.error('Lỗi khi tải kết quả lên:', err);
      message.error(err?.message || 'Không thể tải file kết quả lên.');
    } finally {
      setUploadingOrderId(null);
      targetUploadOrderRef.current = null;
    }
  };

  // Mở xem file kết quả
  const handleViewResultFile = async (record: any) => {
    const result = record.structuredResult;
    if (!result || !result.fileId) {
      message.info('Chỉ định này chưa có file kết quả đính kèm.');
      return;
    }

    const svc = serviceMap.get(record.catalogServiceId);
    const orderTitle = svc?.name || 'Kết quả cận lâm sàng';

    try {
      // Tải nội dung blob an toàn qua authenticated stream
      const res = await stream(result.fileUrl);
      if (!res.ok) throw new Error('Không thể tải file từ máy chủ.');

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      setPreviewFile({
        fileName: result.fileName || 'ket_qua_cls.pdf',
        mediaType: result.mediaType || blob.type || 'application/pdf',
        url: objectUrl,
        orderTitle,
      });
      setPreviewModalOpen(true);
    } catch (err: any) {
      console.error('Lỗi khi mở xem file:', err);
      message.error('Không thể mở file kết quả. Vui lòng thử lại.');
    }
  };

  // Đóng modal xem trước file
  const handleClosePreview = () => {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
    setPreviewModalOpen(false);
  };

  // Xử lý Bác sĩ thu tiền trực tiếp tại phòng khám (Point-of-Care Payment)
  const handleDoctorPayment = async () => {
    let currentSupp = suppInvoice;
    if (!currentSupp || currentSupp.lines.length < orders.length) {
      await fetchSupplementaryInvoice();
      const rawInvoices = await listReceptionInvoices(request, {
        appointmentId,
      }).catch(() => []);
      const deskInvoices = rawInvoices
        .map((inv) => toInvoice(inv as Record<string, unknown> | undefined))
        .filter((inv): inv is DeskInvoice => inv !== null);
      currentSupp =
        deskInvoices.find((i) => i.type === 'SUPPLEMENTARY') || null;
    }
    if (!currentSupp) {
      message.error(
        'Không tìm thấy thông tin hóa đơn cận lâm sàng để thanh toán.',
      );
      return;
    }
    setDoctorPaying(true);
    try {
      const method =
        doctorPayMethod === 'CASH' ? 'CASH' : 'MANUAL_BANK_TRANSFER';
      await request(
        `/api/billing/invoices/${encodeURIComponent(currentSupp.id)}/payments`,
        {
          method: 'POST',
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            method,
            amountMinor: currentSupp.balance,
            expectedInvoiceVersion: currentSupp.version,
            receivedAt: new Date().toISOString(),
            reference: doctorPayMethod === 'CASH' ? 'BS_CASH' : 'BS_VIETQR',
          }),
        },
      );

      // Broadcast realtime cho quầy tiếp đón / thu ngân cập nhật ngay trạng thái ĐÃ THANH TOÁN
      await request('/api/appointment/desk/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'appointment.invoice_updated',
          appointmentId,
          appointmentCode,
          patientId,
          paymentStatus: method === 'CASH' ? 'PAID' : 'UNPAID',
        }),
      }).catch((e) => console.warn('Lỗi broadcast invoice_updated:', e));

      await request('/api/appointment/desk/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'appointment.order_created',
          appointmentId,
          appointmentCode,
          patientId,
          status: 'IN_CLINICAL_CARE',
        }),
      }).catch(() => null);

      message.success(
        method === 'CASH'
          ? `Đã ghi nhận thanh toán ${currentSupp.balance.toLocaleString('vi-VN')} đ viện phí cận lâm sàng thành công!`
          : 'Đã ghi nhận chuyển khoản, chờ lễ tân xác minh.',
      );
      setDoctorPayModalOpen(false);
      await fetchSupplementaryInvoice();
      await fetchOrders();
      if (onOrderCreated) onOrderCreated();
    } catch (err: any) {
      console.error('Lỗi khi bác sĩ thu tiền cận lâm sàng:', err);
      message.error(
        err?.message || 'Không thể ghi nhận thu tiền tại phòng khám.',
      );
    } finally {
      setDoctorPaying(false);
    }
  };

  // Cấu hình bảng hiển thị y lệnh
  const columns: ColumnsType<any> = [
    {
      title: 'STT',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_: any, __: any, index: number) => (
        <span style={{ fontWeight: 700, color: '#64748b' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Tên dịch vụ cận lâm sàng',
      key: 'serviceName',
      render: (_: any, record: any) => {
        const svc = serviceMap.get(record.catalogServiceId);
        const name =
          svc?.name ||
          record.catalogServiceName ||
          record.serviceName ||
          'Dịch vụ cận lâm sàng';
        return (
          <strong style={{ fontSize: 14, color: '#0f172a' }}>{name}</strong>
        );
      },
    },
    {
      title: 'Chuyên khoa / Phân loại',
      key: 'category',
      width: 155,
      render: (_: any, record: any) => {
        const stage = record.stageCode || 'DIAGNOSTIC';
        if (stage === 'ULTRASOUND') {
          return (
            <Tag color="blue" style={{ fontWeight: 600 }}>
              Siêu âm thai
            </Tag>
          );
        }
        if (stage === 'LAB_TEST') {
          return (
            <Tag color="cyan" style={{ fontWeight: 600 }}>
              Xét nghiệm / Sàng lọc
            </Tag>
          );
        }
        return (
          <Tag color="purple" style={{ fontWeight: 600 }}>
            Cận lâm sàng
          </Tag>
        );
      },
    },
    {
      title: 'Đơn giá niêm yết',
      key: 'price',
      width: 135,
      align: 'right',
      render: (_: any, record: any) => {
        const svc = serviceMap.get(record.catalogServiceId);
        const price = svc?.prices?.[0]?.amountMinor
          ? Number(svc.prices[0].amountMinor)
          : null;
        return (
          <strong style={{ color: '#0B5CAD', fontSize: 13.5 }}>
            {price !== null
              ? `${price.toLocaleString('vi-VN')} đ`
              : 'Theo biểu giá'}
          </strong>
        );
      },
    },
    {
      title: 'Trạng thái thực hiện',
      key: 'status',
      width: 185,
      render: (_: any, record: any) => {
        const hasResult = Boolean(
          record.structuredResult?.fileName ||
          record.status === 'RESULT_AVAILABLE' ||
          record.status === 'VERIFIED',
        );
        if (hasResult) {
          return (
            <Tag
              icon={<CheckCircleOutlined />}
              color="success"
              style={{ fontWeight: 700, padding: '3px 8px' }}
            >
              ✓ Đã có kết quả
            </Tag>
          );
        }
        if (record.status === 'IN_PROGRESS') {
          return (
            <Tag
              icon={<SyncOutlined spin />}
              color="processing"
              style={{ fontWeight: 600, padding: '3px 8px' }}
            >
              Đang thực hiện CLS
            </Tag>
          );
        }
        if (isSuppPaid) {
          return (
            <Tag
              icon={<ClockCircleOutlined />}
              color="blue"
              style={{ fontWeight: 600, padding: '3px 8px' }}
            >
              Chờ kết quả thực hiện
            </Tag>
          );
        }
        return (
          <Tag
            icon={<ClockCircleOutlined />}
            color="orange"
            style={{ fontWeight: 600, padding: '3px 8px' }}
          >
            Chờ thanh toán
          </Tag>
        );
      },
    },
    {
      title: 'File kết quả & Tải lên',
      key: 'resultFile',
      width: 220,
      render: (_: any, record: any) => {
        const result = record.structuredResult;
        const isUploading = uploadingOrderId === record.id;

        // Nếu chưa thanh toán, chưa cho tải kết quả
        if (!isSuppPaid) {
          return (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Cần thanh toán viện phí trước khi làm CLS
            </span>
          );
        }

        // Đã thanh toán và ĐÃ CÓ FILE KẾT QUẢ
        if (result?.fileName) {
          const isPdf =
            (result.fileName || '').endsWith('.pdf') ||
            result.mediaType?.includes('pdf');
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <Button
                size="small"
                type="link"
                icon={
                  isPdf ? (
                    <FilePdfOutlined style={{ color: '#ef4444' }} />
                  ) : (
                    <FileImageOutlined style={{ color: '#0284c7' }} />
                  )
                }
                onClick={() => handleViewResultFile(record)}
                style={{
                  fontWeight: 600,
                  color: '#0369a1',
                  padding: 0,
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={result.fileName}
              >
                {result.fileName}
              </Button>

              <Tooltip title="Xem chi tiết kết quả file này">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<EyeOutlined />}
                  onClick={() => handleViewResultFile(record)}
                  style={{
                    height: 26,
                    padding: '0 8px',
                    fontSize: 11.5,
                    borderRadius: 6,
                  }}
                >
                  Xem
                </Button>
              </Tooltip>

              {canEdit && (
                <Tooltip title="Tải file khác để thay thế kết quả">
                  <Button
                    size="small"
                    icon={
                      isUploading ? (
                        <LoadingOutlined spin />
                      ) : (
                        <UploadOutlined />
                      )
                    }
                    disabled={isUploading}
                    onClick={() => handleTriggerUpload(record)}
                    style={{
                      height: 26,
                      padding: '0 6px',
                      fontSize: 11.5,
                      borderRadius: 6,
                    }}
                  />
                </Tooltip>
              )}
            </div>
          );
        }

        // Đã thanh toán nhưng CHƯA CÓ FILE KẾT QUẢ -> Hiển thị nút upload
        return (
          <div>
            {canEdit ? (
              <Button
                size="small"
                type="dashed"
                icon={
                  isUploading ? <LoadingOutlined spin /> : <UploadOutlined />
                }
                loading={isUploading}
                onClick={() => handleTriggerUpload(record)}
                style={{
                  color: '#0284c7',
                  borderColor: '#0284c7',
                  fontWeight: 600,
                  fontSize: 12,
                  borderRadius: 6,
                }}
              >
                Tải file kết quả lên
              </Button>
            ) : (
              <span style={{ fontSize: 12, color: '#d97706' }}>
                Chờ phòng CLS tải kết quả
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 85,
      align: 'center',
      render: (_: any, record: any) => {
        // Sau khi đã thanh toán -> MẤT NÚT XÓA ĐI
        if (isSuppPaid) {
          return (
            <Tag
              color="success"
              style={{ margin: 0, fontSize: 11, fontWeight: 600 }}
            >
              Đã chốt
            </Tag>
          );
        }

        // Khi chưa thanh toán: Bác sĩ có thể xóa/bỏ nếu ấn nhầm
        if (!canEdit) return null;

        const isDeleting = deletingOrderId === record.id;
        return (
          <Popconfirm
            title="Bỏ chỉ định này?"
            description="Bạn có chắc chắn muốn xóa dịch vụ này khỏi ca khám (do ấn nhầm) không?"
            onConfirm={() => handleDeleteOrder(record)}
            okText="Xóa bỏ"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: isDeleting }}
          >
            <Tooltip title="Xóa bỏ nếu ấn nhầm (Khi chưa thanh toán)">
              <Button
                danger
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                loading={isDeleting}
                style={{ color: '#ef4444', fontWeight: 600 }}
              >
                Xóa
              </Button>
            </Tooltip>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <div
      className="doctor-clinical-service-orders-section"
      style={{ marginTop: 16 }}
    >
      {/* Ẩn input file picker dùng chung */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={handleFileChange}
      />

      {/* Header Khối Chỉ định Cận lâm sàng */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f0fa 100%)',
          borderRadius: '10px 10px 0 0',
          border: '1px solid #bfdbfe',
          borderBottom: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#0284c7',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            <ExperimentOutlined />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 14.5, color: '#0c4a6e' }}>
                Chỉ định Cận lâm sàng (Siêu âm, Xét nghiệm, Tầm soát thai kỳ)
              </strong>
              <Tag
                color="blue"
                style={{ borderRadius: 12, fontWeight: 700, margin: 0 }}
              >
                {orders.length} chỉ định
              </Tag>
            </div>
            <div style={{ fontSize: 12, color: '#0369a1', marginTop: 1 }}>
              Bác sĩ chọn dịch vụ thêm nhanh bên dưới. Sau khi thanh toán, có
              thể upload trực tiếp file kết quả siêu âm/xét nghiệm vào từng
              dòng.
            </div>
          </div>
        </div>
      </div>

      {/* THANH THÊM NHANH CHỈ ĐỊNH INLINE (KHÔNG CẦN BẬT MODAL) */}
      {canEdit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: '#f8fafc',
            border: '1px solid #bfdbfe',
            borderTop: 'none',
            borderBottom: '1px dashed #cbd5e1',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 350px' }}>
            <Select
              showSearch
              value={selectedServiceId || undefined}
              placeholder="🔍 Tìm & chọn dịch vụ (Siêu âm thai 2D/4D/5D, NIPT, Triple Test, Xét nghiệm máu...)"
              loading={catalogLoading}
              onChange={(val) => setSelectedServiceId(val)}
              filterOption={(input, option) => {
                const svc = serviceMap.get(String(option?.value));
                if (!svc) return false;
                const searchStr =
                  `${svc.name || ''} ${svc.code || ''} ${svc.summary || ''}`.toLowerCase();
                return searchStr.includes(input.toLowerCase());
              }}
              style={{ width: '100%' }}
              size="middle"
              allowClear
            >
              {catalogServices.map((s) => {
                const price = s.prices?.[0]?.amountMinor
                  ? Number(s.prices[0].amountMinor)
                  : null;
                return (
                  <Select.Option key={s.id} value={s.id}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>
                        <strong style={{ color: '#0f172a' }}>
                          {String(s.name || '')}
                        </strong>{' '}
                        <span style={{ color: '#64748b', fontSize: 11 }}>
                          ({String(s.code || '')})
                        </span>
                      </span>
                      {price !== null && (
                        <span
                          style={{
                            color: '#0B5CAD',
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {price.toLocaleString('vi-VN')} đ
                        </span>
                      )}
                    </div>
                  </Select.Option>
                );
              })}
            </Select>
          </div>

          <div style={{ flex: '1 1 240px' }}>
            <Input
              placeholder="Ghi chú vị trí khảo sát, yêu cầu lâm sàng (tùy chọn)..."
              value={orderClinicalNotes}
              onChange={(e) => setOrderClinicalNotes(e.target.value)}
              onPressEnter={handleInlineCreateOrder}
            />
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!selectedServiceId}
            loading={savingOrder}
            onClick={handleInlineCreateOrder}
            style={{
              background: selectedServiceId ? '#0284c7' : undefined,
              borderColor: selectedServiceId ? '#0284c7' : undefined,
              fontWeight: 700,
              borderRadius: 6,
              height: 36,
              whiteSpace: 'nowrap',
            }}
          >
            Thêm chỉ định{' '}
            {selectedServicePrice !== null
              ? `(${selectedServicePrice.toLocaleString('vi-VN')} đ)`
              : ''}
          </Button>

          {canEdit && orders.length > 0 && !isSuppPaid && (
            <Button
              type="primary"
              icon={<DollarOutlined />}
              onClick={handleOpenDoctorPayModal}
              style={{
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 700,
                borderRadius: 6,
                height: 36,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
              }}
            >
              💳 Thanh toán ngay{' '}
              {unpaidTotal > 0
                ? `(${unpaidTotal.toLocaleString('vi-VN')} đ)`
                : ''}
            </Button>
          )}
        </div>
      )}

      {/* Bảng danh sách hoặc Trạng thái trống */}
      <div
        style={{
          border: '1px solid #bfdbfe',
          borderTop: 'none',
          borderRadius: orders.length > 0 ? '0' : '0 0 10px 10px',
          background: '#fff',
          padding: orders.length > 0 ? 0 : 24,
        }}
      >
        {orders.length > 0 ? (
          <Table
            columns={columns}
            dataSource={orders}
            rowKey={(r) => r.id || r.catalogServiceId}
            pagination={false}
            loading={ordersLoading || invoiceLoading}
            size="middle"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <FileSearchOutlined
              style={{ fontSize: 32, color: '#94a3b8', marginBottom: 6 }}
            />
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
              Chưa có chỉ định cận lâm sàng nào cho ca khám này
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 3,
                maxWidth: 500,
                margin: '3px auto 0',
              }}
            >
              Nếu cần siêu âm hình thái thai nhi hoặc làm xét nghiệm máu/nước
              tiểu, chọn dịch vụ từ thanh tìm kiếm bên trên.
            </div>
          </div>
        )}
      </div>

      {/* Thanh trạng thái viện phí & Nút thanh toán trực tiếp tại phòng khám (Point-of-Care) */}
      {orders.length > 0 && (
        <div
          style={{
            border: '1px solid #bfdbfe',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            padding: '12px 18px',
            background: isSuppPaid ? '#f0fdf4' : '#fffbeb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isSuppPaid ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <ClockCircleOutlined
                  style={{ color: '#d97706', fontSize: 16 }}
                />
                <span style={{ color: '#92400e', fontWeight: 600 }}>
                  Chỉ định {orders.length} dịch vụ · Tổng viện phí CLS:{' '}
                  <strong>
                    {(suppInvoice?.total ?? unpaidTotal).toLocaleString(
                      'vi-VN',
                    )}{' '}
                    đ
                  </strong>{' '}
                  · Cần thu:{' '}
                  <strong style={{ color: '#dc2626' }}>
                    {unpaidTotal.toLocaleString('vi-VN')} đ
                  </strong>
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: '#166534',
                  fontWeight: 600,
                }}
              >
                <CheckCircleOutlined
                  style={{ color: '#16a34a', fontSize: 16 }}
                />
                <span>
                  Đã thanh toán đủ viện phí {orders.length} chỉ định (
                  {(suppInvoice?.paid ?? unpaidTotal).toLocaleString('vi-VN')}{' '}
                  đ). Bệnh nhân đã thực hiện hoặc sẵn sàng tải lên file kết quả!
                </span>
              </div>
            )}
          </div>

          {!isSuppPaid && canEdit && (
            <Button
              type="primary"
              icon={<DollarOutlined />}
              onClick={handleOpenDoctorPayModal}
              style={{
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 700,
                borderRadius: 6,
                height: 36,
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
              }}
            >
              Thanh toán ngay ({unpaidTotal.toLocaleString('vi-VN')} đ)
            </Button>
          )}
        </div>
      )}

      {/* Modal Bác sĩ thu tiền trực tiếp tại phòng khám (Point-of-Care Payment) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              <DollarOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Thu Viện Phí Chỉ Định Tại Phòng Khám
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Hóa đơn #
                {suppInvoice?.number || suppInvoice?.id?.slice(0, 8) || 'CLS'} ·
                Tự động đồng bộ sang Lễ tân
              </div>
            </div>
          </div>
        }
        open={doctorPayModalOpen}
        onCancel={() => setDoctorPayModalOpen(false)}
        onOk={handleDoctorPayment}
        okText={`Xác nhận đã thu ${unpaidTotal.toLocaleString('vi-VN')} đ`}
        cancelText="Đóng"
        confirmLoading={doctorPaying}
        width={560}
        okButtonProps={{
          style: {
            background: '#16a34a',
            borderColor: '#16a34a',
            fontWeight: 700,
          },
        }}
      >
        <div style={{ padding: '12px 0' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '14px 16px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: 13,
              }}
            >
              <span style={{ color: '#64748b' }}>Tổng viện phí phát sinh:</span>
              <strong style={{ color: '#0f172a' }}>
                {(suppInvoice?.total ?? unpaidTotal).toLocaleString('vi-VN')} đ
              </strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: 13,
              }}
            >
              <span style={{ color: '#64748b' }}>Đã thu trước đó:</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>
                {(suppInvoice?.paid ?? 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 10,
                borderTop: '1px dashed #cbd5e1',
                fontSize: 15,
              }}
            >
              <strong style={{ color: '#0f172a' }}>
                Số tiền cần thu ngay:
              </strong>
              <strong style={{ color: '#dc2626', fontSize: 17 }}>
                {unpaidTotal.toLocaleString('vi-VN')} đ
              </strong>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              Hình thức thu viện phí:
            </label>
            <Radio.Group
              value={doctorPayMethod}
              onChange={(e) => setDoctorPayMethod(e.target.value)}
              style={{ width: '100%' }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <Radio.Button
                  value="CASH"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    height: 42,
                    lineHeight: '40px',
                    fontWeight: 600,
                  }}
                >
                  💵 Tiền mặt tại phòng khám
                </Radio.Button>
                <Radio.Button
                  value="VIETQR"
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    height: 42,
                    lineHeight: '40px',
                    fontWeight: 600,
                  }}
                >
                  📲 Chuyển khoản VietQR
                </Radio.Button>
              </div>
            </Radio.Group>
          </div>
        </div>
      </Modal>

      {/* Modal Xem file kết quả cận lâm sàng */}
      <Modal
        open={previewModalOpen}
        onCancel={handleClosePreview}
        footer={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            href={previewFile?.url}
            download={previewFile?.fileName}
          >
            Tải về máy
          </Button>,
          <Button key="close" type="primary" onClick={handleClosePreview}>
            Đóng
          </Button>,
        ]}
        width={900}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilePdfOutlined style={{ color: '#0284c7', fontSize: 18 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                {previewFile?.orderTitle || 'Kết quả cận lâm sàng'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {previewFile?.fileName}
              </div>
            </div>
          </div>
        }
      >
        <div
          style={{
            minHeight: '60vh',
            maxHeight: '78vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#334155',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {previewFile?.mediaType.startsWith('image/') ? (
            <img
              src={previewFile.url}
              alt={previewFile.fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
              }}
            />
          ) : (
            <iframe
              src={previewFile?.url}
              title={previewFile?.fileName}
              style={{ width: '100%', height: '75vh', border: 'none' }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
