import Link from "next/link";
import { redirect } from "next/navigation";
import { getAgent } from "@/lib/agent-auth";
import { COMMISSION } from "@/lib/plans";
import { won } from "@/lib/utils";
import { AgentSignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

/** 담당직원(영업) 스스로 가입 — 코드는 자동으로 나온다. 매장이 그 코드로 가입하면 커미션이 붙는다. */
export default async function AgentSignupPage() {
  if (await getAgent()) redirect("/agent");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-frame p-6">
      <div className="w-full max-w-md rounded-[28px] bg-card p-7 shadow-pop">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Agent</div>
        <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">담당직원 가입</h1>
        <p className="mt-1 text-[12px] leading-[1.8] text-mute">
          매장을 소개하고 커미션을 받는 분이에요. 가입하면 <b className="text-ink">담당 코드</b>가 바로 나와요. 매장이 가입 신청서에 그 코드를 적거나, 내 소개 링크로 신청하면 내 매장이 돼요.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl bg-well p-2.5 text-center"><div className="text-mute">Pro 2년 약정</div><div className="font-bold text-brand">{won(COMMISSION.PRO)}</div></div>
          <div className="rounded-xl bg-well p-2.5 text-center"><div className="text-mute">Max 2년 약정</div><div className="font-bold text-brand">{won(COMMISSION.MAX)}</div></div>
        </div>
        <div className="mt-1 text-[10px] text-mute">매장 세팅(반나절)까지 해 주는 조건이고 그 몫이 포함된 금액이에요. 첫 출금이 성공한 달에 확정되고, 운영사가 그달 정산 때 지급해요. 무약정 매장은 커미션이 없어요.</div>
        <AgentSignupForm />
        <div className="mt-4 text-center text-[11px] text-mute">이미 계정이 있으면 <Link href="/agent/login" className="font-bold text-brand underline-offset-2 hover:underline">로그인</Link></div>
      </div>
    </div>
  );
}
