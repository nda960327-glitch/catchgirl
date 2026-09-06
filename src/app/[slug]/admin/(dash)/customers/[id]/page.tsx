import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { computeCustomerStats } from "@/lib/metrics";
import { parseJsonArray } from "@/lib/utils";
import { Avatar, Card, Chip, Eyebrow, GradeChip, StatusChip, Stars } from "@/components/ui";
import { CustomerAccount, CustomerInfoForm, CustomerNotes } from "./memo-form";
import { Coupons } from "./coupons";

export default async function CustomerDetail({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      reservations: { orderBy: { startTime: "desc" }, include: { staff: true, review: true } },
      favorites: { include: { staff: true } },
      notes: { orderBy: { createdAt: "desc" } },
      coupons: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!c || c.storeId !== store.id) notFound();
  const sources = await prisma.referralSource.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" } });
  const s = computeCustomerStats(c.reservations);
  const perStaff = new Map<string, { name: string; photo: string | null; n: number }>();
  for (const r of c.reservations.filter((r) => r.status !== "CANCELLED")) {
    const v = perStaff.get(r.staffId) ?? { name: r.staff.nickname, photo: parseJsonArray(r.staff.photos)[0] ?? null, n: 0 };
    v.n += 1;
    perStaff.set(r.staffId, v);
  }
  const staffRank = [...perStaff.values()].sort((a, b) => b.n - a.n);

  return (
    <div className="animate-fade">
      <Link href={`/${slug}/admin/customers`} className="text-[12px] text-mute">‹ 고객 목록</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Avatar name={c.nickname} size={52} rounded={17} />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-[22px] font-bold text-ink">{c.nickname}</h1>
            <GradeChip grade={s.grade} />
            {c.isBlacklisted && <Chip tone="red">블랙리스트</Chip>}
            {s.noshowCount >= 3 && <Chip tone="red">노쇼 {s.noshowCount}회 경고</Chip>}
          </div>
          <div className="text-[11px] text-mute">
            가입 {format(c.createdAt, "yyyy.MM.dd")}
            {c.adminContact && <> · <span className="font-semibold text-ink">{c.adminContact}</span></>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["방문 횟수", `${s.visitCount}회`], ["재방문 수", `${s.revisitCount}회`], ["취소", `${s.cancelCount}회`], ["노쇼", `${s.noshowCount}회`], ["최근 방문", s.lastVisitAt ? format(s.lastVisitAt, "MM.dd") : "—"]].map(([k, v]) => (
          <Card key={k} className="p-3.5">
            <div className="text-[11px] text-mute">{k}</div>
            <div className="mt-1 font-serif text-[20px] font-bold text-ink">{v}</div>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <Eyebrow>Coupons</Eyebrow>
            <div className="mt-1 text-[14px] font-bold text-ink">쿠폰</div>
            <div className="text-[11px] text-mute">
              이 손님에게만 주는 할인이에요. 예약할 때 손님이 직접 골라 쓰고, 한 번 쓰면 사라져요.
              등급 혜택·기간 할인 위에 한 장 더 얹혀요.
            </div>
            <Coupons
              slug={slug}
              customerId={c.id}
              coupons={c.coupons.map((cp) => ({
                id: cp.id,
                name: cp.name,
                amount: cp.amount,
                memo: cp.memo,
                expiresAt: cp.expiresAt ? format(cp.expiresAt, "yyyy.MM.dd") : null,
                usedAt: cp.usedAt ? format(cp.usedAt, "yyyy.MM.dd") : null,
                expired: !!cp.expiresAt && !cp.usedAt && cp.expiresAt < new Date(),
              }))}
            />
          </Card>
          <Card className="p-5">
            <Eyebrow>Notes</Eyebrow>
            <div className="mt-1 text-[14px] font-bold text-ink">방문 메모</div>
            <div className="text-[11px] text-mute">연락처를 남기지 않는 대신, 이 손님을 기억할 내용을 여기에 쌓아요. 고객에겐 보이지 않아요.</div>
            <CustomerNotes
              slug={slug}
              customerId={c.id}
              notes={c.notes.map((n) => ({ id: n.id, authorName: n.authorName, content: n.content, createdAt: format(n.createdAt, "yyyy.MM.dd HH:mm") }))}
            />
          </Card>
          <Card className="p-5">
            <Eyebrow>History</Eyebrow>
            <div className="mt-1 text-[14px] font-bold text-ink">전체 예약 히스토리</div>
            <div className="mt-3 divide-y divide-line">
              {c.reservations.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5 text-[12px]">
                  <Avatar src={parseJsonArray(r.staff.photos)[0]} name={r.staff.nickname} size={30} rounded={10} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{format(r.startTime, "yyyy.MM.dd (EEE) HH:mm", { locale: ko })} · {r.staff.nickname}</div>
                    <div className="truncate text-[10px] text-mute">NO. {r.code}{r.requestNote ? ` · ${r.requestNote}` : ""}{r.createdBy === "ADMIN" ? " · 관리자 등록" : ""}</div>
                    {r.review && <div className="mt-0.5 flex items-center gap-1 text-[10px] text-mute"><Stars value={r.review.rating} size={9} /> {r.review.content.slice(0, 40)}</div>}
                  </div>
                  <StatusChip status={r.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <Eyebrow>Preference</Eyebrow>
            <div className="mt-1 text-[14px] font-bold text-ink">주로 지정한 캐치걸</div>
            <div className="mt-3 flex flex-col gap-2">
              {staffRank.length === 0 && <div className="text-[12px] text-mute">아직 예약 이력이 없어요</div>}
              {staffRank.map((x, i) => (
                <div key={x.name} className="flex items-center gap-2.5">
                  <Avatar src={x.photo} name={x.name} size={32} rounded={11} />
                  <span className="text-[13px] font-bold text-ink">{x.name}</span>
                  {i === 0 && <Chip>주 지정</Chip>}
                  <span className="ml-auto text-[12px] text-mute">{x.n}회</span>
                </div>
              ))}
            </div>
            {c.favorites.length > 0 && <div className="mt-3 text-[11px] text-mute">찜: {c.favorites.map((f) => f.staff.nickname).join(", ")}</div>}
          </Card>
          <Card className="p-5">
            <Eyebrow>Customer Info</Eyebrow>
            <div className="mt-1 text-[14px] font-bold text-ink">고객 정보</div>
            <CustomerInfoForm slug={slug} customerId={c.id} init={{ nickname: c.nickname, adminContact: c.adminContact, adminMemo: c.adminMemo, isBlacklisted: c.isBlacklisted, sourceId: c.sourceId ?? "" }} sources={sources.map((s) => ({ id: s.id, name: s.name, tier: s.tier }))} />
          </Card>
          <Card className="p-5">
            <Eyebrow>Account</Eyebrow>
            <div className="mt-1 text-[14px] font-bold text-ink">계정 연결</div>
            <CustomerAccount slug={slug} customerId={c.id} inviteCode={c.inviteCode} hasPin={!!c.passwordHash} />
          </Card>
        </div>
      </div>
    </div>
  );
}
