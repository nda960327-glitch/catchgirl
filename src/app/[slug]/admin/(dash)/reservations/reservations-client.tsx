"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Avatar, Button, Card, Chip, Field, Input, Select, StatusChip, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn, ymd } from "@/lib/utils";
import { adminCreateReservation, adminSetReservationStatus, adminUpdateReservation } from "../../actions";

export type ResRow = {
  id: string; code: string; startTime: string; date: string; time: string; staffId: string; staffName: string; customerId: string; customerName: string; phone: string;
  partySize: number; requestNote: string; purposeTag: string; status: string; createdBy: string; blacklisted: boolean;
};
type StaffLite = { id: string; nickname: string; isActive: boolean };

export function ReservationsClient({ slug, rows, staff, customers, filters, times, openNew, focusId, staffPhotos }: {
  slug: string; rows: ResRow[]; staff: StaffLite[]; customers: { id: string; nickname: string; phone: string }[];
  filters: { date: string; staffId: string; q: string; status: string }; times: string[]; openNew: boolean; focusId?: string; staffPhotos: Record<string, string | null>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [showNew, setShowNew] = useState(openNew);
  const [editing, setEditing] = useState<ResRow | null>(null);
  const [f, setF] = useState(filters);

  useEffect(() => setF(filters), [filters]);

  const apply = (next: Partial<typeof f>) => {
    const v = { ...f, ...next };
    const p = new URLSearchParams({ view: "list" });
    Object.entries(v).forEach(([k, val]) => val && p.set(k, val));
    router.push(`?${p.toString()}`);
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
        <div className="hidden grid-cols-[110px_90px_1fr_1fr_110px_170px] gap-2 border-b border-line bg-[#FAF6F7] px-4 py-2.5 text-[11px] font-semibold text-mute md:grid">
          <span>일시</span><span>캐치걸</span><span>고객</span><span>요청사항</span><span>상태</span><span className="text-right">처리</span>
        </div>
        {rows.length === 0 && <div className="py-10 text-center text-[12px] text-mute">조건에 맞는 예약이 없어요</div>}
        {rows.map((r) => (
          <div key={r.id} id={r.id} className={cn("grid grid-cols-1 gap-2 border-b border-line px-4 py-3 text-[12px] md:grid-cols-[110px_90px_1fr_1fr_110px_170px] md:items-center", focusId === r.id && "bg-blush-lt/40")}>
            <div>
              <div className="font-bold text-ink">{format(new Date(r.startTime), "M/d (EEE)", { locale: ko })} {r.time}</div>
              <div className="text-[10px] tracking-wider text-gold">NO. {r.code}</div>
            </div>
            <div className="flex items-center gap-1.5"><Avatar src={staffPhotos[r.staffId]} name={r.staffName} size={22} rounded={7} /><span className="font-semibold text-ink">{r.staffName}</span></div>
            <div>
              <Link href={`/${slug}/admin/customers/${r.customerId}`} className="font-semibold text-ink underline-offset-2 hover:underline">{r.customerName}</Link>
              {r.blacklisted && <Chip tone="red" className="ml-1">블랙리스트</Chip>}
              <div className="text-[10px] text-mute">{r.phone}{r.createdBy === "ADMIN" ? " · 관리자 등록" : ""}</div>
            </div>
            <div className="truncate text-mute" title={r.requestNote}>{r.requestNote || "—"}</div>
            <div><StatusChip status={r.status} /></div>
            <div className="flex flex-wrap justify-end gap-1">
              {r.status === "CONFIRMED" && (
                <>
                  <button disabled={pending} onClick={() => setStatus(r.id, "COMPLETED")} className="rounded-lg bg-[#E8F6EE] px-2 py-1 text-[11px] font-bold text-[#2E8B57]">방문완료</button>
                  <button disabled={pending} onClick={() => setStatus(r.id, "NOSHOW")} className="rounded-lg bg-[#FDECEC] px-2 py-1 text-[11px] font-bold text-[#C0392B]">노쇼</button>
                  <button disabled={pending} onClick={() => setEditing(r)} className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-bold text-ink">수정</button>
                  <button disabled={pending} onClick={() => setStatus(r.id, "CANCELLED")} className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-bold text-mute">취소</button>
                </>
              )}
              {r.status !== "CONFIRMED" && (
                <button disabled={pending} onClick={() => setStatus(r.id, "CONFIRMED")} className="rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-bold text-mute">확정으로 되돌리기</button>
              )}
            </div>
          </div>
        ))}
      </Card>

      {showNew && <NewReservationModal slug={slug} staff={staff.filter((s) => s.isActive)} customers={customers} times={times} defaultDate={filters.date || ymd(new Date())} onClose={() => { setShowNew(false); router.replace("?view=list" + (filters.date ? `&date=${filters.date}` : "")); }} />}
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
          <button onClick={onClose} className="h-8 w-8 rounded-full border border-line bg-white text-mute">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewReservationModal({ slug, staff, customers, times, defaultDate, onClose }: { slug: string; staff: StaffLite[]; customers: { id: string; nickname: string; phone: string }[]; times: string[]; defaultDate: string; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({ staffId: staff[0]?.id ?? "", date: defaultDate, time: times[0] ?? "18:00", partySize: 1, requestNote: "", customerId: customers[0]?.id ?? "", nickname: "", phone: "" });
  const submit = () => {
    start(async () => {
      const r = await adminCreateReservation(slug, { ...form, customerId: mode === "existing" ? form.customerId : undefined });
      if (!r.ok) return toast(r.error, "error");
      toast("예약을 등록했어요", "success");
      router.push(`?view=list&date=${form.date}`);
      router.refresh();
      onClose();
    });
  };
  return (
    <Modal title="전화 예약 등록" onClose={onClose}>
      <div className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="캐치걸"><Select value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="w-full">{staff.map((s) => <option key={s.id} value={s.id}>{s.nickname}</option>)}</Select></Field>
          <div />
          <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11" /></Field>
          <Field label="시간"><Select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full">{times.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>
        <div className="flex rounded-2xl bg-[#F4EDEE] p-1">
          {(["existing", "new"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded-xl py-2 text-[12px] font-bold", mode === m ? "bg-white text-ink shadow-card" : "text-mute")}>{m === "existing" ? "기존 고객" : "신규 고객"}</button>
          ))}
        </div>
        {mode === "existing" ? (
          <Field label="고객">
            <Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full">
              {customers.map((c) => <option key={c.id} value={c.id}>{c.nickname} · {c.phone}</option>)}
            </Select>
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="닉네임"><Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="예: 민지" /></Field>
            <Field label="휴대폰"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" inputMode="tel" /></Field>
          </div>
        )}
        <Field label="요청사항"><Textarea rows={2} value={form.requestNote} onChange={(e) => setForm({ ...form, requestNote: e.target.value })} /></Field>
        <div className="text-[11px] text-mute">※ 관리자 등록은 근무시간/마감 검증을 건너뛰지만, 같은 슬롯의 동시 접객 한도는 지켜요.</div>
        <Button size="lg" onClick={submit} loading={pending} disabled={mode === "new" && (!form.nickname || !form.phone)}>등록하기</Button>
      </div>
    </Modal>
  );
}

function EditModal({ slug, row, staff, times, onClose }: { slug: string; row: ResRow; staff: StaffLite[]; times: string[]; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ staffId: row.staffId, date: row.date, time: row.time, requestNote: row.requestNote });
  const moved = form.staffId !== row.staffId || form.date !== row.date || form.time !== row.time;
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
          <div />
          <Field label="날짜"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-11" /></Field>
          <Field label="시간"><Select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full">{times.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        </div>
        <Field label="요청사항"><Textarea rows={2} value={form.requestNote} onChange={(e) => setForm({ ...form, requestNote: e.target.value })} /></Field>
        {moved && <div className="rounded-xl bg-blush-lt px-3 py-2 text-[11px] text-brand">일시/캐치걸를 바꾸면 기존 예약은 취소되고 새 예약번호로 다시 생성돼요.</div>}
        <Button size="lg" onClick={submit} loading={pending}>저장</Button>
      </div>
    </Modal>
  );
}
