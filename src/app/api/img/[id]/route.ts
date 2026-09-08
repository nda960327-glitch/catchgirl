import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/img/{id}         원본(1280px)
 * GET /api/img/{id}?t=1     썸네일(320px)
 *
 * id 가 곧 내용이라(한 번 올리면 안 바뀐다) 브라우저·CDN 이 오래 들고 있어도 된다.
 * 로그인 없이 연다 — 손님 화면의 프로필 사진도 이 주소로 나가기 때문이다.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const thumb = req.nextUrl.searchParams.get("t") === "1";

  // 두 갈래를 따로 두는 건 타입 때문이다 — 조건부 select 는 합집합 타입이 되어 어느 쪽인지 못 좁힌다
  const row = thumb
    ? await prisma.image.findUnique({ where: { id }, select: { mime: true, thumb: true } }).then((r) => r && { mime: r.mime, bytes: r.thumb })
    : await prisma.image.findUnique({ where: { id }, select: { mime: true, data: true } }).then((r) => r && { mime: r.mime, bytes: r.data });
  if (!row) return new NextResponse(null, { status: 404 });

  const bytes = row.bytes;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
