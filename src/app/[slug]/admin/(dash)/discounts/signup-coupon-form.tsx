"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { won } from "@/lib/utils";
import { saveSignupCoupon } from "../../actions";

/** 앱 설치 환영 쿠폰 — 연결코드로 앱을 처음 시작한 손님에게 자동으로 한 장 */
export function SignupCouponForm({ slug, init }: { slug: string; init: { amount: number; name: string; days: number } }) {
  const [f, setF] = useState(init);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const save = () =>
    start(async () => {
      const r = await saveSignupCoupon(slug, f);
      if (!r.ok) return toast(r.error, "error");
      toast("저장했어요", "success");
      router.refresh();
    });
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[14px] font-bold text-ink">앱 설치 환영 쿠폰</div>
        <Link href={`/${slug}/admin/cards`} className="text-[11px] font-bold text-brand underline-offset-2 hover:underline">손님 연결 카드 인쇄 ›</Link>
      </div>
      <p className="mt-1 text-[12px] leading-[1.8] text-mute">
        손님이 연결코드로 앱을 처음 시작하는 순간 자동으로 들어가는 쿠폰이에요. 카드에 <b className="text-ink">"앱 깔면 {f.amount > 0 ? won(f.amount) : "○○원"} 할인"</b>이라고 찍혀요. 0원이면 안 줘요.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="금액" hint={f.amount > 0 ? won(f.amount) : "안 줌"}>
          <Input type="number" min={0} step={5000} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} className="h-10 text-[13px]" />
        </Field>
        <Field label="쿠폰 이름" hint="손님 화면에 보여요">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={30} className="h-10 text-[13px]" />
        </Field>
        <Field label="사용 기한" hint="발급 뒤 며칠 · 0이면 기한 없음">
          <Input type="number" min={0} max={365} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} className="h-10 text-[13px]" />
        </Field>
      </div>
      <Button size="sm" onClick={save} loading={pending} className="mt-3">저장</Button>
    </Card>
  );
}
