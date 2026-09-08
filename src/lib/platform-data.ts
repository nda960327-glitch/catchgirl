import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { FIRST_MONTH_PRICE, billedPrice, planOf } from "@/lib/plans";
import { STORE_FEE_PER_HOUR } from "@/lib/utils";

/**
 * 플랫폼 콘솔이 쓰는 계산과 조회.
 *
 * 청구는 planStartedAt 의 날짜를 기준으로 매달 돌아온다. 그래서 "몇 개월째" 와
 * "어느 달이 미납인지" 는 둘 다 그 날짜에서 세어 나온다 — 따로 적어 두는 표가 없다.
 */

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** 그 달에 낼 금액 — 시작한 달은 만원, 그 뒤는 요금제 금액 */
export function amountForMonth(store: { plan: string; planStartedAt: Date }, month: string) {
  return month === monthKey(store.planStartedAt) ? FIRST_MONTH_PRICE : billedPrice(planOf(store.plan));
}

/** 구독 시작 달부터 이번 달까지. 이번 달은 청구일이 지났을 때만 센다 (선불이라 그 전엔 아직 안 낼 돈). */
export function billingMonths(planStartedAt: Date, now = new Date()): string[] {
  const out: string[] = [];
  const cur = new Date(planStartedAt.getFullYear(), planStartedAt.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cur <= end) {
    const isThisMonth = cur.getTime() === end.getTime();
    const dueDay = planStartedAt.getDate();
    if (!isThisMonth || now.getDate() >= dueDay) out.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** 시작한 지 몇 달째인지 — 무료 달도 센다 (얼마나 오래 쓰는 매장인지 보는 숫자) */
export function monthsSubscribed(planStartedAt: Date, now = new Date()) {
  const m = (now.getFullYear() - planStartedAt.getFullYear()) * 12 + (now.getMonth() - planStartedAt.getMonth()) + (now.getDate() >= planStartedAt.getDate() ? 1 : 0);
  return Math.max(1, m);
}

/** 다음 청구일 — 시작일과 같은 날짜로 매달 돌아온다 */
export function nextBillingDate(planStartedAt: Date, now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), planStartedAt.getDate());
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * 손님·직원·관리자가 들어오는 주소.
 * ROOT_DOMAIN 이 있고 운영 도메인이면 서브도메인, 아니면 경로 방식.
 */
export async function publicBase(slug: string) {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const root = process.env.ROOT_DOMAIN;
  const local = host.startsWith("localhost") || host.startsWith("127.");
  if (root && !local && host.endsWith(root)) return `https://${slug}.${root}`;
  return `${local ? "http" : "https"}://${host}/${slug}`;
}

export type StoreLinks = { key: "customer" | "staff" | "admin"; label: string; url: string; qr: string }[];

/** 링크 3개와 큐알. 매장에 명함처럼 넘기는 용도라 큐알을 같이 만든다. */
export async function storeLinks(slug: string): Promise<StoreLinks> {
  const base = await publicBase(slug);
  const defs = [
    { key: "customer" as const, label: "손님 앱", url: base },
    { key: "staff" as const, label: "직원 앱", url: `${base}/staff` },
    { key: "admin" as const, label: "관리자", url: `${base}/admin` },
  ];
  return Promise.all(
    defs.map(async (d) => ({
      ...d,
      qr: await QRCode.toDataURL(d.url, { margin: 1, width: 176, color: { dark: "#3A2830", light: "#FFFFFF" } }),
    })),
  );
}

export async function logPlatform(action: string, detail = "", storeId?: string | null) {
  try {
    await prisma.platformLog.create({ data: { action, detail: detail.slice(0, 500), storeId: storeId ?? null } });
  } catch {
    // 기록이 막힌다고 일 자체를 막지는 않는다
  }
}

/** 업체가 살아 있는지 한눈에 — 최근 30일 예약, 그 매장 몫, 마지막 활동 */
export async function storeHealth(storeId: string, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [recent, last, counts] = await Promise.all([
    prisma.reservation.findMany({
      where: { storeId, startTime: { gte: since, lt: now }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      select: { hours: true, discountAmount: true },
    }),
    prisma.reservation.findFirst({ where: { storeId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.store.findUnique({
      where: { id: storeId },
      select: { _count: { select: { customers: true, staff: true, rooms: true, reservations: true } } },
    }),
  ]);
  const hours = recent.reduce((a, r) => a + r.hours, 0);
  const discount = recent.reduce((a, r) => a + r.discountAmount, 0);
  return {
    reservations30d: recent.length,
    storeRevenue30d: Math.max(0, hours * STORE_FEE_PER_HOUR - discount),
    lastActivityAt: last?.createdAt ?? null,
    counts: counts?._count ?? { customers: 0, staff: 0, rooms: 0, reservations: 0 },
  };
}

/** 미납 달 목록과 이번 달 청구액 */
export function billingStatus(store: { plan: string; planStartedAt: Date }, paidMonths: string[], now = new Date()) {
  const due = billingMonths(store.planStartedAt, now);
  const paid = new Set(paidMonths);
  const unpaid = due.filter((m) => !paid.has(m));
  const unpaidAmount = unpaid.reduce((a, m) => a + amountForMonth(store, m), 0);
  return { due, unpaid, unpaidAmount, monthly: billedPrice(planOf(store.plan)), months: monthsSubscribed(store.planStartedAt, now) };
}
