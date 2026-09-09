import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { businessDayOf } from "@/lib/slots";
import { won } from "@/lib/utils";
import { DEFAULT_GRADE_BENEFITS, GRADE_BENEFIT_GRADES } from "@/lib/discounts";
import { Card, Eyebrow } from "@/components/ui";
import { BenefitsForm } from "./benefits-form";
import { PromotionsManager } from "./promotions-manager";
import { staffLabelOf } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DiscountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const today = businessDayOf(store);

  const [saved, promos, couponStats] = await Promise.all([
    prisma.gradeBenefit.findMany({ where: { storeId: store.id } }),
    prisma.dayPromotion.findMany({ where: { storeId: store.id }, orderBy: [{ startDate: "desc" }] }),
    prisma.coupon.groupBy({ by: ["usedAt"], where: { storeId: store.id }, _count: { _all: true }, _sum: { amount: true } }),
  ]);

  // 아직 저장한 적 없는 등급은 권장값을 채워 보여준다
  const benefits = GRADE_BENEFIT_GRADES.map((grade) => {
    const row = saved.find((s) => s.grade === grade);
    const fallback = DEFAULT_GRADE_BENEFITS.find((d) => d.grade === grade)!;
    return {
      grade,
      amount: row?.amount ?? fallback.amount,
      note: row?.note ?? fallback.note,
      isActive: row?.isActive ?? true,
      saved: !!row,
    };
  });

  const issued = couponStats.reduce((a, c) => a + c._count._all, 0);
  const used = couponStats.filter((c) => c.usedAt !== null).reduce((a, c) => a + c._count._all, 0);
  const usedAmount = couponStats.filter((c) => c.usedAt !== null).reduce((a, c) => a + (c._sum.amount ?? 0), 0);

  return (
    <div className="animate-fade">
      <Eyebrow>Discounts</Eyebrow>
      <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">할인 관리</h1>
      <p className="mt-1 text-[12px] leading-[1.8] text-mute">
        할인은 매장이 부담해요. {staffLabelOf(store)} 몫은 정가 그대로 나가고, 깎아 드린 만큼은 매장 몫(수수료)에서 빠져요.
        <br />
        등급 혜택과 기간 할인은 겹치지 않고 <b className="text-ink">큰 것 하나만</b> 붙어요. 쿠폰은 그 위에 한 장 더 쓰실 수 있어요.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { label: "발급한 쿠폰", value: `${issued}장` },
          { label: "쓴 쿠폰", value: `${used}장` },
          { label: "쿠폰으로 나간 금액", value: won(usedAmount) },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-[11px] font-semibold text-mute">{k.label}</div>
            <div className="mt-1 font-serif text-[20px] font-bold text-ink">{k.value}</div>
          </Card>
        ))}
      </div>

      <BenefitsForm slug={slug} benefits={benefits} />
      <PromotionsManager slug={slug} today={today} items={promos} />

      <Card className="mt-4 p-5">
        <div className="text-[14px] font-bold text-ink">쿠폰은 어디서 주나요</div>
        <p className="mt-1.5 text-[12px] leading-[1.9] text-mute">
          쿠폰은 손님 한 분에게 주는 거라 <b className="text-ink">고객 관리 → 그 손님 화면</b>에서 발급해요.
          <br />
          사유를 같이 적어 두시면 나중에 왜 드렸는지 알 수 있어요. 사유는 매장만 봐요.
          <br />
          아직 안 쓴 쿠폰은 회수하실 수 있고, 이미 쓴 쿠폰은 기록으로 남아요.
        </p>
      </Card>
    </div>
  );
}
