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
 * 서브도메인 → 매장.
 *
 * ROOT_DOMAIN 이 catchgirl.app 이면 bgt.catchgirl.app 은 /bgt 매장이다.
 * 매장마다 도메인을 새로 사지 않고 와일드카드 DNS 하나로 다 받는다.
 * 앱 안의 링크는 /bgt/... 로 만들어져 있으므로, 이미 매장 경로가 붙은 요청은
 * 그대로 두고 안 붙은 요청만 앞에 붙여 준다 — 어느 쪽으로 들어와도 통한다.
 */
function storeFromHost(host: string): string | null {
  const root = process.env.ROOT_DOMAIN;
  if (!root) return null;
  const h = host.split(":")[0].toLowerCase();
  if (h === root || h === `www.${root}`) return null;
  if (!h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  // 한 단계 서브도메인만 매장이다. www 나 콘솔용 이름은 매장이 아니다.
  if (!sub || sub.includes(".") || ["www", "app", "platform", "api", "signup", "demo", "agent"].includes(sub)) return null;
  return sub;
}

/**
 * RBAC.
 *  - /{slug}/admin/* 는 관리자, /{slug}/staff/* 는 캐치걸 세션이 있어야 진입
 *  - 나머지 손님 화면은 초대받은 분만 쓰는 앱이라 로그인 전에는 아예 안 열린다.
 *    캐치걸 프로필과 후기가 그냥 열려 있으면 링크 하나로 다 돌아다닐 수 있다.
 */
export async function middleware(req: NextRequest) {
  const original = req.nextUrl.pathname;

  // 플랫폼 콘솔은 매장이 아니다 — 자체 비밀번호로 잠근다
  if (original === "/platform" || original.startsWith("/platform/")) return NextResponse.next();
  // 가입 신청은 아직 매장이 없는 사람이 오는 곳 — 로그인 없이 열린다
  if (original === "/signup" || original.startsWith("/signup/")) return NextResponse.next();
  // 시연 안내도 매장이 아니다
  if (original === "/demo" || original.startsWith("/demo/")) return NextResponse.next();
  // 담당직원 화면 — 자기 세션으로 잠근다 (페이지 안에서 확인)
  if (original === "/agent" || original.startsWith("/agent/")) return NextResponse.next();
  // 검색·미리보기용 파일은 매장이 아니다
  if (/^/(opengraph-image|twitter-image|icon|apple-icon|robots.txt|sitemap.xml)(/|$|?)/.test(original)) return NextResponse.next();

  // 서브도메인으로 들어왔으면 매장 경로를 앞에 붙인 걸로 본다
  const sub = storeFromHost(req.headers.get("host") ?? "");
  const needsPrefix = !!sub && !(original === `/${sub}` || original.startsWith(`/${sub}/`));
  const pathname = needsPrefix ? `/${sub}${original === "/" ? "" : original}` : original;

  const pass = () => {
    if (!needsPrefix) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.rewrite(url);
  };
  // 서브도메인으로 들어온 사람에게는 매장 경로를 뗀 주소로 보낸다 —
  // bgt.catchgirl.kr/bgt/login 보다 bgt.catchgirl.kr/login 이 자연스럽다. 둘 다 통하긴 한다.
  const strip = (p: string) => (sub && (p === `/${sub}` || p.startsWith(`/${sub}/`)) ? p.slice(sub.length + 1) || "/" : p);
  const toLogin = (loginPath: string) => {
    const url = req.nextUrl.clone();
    url.pathname = strip(loginPath);
    url.searchParams.set("next", strip(pathname));
    return NextResponse.redirect(url);
  };

  const cust = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (cust && !/^\/(admin|staff)(\/|$)/.test(cust[2] ?? "")) {
    const [, slug, rest = ""] = cust;
    // 로그인 화면과 앱 설치 정보는 열려 있어야 한다 — 그래야 코드를 넣고 들어온다
    const open = rest.startsWith("/login") || rest === "/manifest.webmanifest" || rest === "/app-icon";
    if (!open && !(await roleOk(req.cookies.get("cg_customer")?.value, "customer"))) {
      return toLogin(`/${slug}/login`);
    }
    return pass();
  }

  const m = pathname.match(/^\/([^/]+)\/(admin|staff)(\/.*)?$/);
  if (!m) return pass();
  const [, slug, area, rest = ""] = m;
  if (rest.startsWith("/login")) return pass();
  // 앱 설치 정보는 로그인 전에도 읽혀야 한다 — 로그인 화면에서 설치하니까.
  // 매장 이름과 아이콘뿐이라 가려 둘 것도 없다.
  if (rest === "/manifest.webmanifest") return pass();
  const cookieName = area === "admin" ? "cg_admin" : "cg_staff";
  if (await roleOk(req.cookies.get(cookieName)?.value, area)) return pass();
  return toLogin(`/${slug}/${area}/login`);
}

export const config = {
  // _next·api·정적 파일을 뺀 모든 매장 경로. 손님 화면도 로그인 검사를 거친다.
  matcher: ["/((?!_next/|api/|assets/|favicon|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)"],
};
