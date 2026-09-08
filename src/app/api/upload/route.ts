import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 브라우저가 줄여서 보낸 뒤의 상한. 이보다 크면 줄이기가 안 된 것이므로 받지 않는다. */
const MAX_FULL = 2_500_000;
const MAX_THUMB = 400_000;

function decode(dataUrl: string, max: number) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0 || buf.length > max) return null;
  return { mime: `image/${m[1]}`, buf };
}

/**
 * POST /api/upload  { images: [{ full: dataURL, thumb: dataURL }] }
 *
 * 파일로 저장하지 않는다 — 운영 서버는 디스크에 쓸 수 없고, 쓸 수 있어도
 * 배포마다 사라진다. DB 에 넣고 /api/img/{id} 로 꺼내 준다.
 * 브라우저가 이미 1280px 로 줄여 보내므로 한 장이 수백 KB 다.
 */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const sessions = await Promise.all(Object.values(COOKIE).map((c) => verifySession(jar.get(c)?.value)));
  const session = sessions.find(Boolean);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { images?: { full: string; thumb: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!Array.isArray(body.images) || body.images.length === 0 || body.images.length > 10) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const files: { url: string; thumbUrl: string }[] = [];
  const rejected: string[] = [];
  for (const img of body.images) {
    const full = decode(img.full, MAX_FULL);
    const thumb = decode(img.thumb, MAX_THUMB);
    if (!full || !thumb) {
      rejected.push("too-large-or-invalid");
      continue;
    }
    try {
      const row = await prisma.image.create({
        data: { storeId: session.storeId, mime: full.mime, data: full.buf, thumb: thumb.buf },
        select: { id: true },
      });
      files.push({ url: `/api/img/${row.id}`, thumbUrl: `/api/img/${row.id}?t=1` });
    } catch (e) {
      // 운영 서버 로그를 바로 볼 수 없어 무엇이 막혔는지 응답으로 알린다 (관리자만 부르는 주소다)
      const err = e as { name?: string; code?: string; message?: string };
      console.error("[upload] image.create failed", err.name, err.code, err.message);
      return NextResponse.json(
        { error: "저장에 실패했어요.", kind: err.name ?? "Error", code: err.code ?? null, detail: (err.message ?? "").slice(0, 160) },
        { status: 500 },
      );
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "이미지가 너무 크거나 형식을 읽을 수 없어요." }, { status: 413 });
  }
  return NextResponse.json({ files, rejected: rejected.length });
}
