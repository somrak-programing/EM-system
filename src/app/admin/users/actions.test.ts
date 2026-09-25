import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    role: { findUnique: vi.fn() },
    user: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`) as Error & { url: string };
    error.url = url;
    throw error;
  }),
  requireAdmin: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

const { createUserAction, updateUserAction } = await import("./actions");

function createForm() {
  const formData = new FormData();
  formData.set("username", "new.user");
  formData.set("password", "secret123");
  formData.set("displayName", "ผู้ใช้ใหม่");
  formData.set("roleCode", "REQUESTER");
  formData.set("active", "on");
  return formData;
}

describe("createUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      session: { id: "admin-1", role: "ADMIN" },
    });
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    mocks.prisma.role.findUnique.mockResolvedValue({ id: "role-requester" });
    mocks.prisma.user.create.mockResolvedValue({ id: "user-9" });
  });

  it("creates a hashed user and redirects to the edit page", async () => {
    await expect(createUserAction(createForm())).rejects.toMatchObject({
      url: "/admin/users/user-9",
    });
    expect(mocks.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          username: "new.user",
          displayName: "ผู้ใช้ใหม่",
          roleId: "role-requester",
          active: true,
        }),
      }),
    );
    const hash = mocks.prisma.user.create.mock.calls[0][0].data.passwordHash as string;
    expect(hash).not.toBe("secret123");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("rejects a duplicate username", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "existing" });
    await expect(createUserAction(createForm())).rejects.toMatchObject({
      url: "/admin/users/new?error=dup",
    });
    expect(mocks.prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("updateUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      session: { id: "admin-1", role: "ADMIN" },
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: "admin-1",
      active: true,
      role: { code: "ADMIN" },
    });
    mocks.prisma.user.count.mockResolvedValue(1);
    mocks.prisma.user.findFirst.mockResolvedValue(null);
    mocks.prisma.role.findUnique.mockResolvedValue({ id: "role-admin" });
  });

  it("blocks an admin from deactivating themselves", async () => {
    const formData = new FormData();
    formData.set("userId", "admin-1");
    formData.set("username", "admin");
    formData.set("displayName", "ผู้ดูแลระบบ");
    formData.set("roleCode", "ADMIN");

    await expect(updateUserAction(formData)).rejects.toMatchObject({
      url: "/admin/users/admin-1?error=self",
    });
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it("blocks demoting the last remaining admin", async () => {
    mocks.requireAdmin.mockResolvedValue({
      session: { id: "other-admin", role: "ADMIN" },
    });
    const formData = new FormData();
    formData.set("userId", "admin-1");
    formData.set("username", "admin");
    formData.set("displayName", "ผู้ดูแลระบบ");
    formData.set("roleCode", "REQUESTER");
    formData.set("active", "on");

    await expect(updateUserAction(formData)).rejects.toMatchObject({
      url: "/admin/users/admin-1?error=last_admin",
    });
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
});
