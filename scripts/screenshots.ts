/**
 * 화면 캡처 (제안서/설명서용) — npm run dev 상태에서  npx tsx scripts/screenshots.ts
 * 출력: proposal/shots/*.png
 */
import { chromium } from "playwright-core";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join(process.cwd(), "proposal", "shots");
const prisma = new PrismaClient();
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "catch-girl-dev-secret-change-me");
const sign = (p: Record<string, unknown>) => new SignJWT(p).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(secret);

async function main() {
  mkdirSync(OUT, { recursive: true });
  const store = await prisma.store.findFirstOrThrow();
  const slug = store.slug;
  const junhee = await prisma.staff.findFirstOrThrow({ where: { storeId: store.id, nickname: "준희" } });
  const yuna = await prisma.customer.findFirstOrThrow({ where: { storeId: store.id, nickname: "유나" } });
  const admin = await prisma.adminUser.findFirstOrThrow({ where: { storeId: store.id } });
  const completed = await prisma.reservation.findFirst({ where: { customerId: yuna.id, status: "COMPLETED", review: null } });
  const doneRes = await prisma.reservation.findFirst({ where: { customerId: yuna.id, status: "CONFIRMED" }, orderBy: { startTime: "asc" } });

  const cookies = [
    { name: "cg_customer", value: await sign({ role: "customer", id: yuna.id, storeId: store.id, name: yuna.nickname }) },
    { name: "cg_staff", value: await sign({ role: "staff", id: junhee.id, storeId: store.id, name: junhee.nickname }) },
    { name: "cg_admin", value: await sign({ role: "admin", id: admin.id, storeId: store.id, name: admin.name }) },
  ].map((c) => ({ ...c, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" as const }));

  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ── 모바일 (고객/캐치걸) ──
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.addCookies(cookies);
  const m = await mobile.newPage();
  const shotM = async (name: string, url: string, opts: { full?: boolean; before?: () => Promise<void> } = {}) => {
    await m.goto(BASE + url, { waitUntil: "networkidle" });
    await m.waitForTimeout(700);
    if (opts.before) await opts.before();
    await m.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.full ?? false });
    console.log("📸", name);
  };
  // 로그아웃 상태 홈 먼저 (로그인 페이지 용)
  await shotM("c01-home", `/${slug}`, { full: true });
  await shotM("c02-list", `/${slug}/bartenders`, { full: true });
  await shotM("c03-profile", `/${slug}/bartenders/${junhee.id}`, { full: true });
  await shotM("c03b-profile-comments", `/${slug}/bartenders/${junhee.id}`, { full: true, before: async () => { await m.getByRole("button", { name: /^댓글/ }).click(); await m.waitForTimeout(300); } });
  await shotM("c04-book-date", `/${slug}/book/${junhee.id}`);
  await shotM("c05-book-time", `/${slug}/book/${junhee.id}`, { before: async () => { await m.getByRole("button", { name: /시간 보기/ }).click(); await m.waitForTimeout(500); } });
  await shotM("c06-book-info", `/${slug}/book/${junhee.id}`, {
    before: async () => {
      await m.getByRole("button", { name: /시간 보기/ }).click(); await m.waitForTimeout(400);
      const slot = m.locator("button:not([disabled])").filter({ hasText: /^\d\d:\d\d$/ }).first(); await slot.click(); await m.waitForTimeout(200);
      await m.getByRole("button", { name: /예약하기$/ }).click(); await m.waitForTimeout(400);
    },
  });
  if (doneRes) await shotM("c07-done", `/${slug}/done/${doneRes.id}`);
  await shotM("c08-mypage", `/${slug}/me`, { full: true });
  if (completed) await shotM("c09-review", `/${slug}/review/${completed.id}`);
  // 로그인 화면 (쿠키 없는 컨텍스트)
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const a = await anon.newPage();
  await a.goto(`${BASE}/${slug}/login`, { waitUntil: "networkidle" }); await a.waitForTimeout(500);
  await a.screenshot({ path: path.join(OUT, "c10-login.png") }); console.log("📸 c10-login");
  await anon.close();
  // 캐치걸 포털
  await shotM("s01-staff-calendar", `/${slug}/staff`, { full: true });
  await shotM("s02-staff-reviews", `/${slug}/staff/reviews`, { full: true });
  await mobile.close();

  // ── 데스크톱 (관리자) ──
  const desk = await browser.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1.5 });
  await desk.addCookies(cookies);
  const d = await desk.newPage();
  const shotD = async (name: string, url: string, full = true, before?: () => Promise<void>) => {
    await d.goto(BASE + url, { waitUntil: "networkidle" });
    await d.waitForTimeout(900);
    if (before) await before();
    await d.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
    console.log("📸", name);
  };
  await shotD("a01-dashboard", `/${slug}/admin`);
  await shotD("a02-reservations", `/${slug}/admin/reservations`);
  await shotD("a02b-reservations-calendar", `/${slug}/admin/reservations?view=calendar`);
  await shotD("a02c-reservations-new", `/${slug}/admin/reservations?new=1`, false);
  await shotD("a03-staff", `/${slug}/admin/staff?edit=${junhee.id}`);
  await shotD("a04-customers", `/${slug}/admin/customers`);
  await shotD("a04b-customer-detail", `/${slug}/admin/customers/${yuna.id}`);
  await shotD("a05-reviews", `/${slug}/admin/reviews`);
  await shotD("a06-settings", `/${slug}/admin/settings`);
  await desk.close();
  await browser.close();
  console.log("✅ done →", OUT);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
