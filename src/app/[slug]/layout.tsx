import { getStoreBySlug } from "@/lib/store";
import { themeVars } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 매장 테마(화이트라벨) CSS 변수 주입 */
export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  return (
    <div style={themeVars(store.themeColor) as React.CSSProperties} className="min-h-dvh">
      {children}
    </div>
  );
}
