/* eslint-disable no-console */
/**
 * 데모 매장에 지난 10년치 기록을 붙인다.
 *
 * 다른 업체에 보여줄 샘플이라, 문을 연 지 오래된 매장처럼 보여야 한다 — 매출이 해마다
 * 자라고, 캐치걸이 들어오고 나가고, 단골은 몇 년째 오고, 한두 번 오고 만 손님이 훨씬 많다.
 *
 * 기존 시드가 만든 2026-07-01 이후 데이터는 그대로 두고 그 앞을 채운다.
 * 한 건씩 넣으면 몇 시간이 걸리므로 묶어서 넣는다 (id 를 미리 만들어 후기와 이어 준다).
 *
 *   npx tsx prisma/seed-history.ts            # 이미 이력이 있으면 멈춘다
 *   npx tsx prisma/seed-history.ts --reset    # 2026-07-01 이전 이력을 지우고 다시 만든다
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const SLUG = "secret-garden";
const HISTORY_START = new Date(2016, 9, 1); // 2016-10-01
const HISTORY_END = new Date(2026, 5, 30); // 2026-06-30 (이후는 기존 시드가 채웠다)
const CUTOFF = new Date(2026, 6, 1);
const BATCH = 1000;

/* ─── 결과가 매번 같도록 고정 시드 난수 ─── */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const rand = rng(20161001);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const intBetween = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const id = () => `h${randomBytes(12).toString("hex")}`;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

/** 영업 12:00~익일 04:00 → 30분 슬롯 32칸 */
const OPEN_HOUR = 12;
const SLOTS = 32;
const startAt = (day: Date, slot: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), OPEN_HOUR, slot * 30, 0, 0);

/* ─── 글감 ─── */
const REVIEWS_HIGH = [
  "대화 템포를 잘 맞춰주셔서 편했어요.", "리액션이 좋아서 얘기할 맛이 납니다. 추천해요.", "오랜만에 편하게 얘기하고 왔습니다. 다음에 또 뵐게요.",
  "일 얘기 들어주셔서 속이 좀 풀렸어요.", "말수가 많지 않은데 그게 오히려 편했어요.", "시간이 짧게 느껴졌어요. 다음엔 좀 더 길게 잡아야겠네요.",
  "웃을 일이 별로 없었는데 오랜만에 많이 웃었습니다.", "기념일이라 갔는데 작게 챙겨주셔서 기분 좋았습니다.", "다음에 예약할 때도 같은 분으로 하려고요.",
  "늦은 시간에 갔는데도 끝까지 신경 써주셨어요.", "생각보다 조용해서 좋았어요. 시끄러운 곳 싫어하는 분께 추천.", "처음 갔는데 어색하지 않게 잘 이끌어주셨어요.",
];
const REVIEWS_LOW = ["나쁘진 않았는데 기다림이 조금 길었어요.", "그날 좀 정신없어 보이셨어요. 다음엔 괜찮겠죠.", "무난했지만 특별하진 않았습니다."];
const REPLIES = [
  "오실 때마다 반가워요. 다음에도 편하게 놀러 오세요 🌿", "좋게 봐주셔서 감사해요. 다음에 더 잘 챙겨드릴게요.",
  "덕분에 저도 즐거운 시간이었어요. 또 뵐게요!", "말씀 남겨주셔서 감사합니다. 다음엔 더 편하게 모실게요.",
];
const NOTES = ["", "", "", "", "조용한 자리 부탁드려요", "창가 자리면 좋겠어요", "기념일이라 작게 챙겨주시면 감사하겠습니다", "일행 한 명 더 올 수도 있어요", "늦을 수도 있어요"];
const PHOTO_POOL = ["/assets/p1.webp", "/assets/p2.webp", "/assets/p3.webp", "/assets/p4.webp", "/assets/p5.webp", "/assets/p6.webp", "/assets/p7.webp", "/assets/p8.webp", "/assets/p9.webp"];

/** 그만둔 캐치걸 — 10년이면 사람이 바뀐다. 지금 있는 이름과 겹치지 않게 */
const FORMER = ["서윤", "지안", "하은", "서아", "하윤", "지우", "수빈", "다은", "예린", "소율", "채린", "윤서", "유나", "가은", "보라", "나래"];
const FORMER_TAGS = [["차분함", "경청"], ["밝음", "유쾌함"], ["세련됨", "센스"], ["다정함", "배려"], ["털털함", "편안함"], ["조용함", "분위기"]];

/** 손님 이름은 두 글자 조합으로 만든다 — 남자 이름 느낌으로 */
const FIRST = ["민", "서", "지", "현", "준", "태", "승", "도", "재", "성", "우", "진", "영", "정", "경", "상", "동", "병", "광", "기", "형", "종", "원", "대"];
const SECOND = ["호", "우", "준", "현", "민", "훈", "석", "수", "환", "진", "규", "혁", "빈", "욱", "철", "식", "완", "범", "일", "재", "성", "태"];

type Tenure = { staffId: string; hourlyPrice: number; opts: string[]; join: Date; leave: Date | null };
type Guest = { id: string; join: Date; until: Date; weight: number; isNew: boolean };

async function main() {
  const reset = process.argv.includes("--reset");
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: SLUG } });

  const existingHistory = await prisma.reservation.count({ where: { storeId: store.id, startTime: { lt: CUTOFF } } });
  if (existingHistory > 0) {
    if (!reset) {
      console.log(`이미 ${CUTOFF.toISOString().slice(0, 10)} 이전 예약이 ${existingHistory}건 있어요. 다시 만들려면 --reset 을 붙이세요.`);
      return;
    }
    console.log(`🧹 이전 이력 ${existingHistory}건 정리...`);
    // 후기는 예약에 매달려 있어 함께 지워진다
    await prisma.reservation.deleteMany({ where: { storeId: store.id, startTime: { lt: CUTOFF } } });
    await prisma.staff.deleteMany({ where: { storeId: store.id, isActive: false, loginId: null, nickname: { in: FORMER } } });
    await prisma.customer.deleteMany({ where: { storeId: store.id, adminMemo: "10년 이력 샘플", reservations: { none: {} } } });
  }

  const [currentStaff, options, sources, existingCustomers] = await Promise.all([
    prisma.staff.findMany({ where: { storeId: store.id, isActive: true }, orderBy: { sortOrder: "asc" }, include: { options: { select: { id: true } } } }),
    prisma.storeOption.findMany({ where: { storeId: store.id } }),
    prisma.referralSource.findMany({ where: { storeId: store.id } }),
    prisma.customer.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "asc" }, select: { id: true, nickname: true } }),
  ]);
  const optionByName = new Map(options.map((o) => [o.name, o]));

  /* ─── 캐치걸 재직 기간 ─── */
  console.log("🍸 캐치걸 재직 기간과 그만둔 사람들...");
  // 지금 있는 사람들 — 처음부터 있던 사람도, 작년에 온 사람도 있다
  const joinYears = [2016, 2016, 2016, 2017, 2017, 2018, 2018, 2019, 2019, 2020, 2020, 2021, 2021, 2022, 2022, 2023, 2023, 2024, 2025];
  const tenures: Tenure[] = currentStaff.map((s, i) => {
    const y = joinYears[i % joinYears.length];
    const join = y === 2016 ? HISTORY_START : new Date(y, intBetween(0, 11), intBetween(1, 28));
    return { staffId: s.id, hourlyPrice: s.hourlyPrice, opts: s.options.map((o) => o.id), join, leave: null };
  });
  // 그만둔 사람들 — 1~4년 있다가 나갔다
  const formerRows = FORMER.map((name, i) => {
    const join = new Date(2016 + (i % 8), intBetween(0, 11), intBetween(1, 28));
    const leave = addDays(join, intBetween(330, 1400));
    return {
      id: id(),
      name,
      join: join < HISTORY_START ? HISTORY_START : join,
      leave: leave > HISTORY_END ? addDays(HISTORY_END, -intBetween(30, 200)) : leave,
      hourlyPrice: pick([250_000, 280_000, 300_000, 320_000, 350_000, 400_000]),
      tags: pick(FORMER_TAGS),
    };
  });
  await prisma.staff.createMany({
    data: formerRows.map((f, i) => ({
      id: f.id,
      storeId: store.id,
      nickname: f.name,
      bio: "함께했던 캐치걸이에요.",
      tags: JSON.stringify(f.tags),
      photos: JSON.stringify([PHOTO_POOL[(i + 4) % 9]]),
      isActive: false,
      hourlyPrice: f.hourlyPrice,
      sortOrder: 100 + i,
      createdAt: f.join,
      heightCm: 158 + intBetween(0, 14),
      weightKg: 44 + intBetween(0, 11),
    })),
  });
  for (const f of formerRows) tenures.push({ staffId: f.id, hourlyPrice: f.hourlyPrice, opts: [optionByName.get("옵션1")?.id ?? ""].filter(Boolean), join: f.join, leave: f.leave });
  console.log(`   현재 ${currentStaff.length}명 + 그만둔 ${formerRows.length}명`);

  /* ─── 손님 ─── */
  console.log("👤 손님 — 오래된 단골부터 한 번 오고 만 사람까지...");
  const taken = new Set(existingCustomers.map((c) => c.nickname));
  const guests: Guest[] = [];
  // 기존 손님: 앞쪽 22명은 몇 년째 오는 단골, 나머지는 최근 몇 년 사이에 시작
  existingCustomers.forEach((c, i) => {
    const regular = i < 22;
    const join = regular ? new Date(2016 + intBetween(0, 2), intBetween(0, 11), intBetween(1, 28)) : new Date(2021 + intBetween(0, 4), intBetween(0, 11), intBetween(1, 28));
    guests.push({ id: c.id, join: join < HISTORY_START ? HISTORY_START : join, until: HISTORY_END, weight: regular ? 6 : 2, isNew: false });
  });
  // 새 손님: 해마다 30~45명씩 늘고, 대부분은 반년~1년 반 다니다 발길이 끊긴다
  const newCustomers: { id: string; nickname: string; join: Date; sourceId: string | null }[] = [];
  const sourcePool = sources.flatMap((s) => Array(s.name === "OP가이드" ? 40 : s.name === "OP스타" ? 15 : s.name === "OP가자" ? 8 : s.name === "지인 소개" ? 6 : 2).fill(s.id));
  for (let year = 2016; year <= 2026; year++) {
    const n = year === 2016 ? 12 : year === 2026 ? 18 : intBetween(30, 45);
    for (let k = 0; k < n; k++) {
      let nick = "";
      for (let t = 0; t < 50; t++) {
        nick = pick(FIRST) + pick(SECOND);
        if (!taken.has(nick)) break;
      }
      if (taken.has(nick)) continue;
      taken.add(nick);
      const join = new Date(year, year === 2016 ? intBetween(9, 11) : intBetween(0, year === 2026 ? 5 : 11), intBetween(1, 28));
      const churned = chance(0.72);
      const until = churned ? addDays(join, intBetween(60, 540)) : HISTORY_END;
      const cid = id();
      newCustomers.push({ id: cid, nickname: nick, join, sourceId: chance(0.12) ? null : pick(sourcePool) });
      guests.push({ id: cid, join, until: until > HISTORY_END ? HISTORY_END : until, weight: churned ? 1 : 4, isNew: true });
    }
  }
  console.log(`   기존 ${existingCustomers.length}명 + 새 ${newCustomers.length}명`);

  /* ─── 예약 ─── */
  console.log("📅 예약 생성 (2016-10 ~ 2026-06)...");
  type ResRow = {
    id: string; code: string; storeId: string; staffId: string; customerId: string; startTime: Date; endTime: Date; hours: number;
    partySize: number; requestNote: string; purposeTag: string; status: string; createdBy: string; channel: string;
    hourlyPrice: number; optionsPrice: number; discountAmount: number; discountLabel: string; totalPrice: number; roomName: string; cancelledAt: Date | null; createdAt: Date;
  };
  type OptRow = { reservationId: string; optionId: string; name: string; price: number };
  type ReviewRow = { id: string; storeId: string; reservationId: string; staffId: string; customerId: string; rating: number; content: string; reply: string | null; repliedAt: Date | null; createdAt: Date };

  const resRows: ResRow[] = [];
  const optRows: OptRow[] = [];
  const reviewRows: ReviewRow[] = [];
  const firstVisit = new Map<string, Date>();
  const seqByMonth = new Map<string, number>();
  const totalDays = daysBetween(HISTORY_START, HISTORY_END);

  for (let day = new Date(HISTORY_START); day <= HISTORY_END; day = addDays(day, 1)) {
    const progress = daysBetween(HISTORY_START, day) / totalDays; // 0 → 1
    const wd = day.getDay();
    const weekend = wd === 5 || wd === 6;
    // 문 연 지 얼마 안 됐을 땐 하루 4~5건, 지금은 12~13건. 금·토는 더.
    const baseline = 4.5 + progress * 8;
    const target = Math.round(baseline * (weekend ? 1.5 : 1) * (0.8 + rand() * 0.4));

    const onDuty = tenures.filter((t) => t.join <= day && (!t.leave || t.leave >= day));
    if (onDuty.length === 0) continue;
    const working = onDuty.filter(() => chance(0.72));
    const guestsToday = guests.filter((g) => g.join <= day && g.until >= day);
    if (guestsToday.length === 0 || working.length === 0) continue;
    const guestPool = guestsToday.flatMap((g) => Array(g.weight).fill(g));
    const usedGuest = new Set<string>();
    const busy = new Map<string, Array<[number, number]>>();
    const yearFactor = 0.6 + progress * 0.4; // 요금은 해마다 올랐다

    let made = 0;
    let guard = 0;
    while (made < target && guard++ < target * 6) {
      const st = pick(working);
      const hours = chance(0.5) ? 1 : chance(0.6) ? 2 : chance(0.7) ? 3 : 4;
      const span = hours * 2;
      const bias = Math.min(1, Math.max(0, (rand() + rand() + rand()) / 3 + 0.18));
      const slot = Math.min(SLOTS - span, Math.floor(bias * (SLOTS - span)));
      const mine = busy.get(st.staffId) ?? [];
      if (mine.some(([s, e]) => slot < e && slot + span > s)) continue;
      const g = pick(guestPool);
      if (usedGuest.has(g.id)) continue;

      const start = startAt(day, slot);
      const end = new Date(start.getTime() + hours * 3600_000);
      const hourly = Math.round((st.hourlyPrice * yearFactor) / 10_000) * 10_000;
      const chosenOpts = st.opts.filter(() => chance(0.2));
      const optionsPrice = chosenOpts.length * 50_000;
      const list = hourly * hours + optionsPrice;
      const r = rand();
      const status = r < 0.88 ? "COMPLETED" : r < 0.93 ? "NOSHOW" : "CANCELLED";
      const appEra = day >= new Date(2025, 0, 1);
      const c = rand();
      const channel = appEra
        ? c < 0.55 ? "APP" : c < 0.85 ? "PHONE" : c < 0.97 ? "TELEGRAM" : "WALK_IN"
        : c < 0.65 ? "PHONE" : c < 0.9 ? "TELEGRAM" : "WALK_IN";
      const key = `${String(day.getFullYear()).slice(2)}${String(day.getMonth() + 1).padStart(2, "0")}`;
      const seq = (seqByMonth.get(key) ?? 0) + 1;
      seqByMonth.set(key, seq);
      const rid = id();

      resRows.push({
        id: rid, code: `${key}-${String(seq).padStart(4, "0")}`, storeId: store.id, staffId: st.staffId, customerId: g.id,
        startTime: start, endTime: end, hours, partySize: 1, requestNote: pick(NOTES), purposeTag: "", status,
        createdBy: channel === "APP" ? "CUSTOMER" : "ADMIN", channel, hourlyPrice: hourly, optionsPrice,
        discountAmount: 0, discountLabel: "", totalPrice: list, roomName: `${intBetween(1, 10)}번 룸`,
        cancelledAt: status === "CANCELLED" ? new Date(start.getTime() - 5 * 3600_000) : null,
        createdAt: new Date(start.getTime() - intBetween(2, 96) * 3600_000),
      });
      for (const oid of chosenOpts) {
        const o = options.find((x) => x.id === oid);
        if (o) optRows.push({ reservationId: rid, optionId: oid, name: o.name, price: 50_000 });
      }
      if (status === "COMPLETED" && chance(0.3)) {
        const low = chance(0.12);
        const rating = low ? intBetween(2, 3) : chance(0.65) ? 5 : 4;
        const replied = chance(0.35);
        const createdAt = new Date(end.getTime() + intBetween(2, 20) * 3600_000);
        reviewRows.push({
          id: id(), storeId: store.id, reservationId: rid, staffId: st.staffId, customerId: g.id, rating,
          content: low ? pick(REVIEWS_LOW) : pick(REVIEWS_HIGH),
          reply: replied ? pick(REPLIES) : null,
          repliedAt: replied ? new Date(createdAt.getTime() + intBetween(3, 48) * 3600_000) : null,
          createdAt,
        });
      }
      mine.push([slot, slot + span]);
      busy.set(st.staffId, mine);
      usedGuest.add(g.id);
      if (!firstVisit.has(g.id) || firstVisit.get(g.id)! > start) firstVisit.set(g.id, start);
      made++;
    }
  }
  console.log(`   예약 ${resRows.length}건 · 옵션 ${optRows.length}건 · 후기 ${reviewRows.length}건`);

  /* ─── 넣기 ─── */
  console.log("👤 새 손님 넣기...");
  const usedNew = newCustomers.filter((c) => firstVisit.has(c.id));
  for (let i = 0; i < usedNew.length; i += BATCH) {
    await prisma.customer.createMany({
      data: usedNew.slice(i, i + BATCH).map((c) => ({
        id: c.id, storeId: store.id, nickname: c.nickname, sourceId: c.sourceId, adminMemo: "10년 이력 샘플",
        createdAt: addDays(firstVisit.get(c.id)!, -intBetween(1, 3)),
      })),
    });
  }
  console.log(`   ${usedNew.length}명 (한 번도 안 온 ${newCustomers.length - usedNew.length}명은 빼고)`);

  console.log("📅 예약 넣기...");
  for (let i = 0; i < resRows.length; i += BATCH) {
    await prisma.reservation.createMany({ data: resRows.slice(i, i + BATCH) });
    process.stdout.write(`\r   ${Math.min(i + BATCH, resRows.length)}/${resRows.length}`);
  }
  console.log();
  for (let i = 0; i < optRows.length; i += BATCH) await prisma.reservationOption.createMany({ data: optRows.slice(i, i + BATCH) });

  console.log("⭐ 후기 넣기...");
  for (let i = 0; i < reviewRows.length; i += BATCH) {
    await prisma.review.createMany({ data: reviewRows.slice(i, i + BATCH) });
    process.stdout.write(`\r   ${Math.min(i + BATCH, reviewRows.length)}/${reviewRows.length}`);
  }
  console.log();

  console.log("🗓 가입일·입사일 맞추기...");
  // 한 명씩 update 를 돌리면 수백 번 왕복하다 연결이 끊긴다. 한 문장으로 끝낸다.
  // 가입일 = 첫 예약 1~3일 전, 입사일 = 첫 예약 3~14일 전 (더 이른 값이 이미 있으면 그대로)
  await prisma.$executeRaw`
    UPDATE "Customer" c SET "createdAt" = f.first - (floor(random()*3)+1) * interval '1 day'
    FROM (SELECT "customerId", MIN("startTime") AS first FROM "Reservation" WHERE "storeId" = ${store.id} GROUP BY "customerId") f
    WHERE c.id = f."customerId" AND c."createdAt" > f.first`;
  await prisma.$executeRaw`
    UPDATE "Staff" s SET "createdAt" = f.first - (floor(random()*12)+3) * interval '1 day'
    FROM (SELECT "staffId", MIN("startTime") AS first FROM "Reservation" WHERE "storeId" = ${store.id} GROUP BY "staffId") f
    WHERE s.id = f."staffId" AND s."createdAt" > f.first`;

  const byYear = new Map<number, { n: number; won: number }>();
  for (const r of resRows) {
    if (r.status === "CANCELLED" || r.status === "NOSHOW") continue;
    const y = r.startTime.getFullYear();
    const v = byYear.get(y) ?? { n: 0, won: 0 };
    v.n++;
    v.won += r.totalPrice;
    byYear.set(y, v);
  }
  console.log("\n✅ 10년 이력 완료");
  for (const [y, v] of [...byYear.entries()].sort()) console.log(`  ${y}: 예약 ${v.n.toLocaleString()}건 · 매출 ${(v.won / 1e8).toFixed(1)}억`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
