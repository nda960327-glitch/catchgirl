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
          {store.name}에서는 실명이 필요 없어요.
          <br />휴대폰 번호로 예약 확인·알림을 보내드려요. 나머지 정보는 적어주시면 더 잘 챙겨드릴 수 있어요.
        </p>
      </div>
      <div className="px-6 pt-6">
        <LoginForm slug={slug} next={next} />
      </div>
      <div className="mt-auto px-6 pb-8 pt-6 text-center text-[10px] leading-[1.7] text-mute/80">
        데모 계정 — 유나 / 010-1111-0001 (단골) · 제이 / 010-2222-0002
      </div>
    </div>
  );
}
