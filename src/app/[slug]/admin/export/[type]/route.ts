import { endOfMonth, format, startOfMonth } from "date-fns";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { businessDayRange } from "@/lib/slots";
import { STORE_FEE_PER_HOUR, ymd } from "@/lib/utils";
import { PLANS, planOf } from "@/lib/plans";
import { staffLabelOf } from "@/lib/labels";

/**
 * 매장 데이터를 CSV 로 내려준다. Max 요금제 기능.
 *
 * 엑셀은 UTF-8 파일이라도 BOM 이 없으면 한글을 깨뜨린다. 정산에 쓰는 파일이라
 * 열자마자 글자가 깨지면 아무 소용이 없으므로 BOM 을 반드시 붙인다.
 */
const BOM = "﻿";

/** 쉼표·따옴표·줄바꿈이 든 값은 따옴표로 감싸고 내부 따옴표는 두 번 쓴다 */
function cell(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (header: string[], rows: (string | number | null)[][]) =>
  BOM + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

const STATUS_KO: Record<string, string> = {
  CONFIRMED: "예약 확정",
  COMPLETED: "방문 완료",
  CANCELLED: "취소",
  NOSHOW: "노쇼",
};

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; type: string }> }) {
  const { slug, type } = await params;
  const store = await getStoreBySlug(slug);
  try {
    await requireAdmin(store.id);
  } catch {
    return new Response("권한이 없어요.", { status: 403 });
  }
  if (!PLANS[planOf(store.plan)].dataExport) {
    return new Response("데이터 내보내기는 Max 요금제에서 쓰실 수 있어요.", { status: 402 });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  const base = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? new Date(`${monthParam}-01T00:00:00`) : new Date();
  const mStart = startOfMonth(base);
  const mEnd = endOfMonth(base);
  const month = format(mStart, "yyyy-MM");
  // 마감이 익일 새벽이므로 달의 끝은 하루 넘겨 잡는다
  const range = { gte: businessDayRange(store, ymd(mStart)).start, lt: businessDayRange(store, ymd(mEnd)).end };

  let csv: string;
  let name: string;       // 사용자에게 보일 한글 파일명
  let asciiName: string;  // HTTP 헤더는 latin-1 만 담을 수 있어 대체명이 필요하다

  if (type === "reservations") {
    const rows = await prisma.reservation.findMany({
      where: { storeId: store.id, startTime: range },
      include: { staff: { select: { nickname: true } }, customer: { select: { nickname: true } }, options: true },
      orderBy: { startTime: "asc" },
    });
    csv = toCsv(
      ["예약번호", "영업일", "시작", "종료", "시간", staffLabelOf(store), "고객", "룸", "상태", "시간당 금액", "옵션", "옵션 금액", "결제 금액", "매장 몫", "등록 경로"],
      rows.map((r) => [
        r.code,
        ymd(businessDayRange(store, ymd(r.startTime)).start),
        format(r.startTime, "yyyy-MM-dd HH:mm"),
        format(r.endTime, "yyyy-MM-dd HH:mm"),
        r.hours,
        r.staff.nickname,
        r.customer.nickname,
        r.roomName ?? "",
        STATUS_KO[r.status] ?? r.status,
        r.hourlyPrice,
        r.options.map((o) => o.name).join(" / "),
        r.optionsPrice,
        r.totalPrice,
        // 취소·노쇼는 수수료를 받지 않는다
        r.status === "COMPLETED" || r.status === "CONFIRMED" ? r.hours * STORE_FEE_PER_HOUR : 0,
        r.createdBy === "ADMIN" ? "매장 등록" : "고객 앱",
      ]),
    );
    name = `예약내역_${month}`;
    asciiName = `reservations_${month}`;
  } else if (type === "staff") {
    const rows = await prisma.reservation.findMany({
      where: { storeId: store.id, startTime: range, status: { in: ["COMPLETED", "CONFIRMED"] } },
      include: { staff: { select: { id: true, nickname: true } } },
    });
    const by = new Map<string, { name: string; count: number; hours: number; paid: number }>();
    for (const r of rows) {
      const e = by.get(r.staffId) ?? { name: r.staff.nickname, count: 0, hours: 0, paid: 0 };
      e.count++;
      e.hours += r.hours;
      e.paid += r.totalPrice;
      by.set(r.staffId, e);
    }
    csv = toCsv(
      [staffLabelOf(store), "예약 건수", "이용 시간", "손님이 낸 금액", "매장 몫(수수료)", `${staffLabelOf(store)} 몫`],
      [...by.values()]
        .sort((a, b) => b.paid - a.paid)
        .map((e) => {
          const fee = e.hours * STORE_FEE_PER_HOUR;
          return [e.name, e.count, e.hours, e.paid, fee, e.paid - fee];
        }),
    );
    name = `${staffLabelOf(store)}정산_${month}`;
    asciiName = `staff-settlement_${month}`;
  } else if (type === "customers") {
    const rows = await prisma.customer.findMany({
      where: { storeId: store.id },
      include: { reservations: { select: { status: true, startTime: true, totalPrice: true } } },
      orderBy: { nickname: "asc" },
    });
    csv = toCsv(
      ["닉네임", "연락처(매장 기록)", "메모", "연결코드", "앱 시작", "방문 횟수", "노쇼", "취소", "누적 지출", "최근 방문일", "블랙리스트"],
      rows.map((c) => {
        const done = c.reservations.filter((r) => r.status === "COMPLETED");
        const last = done.map((r) => r.startTime).sort((a, b) => b.getTime() - a.getTime())[0];
        return [
          c.nickname,
          c.adminContact,
          c.adminMemo,
          c.inviteCode ?? "",
          c.passwordHash ? "시작함" : "미시작",
          done.length,
          c.reservations.filter((r) => r.status === "NOSHOW").length,
          c.reservations.filter((r) => r.status === "CANCELLED").length,
          c.reservations.filter((r) => r.status === "COMPLETED" || r.status === "CONFIRMED").reduce((a, r) => a + r.totalPrice, 0),
          last ? format(last, "yyyy-MM-dd") : "",
          c.isBlacklisted ? "Y" : "",
        ];
      }),
    );
    name = `고객명단_${format(new Date(), "yyyy-MM-dd")}`;
    asciiName = `customers_${format(new Date(), "yyyy-MM-dd")}`;
  } else {
    return new Response("무엇을 내보낼지 알 수 없어요.", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // 한글 파일명은 브라우저가 그대로 못 읽으므로 RFC 5987 로 함께 적는다
      "Content-Disposition": `attachment; filename="${asciiName}.csv"; filename*=UTF-8''${encodeURIComponent(name)}.csv`,
      "Cache-Control": "no-store",
    },
  });
}
