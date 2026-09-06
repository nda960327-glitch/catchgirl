import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * 플랫폼 콘솔 — 매장을 새로 만드는 자리.
 *
 * 매장 안의 관리자와는 다른 층이다. 이건 앱을 파는 쪽이 쓰는 화면이라
 * 특정 매장에 속하지 않고, 비밀번호는 환경변수로만 둔다 (DB 에 두면
 * 매장 관리자 화면에서 흘러나갈 여지가 생긴다).
 */
const COOKIE = "cg_platform";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "catch-girl-dev-secret");

/** 설정하지 않으면 콘솔 자체가 닫힌다 — 기본 비밀번호를 두지 않는다 */
export const platformEnabled = () => !!process.env.PLATFORM_PASSWORD;

export function checkPlatformPassword(input: string) {
  const expected = process.env.PLATFORM_PASSWORD;
  return !!expected && input === expected;
}

export async function setPlatformSession() {
  const token = await new SignJWT({ role: "platform" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearPlatformSession() {
  (await cookies()).delete(COOKIE);
}

export async function isPlatform() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "platform";
  } catch {
    return false;
  }
}
