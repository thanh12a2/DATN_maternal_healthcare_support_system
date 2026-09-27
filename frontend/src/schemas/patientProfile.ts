export interface PatientProfileFormValues {
  fullName: string;
  birthDate: string;
  phoneNumber: string;
  nationalId: string;
  address: string;
}

export interface EmergencyContactFormValues {
  fullName: string;
  relationship: string;
  phoneNumber: string;
}

export type PatientProfileField = keyof PatientProfileFormValues;
export type EmergencyContactField = keyof EmergencyContactFormValues;
export type ValidationMap = Partial<Record<PatientProfileField, string>>;
export type EmergencyContactValidationMap = Partial<
  Record<EmergencyContactField, string>
>;

export const emptyPatientProfile: PatientProfileFormValues = {
  fullName: "",
  birthDate: "",
  phoneNumber: "",
  nationalId: "",
  address: "",
};
export const emptyEmergencyContact: EmergencyContactFormValues = {
  fullName: "",
  relationship: "Người thân",
  phoneNumber: "",
};

export function validPhone(value: string): boolean {
  const normalized = value.trim().replace(/[^0-9+]/g, "");
  return /^(?:\+84|0)[0-9]{9}$/.test(normalized);
}
export function validNationalId(value: string): boolean {
  return /^(?:[0-9]{9}|[0-9]{12})$/.test(value.replace(/[^0-9]/g, ""));
}
export function validBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00");
  return !Number.isNaN(date.getTime()) && date < new Date();
}
export function validatePatientProfile(
  values: PatientProfileFormValues,
  options?: { storedNationalId?: boolean },
): ValidationMap {
  const errors: ValidationMap = {};
  if (values.fullName.trim().length < 2)
    errors.fullName = "Vui lòng nhập đầy đủ họ và tên.";
  if (!validBirthDate(values.birthDate))
    errors.birthDate = "Vui lòng chọn ngày sinh hợp lệ.";
  if (!validPhone(values.phoneNumber))
    errors.phoneNumber = "Số điện thoại chưa đúng định dạng.";
  if (!values.nationalId && !options?.storedNationalId)
    errors.nationalId = "Vui lòng nhập số CCCD/CMND.";
  else if (values.nationalId && !validNationalId(values.nationalId))
    errors.nationalId = "CCCD/CMND phải gồm 9 hoặc 12 chữ số.";
  if (values.address.trim().length < 6)
    errors.address = "Vui lòng nhập địa chỉ đầy đủ hơn.";
  return errors;
}
export function validateEmergencyContact(
  values: EmergencyContactFormValues,
): EmergencyContactValidationMap {
  const errors: EmergencyContactValidationMap = {};
  if (values.fullName.trim().length < 2)
    errors.fullName = "Vui lòng nhập tên người liên hệ.";
  if (!values.relationship.trim())
    errors.relationship = "Vui lòng chọn mối quan hệ.";
  if (!validPhone(values.phoneNumber))
    errors.phoneNumber = "Số điện thoại liên hệ chưa đúng định dạng.";
  return errors;
}
export function profileProgress(
  values: PatientProfileFormValues,
  storedNationalId = false,
): number {
  const checks = [
    values.fullName.trim().length >= 2,
    validBirthDate(values.birthDate),
    validPhone(values.phoneNumber),
    storedNationalId || validNationalId(values.nationalId),
    values.address.trim().length >= 6,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
