import { NextResponse, type NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { COOKIE, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload  { images: [{ full: dataURL, thumb: dataURL }] }
 * 클라이언트에서 리사이즈(최대 1280px) + 썸네일(320px) 생성 후 업로드.
 * MVP: public/uploads 에 저장. Phase 2: Supabase Storage 로 교체.
 */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const anyRole = (await Promise.all(Object.values(COOKIE).map((c) => verifySession(jar.get(c)?.value)))).some(Boolean);
  if (!anyRole) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { images: { full: string; thumb: string }[] };
  if (!Array.isArray(body.images) || body.images.length > 10) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const urls: { url: string; thumbUrl: string }[] = [];
  for (const img of body.images) {
    const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(img.full);
    const t = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(img.thumb);
    if (!m || !t) continue;
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 3 * 1024 * 1024) continue;
    const id = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
    await writeFile(path.join(dir, `${id}.${ext}`), buf);
    await writeFile(path.join(dir, `${id}.thumb.${ext}`), Buffer.from(t[2], "base64"));
    urls.push({ url: `/uploads/${id}.${ext}`, thumbUrl: `/uploads/${id}.thumb.${ext}` });
  }
  return NextResponse.json({ files: urls });
}
