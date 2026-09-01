import { prisma } from "@/lib/db";
import { gradeOf, type Grade } from "@/lib/utils";

/**
 * 할인.
 *
 * 세 갈래가 있고 성격이 다르다.
 *   - 등급 혜택: 단골·VIP 가 예약할 때마다 자동으로 붙는다.
 *   - 기간 할인: 비 오는 날처럼 매장이 그날그날 걸어 두는 할인.
 *   - 쿠폰: 매장이 특정 손님에게 준 1회용.
 *
 * 자동 할인(등급·기간)은 **더 큰 것 하나만** 적용한다. 둘을 더하면 매장이
 * 의도하지 않은 금액이 빠지고, 손님 화면에서도 왜 이 값이 나왔는지 설명이
 * 어려워진다. 쿠폰은 손님이 직접 고르는 것이므로 그 위에 한 장 더 얹힌다.
 *
 * 할인은 매장이 부담한다. 캐치걸 몫은 정가 기준 그대로이고, 줄어드는 건
 * 매장 몫(수수료)이다.
 */

export type Discount = { label: string; amount: number };

export const GRADE_BENEFIT_GRADES: Grade[] = ["단골", "VIP"];

/** 매장이 아무것도 설정하지 않았을 때 시작점이 되는 값 */
export const DEFAULT_GRADE_BENEFITS: { grade: Grade; amount: number; note: string }[] = [
  { grade: "단골", amount: 20_000, note: "다섯 번째 방문부터 예약마다 2만원 빼 드려요." },
  { grade: "VIP", amount: 50_000, note: "열 번째 방문부터 예약마다 5만원 빼 드리고, 원하시는 자리를 먼저 잡아 드려요." },
];

/** 방문 완료 횟수로 등급을 구한다 — 고객 목록에서 쓰는 기준과 같다 */
export async function gradeOfCustomer(customerId: string): Promise<Grade> {
  const visits = await prisma.reservation.count({ where: { customerId, status: "COMPLETED" } });
  return gradeOf(visits);
}

/** 그 영업일에 걸려 있는 기간 할인 (가장 큰 것 하나) */
export async function promotionOn(storeId: string, businessDay: string): Promise<Discount | null> {
  const rows = await prisma.dayPromotion.findMany({
    where: { storeId, isActive: true, startDate: { lte: businessDay }, endDate: { gte: businessDay } },
    orderBy: { amount: "desc" },
    take: 1,
  });
  return rows[0] ? { label: rows[0].name, amount: rows[0].amount } : null;
}

/** 등급 혜택 */
export async function gradeBenefitFor(storeId: string, grade: Grade): Promise<Discount | null> {
  if (grade === "신규") return null;
  const row = await prisma.gradeBenefit.findUnique({ where: { storeId_grade: { storeId, grade } } });
  if (!row || !row.isActive || row.amount <= 0) return null;
  return { label: `${grade} 혜택`, amount: row.amount };
}

/** 손님이 지금 쓸 수 있는 쿠폰 (만료·사용 제외) */
export async function usableCoupons(storeId: string, customerId: string) {
  return prisma.coupon.findMany({
    where: {
      storeId,
      customerId,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: [{ expiresAt: "asc" }, { amount: "desc" }],
  });
}

export type DiscountPreview = {
  auto: Discount | null;
  coupons: { id: string; name: string; amount: number; expiresAt: Date | null }[];
};

/** 예약 화면에 보여 줄 할인 후보 */
export async function previewDiscounts(storeId: string, customerId: string, businessDay: string): Promise<DiscountPreview> {
  const grade = await gradeOfCustomer(customerId);
  const [benefit, promo, coupons] = await Promise.all([
    gradeBenefitFor(storeId, grade),
    promotionOn(storeId, businessDay),
    usableCoupons(storeId, customerId),
  ]);
  // 자동 할인은 겹치지 않는다 — 큰 쪽 하나만
  const auto = [benefit, promo].filter((d): d is Discount => d !== null).sort((a, b) => b.amount - a.amount)[0] ?? null;
  return {
    auto,
    coupons: coupons.map((c) => ({ id: c.id, name: c.name, amount: c.amount, expiresAt: c.expiresAt })),
  };
}

/**
 * 실제로 적용할 할인을 정한다.
 * 정가보다 많이 깎이지 않도록 마지막에 자른다 — 손님이 낼 돈이 음수가 될 수는 없다.
 */
export function resolveDiscount(listPrice: number, auto: Discount | null, coupon: Discount | null) {
  const parts = [auto, coupon].filter((d): d is Discount => d !== null && d.amount > 0);
  const raw = parts.reduce((a, d) => a + d.amount, 0);
  const amount = Math.min(raw, listPrice);
  return { amount, label: parts.map((d) => d.label).join(" + "), parts };
}
