"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { blockFromCustomer, blockFromStaff, type BlockTarget } from "@/app/[slug]/report-actions";

/**
 * 차단 버튼 — 신고 옆에 붙는다. 신고는 매장·운영사가 판단하는 길이고,
 * 차단은 그 판단을 기다리지 않고 내가 바로 상대를 치우는 길이다.
 *
 *  - 손님이 누르면: 그 손님의 후기·댓글이 내 화면에서 사라진다
 *  - 직원이 누르면: 그 손님은 나를 예약하거나 내 프로필에 댓글을 달 수 없다
 */
export function BlockButton({
  slug, role, target, name, className, onRequireLogin,
}: {
  slug: string;
  role: "customer" | "staff";
  target: BlockTarget;
  name: string;
  className?: string;
  onRequireLogin?: () => void;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const click = () => {
    if (onRequireLogin) return onRequireLogin();
    const msg =
      role === "customer"
        ? `${name}님을 차단할까요?\n\n이 손님의 후기와 댓글이 내 화면에 더 이상 보이지 않아요. 상대에게는 알리지 않고, 마이페이지에서 언제든 풀 수 있어요.`
        : `${name}님을 차단할까요?\n\n이 손님은 나를 예약하거나 내 프로필에 댓글을 달 수 없고, 이 손님의 글도 내 화면에 안 보여요. 상대에게는 알리지 않아요. 매장 관리자는 차단 목록을 볼 수 있고, 내 설정에서 언제든 풀 수 있어요.`;
    if (!window.confirm(msg)) return;
    start(async () => {
      const r = role === "customer" ? await blockFromCustomer(slug, target) : await blockFromStaff(slug, target);
      if (!r.ok) {
        if (r.error === "LOGIN_REQUIRED") return toast("다시 로그인해 주세요", "info");
        return toast(r.error, "error");
      }
      toast(`${name}님을 차단했어요`, "success");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      aria-label={`${name} 차단`}
      className={cn("text-[10px] text-mute underline-offset-2 hover:underline disabled:opacity-50", className)}
    >
      차단
    </button>
  );
}
