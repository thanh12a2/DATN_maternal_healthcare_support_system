import type { EmergencyContact, Patient } from '@prisma/patient-client';
import { NationalIdCryptoService } from '../security/national-id-crypto.service';
type PatientWithContacts = Patient & { emergencyContacts: EmergencyContact[] };

export const presentContact = (contact: EmergencyContact) => ({
  id: contact.id,
  fullName: contact.fullName,
  relationship: contact.relationship,
  phoneNumber: contact.phoneNumber,
  isPrimary: contact.isPrimary,
});

export const presentPatient = (
  patient: PatientWithContacts,
  crypto: NationalIdCryptoService,
) => ({
  id: patient.id,
  fullName: patient.fullName,
  dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
  phoneNumber: patient.phoneNumber,
  nationalIdMasked: crypto.maskCiphertext(patient.nationalIdCiphertext),
  address: patient.address,
  profileStatus: 'COMPLETE' as const,
  version: patient.version,
  emergencyContacts: patient.emergencyContacts.map(presentContact),
});

export const presentSearchPatient = (
  patient: Pick<Patient, 'id' | 'fullName' | 'dateOfBirth' | 'phoneNumber' | 'nationalIdCiphertext'>,
  crypto: NationalIdCryptoService,
) => ({
  id: patient.id,
  fullName: patient.fullName,
  dateOfBirth: patient.dateOfBirth.toISOString().slice(0, 10),
  phoneNumberMasked: '*'.repeat(Math.max(0, patient.phoneNumber.length - 4)) + patient.phoneNumber.slice(-4),
  nationalIdMasked: crypto.maskCiphertext(patient.nationalIdCiphertext),
});
