/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const at = (daysFromToday: number, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(h, m, 0, 0);
  return d;
};
const slotKey = (staffId: string, start: Date, seq = 0) => `${staffId}|${start.toISOString()}|${seq}`;
let codeSeq = 100;
const code = (d: Date) => `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${String(codeSeq++).padStart(4, "0")}`;

async function main() {
  console.log("🧹 기존 데이터 정리...");
  await prisma.favorite.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.staffOff.deleteMany();
  await prisma.staffSchedule.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.store.deleteMany();

  console.log("🏪 매장 생성...");
  const store = await prisma.store.create({
    data: {
      name: "캐치걸",
      slug: "secret-garden",
      tagline: "오늘 밤, 당신의 캐치걸",
      logoUrl: "/assets/icon.webp",
      coverUrl: null,
      themeColor: "#B4586A",
      openTime: "15:00",
      closeTime: "23:00",
      slotMinutes: 30,
      closedDays: "[]",
      cancelDeadlineHours: 2,
      maxAdvanceDays: 14,
      noshowPolicy: "예약 시간 15분 경과 시 노쇼 처리되며, 노쇼 3회 누적 시 예약이 제한될 수 있어요.",
    },
  });

  const pw = await bcrypt.hash("1234", 10);
  await prisma.adminUser.create({
    data: { storeId: store.id, email: "admin@catchgirl.app", passwordHash: pw, name: "매니저" },
  });

  console.log("🍸 캐치걸 3명...");
  const staffDefs = [
    {
      nickname: "준희",
      realName: "김준희",
      loginId: "junhee",
      bio: "처음 오신 분께도 먼저 다가가 편하게 말을 건네요. 조용히 있고 싶은 날엔 옆에서 다정하게 자리를 지켜드려요.",
      tags: ["상냥함", "청순함", "조용한대화"],
      photos: ["/assets/p1.webp", "/assets/p4.webp", "/assets/p7.webp"],
      sortOrder: 0,
      days: [0, 2, 3, 4, 5, 6],
    },
    {
      nickname: "태리",
      realName: "박태리",
      loginId: "taeri",
      bio: "말을 정말 잘하고 리액션이 좋아요. 오늘 있었던 이야기를 들려주시면 끝까지 들어드릴게요.",
      tags: ["말잘함", "수다환영", "서비스좋음"],
      photos: ["/assets/p2.webp", "/assets/p5.webp", "/assets/p8.webp"],
      sortOrder: 1,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
      nickname: "아인",
      realName: "이아인",
      loginId: "ain",
      bio: "귀여운 외모에 마음씨도 착해요. 기념일이면 작은 이벤트도 직접 챙겨드려요.",
      tags: ["외모귀여움", "착함", "기념일"],
      photos: ["/assets/p3.webp", "/assets/p6.webp", "/assets/p9.webp"],
      sortOrder: 2,
      days: [0, 1, 3, 4, 5, 6],
    },
  ];
  const staff: Record<string, { id: string }> = {};
  for (const s of staffDefs) {
    const created = await prisma.staff.create({
      data: {
        storeId: store.id,
        nickname: s.nickname,
        realName: s.realName,
        bio: s.bio,
        tags: JSON.stringify(s.tags),
        photos: JSON.stringify(s.photos),
        capacityPerSlot: 1,
        sortOrder: s.sortOrder,
        loginId: s.loginId,
        passwordHash: pw,
        schedules: { create: s.days.map((weekday) => ({ weekday, startTime: "15:00", endTime: "23:00" })) },
      },
    });
    staff[s.nickname] = created;
  }
  // 태리 3일 뒤 휴무
  const off = new Date();
  off.setDate(off.getDate() + 3);
  await prisma.staffOff.create({ data: { staffId: staff["태리"].id, date: ymd(off), reason: "개인 휴무" } });

  console.log("👤 고객 5명...");
  const custDefs = [
    { nickname: "유나", phone: "010-1111-0001", memo: "조용한 대화 선호, 창가 자리. 준희 단골.", name: "김유나", birthday: "1996-03-14", gender: "F", instagram: "yuna_night", referral: "인스타그램", email: "yuna@example.com" },
    { nickname: "제이", phone: "010-2222-0002", memo: "노쇼 이력 2회 — 예약 확인 전화 필요", name: "박제이", birthday: "1993-11-02", gender: "M", referral: "지인 소개" },
    { nickname: "하루", phone: "010-3333-0003", memo: "", name: "이하루", birthday: "1998-07-21", gender: "F", instagram: "haru.day", referral: "검색" },
    { nickname: "쏘니", phone: "010-4444-0004", memo: "기념일 방문. 이벤트 좋아함", name: "손예진", birthday: "1995-09-09", gender: "F", referral: "인스타그램" },
    { nickname: "무민", phone: "010-5555-0005", memo: "", gender: "M", referral: "지나가다" },
  ];
  const cust: Record<string, { id: string }> = {};
  for (const c of custDefs) {
    cust[c.nickname] = await prisma.customer.create({
      data: { storeId: store.id, nickname: c.nickname, phone: c.phone, adminMemo: c.memo, name: c.name ?? null, birthday: c.birthday ?? null, gender: c.gender ?? null, instagram: c.instagram ?? null, referral: c.referral ?? null, email: c.email ?? null },
    });
  }

  console.log("📅 예약 생성...");
  type R = { c: string; s: string; day: number; t: string; status: string; note?: string; by?: string };
  const rs: R[] = [
    // ── 오늘 (데모 핵심) ──
    { c: "유나", s: "준희", day: 0, t: "15:30", status: "CONFIRMED", note: "창가 자리 부탁드려요" },
    { c: "하루", s: "준희", day: 0, t: "19:00", status: "CONFIRMED" },
    { c: "무민", s: "준희", day: 0, t: "21:30", status: "CONFIRMED" },
    { c: "쏘니", s: "태리", day: 0, t: "18:00", status: "CONFIRMED", note: "케이크 반입 가능할까요?" },
    { c: "제이", s: "태리", day: 0, t: "20:00", status: "CONFIRMED", by: "ADMIN" },
    { c: "유나", s: "아인", day: 0, t: "19:30", status: "CONFIRMED" },
    // ── 과거: 유나 방문 7회(단골) ──
    { c: "유나", s: "준희", day: -3, t: "19:00", status: "COMPLETED" },
    { c: "유나", s: "준희", day: -10, t: "20:00", status: "COMPLETED" },
    { c: "유나", s: "준희", day: -17, t: "19:30", status: "COMPLETED" },
    { c: "유나", s: "준희", day: -24, t: "21:00", status: "COMPLETED" },
    { c: "유나", s: "태리", day: -31, t: "18:30", status: "COMPLETED" },
    { c: "유나", s: "준희", day: -38, t: "19:00", status: "COMPLETED" },
    { c: "유나", s: "준희", day: -45, t: "20:30", status: "COMPLETED" },
    // ── 제이: 노쇼 2회 + 완료 1회 ──
    { c: "제이", s: "태리", day: -5, t: "20:00", status: "NOSHOW" },
    { c: "제이", s: "아인", day: -12, t: "19:00", status: "NOSHOW" },
    { c: "제이", s: "태리", day: -20, t: "21:00", status: "COMPLETED" },
    // ── 하루 3회, 쏘니 1회, 무민 1완료 1취소 ──
    { c: "하루", s: "태리", day: -2, t: "18:00", status: "COMPLETED" },
    { c: "하루", s: "태리", day: -9, t: "19:30", status: "COMPLETED" },
    { c: "하루", s: "아인", day: -16, t: "20:00", status: "COMPLETED" },
    { c: "쏘니", s: "아인", day: -7, t: "19:00", status: "COMPLETED" },
    { c: "무민", s: "아인", day: -4, t: "21:00", status: "COMPLETED" },
    { c: "무민", s: "준희", day: -1, t: "18:00", status: "CANCELLED" },
    // ── 미래 ──
    { c: "하루", s: "준희", day: 1, t: "19:00", status: "CONFIRMED" },
    { c: "쏘니", s: "아인", day: 2, t: "20:00", status: "CONFIRMED" },
    { c: "유나", s: "준희", day: 4, t: "19:30", status: "CONFIRMED" },
  ];
  const created: Record<string, string> = {}; // key `${c}-${day}` → reservation id
  for (const r of rs) {
    const start = at(r.day, r.t);
    const end = new Date(start.getTime() + 30 * 60_000);
    const res = await prisma.reservation.create({
      data: {
        code: code(start),
        storeId: store.id,
        staffId: staff[r.s].id,
        customerId: cust[r.c].id,
        startTime: start,
        endTime: end,
        partySize: 1,
        requestNote: r.note ?? "",
        purposeTag: "",
        status: r.status,
        createdBy: r.by ?? "CUSTOMER",
        slotKey: r.status === "CANCELLED" ? null : slotKey(staff[r.s].id, start),
        cancelledAt: r.status === "CANCELLED" ? new Date(start.getTime() - 5 * 3600_000) : null,
      },
    });
    created[`${r.c}-${r.day}`] = res.id;
  }

  console.log("⭐ 후기 / 💬 댓글 / ♡ 찜...");
  const reviews = [
    { key: "유나--3", c: "유나", s: "준희", rating: 5, content: "혼자 갔는데 전혀 어색하지 않았어요. 말을 걸어주는 타이밍이 어쩜 그렇게 좋은지.", reply: "유나님 오실 때마다 반가워요. 다음에도 편하게 놀러 오세요 🌿" },
    { key: "유나--10", c: "유나", s: "준희", rating: 5, content: "정말 상냥하고 청순한 분이에요. 말 없이 있어도 편한 자리." },
    { key: "유나--31", c: "유나", s: "태리", rating: 4, content: "말을 정말 잘하셔서 시간 가는 줄 몰랐어요. 조금 시끄러운 날이었지만 즐거웠습니다." },
    { key: "하루--2", c: "하루", s: "태리", rating: 5, content: "리액션이 좋고 대화가 즐거웠어요. 서비스도 최고였습니다." },
    { key: "하루--16", c: "하루", s: "아인", rating: 5, content: "외모도 귀엽고 정말 착하세요. 기념일에 또 올게요." },
    { key: "쏘니--7", c: "쏘니", s: "아인", rating: 5, content: "기념일 축하 이벤트까지 챙겨주셔서 감동. 강추." },
    { key: "제이--20", c: "제이", s: "태리", rating: 3, content: "나쁘진 않았는데 기다림이 조금 길었어요.", reported: true, reason: "허위 내용 의심" },
    { key: "무민--4", c: "무민", s: "아인", rating: 4, content: "친구랑 갔는데 대화 템포를 잘 맞춰주셨어요." },
  ];
  for (const rv of reviews) {
    await prisma.review.create({
      data: {
        storeId: store.id,
        reservationId: created[rv.key],
        staffId: staff[rv.s].id,
        customerId: cust[rv.c].id,
        rating: rv.rating,
        content: rv.content,
        reply: rv.reply ?? null,
        repliedAt: rv.reply ? new Date() : null,
        isReported: !!rv.reported,
        reportReason: rv.reason ?? null,
      },
    });
  }

  const c1 = await prisma.comment.create({
    data: { storeId: store.id, staffId: staff["준희"].id, customerId: cust["하루"].id, authorType: "CUSTOMER", authorName: "하루", content: "이번 주 토요일에도 근무하시나요?" },
  });
  await prisma.comment.create({
    data: { storeId: store.id, staffId: staff["준희"].id, authorType: "STAFF", authorName: "준희", content: "네, 토요일 15시부터 자리 지키고 있어요 :)", parentId: c1.id },
  });
  await prisma.comment.create({
    data: { storeId: store.id, staffId: staff["태리"].id, customerId: cust["유나"].id, authorType: "CUSTOMER", authorName: "유나", content: "지난번 들려주신 이야기 너무 재밌었어요. 다음에 또 들려주세요!" },
  });
  await prisma.comment.create({
    data: { storeId: store.id, staffId: staff["아인"].id, customerId: cust["쏘니"].id, authorType: "CUSTOMER", authorName: "쏘니", content: "이번 주 기념일인데 작은 이벤트 가능할까요?" },
  });

  await prisma.favorite.createMany({
    data: [
      { customerId: cust["유나"].id, staffId: staff["준희"].id },
      { customerId: cust["유나"].id, staffId: staff["아인"].id },
      { customerId: cust["하루"].id, staffId: staff["태리"].id },
    ],
  });

  console.log(`
✅ 시드 완료
  매장:   http://localhost:3000/secret-garden
  고객:   닉네임 유나 / 휴대폰 010-1111-0001  (단골 7회)
          닉네임 제이 / 휴대폰 010-2222-0002  (노쇼 2회)
  캐치걸: junhee / 1234   (태리 taeri, 아인 ain)
  관리자: admin@catchgirl.app / 1234
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
