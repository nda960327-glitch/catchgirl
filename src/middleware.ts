import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "catch-girl-dev-secret");

async function roleOk(token: string | undefined, role: string) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === role;
  } catch {
    return false;
  }
}

/** RBAC: /{slug}/admin/* 는 관리자, /{slug}/staff/* 는 캐치걸 세션이 있어야 진입 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const m = pathname.match(/^\/([^/]+)\/(admin|staff)(\/.*)?$/);
  if (!m) return NextResponse.next();
  const [, slug, area, rest = ""] = m;
  if (rest.startsWith("/login")) return NextResponse.next();
  // 앱 설치 정보는 로그인 전에도 읽혀야 한다 — 로그인 화면에서 설치하니까.
  // 매장 이름과 아이콘뿐이라 가려 둘 것도 없다.
  if (rest === "/manifest.webmanifest") return NextResponse.next();
  const cookieName = area === "admin" ? "cg_admin" : "cg_staff";
  const ok = await roleOk(req.cookies.get(cookieName)?.value, area);
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${slug}/${area}/login`;
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/:slug/admin/:path*", "/:slug/staff/:path*", "/:slug/admin", "/:slug/staff"] };
