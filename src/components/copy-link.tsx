"use client";

import { useState } from "react";

/** 주소 한 줄 + 복사 버튼. 담당직원 소개 링크처럼 그대로 붙여 넣을 것에 쓴다. */
export function CopyLink({ value, label = "복사" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { window.prompt("복사해서 쓰세요", value); }
  };
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-well px-3 py-2">
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink">{value}</span>
      <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-bold text-white">{done ? "복사됨" : label}</button>
    </div>
  );
}
