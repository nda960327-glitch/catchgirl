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
const PHOTO_POOL = ["/assets/p1.webp", "/assets/p2.webp", "/assets/p3.webp", "/assets/p4.webp", "/assets/p5.webp", "/assets/p6.webp", "/assets/p7.webp", "/assets/p8.webp", "/assets/p9.webp"];
const photosFor = (i: number) => [PHOTO_POOL[i % 9], PHOTO_POOL[(i + 3) % 9], PHOTO_POOL[(i + 6) % 9]];

async function main() {
  console.log("🧹 기존 데이터 정리...");
  await prisma.customerNote.deleteMany();
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
      name: "캐치걸_어나더",
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

  console.log("🍸 캐치걸 19명...");
  const staffDefs = [
    { nickname: "루나", loginId: "luna", bio: "차분하게 분위기를 맞춰드려요. 조용히 한잔하고 싶은 날 편하게 찾아주세요.", tags: ["조용한매력", "눈빛좋음", "분위기있음"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "민서", loginId: "minseo", bio: "밝은 텐션으로 자리를 채워요. 웃을 일이 필요한 날 찾아주세요.", tags: ["애교많음", "밝은텐션", "노래잘함"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "섬미", loginId: "seommi", bio: "말수는 적어도 이야기는 끝까지 들어드려요.", tags: ["차분함", "경청잘함", "단정함"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "수아", loginId: "sua", bio: "리액션이 좋아서 이야기할 맛이 나요.", tags: ["활발함", "텐션업", "리액션좋음"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "시연", loginId: "siyeon", bio: "말투가 부드러워서 편하게 대화할 수 있어요.", tags: ["다정함", "배려심", "말투부드러움"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "아리", loginId: "ari", bio: "유머 코드가 잘 맞는다는 얘기를 자주 들어요.", tags: ["센스있음", "유머있음", "대화잘통함"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "예리", loginId: "yeri", bio: "말을 정말 잘하고 리액션이 좋아요. 오늘 있었던 이야기를 들려주시면 끝까지 들어드릴게요.", tags: ["말잘함", "수다환영", "서비스좋음"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "준희", loginId: "junhee", bio: "처음 오신 분께도 먼저 다가가 편하게 말을 건네요. 조용히 있고 싶은 날엔 옆에서 다정하게 자리를 지켜드려요.", tags: ["상냥함", "청순함", "조용한대화"], days: [0, 2, 3, 4, 5, 6] },
    { nickname: "지유", loginId: "jiyu", bio: "털털하고 편하게 대해드려서 부담 없어요.", tags: ["털털함", "친근함", "편안함"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "지혜", loginId: "jihye", bio: "차분한 대화를 좋아하신다면 잘 맞으실 거예요.", tags: ["지적임", "차분한매력", "깊은대화"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "유빈", loginId: "yubin", bio: "애교 많고 잘 웃어서 자리가 늘 밝아져요.", tags: ["귀여움", "애교", "웃음많음"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "유이", loginId: "yui", bio: "시크해 보여도 대화하다 보면 편해지실 거예요.", tags: ["세련됨", "도시적매력", "시크함"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "이슬", loginId: "iseul", bio: "맑고 순수한 느낌으로 편안하게 맞아드려요.", tags: ["청량함", "맑은느낌", "순수함"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "지수", loginId: "jisu", bio: "눈을 맞추고 이야기 들어드리는 걸 좋아해요.", tags: ["다정다감", "눈맞춤좋음", "포근함"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "지연", loginId: "jiyeon", bio: "재치 있는 입담으로 자리를 즐겁게 만들어요.", tags: ["재치있음", "입담좋음", "분위기메이커"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "진아", loginId: "jina", bio: "단아한 분위기를 좋아하는 분들과 잘 맞아요.", tags: ["단아함", "조용조용", "여운있음"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "채원", loginId: "chaewon", bio: "상큼하고 긍정적인 에너지로 맞아드려요.", tags: ["상큼함", "발랄함", "긍정에너지"], days: [0, 1, 2, 3, 4, 5, 6] },
    { nickname: "하영", loginId: "hayoung", bio: "귀여운 외모에 마음씨도 착해요. 기념일이면 작은 이벤트도 직접 챙겨드려요.", tags: ["외모귀여움", "착함", "기념일"], days: [0, 1, 3, 4, 5, 6] },
    { nickname: "해린", loginId: "haerin", bio: "당당하고 쿨한 매력으로 대화를 이끌어가요.", tags: ["당당함", "자신감", "쿨한매력"], days: [0, 1, 2, 3, 4, 5, 6] },
  ];
  const staff: Record<string, { id: string }> = {};
  for (let i = 0; i < staffDefs.length; i++) {
    const s = staffDefs[i];
    const created = await prisma.staff.create({
      data: {
        storeId: store.id,
        nickname: s.nickname,
        bio: s.bio,
        tags: JSON.stringify(s.tags),
        photos: JSON.stringify(photosFor(i)),
        capacityPerSlot: 1,
        sortOrder: i,
        loginId: s.loginId,
        passwordHash: pw,
        schedules: { create: s.days.map((weekday) => ({ weekday, startTime: "15:00", endTime: "23:00" })) },
      },
    });
    staff[s.nickname] = created;
  }
  // 예리 3일 뒤 휴무
  const off = new Date();
  off.setDate(off.getDate() + 3);
  await prisma.staffOff.create({ data: { staffId: staff["예리"].id, date: ymd(off), reason: "개인 휴무" } });

  console.log("👤 고객 6명... (연락처·실명 없이 닉네임 + PIN)");
  const custDefs = [
    { nickname: "길동", memo: "조용한 대화 선호, 창가 자리. 준희 단골.", referral: "인스타그램" },
    { nickname: "병정", memo: "노쇼 이력 2회 — 방문 당일 재확인 필요", referral: "지인 소개" },
    { nickname: "갑을", memo: "", referral: "검색" },
    { nickname: "춘삼", memo: "기념일 방문. 이벤트 좋아함", referral: "인스타그램" },
    { nickname: "태식", memo: "", referral: "지나가다" },
    { nickname: "철식", memo: "", referral: "지인 소개" },
  ];
  const cust: Record<string, { id: string }> = {};
  for (const c of custDefs) {
    cust[c.nickname] = await prisma.customer.create({
      data: { storeId: store.id, nickname: c.nickname, passwordHash: pw, adminMemo: c.memo, referral: c.referral ?? null },
    });
  }

  console.log("📅 예약 생성...");
  type R = { c: string; s: string; day: number; t: string; status: string; note?: string; by?: string };
  const rs: R[] = [
    // ── 오늘 (데모 핵심) ──
    { c: "길동", s: "준희", day: 0, t: "15:30", status: "CONFIRMED", note: "창가 자리 부탁드려요" },
    { c: "갑을", s: "준희", day: 0, t: "19:00", status: "CONFIRMED" },
    { c: "태식", s: "준희", day: 0, t: "21:30", status: "CONFIRMED" },
    { c: "춘삼", s: "예리", day: 0, t: "18:00", status: "CONFIRMED", note: "케이크 반입 가능할까요?" },
    { c: "병정", s: "예리", day: 0, t: "20:00", status: "CONFIRMED", by: "ADMIN" },
    { c: "길동", s: "하영", day: 0, t: "19:30", status: "CONFIRMED" },
    { c: "철식", s: "지유", day: 0, t: "17:00", status: "CONFIRMED" },
    // ── 과거: 길동 방문 7회(단골) ──
    { c: "길동", s: "준희", day: -3, t: "19:00", status: "COMPLETED" },
    { c: "길동", s: "준희", day: -10, t: "20:00", status: "COMPLETED" },
    { c: "길동", s: "준희", day: -17, t: "19:30", status: "COMPLETED" },
    { c: "길동", s: "준희", day: -24, t: "21:00", status: "COMPLETED" },
    { c: "길동", s: "예리", day: -31, t: "18:30", status: "COMPLETED" },
    { c: "길동", s: "준희", day: -38, t: "19:00", status: "COMPLETED" },
    { c: "길동", s: "준희", day: -45, t: "20:30", status: "COMPLETED" },
    // ── 병정: 노쇼 2회 + 완료 1회 ──
    { c: "병정", s: "예리", day: -5, t: "20:00", status: "NOSHOW" },
    { c: "병정", s: "하영", day: -12, t: "19:00", status: "NOSHOW" },
    { c: "병정", s: "예리", day: -20, t: "21:00", status: "COMPLETED" },
    // ── 갑을 3회, 춘삼 1회, 태식 1완료 1취소 ──
    { c: "갑을", s: "예리", day: -2, t: "18:00", status: "COMPLETED" },
    { c: "갑을", s: "예리", day: -9, t: "19:30", status: "COMPLETED" },
    { c: "갑을", s: "하영", day: -16, t: "20:00", status: "COMPLETED" },
    { c: "춘삼", s: "하영", day: -7, t: "19:00", status: "COMPLETED" },
    { c: "태식", s: "하영", day: -4, t: "21:00", status: "COMPLETED" },
    { c: "태식", s: "준희", day: -1, t: "18:00", status: "CANCELLED" },
    // ── 미래 ──
    { c: "갑을", s: "준희", day: 1, t: "19:00", status: "CONFIRMED" },
    { c: "춘삼", s: "하영", day: 2, t: "20:00", status: "CONFIRMED" },
    { c: "길동", s: "준희", day: 4, t: "19:30", status: "CONFIRMED" },
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
    { key: "길동--3", c: "길동", s: "준희", rating: 5, content: "혼자 갔는데 전혀 어색하지 않았어요. 말을 걸어주는 타이밍이 어쩜 그렇게 좋은지.", reply: "길동님 오실 때마다 반가워요. 다음에도 편하게 놀러 오세요 🌿" },
    { key: "길동--10", c: "길동", s: "준희", rating: 5, content: "정말 상냥하고 청순한 분이에요. 말 없이 있어도 편한 자리." },
    { key: "길동--31", c: "길동", s: "예리", rating: 4, content: "말을 정말 잘하셔서 시간 가는 줄 몰랐어요. 조금 시끄러운 날이었지만 즐거웠습니다." },
    { key: "갑을--2", c: "갑을", s: "예리", rating: 5, content: "리액션이 좋고 대화가 즐거웠어요. 서비스도 최고였습니다." },
    { key: "갑을--16", c: "갑을", s: "하영", rating: 5, content: "외모도 귀엽고 정말 착하세요. 기념일에 또 올게요." },
    { key: "춘삼--7", c: "춘삼", s: "하영", rating: 5, content: "기념일 축하 이벤트까지 챙겨주셔서 감동. 강추." },
    { key: "병정--20", c: "병정", s: "예리", rating: 3, content: "나쁘진 않았는데 기다림이 조금 길었어요.", reported: true, reason: "허위 내용 의심" },
    { key: "태식--4", c: "태식", s: "하영", rating: 4, content: "친구랑 갔는데 대화 템포를 잘 맞춰주셨어요." },
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
    data: { storeId: store.id, staffId: staff["준희"].id, customerId: cust["갑을"].id, authorType: "CUSTOMER", authorName: "갑을", content: "이번 주 토요일에도 근무하시나요?" },
  });
  await prisma.comment.create({
    data: { storeId: store.id, staffId: staff["준희"].id, authorType: "STAFF", authorName: "준희", content: "네, 토요일 15시부터 자리 지키고 있어요 :)", parentId: c1.id },
  });
  await prisma.comment.create({
    data: { storeId: store.id, staffId: staff["예리"].id, customerId: cust["길동"].id, authorType: "CUSTOMER", authorName: "길동", content: "지난번 들려주신 이야기 너무 재밌었어요. 다음에 또 들려주세요!" },
  });
  await prisma.comment.create({
    data: { storeId: store.id, staffId: staff["하영"].id, customerId: cust["춘삼"].id, authorType: "CUSTOMER", authorName: "춘삼", content: "이번 주 기념일인데 작은 이벤트 가능할까요?" },
  });

  await prisma.favorite.createMany({
    data: [
      { customerId: cust["길동"].id, staffId: staff["준희"].id },
      { customerId: cust["길동"].id, staffId: staff["하영"].id },
      { customerId: cust["갑을"].id, staffId: staff["예리"].id },
    ],
  });

  console.log("📝 관리자 방문 메모...");
  const noteDefs = [
    { c: "길동", day: -45, content: "첫 방문. 준희 지정. 위스키 하이볼 좋아하심." },
    { c: "길동", day: -24, content: "창가 자리 선호 확인. 시끄러운 날은 안쪽 자리 피해달라고 하심." },
    { c: "길동", day: -3, content: "곧 승진한다고 하심 — 다음 방문 때 축하 인사 드리면 좋을 듯." },
    { c: "병정", day: -12, content: "두 번째 노쇼. 다음 예약은 당일 오후에 한 번 더 확인하기로." },
    { c: "춘삼", day: -7, content: "기념일 방문. 케이크 반입 문의 있었고 허용해 드림. 다음에도 챙기면 좋아하실 듯." },
  ];
  for (const n of noteDefs) {
    await prisma.customerNote.create({
      data: { storeId: store.id, customerId: cust[n.c].id, authorName: "매니저", content: n.content, createdAt: at(n.day, "23:30") },
    });
  }

  console.log(`
✅ 시드 완료 — 휴대폰 번호·실명은 저장하지 않아요
  매장:   http://localhost:3000/secret-garden
  고객:   닉네임 길동 / PIN 1234  (단골 7회)
          닉네임 병정 / PIN 1234  (노쇼 2회)
  캐치걸: junhee / 1234   (19명 — 예리 yeri, 하영 hayoung 외)
  관리자: admin@catchgirl.app / 1234
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
