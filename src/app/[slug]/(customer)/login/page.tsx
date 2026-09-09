import { getStoreBySlug } from "@/lib/store";
import { TopBar, Sticker } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function CustomerLoginPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const { next } = await searchParams;
  const store = await getStoreBySlug(slug);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TopBar title="시작하기" back={`/${slug}`} />
      <div className="flex flex-col items-center px-6 pt-8 text-center">
        <Sticker k="p7" size={110} />
        <div className="mt-2 font-serif text-[21px] font-bold text-ink">초대받은 분만 들어와요</div>
        <p className="mt-2 text-[12px] leading-[1.7] text-mute">
          {store.name}은 실명도 휴대폰 번호도 받지 않아요.
          <br />매장에서 받은 연결코드로 시작하면, 다음부턴 닉네임과 PIN으로 들어오실 수 있어요.
        </p>
        {store.signupCouponAmount > 0 && (
          <div className="mt-3 rounded-full bg-blush-lt px-4 py-2 text-[12px] font-bold text-brand">연결코드로 시작하면 {store.signupCouponAmount.toLocaleString("ko-KR")}원 쿠폰이 바로 들어와요</div>
        )}
      </div>
      <div className="px-6 pt-6">
        <LoginForm slug={slug} next={next} />
      </div>
      <div className="mt-auto px-6 pb-8 pt-6 text-center text-[10px] leading-[1.7] text-mute/80">
        데모 계정 — 서준 / PIN 1234 · 연결코드 데모 A3K9
      </div>
    </div>
  );
}
