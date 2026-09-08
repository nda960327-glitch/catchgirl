"use client";

/** 원본이 이보다 크면 줄이기 전에 거른다 — 브라우저가 버거워하기 전에 */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
/** 서버가 받는 상한. 줄인 결과가 이보다 크면 화질을 더 낮춘다. */
const MAX_FULL_BYTES = 2_400_000;
const MAX_THUMB_BYTES = 380_000;

/** dataURL 의 실제 바이트 수 (base64 는 4/3 배로 부풀어 있다) */
const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

async function draw(file: File, maxPx: number) {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("이미지 파일이 아니거나 읽을 수 없는 형식이에요.");
  }
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas;
}

/**
 * 브라우저에서 줄여서 dataURL 로 만든다.
 *
 * PNG 는 투명 배경을 살리고 싶어서 먼저 PNG 로 내보내 보고, 그래도 크면
 * (사진을 PNG 로 찍은 경우) JPEG 로 바꾼다. JPEG 는 상한에 들어올 때까지
 * 화질을 한 단계씩 낮춘다 — 실패시키느니 조금 흐린 게 낫다.
 */
export async function resizeImage(file: File, maxPx: number, quality = 0.85, limit = MAX_FULL_BYTES): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error("이미지가 너무 커요. 40MB 아래로 줄여서 올려 주세요.");
  const canvas = await draw(file, maxPx);

  if (file.type === "image/png") {
    const png = canvas.toDataURL("image/png");
    if (bytesOf(png) <= limit) return png;
  }
  let q = quality;
  let out = canvas.toDataURL("image/jpeg", q);
  while (bytesOf(out) > limit && q > 0.4) {
    q -= 0.1;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

/**
 * 한 번에 한 장씩 올린다. 여러 장을 한 요청에 담으면 서버 요청 상한에 걸리고,
 * 그러면 열 장 중 한 장이 커서 전부 실패한다.
 */
export async function uploadImages(files: File[]): Promise<{ url: string; thumbUrl: string }[]> {
  const out: { url: string; thumbUrl: string }[] = [];
  for (const f of files) {
    const [full, thumb] = await Promise.all([resizeImage(f, 1280), resizeImage(f, 320, 0.8, MAX_THUMB_BYTES)]);
    const r = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: [{ full, thumb }] }),
    });
    if (!r.ok) {
      const msg = await r.json().then((j: { error?: string }) => j.error).catch(() => null);
      throw new Error(msg || (r.status === 413 ? "이미지가 너무 커요." : "업로드에 실패했어요."));
    }
    const j = (await r.json()) as { files: { url: string; thumbUrl: string }[] };
    out.push(...j.files);
  }
  return out;
}

export function thumbOf(url: string) {
  if (url.startsWith("/api/img/")) return url.includes("?") ? url : `${url}?t=1`;
  return url.replace(/\.(jpg|jpeg|png|webp)$/i, ".thumb.$1");
}
