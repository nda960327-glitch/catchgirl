import "server-only";
import { prisma } from "./db";

/** 헷갈리는 글자(0/O, 1/I)는 빼고 4자리 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 매장 안에서 겹치지 않는 새 연결코드 */
export async function freshInviteCode(storeId: string): Promise<string | null> {
  for (let i = 0; i < 16; i++) {
    const code = Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
    const dup = await prisma.customer.findFirst({ where: { storeId, inviteCode: code }, select: { id: true } });
    if (!dup) return code;
  }
  return null;
}

/**
 * 고객에게 연결코드가 없으면 붙여 준다.
 *
 * 코드는 손님이 앱을 처음 열 때 계정을 잇는 열쇠라, 등록되는 순간부터 항상 하나씩 갖고 있어야
 * 매장이 언제든 알려줄 수 있다. 이미 가입을 마친 계정(PIN 설정됨)에는 코드가 먹히지 않으므로
 * 코드가 남아 있어도 남이 계정을 가로챌 수는 없다.
 */
export async function ensureInviteCode(storeId: string, customerId: string): Promise<string | null> {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { inviteCode: true } });
  if (!c) return null;
  if (c.inviteCode) return c.inviteCode;
  const code = await freshInviteCode(storeId);
  if (!code) return null;
  await prisma.customer.update({ where: { id: customerId }, data: { inviteCode: code } });
  return code;
}
