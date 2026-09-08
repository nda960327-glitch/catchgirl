import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/platform";
import { billingStatus, storeHealth } from "@/lib/platform-data";
import { PLANS, planOf } from "@/lib/plans";
import { cn, won, wonShort } from "@/lib/utils";
import { Card, Chip } from "@/components/ui";
import { PENDING_REASON } from "@/lib/terms";
import { NewStoreForm } from "./new-store-form";
import { BroadcastForm } from "./broadcast-form";
import { logoutPlatform } from "./actions";

export const dynamic = "force-dynamic";

/** 영업할 때 보여 주는 매장. 데이터가 다 차 있고 손님 길동/1234 로 들어간다. */
const DEMO_SLUG = "secret-garden";

const ACTION_LABEL: Record<string, string> = {
  STORE_CREATED: "매장 생성", PLAN_CHANGED: "요금제 변경", CONTRACT_UPDATED: "계약 정보", ADMIN_RESET: "관리자 계정",
  ENTERED_AS_ADMIN: "관리자로 들어감", SUSPENDED: "이용 중지", RESUMED: "이용 재개", PAID: "입금", UNPAID: "입금 취소",
  BROADCAST: "전체 공지", STORE_DELETED: "매장 삭제", SIGNUP: "가입 신청", APPROVED: "가입 승인", BIZ_VERIFIED: "사업자 확인", CMS_UPDATED: "자동이체 정보",
};

/**
 * 매장 콘솔 — 파는 쪽의 첫 화면.
 *
 * 어느 업체가 살아 있고, 누가 안 냈고, 이번 달 얼마가 들어오는지가 먼저 보여야
 * 한다. 업체 하나를 자세히 보는 건 눌러서 들어간다.
 */
export default async function PlatformPage() {
  if (!(await isPlatform())) redirect("/platform/login");

  const [stores, logs] = await Promise.all([
    prisma.store.findMany({
      orderBy: { createdAt: "desc" },
      include: { admins: { select: { email: true }, take: 1 }, payments: { select: { month: true } } },
    }),
    prisma.platformLog.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { store: { select: { name: true, slug: true } } } }),
  ]);

  const rows = await Promise.all(
    stores.map(async (s) => {
      const health = await storeHealth(s.id);
      const billing = billingStatus(s, s.payments.map((p) => p.month));
      return { s, health, billing, plan: planOf(s.plan) };
    }),
  );

  const active = rows.filter((r) => !r.s.isSuspended);
  const monthly = active.reduce((a, r) => a + r.billing.monthly, 0);
  const unpaidStores = rows.filter((r) => r.billing.unpaid.length > 0);
  const unpaidAmount = unpaidStores.reduce((a, r) => a + r.billing.unpaidAmount, 0);
  const reservations30d = rows.reduce((a, r) => a + r.health.reservations30d, 0);

  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Platform</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">매장 콘솔</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/platform/billing" className="cta-grad rounded-xl px-3.5 py-2 text-[12px] font-bold text-white shadow-cta">이번 달 출금 명단</Link>
            <form action={logoutPlatform}>
              <button className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-mute">나가기</button>
            </form>
          </div>
        </div>

        {/* 전체 상황 */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { k: "매장", v: `${stores.length}곳`, s: `${stores.length - active.length}곳 중지` },
            { k: "월 구독 합계", v: wonShort(monthly), s: "이용 중인 매장 기준" },
            { k: "미납", v: `${unpaidStores.length}곳`, s: unpaidAmount ? `${wonShort(unpaidAmount)} 밀림` : "밀린 곳 없음", bad: unpaidStores.length > 0 },
            { k: "최근 30일 예약", v: `${reservations30d}건`, s: "모든 매장 합" },
            { k: "Pro · Max", v: `${rows.filter((r) => r.plan === "PRO").length} · ${rows.filter((r) => r.plan === "MAX").length}`, s: "요금제별 매장 수" },
          ].map((c) => (
            <Card key={c.k} className={cn("p-4", c.bad && "border-bad/30 bg-bad-bg/40")}>
              <div className="text-[11px] font-semibold text-mute">{c.k}</div>
              <div className={cn("mt-1 font-serif text-[22px] font-bold", c.bad ? "text-bad" : "text-ink")}>{c.v}</div>
              <div className="mt-0.5 text-[10px] text-mute">{c.s}</div>
            </Card>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-3">
            {rows.length === 0 && <Card className="py-12 text-center text-[13px] text-mute">아직 매장이 없어요. 오른쪽에서 첫 매장을 만들어 보세요.</Card>}

            {rows.map(({ s, health, billing, plan }) => (
              <Link key={s.id} href={`/platform/${s.slug}`} className="block">
                <Card className={cn("p-4 transition-all hover:border-brand hover:shadow-pop", s.isSuspended && "opacity-70")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="h-10 w-10 rounded-xl" style={{ background: s.themeColor }} />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-serif text-[16px] font-bold text-ink">{s.name}</span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-white ${plan === "MAX" ? "bg-gold" : "bg-ink"}`}>{PLANS[plan].name}</span>
                        {s.slug === DEMO_SLUG && <span className="rounded-md bg-blush-lt px-1.5 py-0.5 text-[9px] font-bold text-brand">예시 매장</span>}
                        {s.isSuspended && (s.suspendedReason === PENDING_REASON ? <Chip tone="gold">가입 신청 · 승인 대기</Chip> : <Chip tone="red">이용 중지</Chip>)}
                        {billing.unpaid.length > 0 && !s.isSuspended && <Chip tone="red">미납 {billing.unpaid.length}개월</Chip>}
                        {!s.bizVerifiedAt && !s.isSuspended && <Chip tone="red">사업자 미확인</Chip>}
                        {!s.cmsMemberNo && !s.isSuspended && <Chip tone="red">자동이체 미등록</Chip>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-mute">
                        /{s.slug} · {s.admins[0]?.email ?? "관리자 없음"} · {format(s.createdAt, "yyyy.MM.dd")} 등록 · 구독 {billing.months}개월째
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="font-serif text-[16px] font-bold text-ink">{won(billing.monthly)}<span className="text-[10px] font-normal text-mute">/월</span></div>
                      <div className="text-[10px] text-mute">
                        {health.lastActivityAt ? `마지막 예약 ${format(health.lastActivityAt, "M/d HH:mm")}` : "예약 기록 없음"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-well p-3 text-center">
                    {[
                      ["30일 예약", `${health.reservations30d}건`],
                      ["30일 매장 몫", wonShort(health.storeRevenue30d)],
                      ["고객", `${health.counts.customers}명`],
                      ["캐치걸", `${health.counts.staff}명`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div className="font-serif text-[14px] font-bold text-brand">{v}</div>
                        <div className="text-[9px] text-mute">{k}</div>
                      </div>
                    ))}
                  </div>
                  {(s.ownerContact || s.platformMemo) && (
                    <div className="mt-2 truncate text-[11px] text-mute">
                      {s.ownerContact && <span className="font-semibold text-ink">{s.ownerContact}</span>}
                      {s.ownerContact && s.platformMemo && " · "}
                      {s.platformMemo}
                    </div>
                  )}
                </Card>
              </Link>
            ))}

            {/* 최근 기록 */}
            <Card className="p-5">
              <div className="text-[14px] font-bold text-ink">최근 한 일</div>
              {logs.length === 0 ? (
                <div className="mt-3 text-[12px] text-mute">아직 기록이 없어요</div>
              ) : (
                <div className="mt-3 divide-y divide-line">
                  {logs.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-[12px]">
                      <span className="w-[110px] shrink-0 text-[11px] text-mute">{format(l.createdAt, "M/d HH:mm")}</span>
                      {l.store ? (
                        <Link href={`/platform/${l.store.slug}`} className="font-bold text-brand underline-offset-2 hover:underline">{l.store.name}</Link>
                      ) : (
                        <span className="font-bold text-mute">—</span>
                      )}
                      <span className="font-semibold text-ink">{ACTION_LABEL[l.action] ?? l.action}</span>
                      {l.detail && <span className="text-mute">{l.detail}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <NewStoreForm />
            <BroadcastForm />
          </div>
        </div>
      </div>
    </div>
  );
}
