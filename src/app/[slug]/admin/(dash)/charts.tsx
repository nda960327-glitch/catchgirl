"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui";

export function Charts({ weekly, share }: { weekly: { day: string; count: number }[]; share: { name: string; count: number }[] }) {
  const total = share.reduce((a, s) => a + s.count, 0) || 1;
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-5">
      <Card className="p-5 lg:col-span-3">
        <div className="text-[13px] font-bold text-ink">주간 예약 추이</div>
        <div className="mt-0.5 text-[11px] text-mute">최근 7일 · 취소 제외</div>
        <div className="mt-3 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#F0E4E5" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9A868D" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9A868D" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0E4E5", fontSize: 12 }} formatter={(v) => [`${v}건`, "예약"]} />
              <Line type="monotone" dataKey="count" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--brand)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-5 lg:col-span-2">
        <div className="text-[13px] font-bold text-ink">캐치걸별 예약 점유율</div>
        <div className="mt-0.5 text-[11px] text-mute">최근 30일</div>
        <div className="mt-3 h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={share.map((s) => ({ ...s, pct: Math.round((s.count / total) * 100) }))} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid stroke="#F0E4E5" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#3A2830" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9A868D" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0E4E5", fontSize: 12 }} formatter={(v, _n, p) => [`${v}% (${p.payload.count}건)`, "점유율"]} />
              <Bar dataKey="pct" fill="var(--blush)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
