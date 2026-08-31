import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

export type Role = "customer" | "staff" | "admin";

export type Session = {
  role: Role;
  id: string; // customerId | staffId | adminId
  storeId: string;
  name: string;
};

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "catch-girl-dev-secret");

export const COOKIE: Record<Role, string> = {
  customer: "cg_customer",
  staff: "cg_staff",
  admin: "cg_admin",
};

export async function signSession(s: Session) {
  return new SignJWT(s as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function setSession(s: Session) {
  const token = await signSession(s);
  const jar = await cookies();
  jar.set(COOKIE[s.role], token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(role: Role) {
  const jar = await cookies();
  jar.delete(COOKIE[role]);
}

export async function getSession(role: Role, storeId?: string): Promise<Session | null> {
  const jar = await cookies();
  const s = await verifySession(jar.get(COOKIE[role])?.value);
  if (!s || s.role !== role) return null;
  if (storeId && s.storeId !== storeId) return null;
  return s;
}

/** 현재 로그인한 고객 (세션 + DB 존재 확인) */
export async function getCustomer(storeId: string) {
  const s = await getSession("customer", storeId);
  if (!s) return null;
  const c = await prisma.customer.findUnique({ where: { id: s.id } });
  if (!c || c.storeId !== storeId) return null;
  return c;
}

export async function getStaffUser(storeId: string) {
  const s = await getSession("staff", storeId);
  if (!s) return null;
  const st = await prisma.staff.findUnique({ where: { id: s.id } });
  if (!st || st.storeId !== storeId || !st.isActive) return null;
  return st;
}

export async function getAdmin(storeId: string) {
  const s = await getSession("admin", storeId);
  if (!s) return null;
  const a = await prisma.adminUser.findUnique({ where: { id: s.id } });
  if (!a || a.storeId !== storeId) return null;
  return a;
}

export async function requireAdmin(storeId: string) {
  const a = await getAdmin(storeId);
  if (!a) throw new Error("UNAUTHORIZED");
  return a;
}
export async function requireStaff(storeId: string) {
  const s = await getStaffUser(storeId);
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}
export async function requireCustomer(storeId: string) {
  const c = await getCustomer(storeId);
  if (!c) throw new Error("UNAUTHORIZED");
  return c;
}
