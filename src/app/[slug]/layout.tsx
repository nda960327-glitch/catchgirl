import type { Metadata } from "next";
import { getStoreBySlug } from "@/lib/store";
import { THEMES, themeOf, themeStyle } from "@/lib/themes";
import { isPlatform } from "@/lib/platform";
import { Suspended } from "@/components/suspended";
import { StoreLabelProvider } from "@/components/store-label";

export const dynamic = "force-dynamic";

/** 매장 화면의 제목은 매장 이름이고, 초대받은 손님만 들어오는 곳이라 검색에는 안 나오게 한다 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  return {
    title: { absolute: store.tagline ? `${store.name} — ${store.tagline}` : store.name },
    description: store.tagline || `${store.name} 예약`,
    robots: { index: false, follow: false },
  };
}

/** 매장 테마(화이트라벨) CSS 변수 주입 + 이용 정지 게이트 */
export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const vars = themeStyle(store.theme, store.themeColor);

  // 미납 등으로 잠긴 매장은 손님·직원·관리자 모두 안내만 본다.
  // 파는 쪽(플랫폼 세션)은 그대로 들어가 정리할 수 있어야 하므로 예외.
  if (store.isSuspended && !(await isPlatform())) {
    return <Suspended name={store.name} reason={store.suspendedReason} phone={store.contactPhone} telegram={store.contactTelegram} />;
  }
  // 변수를 div 에만 두면 body 는 :root 기본값(로즈)을 읽어 화면이 짧을 때 가장자리에
  // 밝은 색이 비친다. 이 매장 안에서는 :root 자체를 덮어 html·body 까지 따르게 한다.
  const css = `html:root{${Object.entries(vars)
    .map(([k, v]) => `${k === "colorScheme" ? "color-scheme" : k}:${v}`)
    .join(";")}}`;
  // 어두운 테마에서는 고양이 캐릭터가 묻혀 보이지 않는다. 그 자리에 매장 로고를 두므로
  // 로고 주소와 어두운지 여부를 여기서 내려 주고, Sticker 가 CSS 로 갈아탄다.
  const dark = THEMES[themeOf(store.theme)].dark;
  const logo = store.logoUrl ?? "";
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className="min-h-dvh bg-frame text-ink"
        data-dark={dark ? "" : undefined}
        data-nologo={dark && !logo ? "" : undefined}
        style={logo ? ({ "--store-logo": `url("${logo}")` } as React.CSSProperties) : undefined}
      >
        <StoreLabelProvider staffLabel={store.staffLabel}>{children}</StoreLabelProvider>
      </div>
    </>
  );
}
