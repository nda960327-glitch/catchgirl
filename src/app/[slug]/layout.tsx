import { getStoreBySlug } from "@/lib/store";
import { themeStyle } from "@/lib/themes";
import { isPlatform } from "@/lib/platform";
import { Suspended } from "@/components/suspended";

export const dynamic = "force-dynamic";

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
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="min-h-dvh bg-frame text-ink">{children}</div>
    </>
  );
}
