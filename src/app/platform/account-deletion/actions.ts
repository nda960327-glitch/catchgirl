"use server";

import { prisma } from "@/lib/db";
import { deleteCustomerAccount, isProtectedDemo, PROTECTED_MESSAGE, verifyPin } from "@/lib/account";

export type WebDeletionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * 매장 주소를 어떻게 적든 매장 주소(slug)만 뽑는다.
 *   secret-garden · secret-garden.catchgirl.kr · https://www.catchgirl.kr/secret-garden/me
 */
function slugFrom(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  if (/^[a-z0-9-]+$/.test(s)) return s;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    const host = u.hostname;
    // 운영 도메인은 늘 받고, 환경변수로 다른 루트를 쓰는 환경이면 그것도 받는다
    const roots = Array.from(new Set(["catchgirl.kr", (process.env.ROOT_DOMAIN || "").toLowerCase()].filter(Boolean)));
    for (const root of roots) {
      if (host === root || host === `www.${root}`) return u.pathname.split("/").filter(Boolean)[0] ?? "";
      if (host.endsWith(`.${root}`)) return host.slice(0, -(root.length + 1));
    }
  } catch {
    // 주소 모양이 아니면 아래에서 빈 값으로 떨어진다
  }
  return "";
}

/**
 * 앱 없이 웹에서 계정 지우기 — 스토어 데이터 보안 양식에 적는 삭제 요청 주소.
 * 앱을 지웠거나 휴대폰을 바꾼 손님도 매장 주소·닉네임·PIN 만 알면 지울 수 있다.
 * 틀렸을 때 어느 칸이 틀렸는지는 말하지 않는다 — 남의 닉네임이 있는지 캐보지 못하게.
 */
export async function deleteAccountFromWeb(form: FormData): Promise<WebDeletionResult> {
  // 사람이 못 보는 칸이 채워져 있으면 봇이다. 성공한 척하고 아무것도 안 한다.
  if (String(form.get("website") ?? "")) return { ok: true, message: "처리했어요." };
  if (form.get("agree") !== "on") return { ok: false, error: "지워지는 내용을 확인했다고 체크해 주세요." };

  const slug = slugFrom(String(form.get("store") ?? ""));
  const nickname = String(form.get("nickname") ?? "").trim();
  const pin = String(form.get("pin") ?? "");
  if (!slug || !nickname || !/^\d{4,6}$/.test(pin)) return { ok: false, error: "매장 주소, 닉네임, PIN을 모두 적어 주세요." };

  const fail: WebDeletionResult = { ok: false, error: "매장 주소, 닉네임 또는 PIN이 맞지 않아요." };
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return fail;
  const customer = await prisma.customer.findUnique({ where: { storeId_nickname: { storeId: store.id, nickname } } });
  if (!customer || customer.deletedAt || !customer.passwordHash) return fail;
  if (isProtectedDemo(store, customer)) return { ok: false, error: PROTECTED_MESSAGE };

  const v = await verifyPin(store, customer, pin);
  if (!v.ok) return v.error.includes("잠겼") ? v : fail;

  await deleteCustomerAccount(store, customer, "WEB");
  return { ok: true, message: `${store.name}의 '${nickname}' 계정을 삭제했어요. 그동안 이용해 주셔서 감사해요.` };
}
