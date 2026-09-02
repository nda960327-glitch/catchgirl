import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getAdmin } from "@/lib/auth";

/**
 * 손님이 넣은 새 예약을 알려 준다.
 *
 * 관리자 화면은 서버 렌더라 가만히 두면 갱신되지 않는다. 영업 중에 예약이
 * 들어온 걸 모르고 지나치면 자리를 못 잡아 주므로, 관리자 앱이 이 주소를
 * 짧게 물어보고 새 것이 있으면 알린다.
 *
 * 기준 시각은 관리자마다 따로 둔다 (lastSeenReservationAt).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const admin = await getAdmin(store.id);
  if (!admin) return Response.json({ ok: false }, { status: 401 });

  const row = await prisma.adminUser.findUnique({
    where: { id: admin.id },
    select: { lastSeenReservationAt: true },
  });
  // 처음 켠 관리자에게 예전 예약을 몰아서 알리지 않는다.
  // 다만 기준 시각을 그때 저장해 두어야 한다 — 매번 "지금" 으로 잡으면
  // 방금 들어온 예약도 늘 기준보다 과거가 되어 영영 안 잡힌다.
  let since = row?.lastSeenReservationAt;
  if (!since) {
    since = new Date();
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastSeenReservationAt: since } });
  }

  const items = await prisma.reservation.findMany({
    where: { storeId: store.id, createdBy: "CUSTOMER", createdAt: { gt: since } },
    include: { staff: { select: { nickname: true } }, customer: { select: { nickname: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json(
    {
      ok: true,
      count: items.length,
      items: items.map((r) => ({
        id: r.id,
        code: r.code,
        customer: r.customer.nickname,
        staff: r.staff.nickname,
        at: r.startTime.toISOString(),
        room: r.roomName,
        hours: r.hours,
        price: r.totalPrice,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** 알림을 확인했다고 표시 */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const admin = await getAdmin(store.id);
  if (!admin) return Response.json({ ok: false }, { status: 401 });
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastSeenReservationAt: new Date() } });
  return Response.json({ ok: true });
}
