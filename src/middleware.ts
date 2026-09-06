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

/**
 * RBAC.
 *  - /{slug}/admin/* 는 관리자, /{slug}/staff/* 는 캐치걸 세션이 있어야 진입
 *  - 나머지 손님 화면은 초대받은 분만 쓰는 앱이라 로그인 전에는 아예 안 열린다.
 *    캐치걸 프로필과 후기가 그냥 열려 있으면 링크 하나로 다 돌아다닐 수 있다.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const cust = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (cust && !/^\/(admin|staff)(\/|$)/.test(cust[2] ?? "")) {
    const [, slug, rest = ""] = cust;
    // 로그인 화면과 앱 설치 정보는 열려 있어야 한다 — 그래야 코드를 넣고 들어온다
    const open = rest.startsWith("/login") || rest === "/manifest.webmanifest";
    if (!open && !(await roleOk(req.cookies.get("cg_customer")?.value, "customer"))) {
      const url = req.nextUrl.clone();
      url.pathname = `/${slug}/login`;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

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

export const config = {
  // _next·api·정적 파일을 뺀 모든 매장 경로. 손님 화면도 로그인 검사를 거친다.
  matcher: ["/((?!_next/|api/|assets/|favicon|.*\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)"],
};
