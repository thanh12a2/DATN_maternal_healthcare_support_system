import { recordClientAuditLog } from './adminAuditHealth';
import type { Requester } from './catalog';

// Cache ánh xạ userId -> email người dùng để Audit Log luôn hiển thị email chuẩn xác
export const userEmailLookupCache: Map<string, string> = new Map();

// Cache ánh xạ doctorId -> email/tên bác sĩ
export const doctorLookupCache: Map<string, string> = new Map();

// Cache ánh xạ specialtyId -> name chuyên khoa
export const specialtyLookupCache: Map<string, string> = new Map();

export function registerSpecialtyToCache(id: string, name: string) {
  if (id && name) {
    specialtyLookupCache.set(id, name);
  }
}

export function registerSpecialtyBatchToCache(specialties: Array<{ id: string; name: string }>) {
  if (Array.isArray(specialties)) {
    for (const s of specialties) {
      if (s.id && s.name) {
        specialtyLookupCache.set(s.id, s.name);
      }
    }
  }
}

// Cache lưu trữ context tạm thời (SĐT, Chuyên khoa, ...) khi bác sĩ được tạo hoặc cập nhật
export const doctorContextCache: Map<string, { phoneNumber?: string; specialtyName?: string }> = new Map();

export function setDoctorContext(doctorId: string, context: { phoneNumber?: string; specialtyName?: string }) {
  if (doctorId) {
    const existing = doctorContextCache.get(doctorId) || {};
    doctorContextCache.set(doctorId, { ...existing, ...context });
  }
}

export function registerUserEmailToCache(userId: string, email: string) {
  if (userId && email) {
    userEmailLookupCache.set(userId, email);
  }
}

export function registerDoctorToCache(doctorId: string, identifier: string) {
  if (doctorId && identifier) {
    doctorLookupCache.set(doctorId, identifier);
  }
}

export function registerUserBatchToCache(users: Array<{ id: string; email: string }>) {
  if (Array.isArray(users)) {
    for (const u of users) {
      if (u.id && u.email) {
        userEmailLookupCache.set(u.id, u.email);
      }
    }
  }
}

export function registerDoctorBatchToCache(doctors: Array<{ id: string; email?: string | null; profile?: { fullName?: string } }>) {
  if (Array.isArray(doctors)) {
    for (const d of doctors) {
      const ident = d.email || d.profile?.fullName || '';
      if (d.id && ident) {
        doctorLookupCache.set(d.id, ident);
      }
    }
  }
}

export interface DerivedAuditDetails {
  shouldLog: boolean;
  action: string;
  sourceService: string;
  aggregateType: string;
  aggregateId: string;
  changedFields: string[];
  metadata: Record<string, any>;
}

/**
 * Tự động phân tích HTTP Method, URL Path và Body để sinh Audit Log chuẩn y tế 100%
 */
export function deriveAuditDetails(
  method: string,
  path: string,
  bodyData: any,
  responseResult: any,
): DerivedAuditDetails {
  const normPath = path.split('?')[0];
  const upperMethod = method.toUpperCase();

  // Bỏ qua các request chỉ đọc dữ liệu hoặc query audit-log để tránh vòng lặp
  if (['GET', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
    return { shouldLog: false } as any;
  }
  if (normPath.includes('/api/audit-logs')) {
    return { shouldLog: false } as any;
  }
  // Bỏ qua các request có gắn cờ chủ động suppressAudit (dùng cho các lệnh gọi đồng bộ phụ)
  if (path.includes('suppressAudit=true')) {
    return { shouldLog: false } as any;
  }
  // Bỏ qua các endpoint auth thông thường như login/logout/refresh
  if (normPath.startsWith('/auth/') && !normPath.includes('/auth/admin/')) {
    return { shouldLog: false } as any;
  }

  let sourceService = 'system';
  let aggregateType = 'ENTITY';
  let aggregateId = 'general';
  let action = `${upperMethod}_${normPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const changedFields: string[] = Object.keys(bodyData || {});
  const metadata: Record<string, any> = { ...bodyData };

  // 1. Quản lý người dùng (auth-service)
  if (normPath.includes('/auth/admin/users')) {
    sourceService = 'auth-service';
    aggregateType = 'USER_ACCOUNT';
    const idMatch = normPath.match(/\/users\/([a-zA-Z0-9-]+)/);
    if (idMatch) aggregateId = idMatch[1];
    else if (responseResult?.id) aggregateId = responseResult.id;

    // Cập nhật cache nếu responseResult có chứa id và email
    if (responseResult?.id && responseResult?.email) {
      userEmailLookupCache.set(responseResult.id, responseResult.email);
    }
    if (bodyData?.email && aggregateId && aggregateId !== 'general') {
      userEmailLookupCache.set(aggregateId, bodyData.email);
    }

    const targetUserIdentifier =
      bodyData?.email ||
      responseResult?.email ||
      userEmailLookupCache.get(aggregateId) ||
      aggregateId;

    if (upperMethod === 'POST') {
      action = 'USER_ACCOUNT_CREATED';
      metadata.description = `Tạo tài khoản mới: ${targetUserIdentifier}`;
    } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
      if (bodyData?.status === 'ACTIVE') {
        action = 'USER_ACCOUNT_ACTIVATED';
        metadata.description = `Kích hoạt tài khoản: ${targetUserIdentifier}`;
      } else if (bodyData?.status === 'LOCKED' || bodyData?.status === 'DISABLED') {
        action = 'USER_ACCOUNT_LOCKED';
        metadata.description = `Khóa tài khoản: ${targetUserIdentifier}`;
      } else {
        action = 'USER_ACCOUNT_UPDATED';
        metadata.description = `Cập nhật thông tin tài khoản: ${targetUserIdentifier}`;
      }
    } else if (upperMethod === 'DELETE') {
      action = 'USER_ACCOUNT_DELETED';
      metadata.description = `Xóa tài khoản người dùng: ${targetUserIdentifier}`;
    }
  }

    // 2. Quản lý Bác sĩ & Chuyên môn & Hạng bác sĩ (doctor-service)
  else if (normPath.includes('/api/doctors')) {
    sourceService = 'doctor-service';

    // Bỏ qua các endpoint phụ như liên kết/hủy chuyên khoa của bác sĩ: /api/doctors/{doctorId}/specialties/{specialtyId}
    // (Lưu ý: Không bỏ qua endpoint quản lý danh mục chuyên khoa: /api/doctors/specialties hoặc /api/doctors/specialties/{id})
    if (/\/api\/doctors\/[a-zA-Z0-9-]+\/specialties(\/|$)/.test(normPath) && !normPath.startsWith('/api/doctors/specialties')) {
      return { shouldLog: false } as any;
    }

    const idMatch = normPath.match(/\/doctors\/([a-zA-Z0-9-]+)/);
    if (idMatch && idMatch[1] !== 'specialties' && idMatch[1] !== 'consultation-ranks') {
      aggregateId = idMatch[1];
    } else if (responseResult?.id) {
      aggregateId = responseResult.id;
    }

    if (normPath.includes('/consultation-ranks')) {
      aggregateType = 'DOCTOR_RANK';
      const rankCodeMatch = normPath.match(/\/consultation-ranks\/([a-zA-Z0-9_-]+)/);
      if (rankCodeMatch) aggregateId = rankCodeMatch[1];
      else if (bodyData?.code) aggregateId = bodyData.code;

      if (upperMethod === 'POST') {
        action = 'DOCTOR_RANK_CREATED';
        metadata.description = `Thêm mới hạng bác sĩ: ${bodyData?.name || bodyData?.code || aggregateId}`;
      } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
        action = 'DOCTOR_RANK_UPDATED';
        metadata.description = `Cập nhật hạng bác sĩ: ${bodyData?.name || aggregateId}`;
      } else if (upperMethod === 'DELETE') {
        action = 'DOCTOR_RANK_DELETED';
        metadata.description = `Xóa hạng bác sĩ: ${aggregateId}`;
      }
    } else if (normPath.startsWith('/api/doctors/specialties')) {
      aggregateType = 'SPECIALTY';
      const specMatch = normPath.match(/\/specialties\/([a-zA-Z0-9-]+)/);
      if (specMatch) aggregateId = specMatch[1];
      else if (responseResult?.id) aggregateId = responseResult.id;

      if (responseResult?.id && responseResult?.name) {
        specialtyLookupCache.set(responseResult.id, responseResult.name);
      }
      if (bodyData?.name && aggregateId && aggregateId !== 'general') {
        specialtyLookupCache.set(aggregateId, bodyData.name);
      }

      const targetSpecName =
        bodyData?.name ||
        responseResult?.name ||
        specialtyLookupCache.get(aggregateId) ||
        aggregateId;

      if (upperMethod === 'POST') {
        action = 'SPECIALTY_CREATED';
        metadata.description = `Thêm chuyên khoa mới: ${targetSpecName}`;
        metadata.specialtyName = targetSpecName;
      } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
        if (bodyData?.status === 'ACTIVE') {
          action = 'SPECIALTY_ACTIVATED';
          metadata.description = `Kích hoạt chuyên khoa: ${targetSpecName}`;
          metadata.specialtyName = targetSpecName;
        } else if (bodyData?.status === 'INACTIVE') {
          action = 'SPECIALTY_DEACTIVATED';
          metadata.description = `Tạm khóa chuyên khoa: ${targetSpecName}`;
          metadata.specialtyName = targetSpecName;
        } else {
          action = 'SPECIALTY_UPDATED';
          metadata.description = `Cập nhật chuyên khoa: ${targetSpecName}`;
          metadata.specialtyName = targetSpecName;
        }
      } else if (upperMethod === 'DELETE') {
        action = 'SPECIALTY_DELETED';
        metadata.description = `Xóa chuyên khoa: ${targetSpecName}`;
        metadata.specialtyName = targetSpecName;
      }
    } else {
      aggregateType = 'DOCTOR';

      // Cập nhật cache định danh bác sĩ nếu có responseResult hoặc bodyData
      if (responseResult?.id) {
        const ident = responseResult.email || bodyData?.email || responseResult.profile?.fullName || '';
        if (ident) doctorLookupCache.set(responseResult.id, ident);
        if (responseResult.accountId && responseResult.email) {
          userEmailLookupCache.set(responseResult.accountId, responseResult.email);
        }
      }
      if (bodyData?.email && aggregateId && aggregateId !== 'general') {
        doctorLookupCache.set(aggregateId, bodyData.email);
      }

      const targetDoctorIdentifier =
        bodyData?.email ||
        responseResult?.email ||
        doctorLookupCache.get(aggregateId) ||
        userEmailLookupCache.get(aggregateId) ||
        aggregateId;

      const extraDocContext = aggregateId ? doctorContextCache.get(aggregateId) : undefined;
      if (extraDocContext?.phoneNumber) {
        metadata.phoneNumber = extraDocContext.phoneNumber;
      }
      if (extraDocContext?.specialtyName) {
        metadata.specialty = extraDocContext.specialtyName;
      }

      if (normPath.endsWith('/activate')) {
        action = 'DOCTOR_ACTIVATED';
        metadata.description = `Kích hoạt bác sĩ: ${targetDoctorIdentifier}`;
        metadata.targetEmail = targetDoctorIdentifier;
      } else if (normPath.endsWith('/deactivate')) {
        action = 'DOCTOR_DEACTIVATED';
        const reasonSuffix = bodyData?.reason ? ` - Lý do: ${bodyData.reason}` : '';
        metadata.description = `Tạm khóa bác sĩ: ${targetDoctorIdentifier}${reasonSuffix}`;
        metadata.targetEmail = targetDoctorIdentifier;
      } else if (upperMethod === 'POST') {
        action = 'DOCTOR_PROFILE_CREATED';
        metadata.description = `Thêm mới bác sĩ: ${targetDoctorIdentifier}`;
        metadata.targetEmail = targetDoctorIdentifier;
      } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
        action = 'DOCTOR_PROFILE_UPDATED';
        metadata.description = `Cập nhật thông tin bác sĩ: ${targetDoctorIdentifier}`;
        metadata.targetEmail = targetDoctorIdentifier;
      } else if (upperMethod === 'DELETE') {
        action = 'DOCTOR_DELETED';
        metadata.description = `Xóa hồ sơ bác sĩ: ${targetDoctorIdentifier}`;
        metadata.targetEmail = targetDoctorIdentifier;
      }
    }
  }

  // 3. Quản lý Bệnh nhân (patient-service)
  else if (normPath.includes('/api/patients')) {
    // Bỏ qua search vì /api/patients/search là request đọc dữ liệu
    if (normPath.endsWith('/search')) {
      return { shouldLog: false } as any;
    }

    sourceService = 'patient-service';
    aggregateType = 'PATIENT';
    const idMatch = normPath.match(/\/patients\/([a-zA-Z0-9-]+)/);
    if (idMatch && idMatch[1] !== 'search') aggregateId = idMatch[1];
    else if (responseResult?.id) aggregateId = responseResult.id;

    if (normPath.includes('/emergency-contacts')) {
      aggregateType = 'EMERGENCY_CONTACT';
      if (upperMethod === 'POST') {
        action = 'EMERGENCY_CONTACT_ADDED';
        metadata.description = `Thêm người liên hệ khẩn cấp: ${bodyData?.fullName || ''} (${bodyData?.relationship || ''})`;
      } else if (upperMethod === 'PUT' || upperMethod === 'PATCH') {
        action = 'EMERGENCY_CONTACT_UPDATED';
        metadata.description = `Cập nhật thông tin liên hệ khẩn cấp cho bệnh nhân: ${aggregateId}`;
      } else if (upperMethod === 'DELETE') {
        action = 'EMERGENCY_CONTACT_DELETED';
        metadata.description = `Xóa người liên hệ khẩn cấp của bệnh nhân: ${aggregateId}`;
      }
    } else {
      if (upperMethod === 'POST') {
        action = 'PATIENT_RECORD_CREATED';
        metadata.description = `Thêm hồ sơ bệnh nhân mới: ${bodyData?.fullName || ''}`;
      } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
        action = 'PATIENT_RECORD_UPDATED';
        metadata.description = `Cập nhật hồ sơ bệnh nhân: ${bodyData?.fullName || aggregateId}`;
      } else if (upperMethod === 'DELETE') {
        action = 'PATIENT_RECORD_DELETED';
        metadata.description = `Xóa hồ sơ bệnh nhân: ${aggregateId}`;
      }
    }
  }

  // 4. Dịch vụ y tế & Biểu phí viện phí & Nhóm dịch vụ & Thẻ Tag (service-catalog-service)
  else if (normPath.includes('/api/catalog')) {
    sourceService = 'service-catalog-service';

    if (
      normPath.includes('/prices') ||
      normPath.includes('/schedule-base-price') ||
      normPath.includes('/schedule-price')
    ) {
      aggregateType = 'SERVICE_PRICING';
      const svcMatch = normPath.match(/\/services\/([a-zA-Z0-9-]+)/);
      if (svcMatch) aggregateId = svcMatch[1];

      action = 'SERVICE_PRICE_UPDATED';
      metadata.description = `Thiết lập biểu phí viện phí: ${
        bodyData?.amountMinor
          ? Number(bodyData.amountMinor).toLocaleString('vi-VN') + ' VND'
          : ''
      }`;
    } else if (
      normPath.includes('/doctor-rank-surcharges') ||
      normPath.includes('/rank-surcharges')
    ) {
      aggregateType = 'DOCTOR_RANK_SURCHARGE';
      if (bodyData?.rankCode) aggregateId = bodyData.rankCode;

      action = 'RANK_SURCHARGE_SCHEDULED';
      metadata.description = `Lên lịch phụ thu hạng ${
        bodyData?.rankCode || ''
      }: ${
        bodyData?.amountMinor
          ? Number(bodyData.amountMinor).toLocaleString('vi-VN') + ' VND'
          : ''
      }`;
    } else if (normPath.includes('/categories')) {
      aggregateType = 'SERVICE_CATEGORY';
      const catMatch = normPath.match(/\/categories\/([a-zA-Z0-9-]+)/);
      if (catMatch) aggregateId = catMatch[1];
      else if (responseResult?.id) aggregateId = responseResult.id;

      if (upperMethod === 'POST') {
        if (normPath.endsWith('/activate')) {
          action = 'CATEGORY_ACTIVATED';
          metadata.description = `Kích hoạt nhóm dịch vụ: ${aggregateId}`;
        } else if (normPath.endsWith('/deactivate')) {
          action = 'CATEGORY_DEACTIVATED';
          metadata.description = `Tạm ngừng nhóm dịch vụ: ${aggregateId}`;
        } else {
          action = 'CATEGORY_CREATED';
          metadata.description = `Tạo nhóm dịch vụ: ${bodyData?.name || ''}`;
        }
      } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
        action = 'CATEGORY_UPDATED';
        metadata.description = `Cập nhật nhóm dịch vụ: ${bodyData?.name || aggregateId}`;
      } else if (upperMethod === 'DELETE') {
        action = 'CATEGORY_DELETED';
        metadata.description = `Xóa nhóm dịch vụ: ${aggregateId}`;
      }
    } else if (normPath.includes('/tags')) {
      aggregateType = 'SERVICE_TAG';
      const tagMatch = normPath.match(/\/tags\/([a-zA-Z0-9-]+)/);
      if (tagMatch) aggregateId = tagMatch[1];
      else if (responseResult?.id) aggregateId = responseResult.id;

      if (upperMethod === 'POST') {
        if (normPath.endsWith('/activate')) {
          action = 'TAG_ACTIVATED';
          metadata.description = `Kích hoạt thẻ tag: ${aggregateId}`;
        } else if (normPath.endsWith('/deactivate')) {
          action = 'TAG_DEACTIVATED';
          metadata.description = `Tạm ngừng thẻ tag: ${aggregateId}`;
        } else {
          action = 'TAG_CREATED';
          metadata.description = `Tạo thẻ tag: ${bodyData?.label || bodyData?.name || ''}`;
        }
      } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
        action = 'TAG_UPDATED';
        metadata.description = `Cập nhật thẻ tag: ${bodyData?.label || aggregateId}`;
      } else if (upperMethod === 'DELETE') {
        action = 'TAG_DELETED';
        metadata.description = `Xóa thẻ tag: ${aggregateId}`;
      }
    } else {
      aggregateType = 'MEDICAL_SERVICE';
      const svcMatch = normPath.match(/\/services\/([a-zA-Z0-9-]+)/);
      if (svcMatch) aggregateId = svcMatch[1];
      else if (responseResult?.id) aggregateId = responseResult.id;

      if (upperMethod === 'POST') {
        if (normPath.endsWith('/activate')) {
          action = 'SERVICE_ACTIVATED';
          metadata.description = `Kích hoạt dịch vụ khám: ${aggregateId}`;
        } else if (normPath.endsWith('/deactivate')) {
          action = 'SERVICE_DEACTIVATED';
          metadata.description = `Tạm dừng dịch vụ khám: ${aggregateId}`;
        } else {
          action = 'SERVICE_CREATED';
          metadata.description = `Thêm dịch vụ khám mới: ${bodyData?.name || ''}`;
        }
      } else if (upperMethod === 'PATCH' || upperMethod === 'PUT') {
        action = 'SERVICE_UPDATED';
        metadata.description = `Cập nhật dịch vụ khám: ${bodyData?.name || aggregateId}`;
      } else if (upperMethod === 'DELETE') {
        action = 'SERVICE_DELETED';
        metadata.description = `Xóa dịch vụ khám: ${aggregateId}`;
      }
    }
  }

  return {
    shouldLog: true,
    action,
    sourceService,
    aggregateType,
    aggregateId,
    changedFields,
    metadata,
  };
}

/**
 * Ghi log kiểm toán tự động cho bất kỳ mutating request nào
 */
export function autoRecordAudit(
  requester: Requester,
  method: string,
  path: string,
  bodyData: any,
  resultData: any,
  errorThrown: any,
  user: { userId?: string; email?: string; role?: string } | null,
) {
  try {
    const derived = deriveAuditDetails(method, path, bodyData, errorThrown ? null : resultData);
    if (!derived.shouldLog) return;

    void recordClientAuditLog(requester, {
      action: derived.action,
      sourceService: derived.sourceService,
      aggregateType: derived.aggregateType,
      aggregateId: derived.aggregateId,
      actorId: user?.userId,
      actorType: user?.role || 'ADMIN',
      result: errorThrown ? 'FAILED' : 'SUCCESS',
      changedFields: derived.changedFields,
      metadata: {
        actorEmail: user?.email,
        ...derived.metadata,
        ...(errorThrown ? { errorMessage: errorThrown?.message || String(errorThrown) } : {}),
      },
    });
  } catch {
    // Non-blocking
  }
}
