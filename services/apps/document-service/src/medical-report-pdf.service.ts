import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');

export interface MedicalReportData {
  appointmentCode: string;
  encounterId: string;
  patientId: string;
  roomCode?: string;
  roomName?: string;
  examinationDate: string;
  examinationTime?: string;

  // Patient
  patientName: string;
  patientDob?: string;
  patientAge?: number | string;
  patientGender?: string;
  patientPhone?: string;
  patientNationalId?: string;
  patientAddress?: string;
  emergencyContact?: string;
  pregnancyWeek?: string;

  // Vitals
  vitals?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    weight?: string;
    height?: string;
    bmi?: string;
  };

  // Clinical
  chiefComplaint?: string;
  clinicalExamination?: string;
  primaryDiagnosis: string;
  doctorNotes?: string;

  // Paraclinical orders
  clinicalOrders?: Array<{
    name: string;
    category?: string;
    result?: string;
    status?: string;
  }>;

  // Prescriptions
  prescriptions?: Array<{
    name: string;
    strength?: string;
    quantity: number | string;
    unit?: string;
    dosage?: string;
    frequency?: string;
    instruction?: string;
  }>;

  // Care Advice & Treatment Plan
  careAdvice?: Array<{
    category?: string;
    title: string;
    description: string;
  }>;

  // Follow-up
  followUpDate?: string;
  followUpRelative?: string;

  // Doctor
  doctorName: string;
  finalizedAt?: string;
}

@Injectable()
export class MedicalReportPdfService {
  private isFontConfigured = false;

  private configureFonts() {
    if (this.isFontConfigured) return;

    let fontDir = '';
    try {
      const resolved = require.resolve('pdfmake/fonts/Roboto/Roboto-Regular.ttf');
      fontDir = path.dirname(resolved);
    } catch {
      if (fs.existsSync('/app/node_modules/pdfmake/fonts/Roboto')) {
        fontDir = '/app/node_modules/pdfmake/fonts/Roboto';
      } else {
        fontDir = path.join(process.cwd(), 'node_modules/pdfmake/fonts/Roboto');
      }
    }

    pdfmake.setFonts({
      Roboto: {
        normal: path.join(fontDir, 'Roboto-Regular.ttf'),
        bold: path.join(fontDir, 'Roboto-Medium.ttf'),
        italics: path.join(fontDir, 'Roboto-Italic.ttf'),
        bolditalics: path.join(fontDir, 'Roboto-MediumItalic.ttf'),
      },
    });

    this.isFontConfigured = true;
  }

  async generateReportPdf(data: MedicalReportData): Promise<Buffer> {
    this.configureFonts();

    // 1. Chuẩn bị bảng sinh hiệu
    const vitals = data.vitals || {};
    const vitalsTableBody = [
      [
        { text: 'Huyết áp', bold: true, alignment: 'center', fillColor: '#f8fafc' },
        { text: 'Mạch / Nhịp tim', bold: true, alignment: 'center', fillColor: '#f8fafc' },
        { text: 'Nhiệt độ', bold: true, alignment: 'center', fillColor: '#f8fafc' },
        { text: 'Chiều cao', bold: true, alignment: 'center', fillColor: '#f8fafc' },
        { text: 'Cân nặng', bold: true, alignment: 'center', fillColor: '#f8fafc' },
        { text: 'Chỉ số BMI', bold: true, alignment: 'center', fillColor: '#f8fafc' },
      ],
      [
        { text: vitals.bloodPressure || '—', alignment: 'center' },
        { text: vitals.heartRate || '—', alignment: 'center' },
        { text: vitals.temperature || '—', alignment: 'center' },
        { text: vitals.height ? (String(vitals.height).includes('cm') ? String(vitals.height) : `${vitals.height} cm`) : '—', alignment: 'center' },
        { text: vitals.weight ? (String(vitals.weight).includes('kg') ? String(vitals.weight) : `${vitals.weight} kg`) : '—', alignment: 'center' },
        { text: vitals.bmi || '—', alignment: 'center', bold: true, color: '#0B5CAD' },
      ],
    ];

    // 2. Chuẩn bị bảng chỉ định cận lâm sàng (nếu có)
    const hasOrders = Array.isArray(data.clinicalOrders) && data.clinicalOrders.length > 0;
    const ordersTableBody = hasOrders
      ? [
          [
            { text: 'STT', bold: true, alignment: 'center', width: 30, fillColor: '#f8fafc' },
            { text: 'Tên dịch vụ cận lâm sàng', bold: true, fillColor: '#f8fafc' },
            { text: 'Phân loại', bold: true, width: 100, fillColor: '#f8fafc' },
            { text: 'Trạng thái / Đánh giá sơ bộ', bold: true, width: 140, fillColor: '#f8fafc' },
          ],
          ...data.clinicalOrders!.map((ord, idx) => {
            const hasResult =
              ord.status === 'Đã có kết quả' ||
              ord.status === 'VERIFIED' ||
              ord.status === 'RESULT_AVAILABLE' ||
              (ord.result && !ord.result.includes('Chờ kết quả'));
            const resultText = hasResult
              ? (ord.result && !ord.result.includes('Chờ kết quả') ? ord.result : 'Đã có kết quả (Bình thường)')
              : (ord.result || ord.status || 'Đang thực hiện');
            return [
              { text: String(idx + 1).padStart(2, '0'), alignment: 'center' },
              { text: ord.name, bold: true },
              { text: ord.category || 'Cận lâm sàng', color: '#475569' },
              {
                text: resultText,
                color: hasResult ? '#0f766e' : '#64748b',
                bold: hasResult,
              },
            ];
          }),
        ]
      : [];

    // 3. Chuẩn bị bảng đơn thuốc (nếu có)
    const hasMeds = Array.isArray(data.prescriptions) && data.prescriptions.length > 0;
    const medsTableBody = hasMeds
      ? [
          [
            { text: 'STT', bold: true, alignment: 'center', width: 30, fillColor: '#f8fafc' },
            { text: 'Tên thuốc & Hàm lượng', bold: true, fillColor: '#f8fafc' },
            { text: 'Số lượng', bold: true, alignment: 'center', width: 70, fillColor: '#f8fafc' },
            { text: 'Liều dùng & Hướng dẫn sử dụng cho thai phụ', bold: true, fillColor: '#f8fafc' },
          ],
          ...data.prescriptions!.map((med, idx) => [
            { text: String(idx + 1).padStart(2, '0'), alignment: 'center' },
            {
              stack: [
                { text: med.name, bold: true, color: '#0f172a' },
                med.strength ? { text: med.strength, fontSize: 8.5, color: '#64748b' } : {},
              ],
            },
            {
              text: `${med.quantity} ${med.unit || 'viên'}`,
              alignment: 'center',
              bold: true,
            },
            {
              stack: [
                { text: `${med.dosage || '1 viên'} · ${med.frequency || '1 lần/ngày'}`, bold: true, color: '#0B5CAD' },
                { text: med.instruction || 'Uống theo chỉ định của bác sĩ.', fontSize: 8.5, color: '#334155' },
              ],
            },
          ]),
        ]
      : [];

    // 4. Chuẩn bị danh sách dặn dò chăm sóc thai kỳ
    const hasAdvice = Array.isArray(data.careAdvice) && data.careAdvice.length > 0;
    const adviceList = hasAdvice
      ? data.careAdvice!.map((adv) => ({
          margin: [0, 2, 0, 4],
          columns: [
            { text: '•', width: 14, bold: true, color: '#7c3aed' },
            {
              stack: [
                {
                  text: [
                    adv.category && adv.category !== 'Chăm sóc thai kỳ' && adv.category !== '[Chăm sóc thai kỳ]'
                      ? { text: `[${adv.category}] `, bold: true, color: '#0B5CAD' }
                      : {},
                    { text: adv.title, bold: true, color: '#0f172a' },
                  ],
                },
                { text: adv.description, fontSize: 9, color: '#475569', margin: [0, 1, 0, 0] },
              ],
            },
          ],
        }))
      : [];

    // Document Definition
    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [35, 30, 35, 40],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9.5,
        color: '#1e293b',
        lineHeight: 1.25,
      },
      content: [
        // ─── PHẦN HEADER BỆNH VIỆN ───
        {
          columns: [
            [
              { text: 'BỆNH VIỆN PHỤ SẢN TÂM AN', fontSize: 13, bold: true, color: '#0B5CAD' },
              { text: 'Hệ thống Y tế Chăm sóc Sức khỏe Mẹ & Bé Tiêu chuẩn Quốc tế', fontSize: 8.5, italics: true, color: '#64748b' },
              { text: 'Địa chỉ: 36 Hoàng Hoa Thám, Ba Đình, Hà Nội | Hotline: 1900 6868', fontSize: 8.5, color: '#475569' },
            ],
            [
              { text: `MÃ PHIẾU: ${data.appointmentCode}`, fontSize: 9.5, bold: true, alignment: 'right', color: '#0B5CAD' },
              { text: `Ngày khám: ${data.examinationDate}${data.examinationTime ? ` (${data.examinationTime})` : ''}`, fontSize: 9, alignment: 'right', color: '#475569' },
              { text: `Phòng tiếp nhận: ${data.roomCode || 'P.207'}${data.roomName ? ` — ${data.roomName}` : ''}`, fontSize: 9, alignment: 'right', color: '#475569' },
            ],
          ],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 5, x2: 525, y2: 5, lineWidth: 1.5, lineColor: '#0B5CAD' }],
          margin: [0, 4, 0, 10],
        },

        // ─── TIÊU ĐỀ PHIẾU KHÁM ───
        {
          text: 'PHIẾU KẾT QUẢ KHÁM BỆNH & TỔNG KẾT ĐIỀU TRỊ',
          fontSize: 14,
          bold: true,
          alignment: 'center',
          color: '#0f172a',
          margin: [0, 0, 0, 10],
        },

        // ─── I. THÔNG TIN HÀNH CHÍNH BỆNH NHÂN ───
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'I. THÔNG TIN HÀNH CHÍNH BỆNH NHÂN', bold: true, color: '#0B5CAD', fillColor: '#f1f5f9' }]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 5],
        },
        {
          columns: [
            [
              { text: [{ text: 'Họ và tên: ', bold: true }, data.patientName.toUpperCase()] },
              { text: [{ text: 'Số điện thoại: ', bold: true }, data.patientPhone || '—'] },
              { text: [{ text: 'Địa chỉ: ', bold: true }, data.patientAddress || '—'] },
              ...(data.pregnancyWeek ? [{ text: [{ text: 'Tuần thai kỳ: ', bold: true, color: '#0B5CAD' }, data.pregnancyWeek] }] : []),
            ],
            [
              {
                text: [
                  { text: 'Năm sinh: ', bold: true },
                  data.patientDob ? `${data.patientDob} (${data.patientAge || '—'} tuổi)` : `${data.patientAge || '—'} tuổi`,
                  { text: '  |  Giới tính: ', bold: true },
                  data.patientGender || 'Nữ',
                ],
              },
              { text: [{ text: 'CCCD / Định danh: ', bold: true }, data.patientNationalId || '—'] },
              { text: [{ text: 'Bác sĩ phụ trách: ', bold: true }, data.doctorName] },
            ],
          ],
          margin: [0, 0, 0, 8],
        },

        // ─── II. TIẾP NHẬN & DẤU HIỆU SINH TỒN ───
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'II. TIẾP NHẬN & DẤU HIỆU SINH TỒN (VITAL SIGNS)', bold: true, color: '#0B5CAD', fillColor: '#f1f5f9' }]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 5],
        },
        data.chiefComplaint
          ? {
              text: [{ text: 'Lý do khám / Triệu chứng ban đầu: ', bold: true }, data.chiefComplaint],
              margin: [0, 0, 0, 5],
            }
          : {},
        {
          table: {
            widths: ['*', '*', '*', '*', '*', '*'],
            body: vitalsTableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
          },
          margin: [0, 0, 0, 8],
        },

        // ─── III. CHẨN ĐOÁN & KẾT LUẬN ───
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'III. CHẨN ĐOÁN & KẾT LUẬN CỦA BÁC SĨ', bold: true, color: '#0B5CAD', fillColor: '#f1f5f9' }]],
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 5],
        },
        ...(data.clinicalExamination
          ? [
              {
                text: [{ text: 'Diễn biến khám lâm sàng: ', bold: true }, data.clinicalExamination],
                margin: [0, 0, 0, 4],
              },
            ]
          : []),
        {
          text: [{ text: 'Chẩn đoán xác định: ', bold: true }, { text: data.primaryDiagnosis || 'Khám thai định kỳ chuẩn y khoa', bold: true, color: '#0f172a' }],
          margin: [0, 0, 0, 6],
        },

        // ─── IV. KẾT QUẢ CHỈ ĐỊNH CẬN LÂM SÀNG ───
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'IV. CHỈ ĐỊNH CẬN LÂM SÀNG (SIÊU ÂM & XÉT NGHIỆM)', bold: true, color: '#0B5CAD', fillColor: '#f1f5f9' }]],
          },
          layout: 'noBorders',
          margin: [0, 2, 0, 5],
        },
        hasOrders
          ? {
              table: {
                widths: [30, '*', 110, 140],
                body: ordersTableBody,
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#cbd5e1',
                vLineColor: () => '#cbd5e1',
              },
              margin: [0, 0, 0, 8],
            }
          : {
              text: '— Không có chỉ định cận lâm sàng trong lượt khám này.',
              italics: true,
              color: '#64748b',
              margin: [0, 0, 0, 8],
            },

        // ─── V. ĐƠN THUỐC ĐIỀU TRỊ ───
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'V. ĐƠN THUỐC ĐIỀU TRỊ (PRESCRIPTION)', bold: true, color: '#0B5CAD', fillColor: '#f1f5f9' }]],
          },
          layout: 'noBorders',
          margin: [0, 2, 0, 5],
        },
        hasMeds
          ? {
              table: {
                widths: [30, '*', 80, 210],
                body: medsTableBody,
              },
              layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#cbd5e1',
                vLineColor: () => '#cbd5e1',
              },
              margin: [0, 0, 0, 8],
            }
          : {
              text: '— Không kê đơn thuốc trong lượt khám này.',
              italics: true,
              color: '#64748b',
              margin: [0, 0, 0, 8],
            },

        // ─── VI. KẾ HOẠCH THEO DÕI & DẶN DÒ THAI KỲ ───
        {
          table: {
            widths: ['*'],
            body: [[{ text: 'VI. KẾ HOẠCH THEO DÕI & DẶN DÒ CHĂM SÓC THAI KỲ', bold: true, color: '#0B5CAD', fillColor: '#f1f5f9' }]],
          },
          layout: 'noBorders',
          margin: [0, 2, 0, 5],
        },
        hasAdvice
          ? {
              stack: adviceList,
              margin: [0, 0, 0, 8],
            }
          : {
              text: '— Tuân thủ chế độ dinh dưỡng thai kỳ cân đối và sinh hoạt điều độ.',
              italics: true,
              color: '#64748b',
              margin: [0, 0, 0, 8],
            },

        // ─── VII. HẸN LỊCH TÁI KHÁM ───
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    {
                      text: [
                        { text: 'LỊCH HẸN TÁI KHÁM ĐỊNH KỲ: ', bold: true, color: '#0B5CAD' },
                        data.followUpDate
                          ? {
                              text: `${data.followUpDate}${data.followUpRelative ? ` (${data.followUpRelative})` : ''}`,
                              bold: true,
                              color: '#15803d',
                              fontSize: 10.5,
                            }
                          : { text: 'Theo lịch hẹn tiếp theo của bác sĩ hoặc khi có dấu hiệu bất thường', italics: true },
                      ],
                    },
                    {
                      text: 'Lưu ý: Bệnh nhân vui lòng mang theo Phiếu kết quả này và sổ theo dõi thai kỳ khi đến tái khám.',
                      fontSize: 8.5,
                      color: '#64748b',
                      margin: [0, 2, 0, 0],
                    },
                  ],
                  fillColor: '#f0fdf4',
                  borderColor: ['#86efac', '#86efac', '#86efac', '#86efac'],
                },
              ],
            ],
          },
          margin: [0, 2, 0, 16],
        },

        // ─── PHẦN CHỮ KÝ XÁC NHẬN ───
        {
          columns: [
            [
              { text: 'BỆNH NHÂN / ĐẠI DIỆN GIA ĐÌNH', bold: true, alignment: 'center' },
              { text: '(Ký và ghi rõ họ tên)', fontSize: 8.5, italics: true, alignment: 'center', color: '#64748b' },
              { text: '', margin: [0, 25, 0, 0] },
              { text: data.patientName.toUpperCase(), bold: true, alignment: 'center', fontSize: 10 },
            ],
            [
              { text: `Hà Nội, ngày ${data.examinationDate}`, italics: true, alignment: 'center', color: '#475569' },
              { text: 'BÁC SĨ KHÁM BỆNH', bold: true, alignment: 'center' },
              { text: '(Ký, đóng dấu và ghi rõ họ tên)', fontSize: 8.5, italics: true, alignment: 'center', color: '#64748b' },
              { text: '', margin: [0, 25, 0, 0] },
              { text: data.doctorName, bold: true, alignment: 'center', fontSize: 10, color: '#0B5CAD' },
            ],
          ],
        },
      ],

      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: 'Hệ thống Bệnh án Điện tử (EMR) — Bệnh viện Phụ sản Tâm An',
            fontSize: 8,
            color: '#94a3b8',
            margin: [35, 10, 0, 0],
          },
          {
            text: `Trang ${currentPage} / ${pageCount}`,
            fontSize: 8,
            color: '#94a3b8',
            alignment: 'right',
            margin: [0, 10, 35, 0],
          },
        ],
      }),
    };

    return await pdfmake.createPdf(docDefinition).getBuffer();
  }
}
