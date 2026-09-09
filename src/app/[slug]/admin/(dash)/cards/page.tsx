import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { publicBase } from "@/lib/platform-data";
import { THEMES, themeOf } from "@/lib/themes";
import { CardsClient } from "./cards-client";

export const dynamic = "force-dynamic";

/**
 * 손님 연결 카드 인쇄.
 *
 * 명함 크기(90×50mm)로 A4 한 장에 열 장. 빈칸 카드는 직원이 코드를 손으로 적고,
 * 코드 인쇄 카드는 아직 앱을 시작하지 않은 손님 코드가 그대로 찍혀 나온다.
 */
export default async function CardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const url = await publicBase(slug);
  const [qr, pending] = await Promise.all([
    QRCode.toDataURL(url, { margin: 1, width: 512, color: { dark: "#1a1216", light: "#FFFFFF" } }),
    prisma.customer.findMany({
      where: { storeId: store.id, passwordHash: null, NOT: { inviteCode: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, nickname: true, inviteCode: true },
    }),
  ]);
  const t = THEMES[themeOf(store.theme)];
  return (
    <CardsClient
      slug={slug}
      card={{ storeName: store.name, logoUrl: store.logoUrl, amount: store.signupCouponAmount, qr, url, theme: { brand: store.themeColor || t.brand, ink: t.ink, paper: t.dark ? "#FFFFFF" : t.paper, line: t.dark ? "#E8E0E2" : t.line, gold: t.gold } }}
      pending={pending.map((c) => ({ id: c.id, nickname: c.nickname, code: c.inviteCode! }))}
    />
  );
}
