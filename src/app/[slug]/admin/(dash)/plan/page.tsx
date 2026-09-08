import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { getStoreBySlug } from "@/lib/store";
import { cn, won } from "@/lib/utils";
import { Card, Chip, Eyebrow } from "@/components/ui";
import { PlanBadge } from "@/components/admin-nav";
import { DISCOUNT_LABEL, DISCOUNT_RATE, PLANS, POLICY, SETUP_FEE, billedPrice, planOf, usageOf, yearlyPrice, type Plan } from "@/lib/plans";
import { PlanSwitch } from "./plan-switch";
import { TERMS, TERMS_TITLE, TERMS_VERSION, bizStatus } from "@/lib/terms";

export const dynamic = "force-dynamic";

const limitText = (n: number | null) => (n === null ? "무제한" : `${n.toLocaleString("ko-KR")}명`);
const roomLimitText = (n: number | null) => (n === null ? "무제한" : `${n}개`);

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  const plan = planOf(store.plan);
  const spec = PLANS[plan];

  const [customerCount, staffCount, roomCount] = await Promise.all([
    prisma.customer.count({ where: { storeId: store.id } }),
    prisma.staff.count({ where: { storeId: store.id, isActive: true } }),
    prisma.room.count({ where: { storeId: store.id, isActive: true } }),
  ]);

  const rows = [
    { label: "등록 고객", ...usageOf(customerCount, spec.limits.customers), unit: "명" },
    { label: "캐치걸", ...usageOf(staffCount, spec.limits.staff), unit: "명" },
    { label: "룸", ...usageOf(roomCount, spec.limits.rooms), unit: "개" },
  ];
  const overRows = rows.filter((r) => r.over);

  // 다음 청구일 — 구독 시작일과 같은 날짜로 매달 돌아온다
  const start = store.planStartedAt;
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), start.getDate());
  if (next <= now) next.setMonth(next.getMonth() + 1);

  return (
    <div className="animate-fade">
      <Eyebrow>Plan</Eyebrow>
      <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">요금제</h1>

      {/* 지금 쓰고 계신 요금제 */}
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <PlanBadge plan={plan} />
              <span className="text-[13px] font-bold text-ink">구독 중</span>
              {DISCOUNT_RATE > 0 && <Chip tone="red">{DISCOUNT_LABEL}</Chip>}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-serif text-[30px] font-bold text-brand">{won(billedPrice(plan))}</span>
              <span className="text-[12px] text-mute">/ 월</span>
              {DISCOUNT_RATE > 0 && <span className="text-[12px] text-mute line-through">{won(spec.price)}</span>}
            </div>
            <div className="mt-1 text-[11px] text-mute">{spec.tagline}</div>
          </div>
          <div className="rounded-2xl bg-well px-4 py-3 text-[11px] leading-[1.9]">
            <div className="text-mute">시작일 <b className="text-ink">{format(start, "yyyy년 M월 d일", { locale: ko })}</b></div>
            <div className="text-mute">다음 청구일 <b className="text-ink">{format(next, "M월 d일", { locale: ko })}</b></div>
            <div className="text-mute">연납 시 <b className="text-ink">{won(yearlyPrice(plan))}</b> (2개월 무료)</div>
          </div>
        </div>

        {/* 한도 사용량 */}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="rounded-2xl border border-line bg-card p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-semibold text-mute">{r.label}</span>
                <span className={cn("text-[12px] font-bold", r.over ? "text-bad" : "text-ink")}>
                  {r.used.toLocaleString("ko-KR")}
                  <span className="text-mute"> / {r.limit === null ? "무제한" : r.limit.toLocaleString("ko-KR")}{r.limit === null ? "" : r.unit}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-well-2">
                <span
                  className={cn("block h-full rounded-full", r.over ? "bg-bad" : r.ratio > 0.8 ? "bg-gold" : "bg-brand")}
                  style={{ width: `${r.limit === null ? 6 : Math.max(4, r.ratio * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-mute">
                {r.limit === null ? "제한 없이 쓰실 수 있어요" : r.over ? `한도를 ${(r.used - r.limit).toLocaleString("ko-KR")}${r.unit} 넘었어요` : `${r.remaining?.toLocaleString("ko-KR")}${r.unit} 더 쓰실 수 있어요`}
              </div>
            </div>
          ))}
        </div>

        {overRows.length > 0 && (
          <div className="mt-3 rounded-2xl border border-bad/25 bg-bad-bg px-4 py-3 text-[11px] leading-[1.8] text-ink">
            <b>{overRows.map((r) => r.label).join(" · ")}</b>이(가) {spec.name} 한도를 넘었어요.
            지금 당장 막히는 건 없어요 — 등록도 예약도 그대로 됩니다.
            다음 청구일({format(next, "M월 d일", { locale: ko })})까지 이대로면 Max 로 올려 드리고, 그 전에 미리 알려드려요.
          </div>
        )}
      </Card>

      {/* 요금제 비교 */}
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <div className="text-[14px] font-bold text-ink">요금제 비교</div>
          <div className="mt-0.5 text-[11px] text-mute">지금 쓰시는 요금제에 표시가 있어요</div>
        </div>
        <div className="scroll-x overflow-x-auto">
          <table className="w-full min-w-[440px] text-[12px]">
            <thead>
              <tr className="bg-well">
                <th className="px-5 py-3 text-left font-semibold text-mute">항목</th>
                {(Object.keys(PLANS) as Plan[]).map((p) => (
                  <th key={p} className={cn("px-4 py-3 text-center", p === plan && "bg-blush-lt/60")}>
                    <span className="flex items-center justify-center gap-1.5">
                      <PlanBadge plan={p} />
                      {p === plan && <span className="text-[10px] font-bold text-brand">구독 중</span>}
                    </span>
                    <div className="mt-1 font-bold text-ink">{won(billedPrice(p))}<span className="text-[10px] font-normal text-mute"> / 월</span></div>
                    <div className="text-[10px] text-mute line-through">{won(PLANS[p].price)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["등록 고객", (p: Plan) => limitText(PLANS[p].limits.customers)],
                ["캐치걸", (p: Plan) => limitText(PLANS[p].limits.staff)],
                ["룸", (p: Plan) => roomLimitText(PLANS[p].limits.rooms)],
                ["예약·고객·후기 관리", () => "전부"],
                ["매출 관리 · 스케줄 관리", () => "전부"],
                ["데이터 내보내기", (p: Plan) => (PLANS[p].dataExport ? "○" : "—")],
                ["우선 지원", (p: Plan) => (PLANS[p].prioritySupport ? "○" : "—")],
              ].map(([label, get]) => (
                <tr key={label as string} className="border-t border-line">
                  <td className="px-5 py-3 font-semibold text-mute">{label as string}</td>
                  {(Object.keys(PLANS) as Plan[]).map((p) => (
                    <td key={p} className={cn("px-4 py-3 text-center font-semibold text-ink", p === plan && "bg-blush-lt/40")}>
                      {(get as (p: Plan) => string)(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[12px] font-bold text-ink">초기 구축비</span>
            <span className="font-serif text-[18px] font-bold text-brand">{won(SETUP_FEE)}</span>
            <span className="text-[11px] text-mute">첫 1회 · 요금제와 별도</span>
          </div>
          <p className="mt-1 text-[11px] leading-[1.8] text-mute">
            기존 손님 이관과 연결코드 발급, 캐치걸 프로필·사진 등록, 룸과 조 시간 세팅, 사용 교육까지 포함이에요.
          </p>
        </div>
      </Card>

      {/* 정책 */}
      <Card className="mt-4 p-5">
        <div className="text-[14px] font-bold text-ink">이용 정책</div>
        <div className="mt-4 flex flex-col gap-4">
          {POLICY.map((p) => (
            <div key={p.title} className="border-l-2 border-brand/30 pl-3.5">
              <div className="text-[12px] font-bold text-ink">{p.title}</div>
              <p className="mt-1 whitespace-pre-line text-[11px] leading-[1.9] text-mute">{p.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 약관 — 어느 판에 언제 동의했는지와 전문. 금지 행위와 즉시 정지 조항은 늘 보이게 */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[14px] font-bold text-ink">{TERMS_TITLE}</div>
          <div className="text-[11px] text-mute">
            {(() => {
              const b = bizStatus(store);
              if (!b.agreed) return <span className="font-bold text-bad">동의 기록 없음</span>;
              return (
                <>
                  {store.termsVersion} 판 · {format(store.termsAgreedAt!, "yyyy.MM.dd")} 동의{store.termsAgreedBy ? ` · ${store.termsAgreedBy}` : ""}
                  {b.outdated && <span className="ml-1.5 font-bold text-gold">· 새 판({TERMS_VERSION})이 있어요</span>}
                </>
              );
            })()}
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-bad/30 bg-bad-bg px-4 py-3 text-[11px] leading-[1.8] text-ink">
          <b>즉시 정지 안내.</b> 성매매 알선·권유·강요, 청소년 고용·출입, 성적 서비스의 광고·요청 처리 등 약관 3항의 행위가 확인되면 사전 통지 없이 바로 이용이 정지되고, 정지 기간의 요금과 초기 구축비는 돌려드리지 않아요.
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] font-bold text-brand">약관 전문 보기</summary>
          <div className="mt-3 flex flex-col gap-4">
            {TERMS.map((t) => (
              <div key={t.title} className="border-l-2 border-line pl-3.5">
                <div className="text-[12px] font-bold text-ink">{t.title}</div>
                <p className="mt-1 whitespace-pre-line text-[11px] leading-[1.9] text-mute">{t.body}</p>
              </div>
            ))}
          </div>
        </details>
      </Card>

      <PlanSwitch slug={slug} plan={plan} />
    </div>
  );
}
