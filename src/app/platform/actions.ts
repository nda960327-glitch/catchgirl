"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPlatformPassword, clearPlatformSession, isPlatform, setPlatformSession } from "@/lib/platform";
import { DEFAULT_SOURCES } from "@/lib/sources";
import { DEFAULT_GRADE_BENEFITS } from "@/lib/discounts";
import { FIXED_NOTICE } from "@/lib/notices";

export type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

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
  if (!(await isPlatform())) return { ok: false, error: "권한이 없어요." };
  const p = storeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;

  if (["platform", "api", "assets", "_next"].includes(d.slug)) {
    return { ok: false, error: "쓸 수 없는 주소예요." };
  }
  if (await prisma.store.findUnique({ where: { slug: d.slug } })) {
    return { ok: false, error: "이미 쓰고 있는 주소예요." };
  }
  if (await prisma.adminUser.findUnique({ where: { email: d.adminEmail } })) {
    return { ok: false, error: "이미 쓰고 있는 관리자 이메일이에요." };
  }

  try {
    const store = await prisma.store.create({
      data: {
        name: d.name,
        slug: d.slug,
        plan: d.plan,
        openTime: d.openTime,
        shiftSplitTime: d.shiftSplitTime,
        closeTime: d.closeTime,
        contactPhone: d.contactPhone,
        contactTelegram: d.contactTelegram,
      },
    });

    await prisma.adminUser.create({
      data: {
        storeId: store.id,
        email: d.adminEmail,
        passwordHash: await bcrypt.hash(d.adminPassword, 10),
        name: "매니저",
      },
    });

    // 첫날부터 배치를 짤 수 있게 룸을 만들어 둔다
    await prisma.room.createMany({
      data: Array.from({ length: d.roomCount }, (_, i) => ({
        storeId: store.id,
        name: `${i + 1}번 룸`,
        sortOrder: i,
      })),
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
    // (앱 성격을 밝히는 고정 안내는 코드에 있어 따로 만들지 않는다 — FIXED_NOTICE)
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

    void FIXED_NOTICE; // 고정 안내는 코드에서 그린다 — 여기서 만들지 않는다는 표시
    revalidatePath("/platform");
    return { ok: true, data: { slug: store.slug } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "매장을 만들지 못했어요." };
  }
}

/** 요금제만 바꾼다 — 청구 연동 전까지는 여기서 손으로 맞춘다 */
export async function setStorePlanFromPlatform(slug: string, plan: "PRO" | "MAX"): Promise<R> {
  if (!(await isPlatform())) return { ok: false, error: "권한이 없어요." };
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  await prisma.store.update({ where: { id: store.id }, data: { plan, planStartedAt: new Date() } });
  revalidatePath("/platform");
  return { ok: true };
}
