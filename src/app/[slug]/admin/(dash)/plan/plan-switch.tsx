"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/providers";
import { PLANS, type Plan } from "@/lib/plans";
import { setStorePlan } from "../../actions";

/**
 * 요금제 바꾸기.
 *
 * 실제 서비스에서는 결제가 붙는 자리다. 지금은 결제 연동이 없으므로 화면에서
 * 바로 바뀌고, 그 사실을 숨기지 않고 적어 둔다.
 */
export function PlanSwitch({ slug, plan }: { slug: string; plan: Plan }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const change = (next: Plan) =>
    start(async () => {
      if (next === plan) return;
      if (!confirm(`${PLANS[next].name} 요금제로 바꿀까요?`)) return;
      const r = await setStorePlan(slug, next);
      if (!r.ok) return toast(r.error, "error");
      toast(`${PLANS[next].name} 요금제로 바꿨어요`, "success");
      router.refresh();
    });

  return (
    <Card className="mt-4 p-5">
      <div className="text-[14px] font-bold text-ink">요금제 바꾸기</div>
      <p className="mt-1 text-[11px] leading-[1.8] text-mute">
        올리시면 바로 적용되고 남은 기간만큼 차액으로 계산해 드려요. 내리시는 건 다음 청구일부터예요.
        <br />
        <span className="text-[10px]">결제 연동 전이라 지금은 버튼을 누르면 곧바로 바뀌어요.</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(PLANS) as Plan[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={p === plan ? "secondary" : "outline"}
            disabled={pending || p === plan}
            onClick={() => change(p)}
          >
            {p === plan ? `${PLANS[p].name} 사용 중` : `${PLANS[p].name} 로 바꾸기`}
          </Button>
        ))}
      </div>
    </Card>
  );
}
