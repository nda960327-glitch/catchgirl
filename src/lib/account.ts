import "server-only";
import bcrypt from "bcryptjs";
import type { Customer, Store } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logPlatform } from "@/lib/platform-data";

/**
 * 손님 계정 — PIN 확인, 잠금, 삭제.
 *
 * 스토어 정책상 앱에서 만든 계정은 앱 안과 웹에서 직접 지울 수 있어야 한다.
 * 지난 예약은 매장의 매출·정산 기록이라 남기되 이름을 지우고, 손님이 쓴 글과
 * 손님을 알아볼 수 있는 값(닉네임·PIN·매장 메모·연락처)은 바로 지운다.
 */

export const PIN_MAX_FAILS = 5;
export const PIN_LOCK_MINUTES = 30;

/** 공개 체험 계정 — 시연 안내(/demo)와 스토어 심사 안내에 PIN 까지 적어 둔 계정 */
const PROTECTED_DEMO: Record<string, string[]> = { "secret-garden": ["길동", "서준"] };

export function isProtectedDemo(store: { slug: string }, customer: { nickname: string }) {
  return (PROTECTED_DEMO[store.slug] ?? []).includes(customer.nickname);
}

export const PROTECTED_MESSAGE = "체험용 샘플 계정이라 바꾸거나 삭제할 수 없어요. 연결코드로 새 계정을 만들어 시험해 보세요.";

export type PinResult = { ok: true } | { ok: false; error: string };

/**
 * PIN 확인. 연달아 틀리면 잠근다 — 네 자리 PIN 은 대입해 보면 금방 뚫린다.
 * 공개 체험 계정은 PIN 이 이미 공개라 잠그지 않는다. 누가 일부러 틀려서 시연을 막지 못하게.
 */
export async function verifyPin(store: { slug: string }, customer: Customer, pin: string): Promise<PinResult> {
  const wrong: PinResult = { ok: false, error: "닉네임 또는 PIN이 맞지 않아요." };
  if (!customer.passwordHash || customer.deletedAt) return wrong;
  const demo = isProtectedDemo(store, customer);
  if (!demo && customer.pinLockedUntil && customer.pinLockedUntil > new Date()) {
    const min = Math.max(1, Math.ceil((customer.pinLockedUntil.getTime() - Date.now()) / 60_000));
    return { ok: false, error: `PIN을 여러 번 틀려서 잠겼어요. ${min}분 뒤에 다시 시도해 주세요.` };
  }
  if (await bcrypt.compare(pin, customer.passwordHash)) {
    if (customer.pinFailCount || customer.pinLockedUntil) {
      await prisma.customer.update({ where: { id: customer.id }, data: { pinFailCount: 0, pinLockedUntil: null } });
    }
    return { ok: true };
  }
  if (demo) return wrong;
  const fails = customer.pinFailCount + 1;
  if (fails >= PIN_MAX_FAILS) {
    await prisma.customer.update({ where: { id: customer.id }, data: { pinFailCount: 0, pinLockedUntil: new Date(Date.now() + PIN_LOCK_MINUTES * 60_000) } });
    return { ok: false, error: `PIN을 ${PIN_MAX_FAILS}번 틀려서 ${PIN_LOCK_MINUTES}분 동안 잠겼어요.` };
  }
  await prisma.customer.update({ where: { id: customer.id }, data: { pinFailCount: fails } });
  return wrong;
}

/**
 * 계정 삭제.
 *  - 지운다: 후기, 댓글(달린 답글 포함), 찜, 추천, 안 쓴 쿠폰, 매장이 적은 메모, 차단 기록
 *  - 비운다: 닉네임(익명 이름으로), PIN, 연결코드, 매장이 적은 연락처·메모, 성인 확인 기록
 *  - 취소한다: 앞으로 잡힌 예약
 *  - 남긴다: 지난 예약 — 매장의 매출·정산 기록이라 이름만 지운 채로
 *  - 신고 기록은 안전 문제라 남기되, 신고한 사람·당한 사람 이름은 익명으로 바꾼다
 */
export async function deleteCustomerAccount(store: Pick<Store, "id">, customer: Pick<Customer, "id">, via: "APP" | "WEB") {
  const now = new Date();
  const anon = `탈퇴한 손님 ${customer.id.slice(-6)}`;
  await prisma.$transaction([
    prisma.reservation.updateMany({ where: { customerId: customer.id, status: "CONFIRMED", startTime: { gt: now } }, data: { status: "CANCELLED" } }),
    prisma.review.deleteMany({ where: { customerId: customer.id } }),
    prisma.comment.deleteMany({ where: { customerId: customer.id } }),
    prisma.favorite.deleteMany({ where: { customerId: customer.id } }),
    prisma.staffVote.deleteMany({ where: { customerId: customer.id } }),
    prisma.coupon.deleteMany({ where: { customerId: customer.id, usedAt: null } }),
    prisma.customerNote.deleteMany({ where: { customerId: customer.id } }),
    prisma.block.deleteMany({ where: { OR: [{ blockerType: "CUSTOMER", blockerId: customer.id }, { blockedType: "CUSTOMER", blockedId: customer.id }] } }),
    prisma.report.updateMany({ where: { reporterType: "CUSTOMER", reporterId: customer.id }, data: { reporterName: anon } }),
    prisma.report.updateMany({ where: { targetType: "CUSTOMER", targetId: customer.id }, data: { targetName: anon } }),
    prisma.customer.update({
      where: { id: customer.id },
      data: {
        nickname: anon, passwordHash: null, inviteCode: null, adminContact: "", adminMemo: "",
        isBlacklisted: false, adultConfirmedAt: null, pinFailCount: 0, pinLockedUntil: null, deletedAt: now,
      },
    }),
  ]);
  await logPlatform("ACCOUNT_DELETED", `손님 계정 삭제 · ${via === "APP" ? "앱에서" : "웹 페이지에서"}`, store.id);
}
