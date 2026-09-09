import Link from "next/link";
import { redirect } from "next/navigation";
import { getAgent } from "@/lib/agent-auth";
import { AgentLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AgentLoginPage() {
  if (await getAgent()) redirect("/agent");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-frame p-6">
      <div className="w-full max-w-sm rounded-[28px] bg-card p-7 shadow-pop">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Agent</div>
        <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">담당직원 로그인</h1>
        <p className="mt-1 text-[12px] leading-[1.8] text-mute">내가 데려온 매장과 커미션 정산을 보는 곳이에요.</p>
        <AgentLoginForm />
        <div className="mt-4 text-center text-[11px] text-mute">처음이세요? <Link href="/agent/signup" className="font-bold text-brand underline-offset-2 hover:underline">담당직원 가입</Link> — 코드가 바로 나와요<br /><Link href="/agent/join" className="underline-offset-2 hover:underline">이 일이 뭔지, 얼마 버는지 먼저 보기 ›</Link></div>
      </div>
    </div>
  );
}
