/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/* ─── 결과가 매번 같도록 고정 시드 난수 ─── */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260901);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const intBetween = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
let codeSeq = 1000;
const resCode = (d: Date) => `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${String(codeSeq++).padStart(4, "0")}`;
const PHOTO_POOL = ["/assets/p1.webp", "/assets/p2.webp", "/assets/p3.webp", "/assets/p4.webp", "/assets/p5.webp", "/assets/p6.webp", "/assets/p7.webp", "/assets/p8.webp", "/assets/p9.webp"];
const photosFor = (i: number) => [PHOTO_POOL[i % 9], PHOTO_POOL[(i + 3) % 9], PHOTO_POOL[(i + 6) % 9]];

/** 영업 12:00~익일 04:00 → 30분 슬롯 32칸. 슬롯 인덱스로 시작 시각을 만든다. */
const OPEN_HOUR = 12;
const SLOTS_PER_DAY = 32;
const SLOTS_PER_HOUR = 2;
const startAt = (day: Date, slotIdx: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), OPEN_HOUR, slotIdx * 30, 0, 0);

const CUSTOMER_NAMES = [
  "서준","도윤","시우","민준","은우","예준","지호","유준","하준","주원",
  "선우","지훈","건우","서진","우주","연우","수호","다온","로운","이안",
  "성민","정훈","상현","동현","승호","태현","민수","진우","재현","영호",
  "기택","준호","성호","찬우","경민","현우","도현","태양","우진","지환",
  "시온","루안","노아","리한","유안","도하","하진","해준","서우","은찬",
  "재윤","승우","윤호","수현","지원","시윤","승민","민재","정우","태윤",
  "한결","가람","우람","새론","마루","찬희","진호","건희","기호","종석",
  "동욱","상민","재민","규현","성현","승현","진수","철수","영수","형준",
  "태형","지민","정국","석진","남준","호석","윤기","지용","태민","원호",
  "동해","은혁","희철","정수","종운","시원","기범","민혁","성재","성진",
];

const REVIEW_POOL = [
  "혼자 갔는데 전혀 어색하지 않았어요. 말 걸어주는 타이밍이 참 좋더라고요.",
  "오랜만에 편하게 얘기하고 왔습니다. 다음에 또 뵐게요.",
  "조용한 자리 부탁드렸는데 알아서 챙겨주셔서 좋았어요.",
  "얘기가 잘 통해서 시간 가는 줄 몰랐네요.",
  "웃을 일이 별로 없었는데 오랜만에 많이 웃었습니다.",
  "리액션이 좋아서 얘기할 맛이 납니다. 추천해요.",
  "분위기 잡고 싶을 때 오면 딱 좋을 것 같아요.",
  "처음이라 어색했는데 편하게 대해주셔서 감사했습니다.",
  "일 얘기 들어주셔서 속이 좀 풀렸어요.",
  "기념일이라 갔는데 작게 챙겨주셔서 기분 좋았습니다.",
  "말수가 많지 않은데 그게 오히려 편했어요.",
  "친구랑 같이 갔는데 둘 다 만족했습니다.",
  "다음에 예약할 때도 같은 분으로 하려고요.",
  "시간이 짧게 느껴졌어요. 다음엔 좀 더 길게 잡아야겠네요.",
  "직원분들이 다 친절하시네요. 자리도 깔끔했고요.",
  "기대보다 훨씬 좋았습니다. 재방문 의사 있어요.",
  "무난했어요. 나쁘지 않았습니다.",
  "대화 템포를 잘 맞춰주셔서 편했어요.",
  "늦은 시간에 갔는데도 끝까지 신경 써주셨어요.",
  "생각보다 조용해서 좋았어요. 시끄러운 곳 싫어하는 분께 추천.",
];
const LOW_REVIEW_POOL = [
  "나쁘진 않았는데 기다림이 조금 길었어요.",
  "그날 좀 정신없어 보이셨어요. 다음엔 괜찮겠죠.",
  "무난했지만 특별하진 않았습니다.",
];
const REPLY_POOL = [
  "오실 때마다 반가워요. 다음에도 편하게 놀러 오세요 🌿",
  "좋게 봐주셔서 감사해요. 다음에 더 잘 챙겨드릴게요.",
  "덕분에 저도 즐거운 시간이었어요. 또 뵐게요!",
  "말씀 남겨주셔서 감사합니다. 다음엔 더 편하게 모실게요.",
];
const NOTES = ["", "", "", "조용한 자리 부탁드려요", "창가 자리면 좋겠어요", "기념일이라 작게 챙겨주시면 감사하겠습니다", "케이크 반입 가능할까요?", "일행 한 명 더 올 수도 있어요", "늦을 수도 있어요"];

async function main() {
  console.log("🧹 기존 데이터 정리...");
  await prisma.shiftAssignment.deleteMany();
  await prisma.room.deleteMany();
  await prisma.staffTimeOff.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.reservationOption.deleteMany();
  await prisma.storeOption.deleteMany();
  await prisma.staffVote.deleteMany();
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
      themeColor: "#B4586A",
      openTime: "12:00",
      closeTime: "04:00",
      shiftSplitTime: "20:00",
      slotMinutes: 30,
      closedDays: "[]",
      cancelDeadlineHours: 2,
      maxAdvanceDays: 14,
      noshowPolicy: "예약 시간 15분 경과 시 노쇼 처리되며, 노쇼 3회 누적 시 예약이 제한될 수 있어요.",
    },
  });

  const pw = await bcrypt.hash("1234", 10);
  await prisma.adminUser.create({ data: { storeId: store.id, email: "admin@catchgirl.app", passwordHash: pw, name: "매니저" } });

  console.log("➕ 추가 옵션...");
  const opt1 = await prisma.storeOption.create({ data: { storeId: store.id, name: "옵션1", price: 50000, sortOrder: 0 } });
  const opt2 = await prisma.storeOption.create({ data: { storeId: store.id, name: "옵션2", price: 50000, sortOrder: 1 } });

  console.log("🚪 룸 10개...");
  const rooms = [];
  for (let i = 1; i <= 10; i++) {
    rooms.push(await prisma.room.create({ data: { storeId: store.id, name: `${i}번 룸`, sortOrder: i - 1 } }));
  }

  console.log("🍸 캐치걸 19명...");
  const staffDefs = [
    { nickname: "루나", loginId: "luna", bio: "차분하게 분위기를 맞춰드려요. 조용히 한잔하고 싶은 날 편하게 찾아주세요.", tags: ["조용한매력", "눈빛좋음", "분위기있음"], hourlyPrice: 350000, memo: "" },
    { nickname: "민서", loginId: "minseo", bio: "밝은 텐션으로 자리를 채워요. 웃을 일이 필요한 날 찾아주세요.", tags: ["애교많음", "밝은텐션", "노래잘함"], hourlyPrice: 300000, memo: "노래 잘해서 단체석에 강함" },
    { nickname: "선미", loginId: "seonmi", bio: "말수는 적어도 이야기는 끝까지 들어드려요.", tags: ["차분함", "경청잘함", "단정함"], hourlyPrice: 350000, memo: "" },
    { nickname: "수아", loginId: "sua", bio: "리액션이 좋아서 이야기할 맛이 나요.", tags: ["활발함", "텐션업", "리액션좋음"], hourlyPrice: 300000, memo: "" },
    { nickname: "시연", loginId: "siyeon", bio: "말투가 부드러워서 편하게 대화할 수 있어요.", tags: ["다정함", "배려심", "말투부드러움"], hourlyPrice: 320000, memo: "" },
    { nickname: "아리", loginId: "ari", bio: "유머 코드가 잘 맞는다는 얘기를 자주 들어요.", tags: ["센스있음", "유머있음", "대화잘통함"], hourlyPrice: 280000, memo: "" },
    { nickname: "예리", loginId: "yeri", bio: "말을 정말 잘하고 리액션이 좋아요. 오늘 있었던 이야기를 들려주시면 끝까지 들어드릴게요.", tags: ["말잘함", "수다환영", "서비스좋음"], hourlyPrice: 400000, memo: "지명 많음. 주말 야간 고정 선호" },
    { nickname: "준희", loginId: "junhee", bio: "처음 오신 분께도 먼저 다가가 편하게 말을 건네요. 조용히 있고 싶은 날엔 옆에서 다정하게 자리를 지켜드려요.", tags: ["상냥함", "청순함", "조용한대화"], hourlyPrice: 450000, memo: "에이스. 단골 재방문율 가장 높음" },
    { nickname: "지유", loginId: "jiyu", bio: "털털하고 편하게 대해드려서 부담 없어요.", tags: ["털털함", "친근함", "편안함"], hourlyPrice: 300000, memo: "" },
    { nickname: "지혜", loginId: "jihye", bio: "차분한 대화를 좋아하신다면 잘 맞으실 거예요.", tags: ["지적임", "차분한매력", "깊은대화"], hourlyPrice: 330000, memo: "" },
    { nickname: "유빈", loginId: "yubin", bio: "애교 많고 잘 웃어서 자리가 늘 밝아져요.", tags: ["귀여움", "애교", "웃음많음"], hourlyPrice: 280000, memo: "" },
    { nickname: "유이", loginId: "yui", bio: "시크해 보여도 대화하다 보면 편해지실 거예요.", tags: ["세련됨", "도시적매력", "시크함"], hourlyPrice: 350000, memo: "" },
    { nickname: "이슬", loginId: "iseul", bio: "맑고 순수한 느낌으로 편안하게 맞아드려요.", tags: ["청량함", "맑은느낌", "순수함"], hourlyPrice: 250000, memo: "신입. 주간조 위주로 배치 중" },
    { nickname: "지수", loginId: "jisu", bio: "눈을 맞추고 이야기 들어드리는 걸 좋아해요.", tags: ["다정다감", "눈맞춤좋음", "포근함"], hourlyPrice: 300000, memo: "" },
    { nickname: "지연", loginId: "jiyeon", bio: "재치 있는 입담으로 자리를 즐겁게 만들어요.", tags: ["재치있음", "입담좋음", "분위기메이커"], hourlyPrice: 280000, memo: "" },
    { nickname: "진아", loginId: "jina", bio: "단아한 분위기를 좋아하는 분들과 잘 맞아요.", tags: ["단아함", "조용조용", "여운있음"], hourlyPrice: 320000, memo: "" },
    { nickname: "채원", loginId: "chaewon", bio: "상큼하고 긍정적인 에너지로 맞아드려요.", tags: ["상큼함", "발랄함", "긍정에너지"], hourlyPrice: 250000, memo: "" },
    { nickname: "하영", loginId: "hayoung", bio: "귀여운 외모에 마음씨도 착해요. 기념일이면 작은 이벤트도 직접 챙겨드려요.", tags: ["외모귀여움", "착함", "기념일"], hourlyPrice: 420000, memo: "기념일 응대 잘함" },
    { nickname: "해린", loginId: "haerin", bio: "당당하고 쿨한 매력으로 대화를 이끌어가요.", tags: ["당당함", "자신감", "쿨한매력"], hourlyPrice: 380000, memo: "" },
  ];

  const staff: { id: string; nickname: string; hourlyPrice: number; opts: string[] }[] = [];
  for (let i = 0; i < staffDefs.length; i++) {
    const s = staffDefs[i];
    // 옵션1만 되는 사람과 둘 다 되는 사람을 섞는다
    const both = i % 3 !== 2;
    const optIds = both ? [opt1.id, opt2.id] : [opt1.id];
    const created = await prisma.staff.create({
      data: {
        storeId: store.id,
        nickname: s.nickname,
        bio: s.bio,
        tags: JSON.stringify(s.tags),
        photos: JSON.stringify(photosFor(i)),
        capacityPerSlot: 1,
        hourlyPrice: s.hourlyPrice,
        adminMemo: s.memo,
        sortOrder: i,
        loginId: s.loginId,
        passwordHash: pw,
        schedules: { create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "12:00", endTime: "04:00" })) },
        options: { connect: optIds.map((id) => ({ id })) },
      },
    });
    staff.push({ id: created.id, nickname: s.nickname, hourlyPrice: s.hourlyPrice, opts: optIds });
  }

  console.log("👤 고객 100명... (등록과 동시에 연결코드 발급)");
  // 코드는 계정마다 하나씩 늘 갖고 있다. 이미 가입한 계정엔 코드가 먹히지 않으므로 남아 있어도 안전하다.
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const usedCodes = new Set<string>();
  const newCode = () => {
    for (let i = 0; i < 50; i++) {
      const c = Array.from({ length: 4 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join("");
      if (!usedCodes.has(c)) { usedCodes.add(c); return c; }
    }
    throw new Error("코드 생성 실패");
  };
  const customers: { id: string; nickname: string }[] = [];
  for (const name of CUSTOMER_NAMES) {
    const c = await prisma.customer.create({ data: { storeId: store.id, nickname: name, passwordHash: pw, inviteCode: newCode() } });
    customers.push({ id: c.id, nickname: name });
  }
  // 단골이 될 사람들 — 이들에게 예약을 더 몰아준다
  const regulars = customers.slice(0, 22);

  console.log("📅 7~9월 예약 생성...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(today.getFullYear(), 6, 1); // 7월 1일
  const lastDay = addDays(today, 5); // 오늘 + 5일치 예정 예약

  type Busy = { s: number; e: number }; // 슬롯 인덱스 구간
  const overlaps = (list: Busy[], s: number, e: number) => list.some((b) => s < b.e && e > b.s);

  const createdRes: { id: string; staffIdx: number; customerId: string; start: Date; status: string; nickname: string }[] = [];

  for (let day = new Date(firstDay); day <= lastDay; day = addDays(day, 1)) {
    const isPast = day < today;
    const isFuture = day > today;
    const wd = day.getDay();
    const weekend = wd === 5 || wd === 6; // 금·토가 붐빈다
    const staffBusy = new Map<number, Busy[]>();
    const custBusy = new Map<string, Busy[]>();

    // 그날 출근한 캐치걸 (12~16명)
    const workingCount = weekend ? intBetween(14, 17) : intBetween(10, 14);
    const working = [...staff.keys()].sort(() => rand() - 0.5).slice(0, workingCount);

    for (const si of working) {
      const bookings = weekend ? intBetween(1, 3) : intBetween(0, 2);
      for (let b = 0; b < bookings; b++) {
        const hours = chance(0.45) ? 1 : chance(0.6) ? 2 : chance(0.7) ? 3 : 4;
        const span = hours * SLOTS_PER_HOUR;
        // 저녁~밤에 몰리도록 시작 슬롯을 뒤쪽으로 치우친 분포로 뽑는다
        const bias = Math.min(1, Math.max(0, (rand() + rand() + rand()) / 3 + 0.18));
        const slot = Math.min(SLOTS_PER_DAY - span, Math.floor(bias * (SLOTS_PER_DAY - span)));
        const sBusy = staffBusy.get(si) ?? [];
        if (overlaps(sBusy, slot, slot + span)) continue;

        // 단골 위주로, 가끔 신규
        const cust = chance(0.55) ? pick(regulars) : pick(customers);
        const cBusy = custBusy.get(cust.id) ?? [];
        if (overlaps(cBusy, slot, slot + span)) continue;

        const start = startAt(day, slot);
        const end = new Date(start.getTime() + hours * 3600_000);
        const st = staff[si];

        let status = "CONFIRMED";
        if (isPast) status = chance(0.9) ? "COMPLETED" : chance(0.5) ? "NOSHOW" : "CANCELLED";

        // 캐치걸이 제공하는 옵션 중에서만 고른다
        const chosen = st.opts.filter(() => chance(0.22));
        const optRows = chosen.map((id) => ({ optionId: id, name: id === opt1.id ? "옵션1" : "옵션2", price: 50000 }));
        const optionsPrice = optRows.length * 50000;

        const r = await prisma.reservation.create({
          data: {
            code: resCode(start),
            storeId: store.id,
            staffId: st.id,
            customerId: cust.id,
            startTime: start,
            endTime: end,
            hours,
            partySize: 1,
            requestNote: pick(NOTES),
            purposeTag: "",
            status,
            createdBy: chance(0.18) ? "ADMIN" : "CUSTOMER",
            hourlyPrice: st.hourlyPrice,
            optionsPrice,
            totalPrice: st.hourlyPrice * hours + optionsPrice,
            // 배치가 있으면 화면에서 실시간으로 다시 찾으므로 여기선 비워 둔다
            roomName: null,
            cancelledAt: status === "CANCELLED" ? new Date(start.getTime() - 5 * 3600_000) : null,
            options: { create: optRows },
          },
        });

        staffBusy.set(si, [...sBusy, { s: slot, e: slot + span }]);
        custBusy.set(cust.id, [...cBusy, { s: slot, e: slot + span }]);
        createdRes.push({ id: r.id, staffIdx: si, customerId: cust.id, start, status, nickname: cust.nickname });
        void isFuture;
      }
    }
  }
  console.log(`   예약 ${createdRes.length}건`);

  console.log("⭐ 후기...");
  let reviewCount = 0;
  for (const r of createdRes) {
    if (r.status !== "COMPLETED" || !chance(0.42)) continue;
    const low = chance(0.12);
    const rating = low ? intBetween(2, 3) : chance(0.7) ? 5 : 4;
    const reply = chance(0.35) ? pick(REPLY_POOL) : null;
    await prisma.review.create({
      data: {
        storeId: store.id,
        reservationId: r.id,
        staffId: staff[r.staffIdx].id,
        customerId: r.customerId,
        rating,
        content: low ? pick(LOW_REVIEW_POOL) : pick(REVIEW_POOL),
        reply,
        repliedAt: reply ? new Date(r.start.getTime() + 86_400_000) : null,
        isReported: low && chance(0.15),
        reportReason: low && chance(0.15) ? "허위 내용 의심" : null,
        createdAt: new Date(r.start.getTime() + 6 * 3600_000),
      },
    });
    reviewCount++;
  }
  console.log(`   후기 ${reviewCount}건`);

  console.log("👍 추천 / 💬 댓글 / ♡ 찜...");
  // 방문했던 조합에서만 추천이 나오도록 (자연스럽게)
  const votePairs = new Set<string>();
  for (const r of createdRes) {
    if (r.status !== "COMPLETED" || !chance(0.3)) continue;
    const key = `${r.customerId}|${staff[r.staffIdx].id}`;
    if (votePairs.has(key)) continue;
    votePairs.add(key);
    await prisma.staffVote.create({
      data: { customerId: r.customerId, staffId: staff[r.staffIdx].id, value: chance(0.85) ? "UP" : "DOWN" },
    });
  }
  const favPairs = new Set<string>();
  for (const r of createdRes) {
    if (r.status !== "COMPLETED" || !chance(0.18)) continue;
    const key = `${r.customerId}|${staff[r.staffIdx].id}`;
    if (favPairs.has(key)) continue;
    favPairs.add(key);
    await prisma.favorite.create({ data: { customerId: r.customerId, staffId: staff[r.staffIdx].id } });
  }
  for (let i = 0; i < 14; i++) {
    const st = pick(staff);
    const cu = pick(regulars);
    const c1 = await prisma.comment.create({
      data: { storeId: store.id, staffId: st.id, customerId: cu.id, authorType: "CUSTOMER", authorName: cu.nickname, content: pick(["이번 주 토요일에도 근무하시나요?", "지난번 얘기 너무 재밌었어요. 또 들려주세요!", "다음 주에 예약하려는데 자리 있을까요?", "기념일인데 작은 이벤트 가능할까요?"]) },
    });
    if (chance(0.6)) {
      await prisma.comment.create({
        data: { storeId: store.id, staffId: st.id, authorType: "STAFF", authorName: st.nickname, content: pick(["네, 그날 자리 지키고 있어요 :)", "미리 말씀해 주시면 준비해 둘게요!", "곧 뵐게요. 편하게 오세요."]), parentId: c1.id },
      });
    }
  }

  console.log("📝 고객 메모...");
  for (const c of regulars.slice(0, 12)) {
    await prisma.customer.update({
      where: { id: c.id },
      data: { adminMemo: pick(["조용한 대화 선호, 창가 자리", "위스키 하이볼 즐겨 드심", "기념일 방문 잦음. 이벤트 좋아하심", "말수 적은 편. 편하게 두는 게 나음", "단골. 지명 고정", "늦게 오시는 편 — 확인 전화 필요"]) },
    });
    for (let i = 0; i < intBetween(1, 3); i++) {
      await prisma.customerNote.create({
        data: {
          storeId: store.id,
          customerId: c.id,
          authorName: "매니저",
          content: pick(["첫 방문. 분위기 마음에 들어 하심.", "승진하셨다고 함 — 다음에 축하 인사.", "창가 자리 선호 확인.", "동료분들과 재방문 예정이라고 하심.", "지난번 대기 길어 불편해하심. 다음엔 미리 세팅."]),
          createdAt: new Date(today.getTime() - intBetween(3, 50) * 86_400_000),
        },
      });
    }
  }
  // 연결코드 데모 — 카톡으로만 오가던 손님 한 명
  await prisma.customer.update({
    where: { id: customers[99].id },
    // 아직 앱을 시작하지 않은 손님 — 이 코드로 시작할 수 있다
    data: { inviteCode: "A3K9", passwordHash: null, adminMemo: "카톡으로만 예약하시던 분. 앱 연결코드 안내함." },
  });

  console.log("🗓 출근 배치 (지난주 ~ 다음주)...");
  let assignCount = 0;
  for (let off = -7; off <= 7; off++) {
    const day = addDays(today, off);
    const date = ymd(day);
    const pool = [...staff.keys()].sort(() => rand() - 0.5);
    let p = 0;
    for (const shift of ["DAY", "NIGHT"] as const) {
      // 룸 10개 중 6~9개를 채운다
      const fill = intBetween(6, 9);
      for (let r = 0; r < fill; r++) {
        const si = pool[p++ % pool.length];
        try {
          await prisma.shiftAssignment.create({
            data: { storeId: store.id, date, shift, roomId: rooms[r].id, staffId: staff[si].id },
          });
          assignCount++;
        } catch {
          // 같은 조에 이미 배치된 사람이면 건너뛴다
        }
      }
    }
  }
  console.log(`   배치 ${assignCount}건`);

  console.log("🚶 자리 비움(외출)...");
  const todayStr = ymd(today);
  await prisma.staffTimeOff.createMany({
    data: [
      { staffId: staff[7].id, date: todayStr, startTime: "14:00", endTime: "15:30", reason: "병원", createdBy: "STAFF" },
      { staffId: staff[2].id, date: todayStr, startTime: "18:00", endTime: "19:00", reason: "잠깐 외출", createdBy: "ADMIN" },
      { staffId: staff[12].id, date: ymd(addDays(today, 1)), startTime: "12:00", endTime: "14:00", reason: "개인 사정", createdBy: "STAFF" },
    ],
  });

  console.log("📢 공지사항...");
  const noticeDefs = [
    {
      title: "초대받은 분만 이용하실 수 있어요",
      body:
        "이곳은 기존에 방문해 주신 분들을 위해 조용히 열어둔 공간이에요.\n" +
        "주소나 화면을 다른 분께 공유하시면 예약이 제한될 수 있어요.\n" +
        "새로 함께 오고 싶은 분이 계시면 매장에 먼저 말씀해 주세요.",
      isPinned: true,
    },
    {
      title: "시작하려면 연결코드가 필요해요",
      body:
        "계정은 매장에서 받은 연결코드로만 만들 수 있어요.\n" +
        "카톡·전화로 예약하시던 분은 그동안의 방문 기록을 그대로 이어받으실 수 있어요.\n" +
        "한 번 시작하신 뒤로는 닉네임과 PIN으로 바로 들어오실 수 있어요.",
      isPinned: true,
    },
    {
      title: "전담 캐치걸을 지정해 예약해요",
      body:
        "오늘 그 자리에 누가 앉을지 직접 고르실 수 있어요.\n" +
        "프로필에서 소개와 후기를 보고, 마음에 드는 분을 지정해 주세요.\n" +
        "찜해 두시면 다음 방문 때 더 빠르게 찾으실 수 있어요.",
      isPinned: false,
    },
    {
      title: "예약은 1시간 단위, 이어서도 가능해요",
      body:
        "1시간부터 시작해 원하는 만큼 이어서 예약하실 수 있어요.\n" +
        `영업은 ${store.openTime}부터 다음 날 ${store.closeTime}까지예요.\n` +
        `사정이 생기시면 방문 ${store.cancelDeadlineHours}시간 전까지 취소를 부탁드려요.`,
      isPinned: false,
    },
  ];
  for (let i = 0; i < noticeDefs.length; i++) {
    await prisma.notice.create({ data: { storeId: store.id, ...noticeDefs[i], sortOrder: i } });
  }

  const spend = await prisma.reservation.groupBy({
    by: ["customerId"],
    where: { status: { in: ["COMPLETED", "CONFIRMED"] } },
    _sum: { totalPrice: true },
    orderBy: { _sum: { totalPrice: "desc" } },
    take: 3,
  });
  const topNames = await Promise.all(
    spend.map(async (s) => {
      const c = await prisma.customer.findUnique({ where: { id: s.customerId } });
      return `${c?.nickname} ${(s._sum.totalPrice ?? 0).toLocaleString("ko-KR")}원`;
    }),
  );

  console.log(`
✅ 시드 완료 — 휴대폰 번호·실명은 저장하지 않아요
  매장:   http://localhost:3000/secret-garden
  고객:   ${customers[0].nickname} / PIN 1234  (100명 전원 PIN 1234)
  연결코드 데모: ${customers[99].nickname} → 코드 A3K9
  캐치걸: junhee / 1234   (19명)
  관리자: admin@catchgirl.app / 1234
  큰손:   ${topNames.join(" · ")}
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
