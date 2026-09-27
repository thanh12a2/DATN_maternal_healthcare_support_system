import { describe, expect, it } from "vitest";
import {
  emptyEmergencyContact,
  emptyPatientProfile,
  profileProgress,
  validateEmergencyContact,
  validatePatientProfile,
} from "./patientProfile";

describe("patient profile validation", () => {
  it("calculates completion without requiring an emergency contact", () => {
    const complete = {
      ...emptyPatientProfile,
      fullName: "Nguyễn Thị A",
      birthDate: "1995-06-15",
      phoneNumber: "0901234567",
      nationalId: "012345678901",
      address: "Hà Nội, Việt Nam",
    };
    expect(profileProgress(emptyPatientProfile)).toBe(0);
    expect(profileProgress(complete)).toBe(100);
    expect(validatePatientProfile(complete)).toEqual({});
  });

  it("validates emergency contact independently", () => {
    expect(validateEmergencyContact(emptyEmergencyContact)).toMatchObject({
      fullName: expect.any(String),
      phoneNumber: expect.any(String),
    });
    expect(
      validateEmergencyContact({
        fullName: "Nguyễn Văn B",
        relationship: "Chồng",
        phoneNumber: "0912345678",
      }),
    ).toEqual({});
  });
});
