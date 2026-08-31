/**
 * 동시성 테스트: 같은 슬롯에 5명이 동시에 예약 → 정확히 1건만 성공해야 한다.
 * 사용: npm run dev 실행 후  npx tsx scripts/concurrency-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "catch-girl-dev-secret-change-me");

async function main() {
  const store = await prisma.store.findFirstOrThrow();
  const staff = await prisma.staff.findFirstOrThrow({ where: { storeId: store.id, nickname: "준희" } });
  const customers = await prisma.customer.findMany({ where: { storeId: store.id }, take: 5 });

  // 앞으로 7일 중 첫 '예약 가능' 슬롯을 찾는다
  let date = "", time = "";
  for (let i = 1; i <= 7 && !time; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const j = (await fetch(`${BASE}/api/slots?staffId=${staff.id}&date=${ds}`).then((r) => r.json())) as { slots: { time: string; status: string }[] };
    const open = j.slots.find((s) => s.status === "open");
    if (open) { date = ds; time = open.time; }
  }
  if (!time) throw new Error("예약 가능한 슬롯이 없어요");
  const [hh, mm] = time.split(":").map(Number);
  const [y, m, dd] = date.split("-").map(Number);
  const start = new Date(y, m - 1, dd, hh, mm, 0, 0);
  await prisma.reservation.deleteMany({ where: { staffId: staff.id, startTime: start } });

  const tokens = await Promise.all(customers.map((c) =>
    new SignJWT({ role: "customer", id: c.id, storeId: store.id, name: c.nickname }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(secret)));

  console.log(`🔫 ${customers.length}명이 동시에 ${date} ${time} (${staff.nickname}) 예약 시도...`);
  const results = await Promise.all(tokens.map((t, i) =>
    fetch(`${BASE}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `cg_customer=${t}` },
      body: JSON.stringify({ storeSlug: store.slug, staffId: staff.id, date, time, partySize: 1 }),
    }).then(async (r) => ({ i, status: r.status, body: await r.json() }))));

  for (const r of results) console.log(`  고객 ${customers[r.i].nickname}: HTTP ${r.status} ${r.status === 201 ? "✅ 성공 " + r.body.code : "⛔ " + r.body.error}`);
  const ok = results.filter((r) => r.status === 201).length;
  const inDb = await prisma.reservation.count({ where: { staffId: staff.id, startTime: start, status: "CONFIRMED" } });
  console.log(`\n성공 ${ok}건 / 충돌 ${results.length - ok}건 · DB 확정 예약 ${inDb}건 (capacity ${staff.capacityPerSlot})`);
  if (ok !== staff.capacityPerSlot || inDb !== staff.capacityPerSlot) { console.error("❌ 동시성 제어 실패"); process.exit(1); }
  console.log("✅ 동시성 제어 OK");
  await prisma.reservation.deleteMany({ where: { staffId: staff.id, startTime: start } });
}
main().finally(() => prisma.$disconnect());
