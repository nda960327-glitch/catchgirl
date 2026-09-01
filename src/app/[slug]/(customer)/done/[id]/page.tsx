import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { getCustomer } from "@/lib/auth";
import { fmtDateKo, fmtTimeKo } from "@/lib/utils";
import { Sticker } from "@/components/ui";
import { DoneActions } from "./done-actions";

export default async function DonePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  const me = await getCustomer(store.id);
  const r = await prisma.reservation.findUnique({ where: { id }, include: { staff: true, customer: true, options: true } });
  if (!r || r.storeId !== store.id || (me && r.customerId !== me.id)) notFound();

  const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
  const rows: [string, string][] = [
    ["일시", `${fmtDateKo(r.startTime)} ${fmtTimeKo(r.startTime)}`],
    ["이용 시간", `${r.hours}시간 (~ ${fmtTimeKo(r.endTime)})`],
    ["캐치걸", r.staff.nickname],
    ["닉네임", r.customer.nickname],
    ...(r.options.length ? ([["옵션", r.options.map((o) => o.name).join(", ")]] as [string, string][]) : []),
    ["결제 예정", won(r.totalPrice)],
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-7 py-10 text-center" style={{ background: "radial-gradient(110% 70% at 50% 20%, var(--blush-lt), #FCF7F6 70%)" }}>
      <div className="animate-pop"><Sticker k="p5" size={140} /></div>
      <div className="mt-2 animate-fade font-serif text-[23px] font-bold text-ink" style={{ animationDelay: ".2s" }}>
        {r.status === "CANCELLED" ? "예약이 취소됐어요" : "자리를 비워둘게요"}
      </div>
      <div className="mt-1 text-[12px] text-mute">{r.status === "CANCELLED" ? "다음에 또 만나요" : `${store.name}에서 기다릴게요`}</div>

      <div className="mt-[22px] w-full max-w-[300px] rounded-[22px] border border-line bg-white px-[22px] py-5 shadow-card">
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex justify-between py-[9px] ${i ? "border-t border-line" : ""}`}>
            <span className="text-[12px] font-medium text-mute">{k}</span>
            <span className="text-[13px] font-semibold text-ink">{v}</span>
          </div>
        ))}
        <div className="mt-3.5 border-t border-dashed border-line pt-3.5 text-[10px] font-semibold tracking-[.18em] text-gold">NO. {r.code}</div>
      </div>

      <DoneActions
        slug={slug}
        reservationId={r.id}
        status={r.status}
        ics={{ title: `${store.name} · ${r.staff.nickname} 캐치걸`, start: r.startTime.toISOString(), end: r.endTime.toISOString(), location: store.name, code: r.code }}
      />
      <Link href={`/${slug}`} className="mt-4 text-[11px] text-mute underline-offset-2 hover:underline">홈으로</Link>
    </div>
  );
}
