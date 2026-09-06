"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Avatar, Button, Card, Chip, Field, Input, Select, StatusChip, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, ymd } from "@/lib/utils";
import { CHANNELS, CHANNEL_LABEL, type Channel } from "@/lib/sources";
import { adminCreateReservation, adminSetReservationStatus, adminUpdateReservation } from "../../actions";

export type ResRow = {
  id: string; code: string; startTime: string; date: string; time: string; endLabel: string; hours: number; totalPrice: number; optionNames: string[];
  staffId: string; staffName: string; customerId: string; customerName: string; memo: string;
  partySize: number; requestNote: string; purposeTag: string; status: string; createdBy: string; blacklisted: boolean;
};

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const HOUR_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8];

/** 페이지가 많아도 버튼이 넘치지 않게 현재 주변만 보여준다 (0 은 말줄임표) */
function pageWindow(page: number, count: number): number[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out = new Set([1, count, page, page - 1, page + 1]);
  const list = [...out].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const withGaps: number[] = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) withGaps.push(0);
    withGaps.push(n);
  });
  return withGaps;
}
type StaffLite = { id: string; nickname: string; isActive: boolean };
type CustomerLite = { id: string; nickname: string; contact: string; visits: number };
type SourceLite = { id: string; name: string; tier: string };

export function ReservationsClient({ slug, rows, staff, customers, sources, filters, times, openNew, focusId, staffPhotos, page, pageCount, totalCount }: {
  slug: string; rows: ResRow[]; staff: StaffLite[]; customers: CustomerLite[]; sources: SourceLite[];
  filters: { date: string; staffId: string; q: string; status: string }; times: string[]; openNew: boolean; focusId?: string; staffPhotos: Record<string, string | null>;
  page: number; pageCount: number; totalCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [showNew, setShowNew] = useState(openNew);
  const [editing, setEditing] = useState<ResRow | null>(null);
  const [f, setF] = useState(filters);

  useEffect(() => setF(filters), [filters]);

  // 필터가 바뀌면 1페이지로 돌아간다
  const apply = (next: Partial<typeof f>) => {
    const v = { ...f, ...next };
    const p = new URLSearchParams({ view: "list" });
    Object.entries(v).forEach(([k, val]) => val && p.set(k, val));
    router.push(`?${p.toString()}`);
  };

  const goPage = (n: number) => {
    const p = new URLSearchParams({ view: "list" });
    Object.entries(f).forEach(([k, val]) => val && p.set(k, val));
    if (n > 1) p.set("page", String(n));
    router.push(`?${p.toString()}`, { scroll: true });
  };

  const setStatus = (id: string, status: "COMPLETED" | "NOSHOW" | "CANCELLED" | "CONFIRMED") => {
    if (status === "CANCELLED" && !confirm("이 예약을 취소할까요?")) return;
    start(async () => {
      const r = await adminSetReservationStatus(slug, id, status);
      toast(r.ok ? "상태를 변경했어요" : r.error, r.ok ? "success" : "error");
      router.refresh();
    });
  };

  return (
    <>
      {/* 필터 */}
      <Card className="mt-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="날짜">
          <Input type="date" value={f.date} onChange={(e) => apply({ date: e.target.value })} className="h-10 w-[150px] text-[12px]" />
        </Field>
        <Field label="캐치걸">
          <Select value={f.staffId} onChange={(e) => apply({ staffId: e.target.value })} className="h-10">
            <option value="">전체</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.nickname}</option>)}
          </Select>
        </Field>
        <Field label="상태">
          <Select value={f.status} onChange={(e) => apply({ status: e.target.value })} className="h-10">
            <option value="">전체</option>
            <option value="CONFIRMED">예약확정</option>
            <option value="COMPLETED">방문완료</option>
            <option value="NOSHOW">노쇼</option>
            <option value="CANCELLED">취소</option>
          </Select>
        </Field>
        <Field label="고객 닉네임">
          <form onSubmit={(e) => { e.preventDefault(); apply({ q: f.q }); }}>
            <Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="검색" className="h-10 w-[140px] text-[12px]" />
          </form>
        </Field>
        <div className="ml-auto flex gap-2">
          {(f.date || f.staffId || f.q || f.status) && <Button variant="ghost" size="sm" onClick={() => router.push("?view=list")}>초기화</Button>}
          <Button size="sm" onClick={() => setShowNew(true)}>+ 예약 등록</Button>
        </div>
      </Card>
      {!f.date && <div className="mt-2 px-1 text-[11px] text-mute">날짜를 지정하지 않으면 오늘 이후의 예약을 보여줘요.</div>}

      {/* 리스트 */}
      <Card className="mt-3 overflow-hidden">
        <div className="hidden grid-cols-[110px_90px_1fr_1fr_110px_170px] gap-2 border-b border-line bg-well px-4 py-2.5 text-[11px] font-semibold text-mute md:grid">
          <span>일시</span><span>캐치걸</span><span>고객</span><span>요청사항</span><span>상태</span><span className="text-right">처리</span>
        </div>
        {rows.length === 0 && <div className="py-10 text-center text-[12px] text-mute">조건에 맞는 예약이 없어요</div>}
        {rows.map((r) => (
          <div key={r.id} id={r.id} className={cn("grid grid-cols-1 gap-2 border-b border-line px-4 py-3 text-[12px] md:grid-cols-[110px_90px_1fr_1fr_110px_170px] md:items-center", focusId === r.id && "bg-blush-lt/40")}>
            <div>
              <div className="font-bold text-ink">{format(new Date(r.startTime), "M/d (EEE)", { locale: ko })} {r.time}</div>
              <div className="text-[10px] text-mute">~ {r.endLabel} · {r.hours}시간</div>
              <div className="text-[10px] tracking-wider text-gold">NO. {r.code}</div>
            </div>
            <div className="flex items-center gap-1.5"><Avatar src={staffPhotos[r.staffId]} name={r.staffName} size={22} rounded={7} /><span className="font-semibold text-ink">{r.staffName}</span></div>
            <div>
              <Link href={`/${slug}/admin/customers/${r.customerId}`} className="font-semibold text-ink underline-offset-2 hover:underline">{r.customerName}</Link>
              {r.blacklisted && <Chip tone="red" className="ml-1">블랙리스트</Chip>}
              <div className="truncate text-[10px] text-mute" title={r.memo}>{r.memo || (r.createdBy === "ADMIN" ? "관리자 등록" : "—")}</div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-mute" title={r.requestNote}>{r.requestNote || "—"}</div>
              <div className="text-[10px] text-mute">
                <b className="text-brand">{won(r.totalPrice)}</b>
                {r.optionNames.length > 0 && ` · ${r.optionNames.join(", ")}`}
              </div>
            </div>
            <div><StatusChip status={r.status} /></div>
            <div className="flex flex-wrap justify-end gap-1">
              {r.status === "CONFIRMED" && (
                <>
                  <button disabled={pending} onClick={() => setStatus(r.id, "COMPLETED")} className="rounded-lg bg-ok-bg px-2 py-1 text-[11px] font-bold text-ok">방문완료</button>
                  <button disabled={pending} onClick={() => setStatus(r.id, "NOSHOW")} className="rounded-lg bg-bad-bg px-2 py-1 text-[11px] font-bold text-bad">노쇼</button>
                  <button disabled={pending} onClick={() => setEditing(r)} className="rounded-lg border border-line bg-card px-2 py-1 text-[11px] font-bold text-ink">수정</button>
                  <button disabled={pending} onClick={() => setStatus(r.id, "CANCELLED")} className="rounded-lg border border-line bg-card px-2 py-1 text-[11px] font-bold text-mute">취소</button>
                </>
              )}
              {r.status !== "CONFIRMED" && (
                <button disabled={pending} onClick={() => setStatus(r.id, "CONFIRMED")} className="rounded-lg border border-line bg-card px-2 py-1 text-[11px] font-bold text-mute">확정으로 되돌리기</button>
              )}
            </div>
          </div>
        ))}
      </Card>

      {/* 페이지 이동 — 목록이 길어도 끝없이 스크롤하지 않도록 */}
      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-ink disabled:opacity-35"
          >
            ‹ 이전
          </button>
          {pageWindow(page, pageCount).map((n, i) =>
            n === 0 ? (
              <span key={`gap-${i}`} className="px-1 text-[12px] text-mute">…</span>
            ) : (
              <button
                key={n}
                onClick={() => goPage(n)}
                className={cn(
                  "min-w-[36px] rounded-xl px-2.5 py-2 text-[12px] font-bold transition-colors",
                  n === page ? "bg-brand text-white" : "border border-line bg-card text-mute hover:border-brand",
                )}
              >
                {n}
              </button>
            ),
          )}
          <button
            disabled={page >= pageCount}
            onClick={() => goPage(page + 1)}
            className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] font-bold text-ink disabled:opacity-35"
          >
            다음 ›
          </button>
        </div>
      )}
      {totalCount > 0 && (
        <div className="mt-2 text-center text-[11px] text-mute">전체 {totalCount}건 · {page}/{pageCount} 페이지</div>
      )}

      {showNew && <NewReservationModal slug={slug} staff={staff.filter((s) => s.isActive)} customers={customers} sources={sources} times={times} defaultDate={filters.date || ymd(new Date())} onClose={() => { setShowNew(false); router.replace("?view=list" + (filters.date ? `&date=${filters.date}` : "")); }} />}
      {editing && <EditModal slug={slug} row={editing} staff={staff.filter((s) => s.isActive)} times={times} onClose={() => setEditing(null)} />}
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-paper p-6 shadow-pop md:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-serif text-[18px] font-bold text-ink">{title}</div>
          <button onClick={onClose} className="h-8 w-8 rounded-full border border-line bg-card text-mute">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * 전화·텔레그램으로 받은 예약을 그 자리에서 적는 화면.
 *
 * 손님을 기다리게 하면 안 되므로 손이 적게 가야 한다. 이름 몇 글자만 치면
 * 연락처와 방문 횟수가 같이 나와 같은 이름을 헷갈리지 않고 고를 수 있고,
 * 없는 사람이면 방금 친 이름 그대로 신규로 넘어간다.
 *
 * 경로는 예약마다 따로 찍는다 — 단골이 귀찮아서 전화로 하는 일이 흔해서
 * "재방문이면 앱" 으로 묶어 두면 숫자가 틀어진다.
 */
function NewReservationModal({ slug, staff, customers, sources, times, defaultDate, onClose }: { slug: string; staff: StaffLite[]; customers: CustomerLite[]; sources: SourceLite[]; times: string[]; defaultDate: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    staffId: staff[0]?.id ?? "", date: defaultDate, time: times[0] ?? "18:00", hours: 1, partySize: 1,
    requestNote: "", customerId: "", nickname: "", channel: "PHONE" as Channel, sourceId: "",
  });

  const picked = customers.find((c) => c.id === form.customerId);
  const needle = q.trim();
  const hit = (needle ? customers.filter((c) => c.nickname.includes(needle) || c.contact.includes(needle)) : customers).slice(0, 8);

  const submit = () => {
    start(async () => {
      const r = await adminCreateReservation(slug, {
        ...form,
        customerId: mode === "existing" ? form.customerId : undefined,
        sourceId: mode === "new" ? form.sourceId || null : null,
      });
      if (!r.ok) return toast(r.error, "error");
      toast("예약을 등록했어요", "success");
      router.push(`?view=list&date=${form.date}`);
      router.refresh();
      onClose();
    });
  };

  const canSubmit = mode === "existing" ? !!form.customerId : !!form.nickname.trim();

  return (
    <Modal title="예약 받아 적기" onClose={onClose}>
      <div className="mt-5 flex flex-col gap-4">
        {/* 어디로 들어온 예약인지 — 재방문이어도 전화로 하는 일이 흔하다 */}
        <div>
          <div className="text-[11px] font-semibold text-mute">어디로 받으셨어요?</div>
          <div className="mt-1.5 flex gap-1.5">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                onClick={() => setForm({ ...form, channel: c.key })}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-[12px] font-bold transition-colors",
                  form.channel === c.key ? "border-brand bg-brand text-white" : "border-line bg-card text-mute hover:border-brand",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex rounded-2xl bg-well-2 p-1">
          {(["existing", "new"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded-xl py-2 text-[12px] font-bold", mode === m ? "bg-card text-ink shadow-card" : "text-mute")}>{m === "existing" ? "기존 손님" : "신규 손님"}</button>
          ))}
        </div>

        {mode === "existing" ? (
          picked ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand/40 bg-blush-lt/40 px-4 py-3">
              <span className="text-[13px] font-bold text-ink">{picked.nickname}</span>
              {picked.contact && <span className="text-[11px] text-mute">{picked.contact}</span>}
              <span className="text-[11px] text-mute">방문 {picked.visits}회</span>
              <button onClick={() => { setForm({ ...form, customerId: "" }); setQ(""); }} className="ml-auto text-[11px] font-bold text-mute underline-offset-2 hover:underline">바꾸기</button>
            </div>
          ) : (
            <div>
              <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임이나 연락처로 찾기" className="h-11" />
              <div className="mt-1.5 flex flex-col gap-1">
                {hit.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setForm({ ...form, customerId: c.id })}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-left text-[12px] hover:border-brand"
                  >
                    <span className="font-bold text-ink">{c.nickname}</span>
                    {c.contact && <span className="text-[11px] text-mute">{c.contact}</span>}
                    <span className="ml-auto text-[11px] text-mute">방문 {c.visits}회</span>
                  </button>
                ))}
                {hit.length === 0 && (
                  <button
                    onClick={() => { setMode("new"); setForm({ ...form, nickname: needle }); }}
                    className="rounded-xl border border-dashed border-brand bg-blush-lt/30 px-3 py-2.5 text-[12px] font-bold text-brand"
                  >
                    &ldquo;{needle}&rdquo; 새 손님으로 등록하기
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="닉네임" hint="휴대폰 번호·실명은 받지 않아요">
              <Input autoFocus value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="예: 길동" className="h-11" />
            </Field>
            <Field label="방문 경로" hint="어디를 보고 연락 주셨는지 — 나중에 광고 효과를 봐요">
              <Select value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })} className="w-full">
                <option value="">모름 / 안 물어봄</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}{s.tier ? ` (${s.tier})` : ""}</option>)}
              </Select>
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="캐치걸"><Select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="w-full">{staff.map((s) => <option key={s.id} value={s.id}>{s.nickname}</option>)}</Select></Field>
          <Field label="이용 시간"><Select value={String(form.hours)} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} className="w-full">{HOUR_CHOICES.map((h) => <option key={h} value={h}>{h}시간</option>)}</Select></Field>
          <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11" /></Field>
          <Field label="시간"><Select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full">{times.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>

        <Field label="요청사항"><Textarea rows={2} value={form.requestNote} onChange={(e) => setForm({ ...form, requestNote: e.target.value })} /></Field>
        <div className="text-[11px] text-mute">※ 매장 등록은 근무시간·마감 검증을 건너뛰지만, 같은 시간 동시 접객 한도는 지켜요.</div>
        <Button size="lg" onClick={submit} loading={pending} disabled={!canSubmit}>등록하기</Button>
      </div>
    </Modal>
  );
}

function EditModal({ slug, row, staff, times, onClose }: { slug: string; row: ResRow; staff: StaffLite[]; times: string[]; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ staffId: row.staffId, date: row.date, time: row.time, hours: row.hours, requestNote: row.requestNote });
  const moved = form.staffId !== row.staffId || form.date !== row.date || form.time !== row.time || form.hours !== row.hours;
  const submit = () => {
    start(async () => {
      const r = await adminUpdateReservation(slug, row.id, moved ? form : { requestNote: form.requestNote });
      if (!r.ok) return toast(r.error, "error");
      toast("예약을 수정했어요", "success");
      router.refresh();
      onClose();
    });
  };
  return (
    <Modal title={`예약 수정 · ${row.customerName}`} onClose={onClose}>
      <div className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="캐치걸"><Select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="w-full">{staff.map((s) => <option key={s.id} value={s.id}>{s.nickname}</option>)}</Select></Field>
          <Field label="이용 시간"><Select value={String(form.hours)} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} className="w-full">{HOUR_CHOICES.map((h) => <option key={h} value={h}>{h}시간</option>)}</Select></Field>
          <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11" /></Field>
          <Field label="시간"><Select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full">{times.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>
        <Field label="요청사항"><Textarea rows={2} value={form.requestNote} onChange={(e) => setForm({ ...form, requestNote: e.target.value })} /></Field>
        {moved && <div className="rounded-xl bg-blush-lt px-3 py-2 text-[11px] text-brand">일시/캐치걸/이용 시간을 바꾸면 기존 예약은 취소되고 새 예약번호로 다시 생성돼요. 금액도 지금 요금으로 다시 계산돼요.</div>}
        <Button size="lg" onClick={submit} loading={pending}>저장</Button>
      </div>
    </Modal>
  );
}
