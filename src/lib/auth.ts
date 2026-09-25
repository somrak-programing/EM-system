import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { isOpsRole } from "./ops-access";
import type { RoleCode } from "@prisma/client";

const COOKIE = "tcpr_session";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: RoleCode;
  sectionId: string | null;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: String(payload.id),
      username: String(payload.username),
      displayName: String(payload.displayName),
      role: payload.role as RoleCode,
      sectionId: payload.sectionId ? String(payload.sectionId) : null,
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { role: true, section: true },
  });
  if (!user || !user.active) return null;
  return { session, user };
}

export async function requireAdmin() {
  const auth = await requireSession();
  if (!auth) redirect("/login");
  if (auth.session.role !== "ADMIN") redirect("/tickets");
  return auth;
}

export async function requireOpsSession() {
  const auth = await requireSession();
  if (!auth) redirect("/login");
  if (!isOpsRole(auth.session.role)) redirect("/tickets");
  if (auth.session.role === "SECTION_MANAGER" && auth.session.sectionId === null) {
    redirect("/tickets");
  }
  return auth;
}
