"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Eyebrow, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { deleteProfileField, saveProfileField } from "../../actions";

export type ProfileFieldItem = {
  id: string;
  label: string;
  kind: "CHOICE" | "TEXT";
  options: string[];
  showInFilter: boolean;
  isActive: boolean;
  /** 값을 적어 둔 캐치걸 수 — 지울 때 알려 주려고 */
  usedBy: number;
};

/**
 * 관리자 — 프로필 항목을 매장이 직접 만든다.
 *
 * 앱은 키·몸무게·흡연·문신만 정해 두고, 그 밖의 것(외국어, 성형 여부 같은)은
 * 매장이 이름과 보기를 정한다. 보기 항목은 손님 화면 조건 검색 칩으로도 붙는다.
 */
export function ProfileFieldsManager({ slug, items }: { slug: string; items: ProfileFieldItem[] }) {
  const [rows, setRows] = useState(items);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const set = (id: string, patch: Partial<ProfileFieldItem>) => setRows((v) => v.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = (row: ProfileFieldItem) =>
    start(async () => {
      const r = await saveProfileField(slug, { id: row.id, label: row.label, kind: row.kind, options: row.options, showInFilter: row.showInFilter, isActive: row.isActive });
      toast(r.ok ? "저장했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  const add = () =>
    start(async () => {
      const r = await saveProfileField(slug, { label: `항목${rows.length + 1}`, kind: "CHOICE", options: ["예", "아니오"], showInFilter: true, isActive: true });
      toast(r.ok ? "항목을 추가했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  const remove = (row: ProfileFieldItem) =>
    start(async () => {
      const who = row.usedBy > 0 ? `\n\n캐치걸 ${row.usedBy}명이 적어 둔 값도 함께 지워져요.` : "";
      if (!confirm(`'${row.label}' 항목을 삭제할까요?${who}`)) return;
      const r = await deleteProfileField(slug, row.id);
      toast(r.ok ? "삭제했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });

  return (
    <Card className="mt-5 p-5">
      <Eyebrow>Profile Fields</Eyebrow>
      <div className="mt-1 text-[14px] font-bold text-ink">프로필 항목</div>
      <p className="mt-1 text-[12px] leading-[1.7] text-mute">
        키·몸무게·흡연·문신 말고 더 보여주고 싶은 게 있으면 여기서 항목을 만드세요. 예: 외국어(영어·일본어·중국어), 성형 여부(자연·있음).
        <br />
        <b className="text-ink">보기</b>로 만든 항목은 손님 화면의 조건 검색 칩으로도 붙어요. 값은 직원 관리에서 캐치걸마다 적어요.
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.length === 0 && <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-[12px] text-mute">아직 만든 항목이 없어요</div>}
        {rows.map((r) => (
          <FieldRow key={r.id} row={r} pending={pending} onChange={(patch) => set(r.id, patch)} onSave={() => save(r)} onRemove={() => remove(r)} />
        ))}
      </div>

      <Button size="sm" variant="secondary" onClick={add} loading={pending} className="mt-3">+ 항목 추가</Button>
    </Card>
  );
}

function FieldRow({
  row, pending, onChange, onSave, onRemove,
}: {
  row: ProfileFieldItem;
  pending: boolean;
  onChange: (patch: Partial<ProfileFieldItem>) => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const [optInput, setOptInput] = useState("");
  const addOpt = () => {
    const v = optInput.trim();
    if (!v) return;
    if (row.options.includes(v)) { setOptInput(""); return; }
    if (row.options.length >= 12) return;
    onChange({ options: [...row.options, v] });
    setOptInput("");
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-end gap-2.5">
        <Field label="항목 이름" className="min-w-[140px] flex-1">
          <Input value={row.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={12} className="h-10 text-[13px]" placeholder="예: 외국어" />
        </Field>
        <Field label="입력 방식" className="w-[190px]">
          <div className="flex gap-1">
            {([["CHOICE", "보기 중 고르기"], ["TEXT", "자유 입력"]] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => onChange({ kind: k, showInFilter: k === "CHOICE" ? row.showInFilter : false })}
                className={cn("h-10 flex-1 rounded-xl border text-[11px] font-bold transition-colors", row.kind === k ? "border-brand bg-brand text-white" : "border-line bg-card text-mute hover:border-brand")}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
        <label className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-mute">
          <input type="checkbox" checked={row.isActive} onChange={(e) => onChange({ isActive: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
          노출
        </label>
        {row.kind === "CHOICE" && (
          <label className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-mute">
            <input type="checkbox" checked={row.showInFilter} onChange={(e) => onChange({ showInFilter: e.target.checked })} className="h-4 w-4 accent-[#B4586A]" />
            조건 검색에 넣기
          </label>
        )}
        {!row.isActive && <Chip tone="mute" className="mb-2.5">숨김</Chip>}
        <div className="mb-1 ml-auto flex gap-1.5">
          <Button size="sm" onClick={onSave} loading={pending}>저장</Button>
          <button onClick={onRemove} disabled={pending} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:text-bad">삭제</button>
        </div>
      </div>

      {row.kind === "CHOICE" && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <div className="mb-1.5 text-[11px] font-semibold text-mute">보기 <span className="font-medium">(2개 이상 · 각 12자)</span></div>
          <div className="flex flex-wrap items-center gap-1.5">
            {row.options.map((o) => (
              <span key={o} className="inline-flex items-center gap-1 rounded-full border border-line bg-well px-2.5 py-1 text-[11px] font-bold text-ink">
                {o}
                <button type="button" onClick={() => onChange({ options: row.options.filter((x) => x !== o) })} className="text-mute hover:text-bad" aria-label={`${o} 보기 지우기`}>×</button>
              </span>
            ))}
            <Input
              value={optInput}
              onChange={(e) => setOptInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOpt(); } }}
              maxLength={12}
              placeholder="보기 입력 후 Enter"
              className="h-9 w-[150px] text-[12px]"
            />
            <button type="button" onClick={addOpt} className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-bold text-mute hover:border-brand hover:text-brand">추가</button>
          </div>
        </div>
      )}
      {row.usedBy > 0 && <div className="mt-2 text-[10px] text-mute">캐치걸 {row.usedBy}명이 값을 적어 뒀어요</div>}
    </div>
  );
}
