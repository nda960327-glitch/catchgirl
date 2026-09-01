import { prisma } from "@/lib/db";

/**
 * 역할별 앱 매니페스트.
 *
 * 관리자·직원·손님 앱은 홈 화면에 각각 따로 깔려야 한다. 브라우저는 매니페스트의
 * id 와 scope 로 앱을 구분하므로, 셋 다 scope 가 "/" 이면 한 앱으로 묶여서
 * 관리자 앱을 깔아도 손님 화면이 열린다.
 *
 * 그래서 역할마다 scope 를 그 역할의 경로로 좁힌다. 손님 scope 가 나머지 둘을
 * 품지만, 브라우저는 더 좁은 scope 를 먼저 고르므로 서로 침범하지 않는다.
 * 매장마다 경로가 다르니 정적 파일이 아니라 매장별로 만들어 준다.
 */
export type AppRole = "customer" | "admin" | "staff";

const ROLE = {
  customer: { path: "", suffix: "", short: "", theme: "#B4586A", icon: "customer" },
  admin: { path: "/admin", suffix: " 관리자", short: " 관리자", theme: "#3E6FA8", icon: "admin" },
  staff: { path: "/staff", suffix: " 직원", short: " 직원", theme: "#C8A46A", icon: "staff" },
} as const;

const DESC: Record<AppRole, string> = {
  customer: "전담 매니저(바텐더)를 지정해 예약해요",
  admin: "예약·출근·매출을 한 화면에서 관리해요",
  staff: "내 일정과 예약, 이번 달 매출을 확인해요",
};

export async function buildManifest(slug: string, role: AppRole) {
  const store = await prisma.store.findUnique({ where: { slug }, select: { name: true } });
  const name = store?.name ?? "캐치걸_어나더";
  const r = ROLE[role];
  const base = `/${slug}${r.path}`;

  return {
    // id 가 다르면 브라우저가 서로 다른 앱으로 본다 — 세 개가 따로 깔리는 핵심
    id: base,
    name: `${name}${r.suffix}`,
    short_name: `${name.split("_")[0]}${r.short}`,
    description: DESC[role],
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#FCF7F6",
    theme_color: r.theme,
    icons: [192, 512].map((size) => ({
      src: `/assets/icon-${r.icon}-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    })),
  };
}

export function manifestResponse(body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
