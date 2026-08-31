"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cancelMyReservation } from "../../actions";

export function DoneActions({ slug, reservationId, status, ics }: { slug: string; reservationId: string; status: string; ics: { title: string; start: string; end: string; location: string; code: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const addToCalendar = () => {
    const fmt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//catchgirl//ko", "BEGIN:VEVENT", `UID:${ics.code}@catchgirl`, `DTSTAMP:${fmt(new Date().toISOString())}`, `DTSTART:${fmt(ics.start)}`, `DTEND:${fmt(ics.end)}`, `SUMMARY:${ics.title}`, `LOCATION:${ics.location}`, `DESCRIPTION:예약번호 ${ics.code}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `catchgirl-${ics.code}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("캘린더 파일(.ics)을 내려받았어요", "success");
  };

  const cancel = () => {
    if (!confirm("예약을 취소할까요?")) return;
    start(async () => {
      const r = await cancelMyReservation(slug, reservationId);
      toast(r.ok ? "예약을 취소했어요" : r.error, r.ok ? "success" : "error");
      if (r.ok) router.refresh();
    });
  };

  return (
    <div className="mt-[22px] flex w-full max-w-[300px] flex-col gap-2.5">
      <Button size="lg" onClick={() => router.push(`/${slug}/me`)}>내 예약 보기</Button>
      {status === "CONFIRMED" && (
        <>
          <Button variant="outline" className="h-12" onClick={addToCalendar}>캘린더에 추가</Button>
          <Button variant="ghost" className="h-10 text-[12px]" onClick={cancel} loading={pending}>예약 취소하기</Button>
        </>
      )}
    </div>
  );
}
