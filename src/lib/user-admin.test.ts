import { describe, expect, it } from "vitest";
import {
  parsePassword,
  parseUsername,
  sectionRequiredForRole,
  wouldLeaveNoAdmin,
} from "./user-admin";

describe("parseUsername", () => {
  it("normalizes to lowercase and accepts letters, numbers, dot, underscore, hyphen", () => {
    expect(parseUsername("  Admin.User_1-x  ")).toEqual({
      ok: true,
      value: "admin.user_1-x",
    });
  });

  it("rejects blank or invalid usernames", () => {
    expect(parseUsername("ab")).toEqual({ ok: false, error: "username" });
    expect(parseUsername("bad name")).toEqual({ ok: false, error: "username" });
  });
});

describe("parsePassword", () => {
  it("requires 8+ characters when creating", () => {
    expect(parsePassword("short", true)).toEqual({ ok: false, error: "password_short" });
    expect(parsePassword("admin123", true)).toEqual({ ok: true, value: "admin123" });
  });

  it("allows empty password when editing (keep current)", () => {
    expect(parsePassword("", false)).toEqual({ ok: true, value: null });
  });
});

describe("sectionRequiredForRole", () => {
  it("requires a section only for section managers", () => {
    expect(sectionRequiredForRole("SECTION_MANAGER")).toBe(true);
    expect(sectionRequiredForRole("ADMIN")).toBe(false);
    expect(sectionRequiredForRole("REQUESTER")).toBe(false);
  });
});

describe("wouldLeaveNoAdmin", () => {
  it("blocks deactivating or demoting the last admin", () => {
    expect(
      wouldLeaveNoAdmin({
        targetIsAdmin: true,
        adminCount: 1,
        nextRole: "ADMIN",
        nextActive: false,
      }),
    ).toBe(true);
    expect(
      wouldLeaveNoAdmin({
        targetIsAdmin: true,
        adminCount: 1,
        nextRole: "REQUESTER",
        nextActive: true,
      }),
    ).toBe(true);
  });

  it("allows changing a non-last admin", () => {
    expect(
      wouldLeaveNoAdmin({
        targetIsAdmin: true,
        adminCount: 2,
        nextRole: "REQUESTER",
        nextActive: true,
      }),
    ).toBe(false);
  });
});
