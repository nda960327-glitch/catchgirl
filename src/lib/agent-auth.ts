import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

/**
 * 담당직원(영업) 세션.
 *
 * 매장 세션(손님·직원·관리자)과 층이 다르다 — 어느 매장에도 속하지 않고,
 * 자기가 데려온 매장 목록과 커미션 정산만 본다. 그래서 쿠키를 따로 둔다.
 */
const COOKIE = "cg_agent";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "catch-girl-dev-secret");

export async function setAgentSession(agentId: string) {
  const token = await new SignJWT({ role: "agent", id: agentId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearAgentSession() {
  (await cookies()).delete(COOKIE);
}

/** 로그인한 담당직원 — 세션과 DB 둘 다 살아 있어야 한다 */
export async function getAgent() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== "agent" || typeof payload.id !== "string") return null;
    const agent = await prisma.agent.findUnique({ where: { id: payload.id } });
    if (!agent || !agent.isActive) return null;
    return agent;
  } catch {
    return null;
  }
}
