import Link from "next/link";
import { redirect } from "next/navigation";
import { isPlatform, platformEnabled } from "@/lib/platform";
import { PlatformLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function PlatformLoginPage() {
  if (await isPlatform()) redirect("/platform");
  const enabled = platformEnabled();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-frame p-6">
      <div className="w-full max-w-sm rounded-[28px] bg-card p-7 shadow-pop">
        <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Platform</div>
        <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">매장 콘솔</h1>
        <p className="mt-1 text-[12px] leading-[1.8] text-mute">새 매장을 만들고 요금제를 맞추는 곳이에요. 앱을 파는 쪽만 들어와요.</p>
        <p className="mt-2 text-[11px] text-mute">매장을 열고 싶은 업체라면 <Link href="/signup" className="font-bold text-brand underline-offset-2 hover:underline">가입 신청</Link>, 담당직원이라면 <Link href="/agent/login" className="font-bold text-brand underline-offset-2 hover:underline">담당직원 로그인</Link>으로 가세요.</p>
        {enabled ? (
          <PlatformLoginForm />
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line px-4 py-4 text-[12px] leading-[1.8] text-mute">
            <b className="text-ink">PLATFORM_PASSWORD</b> 환경변수가 없어 콘솔이 닫혀 있어요.
            <br />Vercel 환경변수에 넣고 다시 배포하면 열려요.
          </div>
        )}
      </div>
    </div>
  );
}
