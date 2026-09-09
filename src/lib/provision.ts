import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { DEFAULT_SOURCES } from "./sources";
import { DEFAULT_GRADE_BENEFITS } from "./discounts";
import { THEMES, type ThemeKey } from "./themes";
import type { Commitment, Plan } from "./plans";

/**
 * 매장 한 벌 만들기 — 콘솔에서 파는 쪽이 만들 때와 업체가 /signup 에서 직접 신청할 때
 * 똑같이 쓴다. 두 군데서 따로 만들면 한쪽만 룸이 없거나 공지가 빠지는 식으로 어긋난다.
 *
 * 매장만 만들어 두면 관리자가 로그인해서 룸·옵션·공지·방문경로를 처음부터 채워야
 * 하고, 그 상태로는 첫날 영업이 안 된다. 그래서 바로 쓸 수 있는 기본값을 같이 넣는다.
 */

/** 매장 주소로 쓸 수 없는 이름 — 앱의 다른 경로와 부딪힌다 */
export const RESERVED_SLUGS = ["platform", "api", "assets", "_next", "www", "app", "signup", "demo", "agent", "terms", "login", "admin", "staff", "opengraph-image", "twitter-image", "icon", "apple-icon"];

export const SLUG_RE = /^[a-z0-9-]+$/;

/** 주소가 쓸 수 있는지. 문제가 있으면 사람이 읽을 이유를 돌려준다. */
export async function slugProblem(slug: string): Promise<string | null> {
  if (RESERVED_SLUGS.includes(slug)) return "쓸 수 없는 주소예요.";
  if (await prisma.store.findUnique({ where: { slug } })) return "이미 쓰고 있는 주소예요.";
  return null;
}

export async function emailProblem(email: string): Promise<string | null> {
  if (await prisma.adminUser.findUnique({ where: { email } })) return "이미 쓰고 있는 관리자 이메일이에요.";
  return null;
}

export type ProvisionInput = {
  name: string;
  slug: string;
  /** 직원 호칭 — 캐치걸·매니저·바텐더 */
  staffLabel: string;
  plan: Plan;
  commitment: Commitment;
  /** 데려온 담당직원 — 없으면 null */
  agentId: string | null;
  theme: ThemeKey;
  openTime: string;
  shiftSplitTime: string;
  closeTime: string;
  roomCount: number;
  contactPhone: string;
  contactTelegram: string;
  adminEmail: string;
  adminPassword: string;
  ownerContact: string;
  platformMemo: string;
  biz: { bizName: string; bizNumber: string; bizType: string; bizOwner: string; bizDocUrl: string; bizVerifyMemo: string };
  /** 바 인증 — 유형, 허가, 허가증, 업장 사진, 주소 */
  bar: { barType: string; licenseType: string; licenseDocUrl: string; venuePhotos: string[]; address: string };
  /** 콘솔에서 확인하고 만들면 지금, 업체가 직접 신청하면 null (확인 뒤에 채운다) */
  bizVerifiedAt: Date | null;
  terms: { version: string; agreedBy: string };
  /** 확인 전 매장은 잠근 채로 만든다 */
  isSuspended: boolean;
  suspendedReason: string;
};

export async function provisionStore(d: ProvisionInput) {
  const store = await prisma.store.create({
    data: {
      name: d.name,
      slug: d.slug,
      staffLabel: d.staffLabel || "캐치걸",
      plan: d.plan,
      commitment: d.commitment,
      agentId: d.agentId,
      theme: d.theme,
      themeColor: THEMES[d.theme].brand,
      openTime: d.openTime,
      shiftSplitTime: d.shiftSplitTime,
      closeTime: d.closeTime,
      contactPhone: d.contactPhone,
      contactTelegram: d.contactTelegram,
      ownerContact: d.ownerContact,
      platformMemo: d.platformMemo,
      bizName: d.biz.bizName,
      bizNumber: d.biz.bizNumber,
      bizType: d.biz.bizType,
      bizOwner: d.biz.bizOwner,
      bizDocUrl: d.biz.bizDocUrl,
      bizVerifyMemo: d.biz.bizVerifyMemo,
      barType: d.bar.barType,
      licenseType: d.bar.licenseType,
      licenseDocUrl: d.bar.licenseDocUrl,
      venuePhotos: JSON.stringify(d.bar.venuePhotos),
      address: d.bar.address,
      bizVerifiedAt: d.bizVerifiedAt,
      termsVersion: d.terms.version,
      termsAgreedAt: new Date(),
      termsAgreedBy: d.terms.agreedBy,
      isSuspended: d.isSuspended,
      suspendedReason: d.suspendedReason,
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
  return store;
}
