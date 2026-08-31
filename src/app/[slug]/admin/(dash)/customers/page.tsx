import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { computeCustomerStats } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { Card, Chip, Eyebrow, GradeChip } from "@/components/ui";

type SP = { sort?: string; filter?: string; q?: string };

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  const customers = await prisma.customer.findMany({
    where: { storeId: store.id, ...(sp.q ? { nickname: { contains: sp.q } } : {}) },
    include: { reservations: { select: { status: true, startTime: true, staffId: true, staff: { select: { nickname: true } } } } },
  });
  let rows = customers.map((c) => ({ c, s: computeCustomerStats(c.reservations) }));
  const filter = sp.filter ?? "";
  if (filter === "dormant") rows = rows.filter((r) => r.s.dormant);
  if (filter === "noshow") rows = rows.filter((r) => r.s.noshowCount > 0);
  if (filter === "blacklist") rows = rows.filter((r) => r.c.isBlacklisted);
  if (filter === "vip") rows = rows.filter((r) => r.s.grade !== "신규");
  const sort = sp.sort ?? "revisit";
  rows.sort((a, b) => {
    if (sort === "revisit") return b.s.revisitCount - a.s.revisitCount || b.s.visitCount - a.s.visitCount;
    if (sort === "noshow") return b.s.noshowCount - a.s.noshowCount;
    if (sort === "recent") return (b.s.lastVisitAt?.getTime() ?? 0) - (a.s.lastVisitAt?.getTime() ?? 0);
    if (sort === "cancel") return b.s.cancelCount - a.s.cancelCount;
    return a.c.nickname.localeCompare(b.c.nickname);
  });

  const qs = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    Object.entries({ sort, filter, q: sp.q, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };
  const SORTS = [["revisit", "재방문 많은 순"], ["noshow", "노쇼 많은 순"], ["recent", "최근 방문 순"], ["cancel", "취소 많은 순"], ["name", "이름순"]];
  const FILTERS = [["", "전체"], ["vip", "단골·VIP"], ["dormant", "휴면 (3개월 미방문)"], ["noshow", "노쇼 이력"], ["blacklist", "블랙리스트"]];

  return (
    <div className="animate-fade">
      <Eyebrow>Customers</Eyebrow>
      <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">고객 관리</h1>
      <Card className="mt-5 flex flex-wrap items-center gap-2 p-3">
        <span className="px-1 text-[11px] font-semibold text-mute">정렬</span>
        {SORTS.map(([k, l]) => (
          <Link key={k} href={qs({ sort: k })} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold", sort === k ? "bg-brand text-white" : "bg-[#F4EDEE] text-mute")}>{l}</Link>
        ))}
        <span className="ml-3 px-1 text-[11px] font-semibold text-mute">필터</span>
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={qs({ filter: k })} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold", filter === k ? "bg-ink text-white" : "bg-[#F4EDEE] text-mute")}>{l}</Link>
        ))}
        <form className="ml-auto" action="">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="filter" value={filter} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="닉네임 검색" className="h-9 w-[160px] rounded-xl border border-line px-3 text-[12px] outline-none focus:border-brand" />
        </form>
      </Card>

      <Card className="mt-3 overflow-hidden">
        <div className="hidden grid-cols-[1.3fr_90px_90px_110px_80px_80px_90px_1fr] gap-2 border-b border-line bg-[#FAF6F7] px-4 py-2.5 text-[11px] font-semibold text-mute md:grid">
          <span>고객</span><span>등급</span><span>방문 횟수</span><span>최근 방문일</span><span>취소</span><span>노쇼</span><span>재방문 수</span><span>주 지정 캐치걸</span>
        </div>
        {rows.length === 0 && <div className="py-10 text-center text-[12px] text-mute">조건에 맞는 고객이 없어요</div>}
        {rows.map(({ c, s }) => (
          <Link key={c.id} href={`/${slug}/admin/customers/${c.id}`} className="grid grid-cols-2 gap-2 border-b border-line px-4 py-3 text-[12px] transition-colors hover:bg-blush-lt/30 md:grid-cols-[1.3fr_90px_90px_110px_80px_80px_90px_1fr] md:items-center">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-ink">{c.nickname}</span>
                {c.isBlacklisted && <Chip tone="red">블랙리스트</Chip>}
                {s.noshowCount >= 3 && !c.isBlacklisted && <Chip tone="red">노쇼 경고</Chip>}
                {s.dormant && s.visitCount > 0 && <Chip tone="mute">휴면</Chip>}
              </div>
              <div className="text-[10px] text-mute">{c.phone}{c.name ? ` · ${c.name}` : ""}{c.birthday ? ` · ${c.birthday.slice(2).replace(/-/g, ".")}` : ""}</div>
            </div>
            <div><GradeChip grade={s.grade} /></div>
            <div className="text-ink"><span className="md:hidden text-mute">방문 </span>{s.visitCount}회</div>
            <div className="text-mute">{s.lastVisitAt ? format(s.lastVisitAt, "yyyy.MM.dd") : "—"}</div>
            <div className="text-mute"><span className="md:hidden">취소 </span>{s.cancelCount}</div>
            <div className={cn(s.noshowCount > 0 ? "font-bold text-[#C0392B]" : "text-mute")}><span className="md:hidden">노쇼 </span>{s.noshowCount}</div>
            <div className="font-semibold text-brand"><span className="md:hidden text-mute">재방문 </span>{s.revisitCount}</div>
            <div className="text-ink">{s.mainStaffName ?? "—"}</div>
          </Link>
        ))}
      </Card>
      <div className="mt-2 px-1 text-[10px] text-mute">재방문 수 = 방문완료 건수 − 1 · 등급: 1~4회 신규 / 5~9회 단골 / 10회↑ VIP · 노쇼 3회 이상 자동 경고</div>
    </div>
  );
}
