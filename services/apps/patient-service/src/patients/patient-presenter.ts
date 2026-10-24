import type { EmergencyContact, Patient } from '@prisma/patient-client';
import { NationalIdCryptoService } from '../security/national-id-crypto.service';
type PatientWithContacts = Patient & { emergencyContacts: EmergencyContact[] };

export const presentContact = (contact: EmergencyContact) => ({
  id: contact.id,
  fullName: contact.fullName,
  relationship: contact.relationship,
  phoneNumber: contact.phoneNumber,
  isPrimary: contact.isPrimary,
  priority: contact.priority,
});

export const presentPatient = (
  patient: PatientWithContacts,
  crypto: NationalIdCryptoService,
  email?: string | null,
  status?: string | null,
) => ({
  id: patient.id,
  fullName: patient.fullName,
  dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
  phoneNumber: patient.phoneNumber,
  nationalIdMasked: crypto.maskCiphertext(patient.nationalIdCiphertext),
  nationalId: crypto.decryptIfPresent(patient.nationalIdCiphertext),
  address: patient.address,
  profileStatus: 'COMPLETE' as const,
  status: status ?? (patient.authAccountId ? 'ACTIVE' : 'DRAFT'),
  version: patient.version,
  authAccountId: patient.authAccountId,
  email: email ?? null,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt,
  emergencyContacts: [...patient.emergencyContacts]
    .sort(
      (left, right) =>
        left.priority - right.priority ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    )
    .map(presentContact),
});

export const presentSearchPatient = (
  patient: Patient,
  crypto: NationalIdCryptoService,
  email?: string | null,
  status?: string | null,
) => ({
  id: patient.id,
  fullName: patient.fullName,
  dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
  phoneNumber: patient.phoneNumber,
  phoneNumberMasked:
    '*'.repeat(Math.max(0, patient.phoneNumber.length - 4)) +
    patient.phoneNumber.slice(-4),
  nationalIdMasked: crypto.maskCiphertext(patient.nationalIdCiphertext),
  nationalId: crypto.decryptIfPresent(patient.nationalIdCiphertext),
  address: patient.address,
  authAccountId: patient.authAccountId,
  status: status ?? (patient.authAccountId ? 'ACTIVE' : 'DRAFT'),
  version: patient.version,
  createdAt: patient.createdAt,
  updatedAt: patient.updatedAt,
  email: email ?? null,
});
