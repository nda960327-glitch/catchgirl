import Link from "next/link";
import { redirect } from "next/navigation";
import { getAgent } from "@/lib/agent-auth";
import { leaderboard, maskName } from "@/lib/leaderboard";
import { COMMISSION, PLANS, TERM_MONTHS } from "@/lib/plans";
import { OPERATOR_CONTACT } from "@/lib/terms";
import { won } from "@/lib/utils";
import { AgentEarningsCalculator } from "@/components/agent-earnings-calculator";

export const dynamic = "force-dynamic";

/**
 * 담당직원 모집 페이지 — 영업하는 사람이 우리 손님이다.
 * 한 달에 몇 곳이면 얼마인지 청사진을 그리고, 왜 잘 팔리는지, 뭘 하면 되는지, 돈은 언제 오는지.
 */
const P = COMMISSION.PRO, M = COMMISSION.MAX, O = COMMISSION.ONSITE;
const BLUEPRINT = [
  { who: "주말에만", pro: 2, max: 0, onsite: 0, note: "아는 사장 둘에게 링크 보내기" },
  { who: "퇴근하고", pro: 4, max: 1, onsite: 2, note: "저녁에 매장 한 바퀴, 시연 5분씩" },
  { who: "본업으로", pro: 7, max: 3, onsite: 5, note: "하루 한 곳 시연, 주 2회 방문 세팅" },
  { who: "팀으로", pro: 14, max: 6, onsite: 10, note: "둘이서 나눠 돌면 이 숫자예요" },
].map((r) => ({ ...r, total: r.pro * P + r.max * M + r.onsite * O }));

const WHY = [
  ["초기 투자 0원, 첫 달 무료", "사장이 지갑을 안 열고 시작해요. 6,000만원짜리 앱 세 개를 월 10만원에. \"안 할 이유가 있나요\" 가 그대로 멘트예요."],
  ["무약정도 있고 위약금도 없어요", "\"묶이는 거 아니냐\" 에 \"무약정도 있어요, 2년 하면 23% 싸고요\" 로 끝나요. 강요할 게 없으니 거절이 안 나와요."],
  ["시연이 5분이에요", "시연 페이지 링크 하나면 손님·관리자·직원 앱을 사장 폰에서 바로 열어요. 설치도 회원가입도 없어요."],
  ["손님 정보를 안 받아요", "\"손님 명단 털리는 거 아니냐\" 가 매장의 제일 큰 걱정인데, 실명·번호를 애초에 안 받아요. 이게 결정타예요."],
  ["가입이 셀프예요", "사장이 신청서를 직접 써요. 사업자등록증 사진 한 장이면 운영사가 확인하고 열어요. 내가 서류 들고 뛸 일이 없어요."],
];

const FAQ = [
  ["돈은 언제 들어와요?", "매장이 승인되고 첫 자동이체(매월 5일)가 성공한 달에 확정돼요. 운영사가 그달 정산 때 지급해요. 내 화면에서 매장마다 '승인 대기 → 첫 출금 대기 → 확정 → 지급 완료' 로 보여요."],
  ["무약정으로 가입하면요?", "무약정 매장은 커미션이 없어요. 그래서 2년 약정으로 안내하세요. 사장 입장에서도 23% 싸고 방문 세팅이 무료라 대부분 약정을 골라요."],
  ["방문 세팅이 뭐예요?", "매장에 가서 캐치걸 사진 찍고, 손님 명단 붙여 넣고, 직원한테 앱 여는 법 알려 주는 거예요. 반나절이면 끝나고 한 곳당 +200,000원이에요. 약정 매장은 세팅비가 무료라 사장이 좋아해요."],
  ["매장이 나중에 해지하면요?", "이미 확정돼 지급된 커미션은 돌려받지 않아요. 확정 전(승인 대기·첫 출금 대기)에 매장이 빠지면 커미션도 없어요."],
  ["한도나 할당이 있어요?", "없어요. 한 달에 열 곳이면 열 곳 다 쳐 드려요. 목표를 강제하지도 않아요."],
  ["세금은요?", "프리랜서 사업소득으로 3.3% 원천징수하고 지급해요. 지급 때 연락처와 계좌를 받아요."],
  ["제가 매장 안을 볼 수 있어요?", "아니요. 내 화면에는 매장 이름·상태·커미션만 보여요. 매장의 손님·예약·매출은 매장만 봐요."],
];

export default async function AgentJoinPage() {
  if (await getAgent()) redirect("/agent");
  const board = (await leaderboard()).filter((r) => r.earned > 0 || r.stores > 0).slice(0, 5);
  return (
    <div className="min-h-dvh bg-frame text-ink [word-break:keep-all]">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-frame/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <Link href="/" className="font-serif text-[18px] font-bold">캐치걸</Link>
          <span className="rounded-full bg-blush-lt px-2.5 py-1 text-[10px] font-bold text-brand">담당직원 모집</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/agent/login" className="rounded-xl border border-line bg-card px-3.5 py-2 text-[12px] font-bold text-ink">로그인</Link>
            <Link href="/agent/signup" className="cta-grad rounded-xl px-4 py-2 text-[12px] font-bold text-white shadow-cta">1분 가입</Link>
          </div>
        </div>
      </header>

      {/* 히어로 */}
      <section className="mx-auto max-w-5xl px-5 pb-14 pt-14 md:pt-20">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Sales partner</div>
        <h1 className="mt-3 font-serif text-[34px] font-bold leading-[1.22] md:text-[48px]">
          매장 하나 소개하면 <span className="text-brand">{won(P)}</span>.<br />카톡 한 통이면 돼요.
        </h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-[1.9] text-mute">
          아는 사장님에게 링크 하나 보내고, 사장이 신청서 쓰고, 운영사가 확인해서 열면 끝이에요. 물건도 재고도 서류도 없어요.
          Pro 한 곳 {won(P)}, Max 한 곳 {won(M)}, 방문 세팅까지 직접 하면 한 곳에 {won(O)} 더. <b className="text-ink">한도도, 할당도 없어요.</b>
        </p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          <Link href="/agent/signup" className="cta-grad rounded-2xl px-6 py-3.5 text-[14px] font-bold text-white shadow-cta">가입하고 내 코드 받기</Link>
          <a href="#blueprint" className="rounded-2xl border border-line bg-card px-6 py-3.5 text-[14px] font-bold text-ink hover:border-brand">한 달에 얼마인지 보기</a>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-ok-bg px-3 py-1.5 text-ok">가입 1분 · 코드 즉시</span>
          <span className="rounded-full bg-ok-bg px-3 py-1.5 text-ok">초기 비용 0원</span>
          <span className="rounded-full bg-blush-lt px-3 py-1.5 text-brand">첫 출금 확인 달에 확정</span>
        </div>
      </section>

      {/* 투잡 */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="rounded-[28px] bg-ink p-6 text-on-ink md:p-10">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold-lt">Side job</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold leading-[1.25] md:text-[36px]">조금만 시간 내면 투잡으로 돼요.<br />아니, 이건 투잡에 딱 맞게 생겼어요.</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["매장 한 곳 = 카톡 한 통 + 5분", "출근 전 링크 보내고, 퇴근길에 5분 보여 주면 끝이에요. 나머지는 사장이 신청서 쓰고 운영사가 열어요. 내가 붙어 있을 시간이 없어요."],
              ["주말 두 시간이면 두 곳", "아는 사장 둘에게 보여 주면 " + won(P * 2) + "이에요. 시급으로 치면 계산이 안 돼요. 배달로 " + won(P) + " 벌려면 스무 시간 넘게 뛰어야 해요."],
              ["거절당해도 잃는 게 없어요", "재고도 계약금도 없고, 사장이 안 하면 그냥 끝이에요. 열 번 보여 줘서 세 곳만 해도 " + won(P * 3) + "이에요."],
              ["이미 아는 사장이 몇 명이에요?", "이 일은 모르는 사람을 설득하는 게 아니라 아는 사장에게 좋은 걸 알려 주는 거예요. 그 사장이 옆 가게를 소개하면 그것도 내 매장이에요."],
              ["먼저 가입한 사람이 그 동네를 가져가요", "사장이 코드 하나만 적어요. 옆 가게 사장이 먼저 듣는 코드가 내 코드여야 해요. 늦게 오면 그 동네는 이미 누군가의 매장이에요."],
              ["계속 쌓여요", "한 번 소개한 매장은 내 화면에 남고, 다음 달 새 매장이 더해져요. 이번 달 세 곳, 다음 달 세 곳이면 두 달째 " + won(P * 6) + "이에요."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-on-ink/10 p-4">
                <div className="text-[14px] font-bold text-gold-lt">{t}</div>
                <p className="mt-1.5 text-[12px] leading-[1.8] opacity-85">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/agent/signup" className="rounded-2xl bg-gold-lt px-6 py-3 text-[13px] font-bold text-ink">지금 가입하고 아는 사장에게 보내기</Link>
            <span className="text-[11px] opacity-70">가입 1분 · 코드 즉시 · 초기 비용 0원</span>
          </div>
        </div>
      </section>

      {/* 청사진 */}
      <section id="blueprint" className="scroll-mt-16 border-y border-line/60 bg-card/60">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Blueprint</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">한 달에 몇 곳이면 얼마</h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">2년 약정 기준 커미션이에요. Pro {won(P)} · Max {won(M)} · 방문 세팅 +{won(O)}. 아래는 흔한 네 가지 속도예요.</p>
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {BLUEPRINT.map((r, i) => (
              <div key={r.who} className={`rounded-[26px] p-5 shadow-card ${i === 2 ? "bg-ink text-on-ink" : "bg-card"}`}>
                <div className={`text-[11px] font-bold uppercase tracking-[.12em] ${i === 2 ? "text-gold-lt" : "text-mute"}`}>{r.who}</div>
                <div className={`mt-2 font-serif text-[30px] font-bold leading-none ${i === 2 ? "text-gold-lt" : "text-brand"}`}>{won(r.total)}<span className={`text-[12px] font-normal ${i === 2 ? "opacity-70" : "text-mute"}`}>/월</span></div>
                <div className={`mt-1 text-[12px] ${i === 2 ? "opacity-80" : "text-mute"}`}>1년이면 {won(r.total * 12)}</div>
                <ul className={`mt-4 flex flex-col gap-1 text-[12px] ${i === 2 ? "opacity-90" : "text-ink"}`}>
                  <li>Pro {r.pro}곳 · {won(r.pro * P)}</li>
                  {r.max > 0 && <li>Max {r.max}곳 · {won(r.max * M)}</li>}
                  {r.onsite > 0 && <li>방문 세팅 {r.onsite}곳 · +{won(r.onsite * O)}</li>}
                </ul>
                <div className={`mt-3 text-[11px] leading-[1.6] ${i === 2 ? "opacity-70" : "text-mute"}`}>{r.note}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-mute">매장 한 곳이 월 10만원을 내는 동안 첫 달에 {won(P)}을 받아요. 매장이 오래 남을수록 운영사가 좋고, 그래서 커미션을 이만큼 줘요.</div>

          <h3 className="mt-12 font-serif text-[22px] font-bold">내 속도로 눌러 보세요</h3>
          <div className="mt-4"><AgentEarningsCalculator /></div>
        </div>
      </section>

      {/* 왜 팔리나 */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Why it sells</div>
        <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">거절할 이유를 다 없애 놨어요</h2>
        <p className="mt-3 max-w-2xl text-[13px] leading-[1.9] text-mute">영업이 어려운 건 사장이 거절할 이유가 있을 때예요. 이 앱은 그 이유를 하나씩 없애 둔 상태로 파는 거예요.</p>
        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {WHY.map(([t, d], i) => (
            <div key={t} className="rounded-[22px] border border-line bg-card p-5">
              <div className="font-mono text-[11px] font-bold text-brand">0{i + 1}</div>
              <div className="mt-1.5 text-[14px] font-bold">{t}</div>
              <p className="mt-1.5 text-[12px] leading-[1.8] text-mute">{d}</p>
            </div>
          ))}
          <div className="rounded-[22px] bg-ink p-5 text-on-ink">
            <div className="font-mono text-[11px] font-bold text-gold-lt">멘트</div>
            <p className="mt-1.5 text-[13px] leading-[1.9]">
              &ldquo;사장님, 손님이 QR 찍으면 예약되는 우리 매장 앱이 있어요. 외주로 만들면 6천만원인데 월 10만원이고, 첫 달은 무료예요. 손님 번호는 안 받아서 털릴 것도 없어요. 5분만 보여드릴게요.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* 할 일 */}
      <section className="border-y border-line/60 bg-card/60">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">What you do</div>
          <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">하는 일은 세 가지예요</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["1", "링크 보내기", "가입하면 나오는 내 소개 링크를 사장에게 보내요. 그 링크로 신청하면 자동으로 내 매장이 돼요. 코드만 불러 줘도 돼요."],
              ["2", "5분 시연", "시연 페이지를 사장 폰에서 열어요. 손님 앱·관리자·직원 앱이 계정과 함께 다 열려 있어요. 사장이 직접 눌러 보게 두세요."],
              ["3", "(선택) 방문 세팅", "승인된 매장에 가서 사진 찍고, 손님 명단 붙여 넣고, 직원에게 앱 여는 법 알려 줘요. 반나절, +" + won(O) + "."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-[26px] bg-card p-6 shadow-card">
                <div className="font-serif text-[44px] font-bold leading-none text-brand">{n}</div>
                <div className="mt-2 font-serif text-[22px] font-bold">{t}</div>
                <p className="mt-2 text-[13px] leading-[1.8] text-mute">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-[22px] border border-line bg-card p-5 text-[13px] leading-[1.9] text-mute">
            <b className="text-ink">돈이 오는 순서.</b> 사장이 신청 → 운영사가 사업자등록증 확인하고 승인 → 매장이 출금 동의 등록 → 다음 달 5일 첫 자동이체 성공 → <b className="text-ink">그달 커미션 확정</b> → 운영사가 정산 때 지급. 내 화면에서 매장마다 지금 어느 단계인지 보여요.
          </div>
        </div>
      </section>

      {/* 순위 */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold">Leaderboard</div>
        <h2 className="mt-2 font-serif text-[28px] font-bold md:text-[36px]">지금 뛰는 사람들</h2>
        {board.length === 0 ? (
          <div className="mt-6 rounded-[26px] border border-dashed border-line bg-card p-8 text-center">
            <div className="font-serif text-[20px] font-bold">아직 1등 자리가 비어 있어요</div>
            <p className="mt-2 text-[13px] leading-[1.8] text-mute">지금 가입하면 첫 매장이 곧 1등이에요. 순위는 가입한 직원끼리 이름으로 보고, 여기엔 성만 나와요.</p>
            <Link href="/agent/signup" className="cta-grad mt-4 inline-block rounded-2xl px-6 py-3 text-[13px] font-bold text-white shadow-cta">1등 하러 가기</Link>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[22px] border border-line bg-card">
            {board.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 border-b border-line/60 px-5 py-3 text-[13px] last:border-0">
                <span className={`w-7 text-center font-serif text-[18px] font-bold ${i === 0 ? "text-brand" : "text-mute"}`}>{i + 1}</span>
                <span className="font-bold">{maskName(r.name)}</span>
                <span className="text-mute">매장 {r.stores}곳</span>
                <span className="ml-auto font-bold text-brand">{won(r.earned)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FAQ */}
      <section className="border-t border-line/60 bg-card/60">
        <div className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="font-serif text-[28px] font-bold md:text-[36px]">자주 묻는 질문</h2>
          <div className="mt-6 flex flex-col gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-2xl border border-line bg-card px-5 py-4">
                <summary className="cursor-pointer list-none text-[14px] font-bold"><span className="mr-2 text-brand">Q.</span>{q}</summary>
                <p className="mt-2 text-[13px] leading-[1.9] text-mute">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14 text-center">
        <h2 className="font-serif text-[28px] font-bold md:text-[36px]">아는 사장님 한 분이면 {won(P)}이에요</h2>
        <p className="mx-auto mt-3 max-w-xl text-[13px] leading-[1.9] text-mute">가입은 1분, 코드는 즉시. 링크 보내고 5분 보여 주면 끝이에요. 궁금한 건 텔레그램 <a href={`https://t.me/${OPERATOR_CONTACT.telegram}`} target="_blank" rel="noreferrer" className="font-bold text-brand">@{OPERATOR_CONTACT.telegram}</a>.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link href="/agent/signup" className="cta-grad rounded-2xl px-7 py-3.5 text-[14px] font-bold text-white shadow-cta">가입하고 내 코드 받기</Link>
          <Link href="/demo" className="rounded-2xl border border-line bg-card px-7 py-3.5 text-[14px] font-bold hover:border-brand">시연 페이지 먼저 보기</Link>
        </div>
        <div className="mt-8 text-[10px] text-mute/70">매장 요금 Pro {won(PLANS.PRO.termPrice)} · Max {won(PLANS.MAX.termPrice)} ({TERM_MONTHS / 12}년 약정) · 커미션은 2년 약정 매장에만 · 프리랜서 사업소득 3.3% 원천징수</div>
      </section>
    </div>
  );
}
