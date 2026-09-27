import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppRouter } from "../app/AppRouter";
import { navigate } from "../app/navigation";

const session = {
  accessToken: "access",
  refreshToken: "refresh",
  tokenType: "Bearer",
  expiresIn: 900,
  user: { userId: "u1", email: "patient@example.com", role: "PATIENT" },
  remember: true,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/khong-ton-tai");
  vi.stubGlobal("scrollTo", vi.fn());
});

describe("NotFoundPage", () => {
  it("renders an unknown public route without redirecting to login", async () => {
    render(<AppRouter />);

    expect(
      await screen.findByRole("heading", { name: "Trang này không tồn tại" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/khong-ton-tai");
    expect(
      screen.getByRole("link", { name: "An Tâm Medical — về trang chính" }),
    ).toHaveAttribute("href", "/dang-nhap");
    expect(document.title).toBe("Không tìm thấy trang — An Tâm Medical");
  });

  it("sends an authenticated patient to the overview from the brand", async () => {
    window.localStorage.setItem("an-tam-auth-session", JSON.stringify(session));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ user: session.user }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(<AppRouter />);

    const brand = await screen.findByRole("link", {
      name: "An Tâm Medical — về trang chính",
    });
    expect(brand).toHaveAttribute("href", "/tong-quan");
  });

  it("returns to the previous in-app route", async () => {
    window.history.replaceState({}, "", "/dang-nhap");
    navigate("/khong-ton-tai");
    render(<AppRouter />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Quay lại trang trước" }),
    );

    await waitFor(() => expect(window.location.pathname).toBe("/dang-nhap"));
    expect(
      await screen.findByRole("heading", { name: "Chào mừng trở lại" }),
    ).toBeInTheDocument();
  });
});
