"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { clearAgentSession, setAgentSession } from "@/lib/agent-auth";

export type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function loginAgent(form: FormData): Promise<R> {
  const loginId = String(form.get("loginId") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const agent = await prisma.agent.findUnique({ where: { loginId } });
  if (!agent || !agent.isActive || !(await bcrypt.compare(password, agent.passwordHash))) {
    return { ok: false, error: "아이디나 비밀번호가 맞지 않아요." };
  }
  await setAgentSession(agent.id);
  redirect("/agent");
}

/** 헷갈리는 글자(0/O, 1/I)는 빼고 두 글자 + 세 숫자 — 명함에 손으로 적어도 안 틀린다 */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
async function freshAgentCode() {
  for (let i = 0; i < 20; i++) {
    const code = LETTERS[Math.floor(Math.random() * LETTERS.length)] + LETTERS[Math.floor(Math.random() * LETTERS.length)] + String(Math.floor(Math.random() * 900) + 100);
    if (!(await prisma.agent.findUnique({ where: { code } }))) return code;
  }
  return null;
}

/**
 * 담당직원 스스로 가입. 코드는 자동으로 나오고 바로 활동 상태다 —
 * 매장이 실제로 그 코드로 가입해 첫 출금까지 가야 돈이 나가므로 미리 막을 이유가 없다.
 * 이상하면 콘솔에서 끄면 된다.
 */
export async function signupAgent(input: { name: string; contact: string; loginId: string; password: string }): Promise<R> {
  const name = input.name.trim().slice(0, 20);
  const contact = input.contact.trim().slice(0, 60);
  const loginId = input.loginId.trim().toLowerCase();
  if (!name) return { ok: false, error: "이름을 적어 주세요." };
  if (!contact) return { ok: false, error: "연락처를 적어 주세요. 정산 때 필요해요." };
  if (!/^[a-z0-9_.-]{3,30}$/.test(loginId)) return { ok: false, error: "아이디는 3~30자 영문·숫자로 해 주세요." };
  if (input.password.length < 6) return { ok: false, error: "비밀번호는 6자 이상이에요." };
  if (await prisma.agent.findUnique({ where: { loginId } })) return { ok: false, error: "이미 쓰는 아이디예요." };
  const code = await freshAgentCode();
  if (!code) return { ok: false, error: "코드 발급에 실패했어요. 다시 시도해 주세요." };
  const agent = await prisma.agent.create({ data: { name, code, contact, loginId, passwordHash: await bcrypt.hash(input.password, 10) } });
  await prisma.platformLog.create({ data: { action: "AGENT_SIGNUP", detail: `${agent.name} (${agent.code}) · ${contact}` } }).catch(() => {});
  await setAgentSession(agent.id);
  redirect("/agent?welcome=1");
}

export async function logoutAgent() {
  await clearAgentSession();
  redirect("/agent/login");
}
