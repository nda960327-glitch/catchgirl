import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCustomer } from "@/lib/auth";
import { createReservation, SlotConflictError } from "@/lib/reservations";

export const dynamic = "force-dynamic";

const schema = z.object({
  storeSlug: z.string().min(1),
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(8).default(1),
  requestNote: z.string().max(200).optional(),
  purposeTag: z.string().max(20).optional(),
});

/** POST /api/reservations — 고객 세션 필요. 서버 액션과 동일한 동시성 제어 경로를 탄다. */
export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const store = await prisma.store.findUnique({ where: { slug: body.data.storeSlug } });
  if (!store) return NextResponse.json({ error: "store not found" }, { status: 404 });
  const customer = await getCustomer(store.id);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await createReservation({ ...body.data, storeId: store.id, customerId: customer.id, createdBy: "CUSTOMER" });
    return NextResponse.json({ id: r.id, code: r.code, startTime: r.startTime }, { status: 201 });
  } catch (e) {
    if (e instanceof SlotConflictError) return NextResponse.json({ error: e.message, conflict: true }, { status: 409 });
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
  }
}
