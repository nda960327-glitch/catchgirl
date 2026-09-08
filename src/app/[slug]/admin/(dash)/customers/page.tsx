import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { customerStatsBulk } from "@/lib/metrics";
import { cn, wonShort } from "@/lib/utils";
import { Card, Chip, Eyebrow, GradeChip } from "@/components/ui";
import { InviteButton } from "./invite-button";

type SP = { sort?: string; filter?: string; q?: string; page?: string };

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const store = await getStoreBySlug(slug);
  // 손님마다 예약을 통째로 끌어오면 이력이 긴 매장에서 화면 하나에 수만 행을 읽는다.
  // 숫자는 DB 가 세고, 여기서는 손님당 통계 한 줄만 받는다.
  const [customers, stats] = await Promise.all([
    prisma.customer.findMany({
      where: {
        storeId: store.id,
        // 닉네임뿐 아니라 매장이 적어 둔 연락처로도 찾을 수 있게
        ...(sp.q ? { OR: [{ nickname: { contains: sp.q } }, { adminContact: { contains: sp.q } }] } : {}),
      },
    }),
    customerStatsBulk(store.id),
  ]);
  const NONE = { visitCount: 0, revisitCount: 0, cancelCount: 0, noshowCount: 0, lastVisitAt: null, grade: "신규" as const, mainStaffId: null, mainStaffName: null, dormant: true, spent: 0 };
  // 누적 지출 = 취소·노쇼를 뺀 결제 금액 합계 (customerStatsBulk 가 같은 규칙으로 더한다)
  let rows = customers.map((c) => {
    const s = stats.get(c.id) ?? NONE;
    return { c, s, spent: s.spent };
  });
  const filter = sp.filter ?? "";
  if (filter === "dormant") rows = rows.filter((r) => r.s.dormant);
  if (filter === "noshow") rows = rows.filter((r) => r.s.noshowCount > 0);
  if (filter === "blacklist") rows = rows.filter((r) => r.c.isBlacklisted);
  if (filter === "vip") rows = rows.filter((r) => r.s.grade !== "신규");
  const sort = sp.sort ?? "spent";
  rows.sort((a, b) => {
    if (sort === "spent") return b.spent - a.spent || b.s.visitCount - a.s.visitCount;
    if (sort === "revisit") return b.s.revisitCount - a.s.revisitCount || b.s.visitCount - a.s.visitCount;
    if (sort === "noshow") return b.s.noshowCount - a.s.noshowCount;
    if (sort === "recent") return (b.s.lastVisitAt?.getTime() ?? 0) - (a.s.lastVisitAt?.getTime() ?? 0);
    if (sort === "cancel") return b.s.cancelCount - a.s.cancelCount;
    return a.c.nickname.localeCompare(b.c.nickname);
  });

  // 고객이 100명을 넘어가면 한 화면에 다 쏟지 않고 끊어 보여준다
  const PER_PAGE = 30;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const totalRows = rows.length;
  const pageRows = rows.slice((Math.min(page, pageCount) - 1) * PER_PAGE, Math.min(page, pageCount) * PER_PAGE);

  const qs = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    Object.entries({ sort, filter, q: sp.q, ...o }).forEach(([k, v]) => v && p.set(k, v));
    return `?${p.toString()}`;
  };
  const SORTS = [["spent", "많이 쓴 순"], ["revisit", "재방문 많은 순"], ["noshow", "노쇼 많은 순"], ["recent", "최근 방문 순"], ["cancel", "취소 많은 순"], ["name", "이름순"]];
  const FILTERS = [["", "전체"], ["vip", "단골·VIP"], ["dormant", "휴면 (3개월 미방문)"], ["noshow", "노쇼 이력"], ["blacklist", "블랙리스트"]];

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Customers</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">고객 관리</h1>
          <div className="mt-0.5 text-[11px] text-mute">새로 오신 분은 여기서 등록하시면 연결코드가 나와요. 손님이 그 코드로 앱을 시작해요.</div>
        </div>
        <InviteButton slug={slug} />
      </div>
      <Card className="mt-5 flex flex-wrap items-center gap-2 p-3">
        <span className="px-1 text-[11px] font-semibold text-mute">정렬</span>
        {SORTS.map(([k, l]) => (
          <Link key={k} href={qs({ sort: k })} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold", sort === k ? "bg-brand text-white" : "bg-well-2 text-mute")}>{l}</Link>
        ))}
        <span className="ml-3 px-1 text-[11px] font-semibold text-mute">필터</span>
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={qs({ filter: k })} className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold", filter === k ? "bg-ink text-on-ink" : "bg-well-2 text-mute")}>{l}</Link>
        ))}
        <form className="ml-auto" action="">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="filter" value={filter} />
          <input name="q" defaultValue={sp.q ?? ""} placeholder="닉네임·연락처 검색" className="h-9 w-[160px] rounded-xl border border-line px-3 text-[12px] outline-none focus:border-brand" />
        </form>
      </Card>

      <Card className="mt-3 overflow-hidden">
        <div className="hidden grid-cols-[1.3fr_130px_90px_100px_90px_110px_80px_80px_90px_1fr] gap-2 border-b border-line bg-well px-4 py-2.5 text-[11px] font-semibold text-mute md:grid">
          <span>고객</span><span>연락처·텔레</span><span>등급</span><span className="text-right">누적 지출</span><span>방문 횟수</span><span>최근 방문일</span><span>취소</span><span>노쇼</span><span>재방문 수</span><span>주 지정 캐치걸</span>
        </div>
        {rows.length === 0 && <div className="py-10 text-center text-[12px] text-mute">조건에 맞는 고객이 없어요</div>}
        {pageRows.map(({ c, s, spent }) => (
          <Link key={c.id} href={`/${slug}/admin/customers/${c.id}`} className="grid grid-cols-2 gap-2 border-b border-line px-4 py-3 text-[12px] transition-colors hover:bg-blush-lt/30 md:grid-cols-[1.3fr_130px_90px_100px_90px_110px_80px_80px_90px_1fr] md:items-center">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-ink">{c.nickname}</span>
                {/* 아직 앱을 시작 안 한 손님 — 이 코드를 알려드리면 된다 */}
                {!c.passwordHash && c.inviteCode && <Chip>미시작 · 코드 {c.inviteCode}</Chip>}
                {c.isBlacklisted && <Chip tone="red">블랙리스트</Chip>}
                {s.noshowCount >= 3 && !c.isBlacklisted && <Chip tone="red">노쇼 경고</Chip>}
                {s.dormant && s.visitCount > 0 && <Chip tone="mute">휴면</Chip>}
              </div>
              <div className="truncate text-[10px] text-mute" title={c.adminMemo}>{c.adminMemo || "메모 없음"}</div>
            </div>
            {/* 매장이 적어 둔 연락처 — 고객 화면엔 없는 칸이다 */}
            <div className="truncate" title={c.adminContact}>
              <span className="text-mute md:hidden">연락처 </span>
              {c.adminContact
                ? <span className="font-semibold text-ink">{c.adminContact}</span>
                : <span className="text-mute/60">—</span>}
            </div>
            <div><GradeChip grade={s.grade} /></div>
            <div className="font-bold text-brand md:text-right"><span className="font-normal text-mute md:hidden">지출 </span>{wonShort(spent)}</div>
            <div className="text-ink"><span className="md:hidden text-mute">방문 </span>{s.visitCount}회</div>
            <div className="text-mute">{s.lastVisitAt ? format(s.lastVisitAt, "yyyy.MM.dd") : "—"}</div>
            <div className="text-mute"><span className="md:hidden">취소 </span>{s.cancelCount}</div>
            <div className={cn(s.noshowCount > 0 ? "font-bold text-bad" : "text-mute")}><span className="md:hidden">노쇼 </span>{s.noshowCount}</div>
            <div className="font-semibold text-brand"><span className="md:hidden text-mute">재방문 </span>{s.revisitCount}</div>
            <div className="text-ink">{s.mainStaffName ?? "—"}</div>
          </Link>
        ))}
      </Card>
      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={qs({ page: n === 1 ? undefined : String(n) })}
              className={cn("min-w-[36px] rounded-xl px-2.5 py-2 text-center text-[12px] font-bold transition-colors", n === Math.min(page, pageCount) ? "bg-brand text-white" : "border border-line bg-card text-mute hover:border-brand")}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-2 text-center text-[11px] text-mute">전체 {totalRows}명 · {Math.min(page, pageCount)}/{pageCount} 페이지</div>
      <div className="mt-2 px-1 text-[10px] text-mute">재방문 수 = 방문완료 건수 − 1 · 등급: 1~4회 신규 / 5~9회 단골 / 10회↑ VIP · 노쇼 3회 이상 자동 경고</div>
    </div>
  );
}
