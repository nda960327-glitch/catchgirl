"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Eyebrow, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { deleteRoom, saveRoom } from "../../actions";
import { useStaffLabel } from "@/components/store-label";
import { josa } from "@/lib/labels";

export type RoomItem = { id: string; name: string; isActive: boolean; assignedCount: number };

/** 관리자 — 접객 룸 관리. 출근 배치는 여기서 만든 룸 위에서 이뤄진다. */
export function RoomsManager({ slug, items }: { slug: string; items: RoomItem[] }) {
  const staffLabel = useStaffLabel();
  const [rows, setRows] = useState(items);
  const [adding, setAdding] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const set = (id: string, patch: Partial<RoomItem>) => setRows((v) => v.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = (row: RoomItem) =>
    start(async () => {
      const r = await saveRoom(slug, { id: row.id, name: row.name, isActive: row.isActive });
      toast(r.ok ? "저장했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  const add = () =>
    start(async () => {
      const name = adding.trim() || `${rows.length + 1}번 룸`;
      const r = await saveRoom(slug, { name, isActive: true });
      if (!r.ok) return toast(r.error, "error");
      toast("룸을 추가했어요", "success");
      setAdding("");
      router.refresh();
    });

  const remove = (row: RoomItem) =>
    start(async () => {
      const warn = row.assignedCount > 0 ? `\n\n이 룸에 잡혀 있는 출근 배치 ${row.assignedCount}건도 함께 지워져요.` : "";
      if (!confirm(`'${row.name}'을(를) 삭제할까요?${warn}`)) return;
      const r = await deleteRoom(slug, row.id);
      toast(r.ok ? "삭제했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  return (
    <Card id="rooms" className="mt-5 scroll-mt-6 p-5">
      <Eyebrow>Rooms</Eyebrow>
      <div className="mt-1 text-[14px] font-bold text-ink">접객 룸 {rows.length}개</div>
      <p className="mt-1 text-[12px] text-mute">
        <Link href={`/${slug}/admin/staff/schedule`} className="font-bold text-brand">출근 배치 ›</Link>
        에서 이 룸에 {josa(staffLabel, "을")} 한 명씩 넣어요. 예약이 잡히면 손님에게 룸 번호가 안내돼요.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {rows.length === 0 && <div className="w-full rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 룸이 없어요</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2">
            <Input value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} className="h-9 w-[110px] text-[13px]" />
            <label className="flex items-center gap-1 text-[11px] font-semibold text-mute">
              <input type="checkbox" checked={r.isActive} onChange={(e) => set(r.id, { isActive: e.target.checked })} className="h-3.5 w-3.5 accent-[#B4586A]" />
              사용
            </label>
            {!r.isActive && <Chip tone="mute">미사용</Chip>}
            <Button size="sm" onClick={() => save(r)} loading={pending}>저장</Button>
            <button onClick={() => remove(r)} disabled={pending} className="text-[11px] font-bold text-mute hover:text-bad">삭제</button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <Field label="룸 추가" hint="비워두면 번호가 자동으로 붙어요" className="w-[200px]">
          <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={`${rows.length + 1}번 룸`} className="h-10 text-[13px]" />
        </Field>
        <Button size="sm" variant="secondary" onClick={add} loading={pending} className="mb-0.5">+ 추가</Button>
      </div>
    </Card>
  );
}
