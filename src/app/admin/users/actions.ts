"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  optionalText,
  parsePassword,
  parseRole,
  parseUsername,
  sectionRequiredForRole,
  wouldLeaveNoAdmin,
} from "@/lib/user-admin";

function back(path: string, error?: string): never {
  redirect(error ? `${path}?error=${error}` : path);
}

async function adminCount() {
  return prisma.user.count({
    where: { active: true, role: { code: "ADMIN" } },
  });
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const username = parseUsername(String(formData.get("username") ?? ""));
  if (!username.ok) back("/admin/users/new", username.error);
  const password = parsePassword(String(formData.get("password") ?? ""), true);
  if (!password.ok || !password.value) back("/admin/users/new", password.ok ? "password" : password.error);
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) back("/admin/users/new", "name");
  const roleCode = parseRole(String(formData.get("roleCode") ?? ""));
  if (!roleCode) back("/admin/users/new", "role");
  const sectionId = optionalText(String(formData.get("sectionId") ?? ""));
  if (sectionRequiredForRole(roleCode) && !sectionId) back("/admin/users/new", "section");

  const exists = await prisma.user.findUnique({ where: { username: username.value } });
  if (exists) back("/admin/users/new", "dup");
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) back("/admin/users/new", "role");

  const user = await prisma.user.create({
    data: {
      username: username.value,
      passwordHash: bcrypt.hashSync(password.value, 10),
      displayName,
      email: optionalText(String(formData.get("email") ?? "")),
      phone: optionalText(String(formData.get("phone") ?? "")),
      active: formData.get("active") === "on",
      roleId: role.id,
      sectionId,
    },
  });
  redirect(`/admin/users/${user.id}`);
}

export async function updateUserAction(formData: FormData) {
  const auth = await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  const path = `/admin/users/${id}`;
  const target = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!target) back("/admin/users", "missing");

  const username = parseUsername(String(formData.get("username") ?? ""));
  if (!username.ok) back(path, username.error);
  const password = parsePassword(String(formData.get("password") ?? ""), false);
  if (!password.ok) back(path, password.error);
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) back(path, "name");
  const roleCode = parseRole(String(formData.get("roleCode") ?? ""));
  if (!roleCode) back(path, "role");
  const sectionId = optionalText(String(formData.get("sectionId") ?? ""));
  if (sectionRequiredForRole(roleCode) && !sectionId) back(path, "section");
  const nextActive = formData.get("active") === "on";

  if (auth.session.id === id && target.active && !nextActive) {
    back(path, "self");
  }

  const admins = await adminCount();
  if (
    wouldLeaveNoAdmin({
      targetIsAdmin: target.active && target.role.code === "ADMIN",
      adminCount: admins,
      nextRole: roleCode,
      nextActive,
    })
  ) {
    back(path, "last_admin");
  }

  const clash = await prisma.user.findFirst({
    where: { username: username.value, NOT: { id } },
  });
  if (clash) back(path, "dup");
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) back(path, "role");

  await prisma.user.update({
    where: { id },
    data: {
      username: username.value,
      displayName,
      email: optionalText(String(formData.get("email") ?? "")),
      phone: optionalText(String(formData.get("phone") ?? "")),
      active: nextActive,
      roleId: role.id,
      sectionId,
      ...(password.value ? { passwordHash: bcrypt.hashSync(password.value, 10) } : {}),
    },
  });
  back(path);
}
