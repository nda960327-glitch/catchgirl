/**
 * 브라우저가 줄여서 보낸 이미지(data URL)를 DB 에 넣기 전에 푼다.
 * 업로드 API 와 가입 신청(등록증 사본)이 같이 쓴다.
 */

/** 브라우저가 줄여서 보낸 뒤의 상한. 이보다 크면 줄이기가 안 된 것이므로 받지 않는다. */
export const MAX_FULL = 2_500_000;
export const MAX_THUMB = 400_000;

export function decodeDataUrl(dataUrl: string, max: number) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0 || buf.length > max) return null;
  return { mime: `image/${m[1]}`, buf };
}
