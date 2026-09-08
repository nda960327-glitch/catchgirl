"use client";

import { Button, Card, Eyebrow } from "@/components/ui";
import type { StoreLinks } from "@/lib/platform-data";

/**
 * 매장이 스스로 큐알을 뽑아 붙이는 자리.
 * 운영사 콘솔에도 같은 큐알이 있지만, 매장이 직접 세팅하는 흐름에서는 여기서 바로 인쇄한다.
 */
export function LinksCard({ links }: { links: StoreLinks }) {
  return (
    <Card id="links" className="mt-5 p-5 print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-baseline justify-between gap-2 print:hidden">
        <div>
          <Eyebrow>Links · QR</Eyebrow>
          <div className="mt-1 text-[14px] font-bold text-ink">들어오는 주소와 큐알</div>
          <p className="mt-1 text-[12px] leading-[1.7] text-mute">
            손님용은 카운터나 명함에, 직원용은 대기실에 붙이세요. 손님은 연결코드가 있어야 들어오니 큐알이 퍼져도 괜찮아요. 주소를 열고 '앱으로 설치'를 누르면 홈 화면에 매장 로고로 깔려요.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>인쇄</Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 print:mt-0 print:grid-cols-3">
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
  );
}
