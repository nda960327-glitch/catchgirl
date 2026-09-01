"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui";
import { STAFF_SORTS } from "@/lib/utils";

/** 캐치걸 목록 정렬 — 선택지가 많아 칩으로 늘어놓으면 화면 밖으로 잘려서 드롭다운으로 둔다 */
export function SortSelect({ slug, sort, now }: { slug: string; sort: string; now?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2 px-4 pt-3">
      <span className="shrink-0 text-[12px] font-semibold text-mute">정렬</span>
      <Select
        value={sort}
        disabled={pending}
        onChange={(e) => {
          const p = new URLSearchParams();
          if (e.target.value) p.set("sort", e.target.value);
          if (now) p.set("now", "1");
          const qs = p.toString();
          start(() => router.push(`/${slug}/bartenders${qs ? `?${qs}` : ""}`, { scroll: false }));
        }}
        className="h-11 flex-1 text-[13px] font-semibold"
      >
        {STAFF_SORTS.map(([k, label]) => (
          <option key={k || "default"} value={k}>{label}</option>
        ))}
      </Select>
    </div>
  );
}
