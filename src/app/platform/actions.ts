"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { checkPlatformPassword, clearPlatformSession, isPlatform, setPlatformSession } from "@/lib/platform";
import { amountForMonth, logPlatform } from "@/lib/platform-data";
import { SLUG_RE, emailProblem, provisionStore, slugProblem } from "@/lib/provision";
import { COMMITMENT_LABEL, PLANS, commitmentOf, planOf } from "@/lib/plans";
import { PENDING_REASON, TERMS_VERSION, formatBizNumber, isValidBizNumber } from "@/lib/terms";
import { barLicenseProblem } from "@/lib/bar";

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
    .regex(SLUG_RE, "주소는 영문 소문자·숫자·하이픈만 쓸 수 있어요"),
  adminEmail: z.string().trim().email("이메일 형식을 확인해 주세요"),
  adminPassword: z.string().min(4, "비밀번호는 4자 이상으로 정해 주세요").max(50),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  shiftSplitTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomCount: z.coerce.number().int().min(1).max(50),
  plan: z.enum(["PRO", "MAX"]).default("PRO"),
  commitment: z.enum(["TERM24", "MONTHLY"]).default("TERM24"),
  agentId: z.string().max(40).default(""),
  theme: z.enum(["rose", "cream", "noir", "wine", "midnight"]).default("rose"),
  contactPhone: z.string().trim().max(30).default(""),
  contactTelegram: z.string().trim().max(40).default(""),
  // 사업자 확인 — 등록증 없이는 열지 않는다
  bizName: z.string().trim().min(1, "등록증의 상호를 적어 주세요").max(60),
  bizNumber: z.string().trim().refine(isValidBizNumber, "사업자등록번호가 맞지 않아요 (10자리, 검증번호 확인)"),
  bizType: z.string().trim().min(1, "업태·종목을 적어 주세요").max(80),
  bizOwner: z.string().trim().min(1, "대표자를 적어 주세요").max(30),
  bizDocUrl: z.string().trim().min(1, "사업자등록증 사본을 올려 주세요").max(300),
  bizVerified: z.literal(true, { errorMap: () => ({ message: "국세청 조회로 사업자 상태와 업종을 확인한 뒤 체크해 주세요" }) }),
  bizVerifyMemo: z.string().trim().max(300).default(""),
  barType: z.enum(["SEATED", "TALKING", "CLASSIC", "MODERN", "COCKTAIL"], { errorMap: () => ({ message: "업장 유형을 골라 주세요" }) }),
  licenseType: z.enum(["ENTERTAINMENT", "DANRAN", "RESTAURANT"], { errorMap: () => ({ message: "영업 허가 종류를 골라 주세요" }) }),
  address: z.string().trim().min(5, "영업장 주소를 적어 주세요").max(120),
  licenseDocUrl: z.string().trim().max(300).default(""),
  venuePhotos: z.array(z.string()).max(3).default([]),
  // 약관 — 대표자가 읽고 동의했음을 파는 쪽이 확인한다
  termsAgreed: z.literal(true, { errorMap: () => ({ message: "약관 동의를 확인해 주세요" }) }),
  termsAgreedBy: z.string().trim().min(1, "약관에 동의한 사람을 적어 주세요").max(60),
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

  const slugErr = await slugProblem(d.slug);
  if (slugErr) return { ok: false, error: slugErr };
  const emailErr = await emailProblem(d.adminEmail);
  if (emailErr) return { ok: false, error: emailErr };
  const lawErr = barLicenseProblem(d.barType, d.licenseType);
  if (lawErr) return { ok: false, error: lawErr };

  try {
    const store = await provisionStore({
      name: d.name,
      slug: d.slug,
      staffLabel: "캐치걸",
      plan: d.plan,
      commitment: d.commitment,
      agentId: d.agentId || null,
      theme: d.theme,
      openTime: d.openTime,
      shiftSplitTime: d.shiftSplitTime,
      closeTime: d.closeTime,
      roomCount: d.roomCount,
      contactPhone: d.contactPhone,
      contactTelegram: d.contactTelegram,
      adminEmail: d.adminEmail,
      adminPassword: d.adminPassword,
      ownerContact: "",
      platformMemo: "",
      biz: { bizName: d.bizName, bizNumber: formatBizNumber(d.bizNumber), bizType: d.bizType, bizOwner: d.bizOwner, bizDocUrl: d.bizDocUrl, bizVerifyMemo: d.bizVerifyMemo },
      bar: { barType: d.barType, licenseType: d.licenseType, licenseDocUrl: d.licenseDocUrl, venuePhotos: d.venuePhotos, address: d.address },
      bizVerifiedAt: new Date(),
      terms: { version: TERMS_VERSION, agreedBy: d.termsAgreedBy },
      isSuspended: false,
      suspendedReason: "",
    });
    await logPlatform("STORE_CREATED", `${d.name} (/${d.slug}) · ${PLANS[d.plan].name} · ${COMMITMENT_LABEL[d.commitment]}`, store.id);
    await logPlatform("BIZ_VERIFIED", `${d.bizName} ${formatBizNumber(d.bizNumber)} · ${d.bizType}${d.bizVerifyMemo ? ` · ${d.bizVerifyMemo}` : ""}`, store.id);
    await logPlatform("TERMS_AGREED", `${TERMS_VERSION} 판 · ${d.termsAgreedBy}`, store.id);
    revalidatePath("/platform");
    return { ok: true, data: { slug: store.slug } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "매장을 만들지 못했어요." };
  }
}

/* ─── 계약 정보 ─── */
const contractSchema = z.object({
  plan: z.enum(["PRO", "MAX"]),
  commitment: z.enum(["TERM24", "MONTHLY"]).default("TERM24"),
  onsiteSetupDone: z.boolean().default(false),
  agentId: z.string().max(40).default(""),
  agentDidOnsite: z.boolean().default(false),
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
  const commitmentChanged = d.commitment !== commitmentOf(store.commitment);
  await prisma.store.update({
    where: { id: store.id },
    data: { plan: d.plan, commitment: d.commitment, onsiteSetupDone: d.onsiteSetupDone, agentId: d.agentId || null, agentDidOnsite: d.agentDidOnsite, ...(planChanged ? { planStartedAt: new Date() } : {}), ownerContact: d.ownerContact, platformMemo: d.platformMemo },
  });
  if (planChanged) await logPlatform("PLAN_CHANGED", `${PLANS[planOf(store.plan)].name} → ${PLANS[d.plan].name}`, store.id);
  else if (commitmentChanged) await logPlatform("CONTRACT_UPDATED", `${COMMITMENT_LABEL[commitmentOf(store.commitment)]} → ${COMMITMENT_LABEL[d.commitment]}`, store.id);
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
/* ─── 사업자 확인 · 약관 ─── */
const bizSchema = z.object({
  bizName: z.string().trim().min(1, "등록증의 상호를 적어 주세요").max(60),
  bizNumber: z.string().trim().refine(isValidBizNumber, "사업자등록번호가 맞지 않아요 (10자리, 검증번호 확인)"),
  bizType: z.string().trim().min(1, "업태·종목을 적어 주세요").max(80),
  bizOwner: z.string().trim().min(1, "대표자를 적어 주세요").max(30),
  bizDocUrl: z.string().trim().max(300).default(""),
  bizVerifyMemo: z.string().trim().max(300).default(""),
  barType: z.string().max(20).default(""),
  licenseType: z.string().max(20).default(""),
  address: z.string().trim().max(120).default(""),
  licenseDocUrl: z.string().trim().max(300).default(""),
  venuePhotos: z.array(z.string()).max(3).default([]),
});

/** 등록증 내용을 고친다. 상호·번호·업종이 바뀌면 확인은 다시 해야 하므로 확인 표시를 지운다. */
export async function updateBizInfo(slug: string, input: z.input<typeof bizSchema>): Promise<R> {
  if (!(await isPlatform())) return denied();
  const p = bizSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  const d = p.data;
  const bizNumber = formatBizNumber(d.bizNumber);
  const identityChanged = bizNumber !== store.bizNumber || d.bizName !== store.bizName || d.bizType !== store.bizType || d.barType !== store.barType || d.licenseType !== store.licenseType || d.address !== store.address;
  if (d.barType && d.licenseType) { const lawErr = barLicenseProblem(d.barType, d.licenseType); if (lawErr) return { ok: false, error: lawErr }; }
  await prisma.store.update({
    where: { id: store.id },
    data: {
      bizName: d.bizName, bizNumber, bizType: d.bizType, bizOwner: d.bizOwner, bizDocUrl: d.bizDocUrl, bizVerifyMemo: d.bizVerifyMemo,
      barType: d.barType, licenseType: d.licenseType, address: d.address, licenseDocUrl: d.licenseDocUrl, venuePhotos: JSON.stringify(d.venuePhotos),
      ...(identityChanged ? { bizVerifiedAt: null } : {}),
    },
  });
  await logPlatform("BIZ_UPDATED", `${d.bizName} ${bizNumber} · ${d.bizType}${identityChanged ? " · 다시 확인 필요" : ""}`, store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/** 국세청 조회까지 마쳤다는 표시. 메모에 조회 결과(계속사업자, 허가 종류)를 남긴다. */
export async function verifyBiz(slug: string, memo: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  if (!store.bizNumber || !store.bizDocUrl) return { ok: false, error: "등록증 사본과 사업자등록번호가 먼저 있어야 해요." };
  if (!store.licenseDocUrl) return { ok: false, error: "영업 허가증·신고증 사본이 먼저 있어야 해요." };
  if (JSON.parse(store.venuePhotos || "[]").length === 0) return { ok: false, error: "업장 사진이 한 장 이상 있어야 해요." };
  if (!store.address) return { ok: false, error: "영업장 주소가 먼저 있어야 해요." };
  const lawErr = barLicenseProblem(store.barType, store.licenseType);
  if (lawErr) return { ok: false, error: lawErr };
  const m = memo.trim().slice(0, 300);
  // 직접 신청해 잠겨 있던 매장은 확인이 곧 승인이다 — 여기서 연다
  const opening = store.isSuspended && store.suspendedReason === PENDING_REASON;
  await prisma.store.update({
    where: { id: store.id },
    // 직접 신청한 매장은 여는 날이 곧 구독 시작일 — 무료 한 달이 여기서부터 돈다
    data: { bizVerifiedAt: new Date(), bizVerifyMemo: m || store.bizVerifyMemo, ...(opening ? { isSuspended: false, suspendedReason: "", planStartedAt: new Date() } : {}) },
  });
  await logPlatform("BIZ_VERIFIED", `${store.bizName} ${store.bizNumber} · ${store.bizType}${m ? ` · ${m}` : ""}`, store.id);
  if (opening) {
    await logPlatform("APPROVED", "가입 신청 승인 — 매장 열림", store.id);
    revalidatePath(`/${slug}`, "layout");
  }
  revalidatePath("/platform", "layout");
  return { ok: true };
}

export async function unverifyBiz(slug: string, reason: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  await prisma.store.update({ where: { id: store.id }, data: { bizVerifiedAt: null } });
  await logPlatform("BIZ_UNVERIFIED", reason.trim().slice(0, 200), store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/** 약관이 새 판으로 바뀐 뒤 매장이 다시 동의했을 때 */
export async function recordTermsAgreement(slug: string, agreedBy: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  const by = agreedBy.trim().slice(0, 60);
  if (!by) return { ok: false, error: "동의한 사람을 적어 주세요." };
  await prisma.store.update({ where: { id: store.id }, data: { termsVersion: TERMS_VERSION, termsAgreedAt: new Date(), termsAgreedBy: by } });
  await logPlatform("TERMS_AGREED", `${TERMS_VERSION} 판 · ${by}`, store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/* ─── 담당직원 ─── */
const agentSchema = z.object({
  name: z.string().trim().min(1, "이름을 적어 주세요").max(20),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9가-힣]{2,10}$/, "코드는 2~10자 영문·숫자로"),
  contact: z.string().trim().max(60).default(""),
  loginId: z.string().trim().min(3, "아이디는 3자 이상").max(30),
  password: z.string().min(6, "비밀번호는 6자 이상").max(50),
});
export async function createAgent(input: z.input<typeof agentSchema>): Promise<R> {
  if (!(await isPlatform())) return denied();
  const p = agentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  if (await prisma.agent.findUnique({ where: { code: d.code } })) return { ok: false, error: "이미 쓰는 코드예요." };
  if (await prisma.agent.findUnique({ where: { loginId: d.loginId } })) return { ok: false, error: "이미 쓰는 아이디예요." };
  const a = await prisma.agent.create({ data: { name: d.name, code: d.code, contact: d.contact, loginId: d.loginId, passwordHash: await bcrypt.hash(d.password, 10) } });
  await logPlatform("AGENT_CREATED", `${a.name} (${a.code})`);
  revalidatePath("/platform", "layout");
  return { ok: true };
}
export async function updateAgent(id: string, input: { name: string; contact: string; isActive: boolean }): Promise<R> {
  if (!(await isPlatform())) return denied();
  const name = input.name.trim().slice(0, 20);
  if (!name) return { ok: false, error: "이름을 적어 주세요." };
  const a = await prisma.agent.update({ where: { id }, data: { name, contact: input.contact.trim().slice(0, 60), isActive: !!input.isActive } });
  await logPlatform("AGENT_UPDATED", `${a.name} (${a.code}) · ${a.isActive ? "활동" : "비활성"}`);
  revalidatePath("/platform", "layout");
  return { ok: true };
}
export async function setAgentPassword(id: string, password: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  if (password.length < 6) return { ok: false, error: "비밀번호는 6자 이상이에요." };
  await prisma.agent.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { ok: true };
}
/** 커미션 지급 표시 — 확정된 매장에만. 직원 화면에 '지급 완료' 로 뜬다. */
export async function markCommissionPaid(slug: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  if (!store.agentId) return { ok: false, error: "담당직원이 없는 매장이에요." };
  await prisma.store.update({ where: { id: store.id }, data: { commissionPaidAt: new Date() } });
  await logPlatform("COMMISSION_PAID", "담당직원 커미션 지급", store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}
export async function unmarkCommissionPaid(slug: string): Promise<R> {
  if (!(await isPlatform())) return denied();
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  await prisma.store.update({ where: { id: store.id }, data: { commissionPaidAt: null } });
  await logPlatform("COMMISSION_UNPAID", "커미션 지급 표시 취소", store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/* ─── CMS 자동이체 ─── */
const cmsSchema = z.object({
  memberNo: z.string().trim().max(40).default(""),
  agreed: z.boolean().default(false),
  note: z.string().trim().max(120).default(""),
});
export async function updateCms(slug: string, input: z.input<typeof cmsSchema>): Promise<R> {
  if (!(await isPlatform())) return denied();
  const p = cmsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const store = await storeBySlug(slug);
  if (!store) return { ok: false, error: "매장을 찾을 수 없어요." };
  const d = p.data;
  await prisma.store.update({
    where: { id: store.id },
    data: { cmsMemberNo: d.memberNo, cmsNote: d.note, cmsAgreedAt: d.agreed ? (store.cmsAgreedAt ?? new Date()) : null },
  });
  await logPlatform("CMS_UPDATED", `회원번호 ${d.memberNo || "없음"} · 동의 ${d.agreed ? "받음" : "없음"}`, store.id);
  revalidatePath("/platform", "layout");
  return { ok: true };
}

/** 출금 결과 반영 — 성공한 회원번호들을 그 달 입금으로 한 번에 표시 */
export async function markPaidBulk(month: string, memberNos: string[]): Promise<R<{ marked: number; unknown: string[] }>> {
  if (!(await isPlatform())) return denied();
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "달을 확인해 주세요." };
  const nos = Array.from(new Set(memberNos.map((s) => s.trim()).filter(Boolean))).slice(0, 500);
  if (nos.length === 0) return { ok: false, error: "회원번호가 없어요." };
  const stores = await prisma.store.findMany({ where: { cmsMemberNo: { in: nos } } });
  const found = new Set(stores.map((s) => s.cmsMemberNo));
  for (const store of stores) {
    const amount = amountForMonth(store, month);
    await prisma.payment.upsert({
      where: { storeId_month: { storeId: store.id, month } },
      create: { storeId: store.id, month, amount, memo: "CMS 출금" },
      update: { paidAt: new Date(), amount, memo: "CMS 출금" },
    });
    await logPlatform("PAID", `${month} · ${amount.toLocaleString("ko-KR")}원 · CMS`, store.id);
  }
  revalidatePath("/platform", "layout");
  return { ok: true, data: { marked: stores.length, unknown: nos.filter((n) => !found.has(n)) } };
}

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
  const amount = amountForMonth(store, month);
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
