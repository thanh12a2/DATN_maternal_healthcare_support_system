import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRouter } from "../app/AppRouter";
import { emptyPatientProfile } from "../schemas/patientProfile";

const session = {
  accessToken: "access",
  refreshToken: "refresh",
  tokenType: "Bearer" as const,
  expiresIn: 900,
  user: { userId: "u1", email: "patient@example.com", role: "PATIENT" },
  remember: true,
};
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const profile = (contacts: unknown[] = []) => ({
  id: "p1",
  fullName: "Nguyễn Thị A",
  dateOfBirth: "1995-06-15",
  phoneNumber: "+84901234567",
  nationalIdMasked: "********8901",
  address: "Hà Nội, Việt Nam",
  profileStatus: "COMPLETE",
  version: 1,
  emergencyContacts: contacts,
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/ho-so/hoan-thien");
  window.localStorage.setItem("an-tam-auth-session", JSON.stringify(session));
});

describe("PatientProfilePage API flow", () => {
  it("saves a patient profile without requiring or creating an emergency contact", async () => {
    const saved = profile([]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ user: session.user }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: "PATIENT_PROFILE_NOT_FOUND", message: "not found" },
          },
          404,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: saved }, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<AppRouter />);
    expect(
      await screen.findByRole("heading", {
        name: /hoàn thiện thông tin bệnh nhân/i,
      }),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Họ và tên"), "Nguyễn Thị A");
    fireEvent.change(screen.getByLabelText("Ngày sinh"), {
      target: { value: "1995-06-15" },
    });
    await user.type(screen.getByLabelText("Số điện thoại"), "0901234567");
    await user.type(screen.getByLabelText("Số CCCD / CMND"), "012345678901");
    await user.type(
      screen.getByLabelText("Địa chỉ hiện tại"),
      "Hà Nội, Việt Nam",
    );
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(
      await screen.findByText("Hồ sơ bệnh nhân đã được lưu thành công."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(
      "http://localhost:8080/api/patients/me",
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).not.toHaveProperty(
      "emergencyContacts",
    );
    expect(
      screen.getByText(
        "Chưa có người liên hệ khẩn cấp. Hồ sơ của bạn vẫn đã được lưu.",
      ),
    ).toBeInTheDocument();
  });

  it("adds an emergency contact after the profile already exists", async () => {
    const savedContact = {
      id: "c1",
      fullName: "Nguyễn Văn B",
      relationship: "Chồng",
      phoneNumber: "+84912345678",
      isPrimary: true,
      priority: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ user: session.user }))
      .mockResolvedValueOnce(jsonResponse({ data: profile([]) }))
      .mockResolvedValueOnce(jsonResponse({ data: savedContact }, 201));
    vi.stubGlobal("fetch", fetchMock);
    render(<AppRouter />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "+ Thêm người liên hệ" }),
    );
    await user.type(
      screen.getByLabelText("Họ và tên người liên hệ"),
      "Nguyễn Văn B",
    );
    await user.selectOptions(screen.getByLabelText("Mối quan hệ"), "Chồng");
    await user.type(
      screen.getByLabelText("Số điện thoại người liên hệ"),
      "0912345678",
    );
    await user.click(screen.getByRole("button", { name: "Lưu người liên hệ" }));
    expect(
      await screen.findByText("Đã thêm người liên hệ khẩn cấp."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe(
      "http://localhost:8080/api/patients/p1/emergency-contacts",
    );
    expect(screen.getByText("Ưu tiên đầu tiên")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting an emergency contact", async () => {
    const contact = {
      id: "c1",
      fullName: "Liên hệ Một",
      relationship: "Mẹ",
      phoneNumber: "0901234567",
      isPrimary: true,
      priority: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ user: session.user }))
      .mockResolvedValueOnce(jsonResponse({ data: profile([contact]) }));
    vi.stubGlobal("fetch", fetchMock);
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AppRouter />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Xóa" }));
    expect(confirmMock).toHaveBeenCalledWith(
      "Bạn có chắc muốn xóa người liên hệ “Liên hệ Một” không?",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Liên hệ Một")).toBeInTheDocument();
  });

  it("reorders all emergency contact IDs with priority buttons", async () => {
    const first = {
      id: "c1",
      fullName: "Liên hệ Một",
      relationship: "Mẹ",
      phoneNumber: "0901234567",
      isPrimary: true,
      priority: 1,
    };
    const second = {
      id: "c2",
      fullName: "Liên hệ Hai",
      relationship: "Chồng",
      phoneNumber: "0912345678",
      isPrimary: false,
      priority: 2,
    };
    const reordered = [
      { ...second, isPrimary: true, priority: 1 },
      { ...first, isPrimary: false, priority: 2 },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ user: session.user }))
      .mockResolvedValueOnce(jsonResponse({ data: profile([first, second]) }))
      .mockResolvedValueOnce(jsonResponse({ data: reordered }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AppRouter />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", {
        name: "Giảm ưu tiên Liên hệ Một",
      }),
    );
    expect(
      await screen.findByText("Đã cập nhật thứ tự ưu tiên."),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe(
      "http://localhost:8080/api/patients/p1/emergency-contacts/order",
    );
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      contactIds: ["c2", "c1"],
    });
    expect(
      screen.getByLabelText("Tiến độ hoàn thiện hồ sơ 100%").closest("aside"),
    ).toHaveClass("profile-progress-sticky");
  });
});

describe("Patient profile session draft", () => {
  it("restores a version 2 profile-only draft", async () => {
    const draft = {
      ...emptyPatientProfile,
      fullName: "Bản nháp Patient",
      address: "Hà Nội, Việt Nam",
    };
    window.sessionStorage.setItem(
      "an-tam-patient-profile-draft:u1",
      JSON.stringify({ version: 2, savedAt: Date.now(), values: draft }),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ user: session.user }))
        .mockResolvedValueOnce(
          jsonResponse(
            {
              error: {
                code: "PATIENT_PROFILE_NOT_FOUND",
                message: "not found",
              },
            },
            404,
          ),
        ),
    );
    render(<AppRouter />);
    expect(
      await screen.findByDisplayValue("Bản nháp Patient"),
    ).toBeInTheDocument();
  });
});
