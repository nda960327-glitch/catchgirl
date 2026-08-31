import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSlotsFor } from "@/lib/slots";

export const dynamic = "force-dynamic";

/** GET /api/slots?staffId=&date=YYYY-MM-DD — 5초 폴링용 (실시간 슬롯 갱신) */
export async function GET(req: NextRequest) {
  const staffId = req.nextUrl.searchParams.get("staffId") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!staffId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const staff = await prisma.staff.findUnique({ where: { id: staffId }, include: { schedules: true, store: true } });
  if (!staff) return NextResponse.json({ error: "not found" }, { status: 404 });
  const slots = await getSlotsFor(staff.store, staff, date);
  return NextResponse.json({ slots, at: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
