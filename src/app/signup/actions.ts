"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { logPlatform } from "@/lib/platform-data";
import { SLUG_RE, emailProblem, provisionStore, slugProblem } from "@/lib/provision";
import { PENDING_REASON, TERMS_VERSION, formatBizNumber, isValidBizNumber } from "@/lib/terms";
import { MAX_FULL, MAX_THUMB, decodeDataUrl } from "@/lib/image-server";

export type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * 업체가 직접 매장을 신청한다.
 *
 * 콘솔에서 파는 쪽이 만드는 것과 같은 한 벌이 생기지만, 잠근 채로 생긴다.
 * 등록증과 업종을 운영사가 홈택스에서 확인하고 콘솔에서 "확인 완료" 를 눌러야 열린다.
 * 그 전까지 손님·직원·관리자 화면은 "확인 중" 안내만 보인다.
 */
const signupSchema = z.object({
  name: z.string().trim().min(1, "매장 이름을 입력해 주세요").max(30),
  slug: z.string().trim().min(2, "주소는 2자 이상이어야 해요").max(30).regex(SLUG_RE, "주소는 영문 소문자·숫자·하이픈만 쓸 수 있어요"),
  adminEmail: z.string().trim().email("이메일 형식을 확인해 주세요"),
  adminPassword: z.string().min(6, "비밀번호는 6자 이상으로 정해 주세요").max(50),
  plan: z.enum(["PRO", "MAX"]).default("PRO"),
  theme: z.enum(["rose", "cream", "noir", "wine", "midnight"]).default("rose"),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  shiftSplitTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomCount: z.coerce.number().int().min(1).max(50),
  contactPhone: z.string().trim().max(30).default(""),
  contactTelegram: z.string().trim().max(40).default(""),
  ownerContact: z.string().trim().min(1, "연락받을 전화나 텔레그램을 적어 주세요").max(120),
  bizName: z.string().trim().min(1, "등록증의 상호를 적어 주세요").max(60),
  bizNumber: z.string().trim().refine(isValidBizNumber, "사업자등록번호가 맞지 않아요 (10자리를 확인해 주세요)"),
  bizType: z.string().trim().min(1, "업태·종목을 적어 주세요").max(80),
  bizOwner: z.string().trim().min(1, "대표자를 적어 주세요").max(30),
  // 등록증 사본 — 세션이 없어 업로드 API 를 못 쓰므로 신청서에 같이 담아 보낸다
  bizDoc: z.object({ full: z.string().min(1, "사업자등록증 사본을 올려 주세요"), thumb: z.string().min(1) }),
  termsAgreed: z.literal(true, { errorMap: () => ({ message: "약관에 동의해 주세요" }) }),
  termsAgreedBy: z.string().trim().min(1, "동의하는 분의 이름을 적어 주세요").max(60),
  /** 봇이 채우는 칸 — 사람은 못 본다. 채워져 있으면 조용히 성공한 척한다 */
  website: z.string().max(200).default(""),
});

export async function signupStore(input: z.input<typeof signupSchema>): Promise<R<{ slug: string }>> {
  const p = signupSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  if (d.website) return { ok: true, data: { slug: d.slug } };

  const full = decodeDataUrl(d.bizDoc.full, MAX_FULL);
  const thumb = decodeDataUrl(d.bizDoc.thumb, MAX_THUMB);
  if (!full || !thumb) return { ok: false, error: "등록증 사본 이미지를 읽을 수 없어요. 다시 올려 주세요." };

  const slugErr = await slugProblem(d.slug);
  if (slugErr) return { ok: false, error: slugErr };
  const emailErr = await emailProblem(d.adminEmail);
  if (emailErr) return { ok: false, error: emailErr };

  try {
    const img = await prisma.image.create({ data: { mime: full.mime, data: full.buf, thumb: thumb.buf }, select: { id: true } });
    const store = await provisionStore({
      name: d.name,
      slug: d.slug,
      plan: d.plan,
      theme: d.theme,
      openTime: d.openTime,
      shiftSplitTime: d.shiftSplitTime,
      closeTime: d.closeTime,
      roomCount: d.roomCount,
      contactPhone: d.contactPhone,
      contactTelegram: d.contactTelegram.replace(/^@/, ""),
      adminEmail: d.adminEmail,
      adminPassword: d.adminPassword,
      ownerContact: d.ownerContact,
      platformMemo: `직접 신청 (${new Date().toLocaleDateString("ko-KR")})`,
      biz: { bizName: d.bizName, bizNumber: formatBizNumber(d.bizNumber), bizType: d.bizType, bizOwner: d.bizOwner, bizDocUrl: `/api/img/${img.id}`, bizVerifyMemo: "" },
      bizVerifiedAt: null,
      terms: { version: TERMS_VERSION, agreedBy: d.termsAgreedBy },
      isSuspended: true,
      suspendedReason: PENDING_REASON,
    });
    await prisma.image.update({ where: { id: img.id }, data: { storeId: store.id } });
    await logPlatform("SIGNUP", `${d.name} (/${d.slug}) · ${d.bizName} ${formatBizNumber(d.bizNumber)} · ${d.bizType} · 연락 ${d.ownerContact}`, store.id);
    await logPlatform("TERMS_AGREED", `${TERMS_VERSION} 판 · ${d.termsAgreedBy} (직접 신청)`, store.id);
    return { ok: true, data: { slug: store.slug } };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message.includes("Unique constraint") ? "이미 쓰고 있는 주소나 이메일이에요." : "신청을 저장하지 못했어요. 잠시 뒤 다시 해 주세요." };
  }
}
