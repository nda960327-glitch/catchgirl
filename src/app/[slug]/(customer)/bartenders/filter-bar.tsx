"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, STAFF_FILTERS, STAFF_SORTS } from "@/lib/utils";

/**
 * 조건 검색 — 중고차 고르듯 체크해서 좁힌다.
 *
 * 누른 건 화면에서 바로 켜지고, 주소는 잠깐 뒤에 한 번만 따라간다.
 * 누를 때마다 곧장 이동하면 연달아 누른 조건들이 서로를 덮어써서
 * 마지막 하나만 남는다. 주소에 남기는 건 뒤로 가기와 링크 공유 때문이다.
 */
export function FilterBar({
  slug, sort, now, active, counts,
}: {
  slug: string;
  sort: string;
  now: boolean;
  active: string[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState(active);
  const [order, setOrder] = useState(sort);

  const build = (f: string[], s: string) => {
    const p = new URLSearchParams();
    if (s) p.set("sort", s);
    if (now) p.set("now", "1");
    if (f.length) p.set("f", f.join(","));
    const qs = p.toString();
    return `/${slug}/bartenders${qs ? `?${qs}` : ""}`;
  };

  // 지금 주소가 이미 원하는 상태면 다시 이동하지 않는다 —
  // 그래야 서버가 되돌려 준 값과 화면이 서로를 밀어내지 않는다.
  const wanted = build(picked, order);
  const current = build(active, sort);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (wanted === current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.push(wanted, { scroll: false }), 220);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [wanted, current, router]);

  const toggle = (key: string) =>
    setPicked((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  return (
    <div className="px-4 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {STAFF_FILTERS.map((f) => {
          const on = picked.includes(f.key);
          const n = counts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              onClick={() => toggle(f.key)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                on ? "border-brand bg-brand text-white" : "border-line bg-white text-mute hover:border-brand",
              )}
            >
              {f.label} <span className={cn(on ? "opacity-80" : "text-mute/70")}>{n}</span>
            </button>
          );
        })}
        {picked.length > 0 && (
          <button
            onClick={() => setPicked([])}
            className="rounded-full px-2.5 py-1.5 text-[11px] font-bold text-mute underline-offset-2 hover:underline"
          >
            조건 지우기
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-semibold text-mute">정렬</span>
        <select
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          className="h-10 flex-1 rounded-xl border border-line bg-white px-3 text-[12px] font-semibold text-ink outline-none focus:border-brand"
        >
          {STAFF_SORTS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
