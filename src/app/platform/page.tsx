import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/platform";
import { PLANS, billedPrice, planOf } from "@/lib/plans";
import { won } from "@/lib/utils";
import { Card } from "@/components/ui";
import { NewStoreForm } from "./new-store-form";
import { logoutPlatform } from "./actions";

export const dynamic = "force-dynamic";

/** 영업할 때 보여 주는 매장. 데이터가 다 차 있고 손님 길동/1234 로 들어간다. */
const DEMO_SLUG = "secret-garden";

export default async function PlatformPage() {
  if (!(await isPlatform())) redirect("/platform/login");

  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      admins: { select: { email: true }, take: 1 },
      _count: { select: { customers: true, staff: true, rooms: true, reservations: true } },
    },
  });
  const monthly = stores.reduce((a, s) => a + billedPrice(planOf(s.plan)), 0);

  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Platform</div>
            <h1 className="mt-1 font-serif text-[24px] font-bold text-ink">매장 콘솔</h1>
            <div className="mt-0.5 text-[12px] text-mute">
              매장 {stores.length}곳 · 월 구독 합계 {won(monthly)}
            </div>
          </div>
          <form action={logoutPlatform}>
            <button className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-mute">나가기</button>
          </form>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-3">
            {stores.length === 0 && (
              <Card className="py-12 text-center text-[13px] text-mute">아직 매장이 없어요. 오른쪽에서 첫 매장을 만들어 보세요.</Card>
            )}
            {stores.map((s) => {
              const plan = planOf(s.plan);
              return (
                <Card key={s.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover" /> : <span className="h-9 w-9 rounded-xl" style={{ background: s.themeColor }} />}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-serif text-[16px] font-bold text-ink">{s.name}</span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-white ${plan === "MAX" ? "bg-gold" : "bg-ink"}`}>{PLANS[plan].name}</span>
                        {s.slug === DEMO_SLUG && <span className="rounded-md bg-blush-lt px-1.5 py-0.5 text-[9px] font-bold text-brand">예시 매장</span>}
                      </div>
                      <div className="text-[11px] text-mute">
                        /{s.slug} · {s.admins[0]?.email ?? "관리자 없음"} · {format(s.createdAt, "yyyy.MM.dd")} 시작
                      </div>
                    </div>
                    <div className="ml-auto flex gap-1.5">
                      <Link href={`/${s.slug}/admin/login`} target="_blank" className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-ink">관리자 ↗</Link>
                      <Link href={`/${s.slug}/login`} target="_blank" className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] font-bold text-ink">손님 ↗</Link>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-[#FAF6F7] p-3 text-center">
                    {[
                      ["고객", s._count.customers],
                      ["캐치걸", s._count.staff],
                      ["룸", s._count.rooms],
                      ["예약", s._count.reservations],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <div className="font-serif text-[15px] font-bold text-brand">{v as number}</div>
                        <div className="text-[9px] text-mute">{k as string}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-mute">
                    {won(billedPrice(plan))}/월 · {s.openTime}~{s.closeTime} · 교대 {s.shiftSplitTime}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="lg:sticky lg:top-6 lg:self-start">
            <NewStoreForm />
          </div>
        </div>
      </div>
    </div>
  );
}
