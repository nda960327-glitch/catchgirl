"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { checkPlatformPassword, clearPlatformSession, isPlatform, setPlatformSession } from "@/lib/platform";
import { logPlatform } from "@/lib/platform-data";
import { DEFAULT_SOURCES } from "@/lib/sources";
import { DEFAULT_GRADE_BENEFITS } from "@/lib/discounts";
import { THEMES } from "@/lib/themes";
import { PLANS, billedPrice, planOf } from "@/lib/plans";

export type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const denied = (): R<never> => ({ ok: false, error: "권한이 없어요." });

const storeBySlug = (slug: string) => prisma.store.findUnique({ where: { slug } });

/* ─── 콘솔 로그인 ─── */
export async function loginPlatform(form: FormData): Promise<R> {
  const pw = String(form.get("password") ?? "");
  if (!checkPlatformPassword(pw)) return { ok: false, error: "비밀번호가 맞지 않아요." };
  await setPlatformSession();
  redirect("/platform");
}

export async function logoutPlatform() {
  await clearPlatformSession();
  redirect("/platform/login");
}

/* ─── 매장 만들기 ─── */
const storeSchema = z.object({
  name: z.string().trim().min(1, "매장 이름을 입력해 주세요").max(30),
  slug: z
    .string()
    .trim()
    .min(2, "주소는 2자 이상이어야 해요")
    .max(30)
    .regex(/^[a-z0-9-]+$/, "주소는 영문 소문자·숫자·하이픈만 쓸 수 있어요"),
  adminEmail: z.string().trim().email("이메일 형식을 확인해 주세요"),
  adminPassword: z.string().min(4, "비밀번호는 4자 이상으로 정해 주세요").max(50),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  shiftSplitTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomCount: z.coerce.number().int().min(1).max(50),
  plan: z.enum(["PRO", "MAX"]).default("PRO"),
  theme: z.enum(["rose", "cream", "noir", "wine", "midnight"]).default("rose"),
  contactPhone: z.string().trim().max(30).default(""),
  contactTelegram: z.string().trim().max(40).default(""),
});

/**
 * 새 매장 한 벌을 통째로 만든다.
 *
 * 매장만 만들어 두면 관리자가 로그인해서 룸·옵션·공지·사이트 목록을 처음부터
 * 채워야 하고, 그 상태로는 첫날 영업이 안 된다. 그래서 바로 쓸 수 있는 기본값을
 * 같이 넣어 준다 — 매장이 나중에 고치면 되는 것들이다.
 */
export async function createStore(input: z.input<typeof storeSchema>): Promise<R<{ slug: string }>> {
  if (!(await isPlatform())) return denied();
  const p = storeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;

  if (["platform", "api", "assets", "_next", "www", "app"].includes(d.slug)) return { ok: false, error: "쓸 수 없는 주소예요." };
  if (await prisma.store.findUnique({ where: { slug: d.slug } })) return { ok: false, error: "이미 쓰고 있는 주소예요." };
  if (await prisma.adminUser.findUnique({ where: { email: d.adminEmail } })) return { ok: false, error: "이미 쓰고 있는 관리자 이메일이에요." };

  try {
    const store = await prisma.store.create({
      data: {
        name: d.name,
        slug: d.slug,
        plan: d.plan,
        theme: d.theme,
        themeColor: THEMES[d.theme].brand,
        openTime: d.openTime,
        shiftSplitTime: d.shiftSplitTime,
        closeTime: d.closeTime,
        contactPhone: d.contactPhone,
        contactTelegram: d.contactTelegram,
      },
    });
    await prisma.adminUser.create({
      data: { storeId: store.id, email: d.adminEmail, passwordHash: await bcrypt.hash(d.adminPassword, 10), name: "매니저" },
    });
    // 첫날부터 배치를 짤 수 있게 룸을 만들어 둔다
    await prisma.room.createMany({
      data: Array.from({ length: d.roomCount }, (_, i) => ({ storeId: store.id, name: `${i + 1}번 룸`, sortOrder: i })),
    });
    // 옵션은 매장마다 이름이 다르지만, 두 칸 있는 형태는 공통이라 틀만 준다
    await prisma.storeOption.createMany({
      data: [
        { storeId: store.id, name: "옵션1", price: 50_000, sortOrder: 0 },
        { storeId: store.id, name: "옵션2", price: 50_000, sortOrder: 1 },
      ],
    });
    await prisma.gradeBenefit.createMany({
      data: DEFAULT_GRADE_BENEFITS.map((b) => ({ storeId: store.id, grade: b.grade, amount: b.amount, note: b.note })),
    });
    await prisma.referralSource.createMany({
      data: DEFAULT_SOURCES.map((s, i) => ({ storeId: store.id, name: s.name, tier: s.tier, sortOrder: i })),
    });
    // 손님이 처음 들어왔을 때 빈 화면을 보지 않도록 안내 공지를 넣어 둔다.
    // (앱 성격을 밝히는 고정 안내는 코드에 있어 따로 만들지 않는다)
    await prisma.notice.createMany({
      data: [
        {
          storeId: store.id,
          title: "초대받은 분만 이용하실 수 있어요",
          body:
            "이곳은 기존에 방문해 주신 분들을 위해 조용히 열어둔 공간이에요.\n" +
            "주소나 화면을 다른 분께 공유하시면 예약이 제한될 수 있어요.\n" +
            "새로 함께 오고 싶은 분이 계시면 매장에 먼저 말씀해 주세요.",
          isPinned: true,
          sortOrder: 0,
        },
        {
          storeId: store.id,
          title: "시작하려면 연결코드가 필요해요",
          body:
            "계정은 매장에서 받은 연결코드로만 만들 수 있어요.\n" +
            "카톡·전화로 예약하시던 분은 그동안의 방문 기록을 그대로 이어받으실 수 있어요.\n" +
            "한 번 시작하신 뒤로는 닉네임과 PIN으로 바로 들어오실 수 있어요.",
          isPinned: true,
          sortOrder: 1,
        },
      ],
    });
    await logPlatform("STORE_CREATED", `${d.name} (/${d.slug}) · ${PLANS[d.plan].name}`, store.id);
    revalidatePath("/platform");
    return { ok: true, data: { slug: store.slug } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "매장을 만들지 못했어요." };
  }
}

/* ─── 계약 정보 ─── */
const contractSchema = z.object({
  plan: z.enum(["PRO", "MAX"]),
  ownerContact: z.string().trim().max(120).default(""),
  platformMemo: z.string().trim().max(1000).default(""),
});

/** 요금제·담당자 연락처·메모. 요금제가 바뀌면 그날부터 새로 센다. */
export async function updateStoreFromPlatform(slug: string, input: z.input<typeof contractSchema>): Promise<R> {
  if (!(await isPlatform())) return denied();
  const p = contractSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  const d = p.data;
  const planChanged = d.plan !== store.plan;
  await prisma.store.update({
    where: { id: store.id },
    data: { plan: d.plan, ...(planChanged ? { planStartedAt: new Date() } : {}), ownerContact: d.ownerContact, platformMemo: d.platformMemo },
  });
  if (planChanged) await logPlatform("PLAN_CHANGED", `${PLANS[planOf(store.plan)].name} → ${PLANS[d.plan].name}`, store.id);
  else await logPlatform("CONTRACT_UPDATED", "연락처·메모", store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/* ─── 업체 관리자 계정 ─── */
const adminLoginSchema = z.object({
  email: z.string().trim().email("이메일 형식을 확인해 주세요"),
  password: z.string().max(50).default(""),
});

/** 업체 관리자 이메일·비밀번호를 콘솔에서 새로 정한다 — 비밀번호를 잊었다고 할 때 */
export async function setStoreAdminLogin(slug: string, input: z.input<typeof adminLoginSchema>): Promise<R> {
  if (!(await isPlatform())) return denied();
  const p = adminLoginSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  const d = p.data;
  if (d.password && d.password.length < 4) return { ok: false, error: "비밀번호는 4자 이상으로 정해 주세요." };
  const taken = await prisma.adminUser.findUnique({ where: { email: d.email } });
  if (taken && taken.storeId !== store.id) return { ok: false, error: "다른 매장이 쓰는 이메일이에요." };
  const admin = await prisma.adminUser.findFirst({ where: { storeId: store.id }, orderBy: { id: "asc" } });

  if (admin) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { email: d.email, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}) },
    });
  } else {
    if (!d.password) return { ok: false, error: "관리자가 없어 비밀번호가 필요해요." };
    await prisma.adminUser.create({ data: { storeId: store.id, email: d.email, passwordHash: await bcrypt.hash(d.password, 10), name: "매니저" } });
  }
  await logPlatform("ADMIN_RESET", `${d.email}${d.password ? " · 비밀번호 변경" : ""}`, store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/**
 * 그 업체 관리자 화면으로 바로 들어간다 — 대신 손봐 줄 때.
 * 설정 화면을 콘솔에 또 만들지 않고 업체가 쓰는 화면을 그대로 쓴다.
 */
export async function enterStoreAsAdmin(slug: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  const admin = await prisma.adminUser.findFirst({ where: { storeId: store.id }, orderBy: { id: "asc" } });
  if (!admin) return { ok: false, error: "이 매장에 관리자 계정이 없어요. 먼저 만들어 주세요." };
  await setSession({ role: "admin", id: admin.id, storeId: store.id, name: `${admin.name} (플랫폼)` });
  await logPlatform("ENTERED_AS_ADMIN", admin.email, store.id);
  redirect(`/${slug}/admin`);
}

/* ─── 이용 정지 · 재개 · 삭제 ─── */
export async function suspendStore(slug: string, reason: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  await prisma.store.update({ where: { id: store.id }, data: { isSuspended: true, suspendedReason: reason.trim().slice(0, 200) } });
  await logPlatform("SUSPENDED", reason.trim().slice(0, 200), store.id);
  revalidatePath("/platform", "layout");
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

export async function resumeStore(slug: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  await prisma.store.update({ where: { id: store.id }, data: { isSuspended: false, suspendedReason: "" } });
  await logPlatform("RESUMED", "", store.id);
  revalidatePath("/platform", "layout");
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/** 매장을 지운다. 주소를 그대로 다시 쳐야만 지워진다 — 손님·예약·매출이 전부 같이 사라진다. */
export async function deleteStore(slug: string, confirmSlug: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  if (confirmSlug.trim() !== slug) return { ok: false, error: "확인을 위해 매장 주소를 그대로 입력해 주세요." };
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  // 기록은 매장이 사라져도 남아야 하므로 storeId 없이 이름을 적어 둔다
  await logPlatform("STORE_DELETED", `${store.name} (/${slug})`, null);
  await prisma.store.delete({ where: { id: store.id } });
  revalidatePath("/platform", "layout");
  redirect("/platform");
}

/* ─── 입금 ─── */
export async function markPaid(slug: string, month: string, memo = ""): Promise<R> {
  if (!(await isPlatform())) return denied();
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "달을 확인해 주세요." };
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  const amount = billedPrice(planOf(store.plan));
  await prisma.payment.upsert({
    where: { storeId_month: { storeId: store.id, month } },
    create: { storeId: store.id, month, amount, memo: memo.trim().slice(0, 200) },
    update: { paidAt: new Date(), amount, memo: memo.trim().slice(0, 200) },
  });
  await logPlatform("PAID", `${month} · ${amount.toLocaleString("ko-KR")}원`, store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

export async function unmarkPaid(slug: string, month: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  await prisma.payment.deleteMany({ where: { storeId: store.id, month } });
  await logPlatform("UNPAID", month, store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/* ─── 전체 공지 ─── */
const broadcastSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요").max(40),
  body: z.string().trim().min(1, "내용을 입력해 주세요").max(1000),
  isPinned: z.boolean().default(true),
});

/** 점검 안내처럼 모든 업체 손님 화면에 한 번에 띄우는 공지 */
export async function broadcastNotice(input: z.input<typeof broadcastSchema>): Promise<R<{ count: number }>> {
  if (!(await isPlatform())) return denied();
  const p = broadcastSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const stores = await prisma.store.findMany({ where: { isSuspended: false }, select: { id: true } });
  await prisma.notice.createMany({
    data: stores.map((s) => ({ storeId: s.id, title: p.data.title, body: p.data.body, isPinned: p.data.isPinned, sortOrder: -1 })),
  });
  await logPlatform("BROADCAST", `${p.data.title} → ${stores.length}곳`, null);
  revalidatePath("/", "layout");
  return { ok: true, data: { count: stores.length } };
}
