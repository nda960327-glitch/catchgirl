"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Eyebrow } from "@/components/ui";
import { InviteCard } from "@/components/invite-card";
import { InstallPoster } from "@/components/install-poster";
import { won } from "@/lib/utils";

type CardProps = { storeName: string; logoUrl: string | null; amount: number; qr: string; url: string; theme: { brand: string; ink: string; paper: string; line: string; gold: string } };
type Pending = { id: string; nickname: string; code: string };

/** 인쇄 화면 — 빈칸 카드 N장 또는 대기 손님 코드 카드 */
export function CardsClient({ slug, card, pending }: { slug: string; card: CardProps; pending: Pending[] }) {
  const [mode, setMode] = useState<"blank" | "coded" | "poster">("blank");
  const [count, setCount] = useState(10);

  const cards: { key: string; code: string | null; who?: string }[] =
    mode === "blank" ? Array.from({ length: Math.min(60, Math.max(1, count)) }, (_, i) => ({ key: `b${i}`, code: null })) : pending.map((p) => ({ key: p.id, code: p.code, who: p.nickname }));

  return (
    <div className="animate-fade">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #card-sheet, #card-sheet * { visibility: visible !important; }
          #card-sheet { position: absolute; left: 0; top: 0; width: 190mm; display: grid !important; grid-template-columns: repeat(2, 90mm); gap: 5mm 10mm; padding: 0; margin: 0; }
          #card-sheet .invite-card { break-inside: avoid; box-shadow: none !important; }
          #card-sheet[data-poster] { display: block !important; width: 190mm; }
          #card-sheet[data-poster] .install-poster { width: 190mm !important; border: 0 !important; border-radius: 0 !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>

      <div className="print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Invite Cards</Eyebrow>
            <h1 className="mt-1 font-serif text-[22px] font-bold text-ink">손님 연결 카드 · 포스터</h1>
            <div className="mt-0.5 text-[12px] leading-[1.7] text-mute">
              명함 크기(90×50mm), A4 한 장에 열 장. 방문한 손님에게 코드를 적어 건네면 QR로 바로 열고 코드로 시작해요. 앱스토어 없이 열리는 웹앱이라 설치는 선택이고, 지갑에 넣고 QR만 찍어도 돼요.
              {card.amount > 0 ? <> 시작하면 <b className="text-ink">{won(card.amount)} 쿠폰</b>이 바로 들어가요.</> : <> 환영 쿠폰은 <Link href={`/${slug}/admin/discounts`} className="font-bold text-brand underline-offset-2 hover:underline">할인 관리</Link>에서 켤 수 있어요.</>}
            </div>
          </div>
          <Button onClick={() => window.print()}>인쇄하기</Button>
        </div>

        <Card className="mt-4 p-4">
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <label className="flex items-center gap-1.5 font-semibold text-ink">
              <input type="radio" checked={mode === "blank"} onChange={() => setMode("blank")} className="accent-[#B4586A]" />
              빈칸 카드 <span className="font-normal text-mute">— 직원이 코드를 네임펜으로 적어요</span>
            </label>
            {mode === "blank" && (
              <label className="flex items-center gap-1.5 text-mute">장수
                <input type="number" min={1} max={60} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-8 w-16 rounded-lg border border-line bg-card px-2 text-center text-[12px] text-ink" />
              </label>
            )}
            <label className="flex items-center gap-1.5 font-semibold text-ink">
              <input type="radio" checked={mode === "coded"} onChange={() => setMode("coded")} className="accent-[#B4586A]" disabled={pending.length === 0} />
              코드 인쇄 카드 <span className="font-normal text-mute">— 아직 앱을 시작하지 않은 손님 {pending.length}명</span>
            </label>
            <label className="flex items-center gap-1.5 font-semibold text-ink">
              <input type="radio" checked={mode === "poster"} onChange={() => setMode("poster")} className="accent-[#B4586A]" />
              포스터 (A4) <span className="font-normal text-mute">— 카운터·테이블·거울 옆에 붙여요</span>
            </label>
          </div>
          <div className="mt-2 text-[11px] leading-[1.7] text-mute">
            코드는 손님마다 하나씩 늘 있어요. 카드를 잃어버려도 고객 관리에서 코드를 보고 다시 알려 주면 돼요. 손님이 앱을 안 깔아도 그 손님 기록은 관리자 화면에서 그대로 관리돼요.
          </div>
        </Card>

        <div className="mt-4 text-[11px] font-semibold text-mute">미리보기 · 인쇄하면 실제 크기로 나와요</div>
      </div>

      {mode === "poster" ? (
        <div id="card-sheet" data-poster className="mt-2 print:mt-0">
          <InstallPoster storeName={card.storeName} logoUrl={card.logoUrl} amount={card.amount} qr={card.qr} width="min(100%, 420px)" theme={card.theme} />
        </div>
      ) : (
      <div id="card-sheet" className="mt-2 grid gap-4 print:mt-0" style={{ gridTemplateColumns: "repeat(auto-fill, 90mm)" }}>
        {cards.map((c) => (
          <div key={c.key} className="flex flex-col items-start gap-1">
            <InviteCard storeName={card.storeName} logoUrl={card.logoUrl} amount={card.amount} qr={card.qr} url={card.url} code={c.code} width="90mm" theme={card.theme} />
            {c.who && <div className="text-[10px] text-mute print:hidden">{c.who}</div>}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
