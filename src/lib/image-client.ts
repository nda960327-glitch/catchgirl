"use client";

/** 브라우저에서 이미지 리사이즈 → JPEG dataURL */
export async function resizeImage(file: File, maxPx: number, quality = 0.85): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function uploadImages(files: File[]): Promise<{ url: string; thumbUrl: string }[]> {
  const images = await Promise.all(files.map(async (f) => ({ full: await resizeImage(f, 1280), thumb: await resizeImage(f, 320, 0.8) })));
  const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
  if (!r.ok) throw new Error("업로드 실패");
  const j = (await r.json()) as { files: { url: string; thumbUrl: string }[] };
  return j.files;
}

export function thumbOf(url: string) {
  return url.replace(/\.(jpg|jpeg|png|webp)$/i, ".thumb.$1");
}
