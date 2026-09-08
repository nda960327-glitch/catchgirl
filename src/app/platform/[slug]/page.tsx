import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { isPlatform } from "@/lib/platform";
import { amountForMonth, billingStatus, nextBillingDate, storeHealth, storeLinks } from "@/lib/platform-data";
import { COMMITMENT_LABEL, PLANS, TERM_MONTHS, commitmentOf, earlyTerminationFee, planOf } from "@/lib/plans";
import { THEMES, themeOf } from "@/lib/themes";
import { won, wonShort } from "@/lib/utils";
import { Card, Chip } from "@/components/ui";
import { StoreCardEditor } from "../store-card-editor";
import { BizBox } from "./biz-box";
import { CmsBox } from "./cms-box";
import { DEBIT_DAY } from "@/lib/plans";
import { PENDING_REASON, bizStatus } from "@/lib/terms";
import { DeleteBox, PaymentsTable, SuspendBox, type PaymentRow } from "./store-forms";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  STORE_CREATED: "매장 생성",
  PLAN_CHANGED: "요금제 변경",
  CONTRACT_UPDATED: "계약 정보 수정",
  ADMIN_RESET: "관리자 계정 변경",
  ENTERED_AS_ADMIN: "관리자로 들어감",
  SUSPENDED: "이용 중지",
  RESUMED: "이용 재개",
  PAID: "입금 확인",
  UNPAID: "입금 표시 취소",
  BROADCAST: "전체 공지",
  STORE_DELETED: "매장 삭제",
  SIGNUP: "가입 신청",
  APPROVED: "가입 승인",
  BIZ_VERIFIED: "사업자 확인",
  BIZ_UPDATED: "사업자 정보 수정",
  BIZ_UNVERIFIED: "사업자 확인 취소",
  TERMS_AGREED: "약관 동의",
  CMS_UPDATED: "자동이체 정보",
};

/**
 * 업체 한 곳의 모든 것.
 *
 * 넘겨줄 링크와 큐알, 계약, 관리자 계정, 달마다 들어왔는지, 살아 있는지,
 * 그리고 무슨 일이 있었는지. 업체와 통화하면서 이 화면 하나만 보면 되게.
 */
export default async function StoreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isPlatform())) redirect("/platform/login");
  const { slug } = await params;

  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      admins: { orderBy: { id: "asc" }, take: 1, select: { email: true } },
      payments: { orderBy: { month: "desc" } },
      platformLogs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!store) notFound();

  const [links, health] = await Promise.all([storeLinks(slug), storeHealth(store.id)]);
  const plan = planOf(store.plan);
  const billing = billingStatus(store, store.payments.map((p) => p.month));
  const next = nextBillingDate(store.planStartedAt);
  const theme = THEMES[themeOf(store.theme)];
  const biz = bizStatus(store);
  const commitment = commitmentOf(store.commitment);
  const etf = earlyTerminationFee(store, billing.due.length);
  const pendingApproval = store.isSuspended && store.suspendedReason === PENDING_REASON;

  // 청구 예정 달(최근 것부터)에 입금 여부를 붙인다
  const paidBy = new Map(store.payments.map((p) => [p.month, p]));
  const paymentRows: PaymentRow[] = [...billing.due].reverse().map((m) => {
    const p = paidBy.get(m);
    return { month: m, amount: p?.amount ?? amountForMonth(store, m), paid: !!p, paidAt: p ? format(p.paidAt, "M/d") : null, memo: p?.memo ?? "" };
  });

  return (
    <div className="min-h-dvh bg-frame">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Link href="/platform" className="text-[12px] text-mute">‹ 매장 콘솔</Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {store.logoUrl ? <img src={store.logoUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="h-14 w-14 rounded-2xl" style={{ background: store.themeColor }} />}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-[24px] font-bold text-ink">{store.name}</h1>
                <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] text-white ${plan === "MAX" ? "bg-gold" : "bg-ink"}`}>{PLANS[plan].name}</span>
                <Chip tone={commitment === "TERM24" ? "brand" : "mute"}>{COMMITMENT_LABEL[commitment]}{commitment === "TERM24" ? ` · ${Math.min(billing.months, TERM_MONTHS)}/${TERM_MONTHS}개월` : ""}</Chip>
                {store.isSuspended && (pendingApproval ? <Chip tone="gold">가입 신청 · 승인 대기</Chip> : <Chip tone="red">이용 중지</Chip>)}
                {billing.unpaid.length > 0 && !pendingApproval && <Chip tone="red">미납 {billing.unpaid.length}개월</Chip>}
                {!biz.verified && !pendingApproval && <Chip tone="red">사업자 미확인</Chip>}
                {!store.cmsMemberNo && !pendingApproval && !store.isSuspended && <Chip tone="red">자동이체 미등록</Chip>}
                {(!biz.agreed || biz.outdated) && <Chip tone="gold">{biz.agreed ? "새 약관 동의 필요" : "약관 미동의"}</Chip>}
              </div>
              <div className="mt-1 text-[12px] text-mute">
                /{store.slug} · {format(store.createdAt, "yyyy.MM.dd")} 등록 · 구독 {billing.months}개월째 · 테마 {theme.name}
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-card px-4 py-3 text-[11px] leading-[1.9] shadow-card">
            <div className="text-mute">월 요금 <b className="text-ink">{won(billing.monthly)}</b></div>
            <div className="text-mute">다음 출금일 <b className="text-ink">{format(next, "M월 d일", { locale: ko })}</b> · 매월 {DEBIT_DAY}일</div>
            <div className="text-mute">관리자 <b className="text-ink">{store.admins[0]?.email ?? "없음"}</b></div>
            {commitment === "TERM24" && <div className="text-mute">지금 해지 시 반환 <b className="text-ink">{won(etf.total)}</b> <span className="text-[10px]">(할인 {won(etf.discountRefund)}{etf.setupRefund ? ` + 세팅 ${won(etf.setupRefund)}` : ""})</span></div>}
          </div>
        </div>

        {/* 살아 있는지 */}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["최근 30일 예약", `${health.reservations30d}건`],
            ["최근 30일 매장 몫", wonShort(health.storeRevenue30d)],
            ["마지막 예약", health.lastActivityAt ? format(health.lastActivityAt, "M/d HH:mm") : "없음"],
            ["고객 · 캐치걸", `${health.counts.customers} · ${health.counts.staff}`],
            ["룸 · 전체 예약", `${health.counts.rooms} · ${health.counts.reservations}`],
          ].map(([k, v]) => (
            <Card key={k} className="p-3.5">
              <div className="text-[10px] font-semibold text-mute">{k}</div>
              <div className="mt-1 font-serif text-[18px] font-bold text-ink">{v}</div>
            </Card>
          ))}
        </div>

        {/* 링크와 큐알 — 업체에 명함처럼 넘긴다 */}
        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">들어오는 주소</div>
          <div className="mt-0.5 text-[11px] text-mute">큐알을 찍으면 바로 열려요. 손님 앱은 초대받은 분만 들어갈 수 있으니 주소가 퍼져도 괜찮아요.</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {links.map((l) => (
              <div key={l.key} className="flex flex-col items-center rounded-2xl border border-line bg-card p-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.qr} alt={`${l.label} 큐알`} className="h-[176px] w-[176px] rounded-xl bg-white" />
                <div className="mt-2 text-[13px] font-bold text-ink">{l.label}</div>
                <a href={l.url} target="_blank" rel="noreferrer" className="mt-0.5 break-all font-mono text-[11px] text-brand underline-offset-2 hover:underline">{l.url}</a>
              </div>
            ))}
          </div>
        </Card>

        {/* 계약 · 계정 */}
        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">계약 · 관리자 계정</div>
          <div className="mt-0.5 text-[11px] text-mute">연락처와 메모는 여기서만 보여요. 업체 관리자 화면에는 나가지 않아요.</div>
          <StoreCardEditor
            slug={store.slug}
            plan={plan}
            commitment={commitment}
            onsiteSetupDone={store.onsiteSetupDone}
            ownerContact={store.ownerContact}
            platformMemo={store.platformMemo}
            adminEmail={store.admins[0]?.email ?? ""}
          />
        </Card>

        {/* 사업자 확인 · 약관 */}
        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">사업자 확인 · 약관</div>
          {pendingApproval && (
            <div className="mt-2 rounded-2xl border border-gold/40 bg-gold-lt/20 px-4 py-3 text-[12px] leading-[1.8] text-ink">
              <b>업체가 직접 신청한 매장이에요.</b> 등록증 사본을 열어 보고 홈택스에서 사업자 상태와 업태·종목을 조회한 뒤 <b>확인 완료</b>를 누르면 그 순간 매장이 열려요.
              {store.ownerContact && <> 연락처: <b>{store.ownerContact}</b></>}
            </div>
          )}
          <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">
            등록증 사본과 국세청 조회로 확인한 기록이에요. 상호·번호·업종을 고치면 확인 표시가 풀리니 다시 조회하고 확인해 주세요.
          </div>
          <BizBox
            slug={store.slug}
            biz={{ bizName: store.bizName, bizNumber: store.bizNumber, bizType: store.bizType, bizOwner: store.bizOwner, bizDocUrl: store.bizDocUrl, bizVerifyMemo: store.bizVerifyMemo }}
            verifiedAt={store.bizVerifiedAt ? format(store.bizVerifiedAt, "yyyy.MM.dd HH:mm") : null}
            pendingApproval={pendingApproval}
            terms={{ version: store.termsVersion, agreedAt: store.termsAgreedAt ? format(store.termsAgreedAt, "yyyy.MM.dd") : null, agreedBy: store.termsAgreedBy }}
          />
        </Card>

        {/* CMS 자동이체 */}
        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">CMS 자동이체</div>
          <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">
            요금은 매월 {DEBIT_DAY}일 매장 계좌에서 자동으로 빠져요. CMS 사 화면에서 이 매장을 고객으로 등록해 출금 동의를 받고, 회원번호를 여기에 적어 두면 <Link href="/platform/billing" className="font-bold text-brand underline-offset-2 hover:underline">출금 명단</Link>에 실려요.
          </div>
          <CmsBox slug={store.slug} memberNo={store.cmsMemberNo} agreedAt={store.cmsAgreedAt ? format(store.cmsAgreedAt, "yyyy.MM.dd") : null} note={store.cmsNote} />
        </Card>

        {/* 입금 */}
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[14px] font-bold text-ink">월 구독료 입금</div>
            <div className="text-[11px] text-mute">
              {billing.unpaid.length > 0 ? <span className="font-bold text-bad">미납 {billing.unpaid.join(", ")}</span> : "밀린 달 없음"}
            </div>
          </div>
          <div className="mt-0.5 text-[11px] text-mute">매월 {DEBIT_DAY}일 출금 기준이에요. CMS 결과는 출금 명단 화면에서 한 번에 반영하고, 계좌이체로 낸 달은 여기서 눌러요. 안 눌린 달이 미납으로 남아요.</div>
          <div className="mt-3">
            <PaymentsTable slug={store.slug} rows={paymentRows} />
          </div>
        </Card>

        {/* 정지 */}
        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">이용 중지</div>
          <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">
            약관 3항의 금지 행위가 확인되거나 미납이 길어지면 여기서 닫아요. 약관 4항에 따라 사전 통지 없이 바로 닫을 수 있어요. 손님·직원·관리자 화면이 모두 안내로 바뀌고, 손님에게는 사유가 보이지 않아요. 데이터는 그대로 남아 다시 열면 바로 돌아와요.
          </div>
          <div className="mt-3">
            <SuspendBox slug={store.slug} isSuspended={store.isSuspended} reason={store.suspendedReason} />
          </div>
        </Card>

        {/* 기록 */}
        <Card className="mt-4 p-5">
          <div className="text-[14px] font-bold text-ink">이 매장에 한 일</div>
          {store.platformLogs.length === 0 ? (
            <div className="mt-3 text-[12px] text-mute">아직 기록이 없어요</div>
          ) : (
            <div className="mt-3 divide-y divide-line">
              {store.platformLogs.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-[12px]">
                  <span className="w-[110px] shrink-0 text-[11px] text-mute">{format(l.createdAt, "M/d HH:mm")}</span>
                  <span className="font-bold text-ink">{ACTION_LABEL[l.action] ?? l.action}</span>
                  {l.detail && <span className="text-mute">{l.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 삭제 */}
        <Card className="mt-4 border-bad/30 p-5">
          <div className="text-[14px] font-bold text-bad">매장 삭제</div>
          <div className="mt-0.5 text-[11px] leading-[1.7] text-mute">
            손님·예약·매출·후기가 전부 사라지고 되돌릴 수 없어요. 해지 정책대로 90일은 이용 중지로 두었다가 지우세요.
          </div>
          <div className="mt-3">
            <DeleteBox slug={store.slug} />
          </div>
        </Card>
      </div>
    </div>
  );
}
