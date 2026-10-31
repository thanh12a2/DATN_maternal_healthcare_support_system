/**
 * Cấu trúc cột `medical_services.content` (jsonb), schema_version = 1.
 * Mọi section đều optional: UI chỉ render section nào có dữ liệu.
 */
export interface ServiceContent {
  schema_version: 1;
  review: { status: 'DRAFT' | 'REVIEWED' | 'PUBLISHED'; needs_medical_review: boolean };

  intro: string;                       // giới thiệu chi tiết (khác description marketing)
  notice?: ServiceNotice;              // banner đầu trang (ngừng/tạm ngưng/sắp ra mắt)
  key_facts?: KeyFact[];               // thanh thông tin nhanh dưới hero
  highlights?: Highlight[];            // điểm nổi bật (card có icon)

  suitable_for?: string[];             // đối tượng nên thực hiện
  not_suitable_for?: string[];         // chống chỉ định / cần tư vấn trước
  parameters?: Parameter[];            // chỉ số / nội dung được đánh giá
  package?: PackageContent;            // chỉ dùng với kind = PACKAGE

  process_steps?: ProcessStep[];       // quy trình
  preparation?: string[];              // chuẩn bị trước
  aftercare?: string[];                // lưu ý sau thực hiện
  warning_signs?: string[];            // dấu hiệu cần đi khám/cấp cứu ngay

  technology?: { title: string; desc: string; items?: string[] };
  accuracy_note?: string;              // độ chính xem, giới hạn
  faqs?: Faq[];
  performed_by?: string;               // người thực hiện (hiển thị chung chung)
  references?: { title: string; org: string }[];
  disclaimer: string;
  seo?: { noindex?: boolean };
}

export type NoticeType = 'INFO' | 'WARNING' | 'COMING_SOON' | 'TEMP_SUSPENDED' | 'DISCONTINUED';
export interface ServiceNotice { type: NoticeType; title: string; body: string }

export interface KeyFact { icon: string; label: string; value: string }      // icon: tên lucide
export interface Highlight { icon: string; title: string; desc: string }
export interface Parameter { name: string; desc: string; reference?: string }
export interface ProcessStep { title: string; desc: string; duration_minutes: number | null }
export interface Faq { q: string; a: string }

export interface PackageContent {
  included_groups: { group: string; items: { name: string; qty?: string; note?: string }[] }[];
  excluded: string[];
  conditions: string[];
  needs_confirmation?: boolean;        // true = danh mục chưa được bộ phận dịch vụ xác nhận
}

