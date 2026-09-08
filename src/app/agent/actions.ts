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

export async function logoutAgent() {
  await clearAgentSession();
  redirect("/agent/login");
}
