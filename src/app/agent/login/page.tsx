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
        <p className="mt-1 text-[12px] leading-[1.8] text-mute">내가 데려온 매장과 커미션 정산을 보는 곳이에요. 운영사가 만들어 준 아이디로 들어와요.</p>
        <AgentLoginForm />
      </div>
    </div>
  );
}
