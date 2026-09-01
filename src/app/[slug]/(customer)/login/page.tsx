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
        <div className="mt-2 font-serif text-[21px] font-bold text-ink">닉네임으로 충분해요</div>
        <p className="mt-2 text-[12px] leading-[1.7] text-mute">
          {store.name}은 실명도 휴대폰 번호도 받지 않아요.
          <br />닉네임과 PIN만 있으면 예약하고, 다음에 다시 찾아올 수 있어요.
        </p>
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
