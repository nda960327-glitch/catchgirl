import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Root() {
  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  if (!store) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-8 text-center text-sm text-mute">
        매장 데이터가 없어요. <code className="mx-1 rounded bg-white px-1">npm run db:seed</code> 를 실행해 주세요.
      </main>
    );
  }
  redirect(`/${store.slug}`);
}
