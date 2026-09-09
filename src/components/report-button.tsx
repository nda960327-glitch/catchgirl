"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { cn } from "@/lib/utils";
import { REPORT_CATEGORIES, REPORT_DETAIL_MAX, type ReportCategory, type ReportTargetType } from "@/lib/report-types";
import { reportFromCustomer, reportFromStaff } from "@/app/[slug]/report-actions";

/**
 * 신고 버튼 — 누르면 아래에서 시트가 올라오고, 사유 하나 고르고 보내면 끝.
 * 손님 화면과 직원 화면이 같은 버튼을 쓰고, 누가 눌렀는지는 role 로 가른다.
 * 로그인 전이면 onRequireLogin 을 부른다 (손님 화면에서만 있는 일).
 */
export function ReportButton({
  slug, role, target, label = "신고", className, variant = "text", onRequireLogin,
}: {
  slug: string;
  role: "customer" | "staff";
  target: { type: ReportTargetType; id: string | null; name: string };
  label?: string;
  className?: string;
  variant?: "text" | "pill" | "icon";
  onRequireLogin?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<ReportCategory | null>(null);
  const [detail, setDetail] = useState("");
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const openSheet = () => {
    if (onRequireLogin) return onRequireLogin();
    setOpen(true);
  };

  const submit = () => {
    if (!cat) return toast("사유를 골라 주세요", "info");
    start(async () => {
      const fn = role === "customer" ? reportFromCustomer : reportFromStaff;
      const r = await fn(slug, { targetType: target.type, targetId: target.id, targetName: target.name, category: cat, detail });
      if (!r.ok) {
        if (r.error === "LOGIN_REQUIRED") { setOpen(false); return onRequireLogin?.(); }
        return toast(r.error, "error");
      }
      setOpen(false); setCat(null); setDetail("");
      toast("신고가 접수됐어요. 매장과 운영사가 확인할게요.", "success");
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={`${target.name} 신고`}
        className={cn(
          variant === "text" && "text-[10px] text-mute underline-offset-2 hover:underline",
          variant === "pill" && "rounded-full border border-line bg-card px-2.5 py-1 text-[10px] font-semibold text-mute",
          variant === "icon" && "flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-[15px] text-mute transition-all active:scale-90",
          className,
        )}
      >
        {variant === "icon" ? "⚑" : label}
      </button>

      {/* 애니메이션이 남긴 transform 때문에 fixed 가 부모에 갇힌다 — body 로 꺼내서 띄운다 */}
      {open && createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-md rounded-t-[26px] bg-card p-5 shadow-card sm:rounded-[26px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-gold">Report</div>
            <div className="mt-1 font-serif text-[18px] font-bold text-ink">{target.name ? `${target.name} 신고` : "신고"}</div>
            <p className="mt-1 text-[11px] leading-[1.7] text-mute">
              신고는 매장 관리자와 운영사에 같이 전달돼요. 누가 신고했는지는 신고당한 쪽에 보이지 않아요.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {REPORT_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCat(c.key)}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                    cat === c.key ? "border-brand bg-blush-lt" : "border-line bg-card",
                  )}
                >
                  <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", cat === c.key ? "border-brand bg-brand" : "border-line")}>
                    {cat === c.key && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-ink">{c.label}</span>
                    <span className="block text-[11px] text-mute">{c.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            <Textarea
              rows={2}
              value={detail}
              maxLength={REPORT_DETAIL_MAX}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="무슨 일이 있었는지 (선택)"
              className="mt-3"
            />

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>취소</Button>
              <Button className="flex-1" onClick={submit} loading={pending} disabled={!cat}>신고 보내기</Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
