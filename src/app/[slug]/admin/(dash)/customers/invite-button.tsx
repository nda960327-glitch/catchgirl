"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useToast } from "@/components/providers";
import { inviteNewCustomer } from "../../actions";

/** 새 손님 초대 — 계정은 코드 없이 만들 수 없으므로 매장이 먼저 코드를 발급한다 */
export function InviteButton({ slug }: { slug: string }) {
  const [issued, setIssued] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const invite = () =>
    start(async () => {
      const memo = prompt("이 초대에 남길 메모 (선택)\n예: 김대표님 소개, 8/30 방문 예정") ?? "";
      const r = await inviteNewCustomer(slug, memo);
      if (!r.ok) return toast(r.error, "error");
      setIssued(r.data!.code);
      router.refresh();
    });

  return (
    <>
      <Button size="sm" onClick={invite} loading={pending}>+ 손님 초대</Button>
      {issued && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm" onClick={() => setIssued(null)}>
          <div className="w-full max-w-sm rounded-[28px] bg-paper p-7 text-center shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-mute">새 손님 연결코드</div>
            <div className="mt-2 font-serif text-[42px] font-bold tracking-[.25em] text-brand">{issued}</div>
            <p className="mt-3 text-[12px] leading-[1.8] text-mute">
              이 코드를 손님께 알려주세요.
              <br />앱 첫 화면 <b className="text-ink">&ldquo;처음이에요&rdquo;</b>에서 코드를 넣고
              <br />닉네임과 PIN을 정하면 시작됩니다.
            </p>
            <div className="mt-3 rounded-2xl bg-[#FAF6F7] px-4 py-2.5 text-[11px] text-mute">한 번 쓰면 사라져요. 고객 목록에 &ldquo;초대-{issued}&rdquo;로 대기 중이에요.</div>
            <Button className="mt-4" onClick={() => setIssued(null)}>확인</Button>
          </div>
        </div>
      )}
    </>
  );
}
