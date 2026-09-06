import sharp from "sharp";
import { prisma } from "@/lib/db";

/**
 * 매장 로고로 만든 앱 아이콘.
 *
 * 매장마다 앱이 따로 깔리는데 아이콘이 전부 같은 고양이면 홈 화면에서
 * 구분이 안 된다. 로고를 정사각으로 잘라 쓰고, 역할마다 테두리 색을 달리
 * 해서 한 매장의 손님·관리자·직원 앱도 서로 구분되게 한다.
 *
 * 로고가 없는 매장은 기본 고양이 아이콘으로 돌려보낸다.
 */
const RING: Record<string, string> = {
  customer: "#B4586A",
  admin: "#3E6FA8",
  staff: "#C8A46A",
};

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const role = ["customer", "admin", "staff"].includes(url.searchParams.get("role") ?? "") ? url.searchParams.get("role")! : "customer";
  const size = url.searchParams.get("size") === "512" ? 512 : 192;

  const store = await prisma.store.findUnique({ where: { slug }, select: { logoUrl: true } });
  const fallback = () => Response.redirect(new URL(`/assets/icon-${role}-${size}.png`, req.url), 302);
  if (!store?.logoUrl) return fallback();

  try {
    // 업로드된 파일이든 외부 주소든 같은 방법으로 읽는다
    const res = await fetch(new URL(store.logoUrl, req.url), { cache: "force-cache" });
    if (!res.ok) return fallback();
    const src = Buffer.from(await res.arrayBuffer());

    const ring = Math.round(size * 0.07);
    const inner = size - ring * 2;
    const logo = await sharp(src).resize(inner, inner, { fit: "cover" }).png().toBuffer();

    const out = await sharp({
      create: { width: size, height: size, channels: 4, background: RING[role] },
    })
      .composite([{ input: logo, left: ring, top: ring }])
      .png()
      .toBuffer();

    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/png",
        // 로고를 바꾸면 주소는 같으니 하루 정도만 붙잡아 둔다
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return fallback();
  }
}
