"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ─── 버튼 ─── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-[.98] disabled:cursor-not-allowed",
        size === "sm" && "h-9 px-3 text-[12px] rounded-xl",
        size === "md" && "h-11 px-4 text-[13px]",
        size === "lg" && "h-[54px] px-5 text-[15px] w-full",
        variant === "primary" && "cta-grad text-white shadow-cta disabled:bg-none disabled:bg-[#EFE7E8] disabled:text-mute disabled:shadow-none",
        variant === "secondary" && "bg-blush-lt text-brand disabled:opacity-50",
        variant === "outline" && "bg-white border border-line text-ink disabled:opacity-50",
        variant === "ghost" && "bg-transparent text-mute hover:bg-blush-lt disabled:opacity-50",
        variant === "danger" && "bg-[#FDECEC] text-[#C0392B] disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
});

/* ─── 입력 ─── */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-white px-4 text-[14px] text-ink outline-none placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-[rgba(var(--brand-rgb),.15)]",
        className,
      )}
      {...rest}
    />
  );
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-line bg-white px-4 py-3 text-[14px] text-ink outline-none placeholder:text-mute/70 focus:border-brand focus:ring-2 focus:ring-[rgba(var(--brand-rgb),.15)]",
        className,
      )}
      {...rest}
    />
  );
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn("h-11 rounded-xl border border-line bg-white px-3 text-[13px] text-ink outline-none focus:border-brand", className)}
      {...rest}
    />
  );
});

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-semibold text-ink">{label}</span>
        {hint && <span className="text-[11px] text-mute">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

/* ─── 카드/칩/기타 ─── */
export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("rounded-[22px] border border-line bg-white shadow-card", onClick && "cursor-pointer", className)}>
      {children}
    </div>
  );
}
export function Chip({ children, className, tone = "brand" }: { children: ReactNode; className?: string; tone?: "brand" | "gold" | "mute" | "green" | "red" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold leading-none",
        tone === "brand" && "bg-blush-lt text-brand",
        tone === "gold" && "border border-gold-lt text-gold",
        tone === "mute" && "bg-[#F4EDEE] text-mute",
        tone === "green" && "bg-[#E8F6EE] text-[#2E8B57]",
        tone === "red" && "bg-[#FDECEC] text-[#C0392B]",
        className,
      )}
    >
      {children}
    </span>
  );
}
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[10px] font-semibold uppercase tracking-[.2em] text-gold", className)}>{children}</div>;
}
export function Sticker({ k, size = 90, className }: { k: string; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/assets/${k}.webp`} alt="" width={size} style={{ width: size, height: "auto", mixBlendMode: "multiply" }} className={className} />;
}
export function Stars({ value, size = 12, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex text-blush", className)} style={{ fontSize: size, letterSpacing: 1 }} aria-label={`${value}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ opacity: i <= Math.round(value) ? 1 : 0.3 }}>★</span>
      ))}
    </span>
  );
}
export function Avatar({ src, name, size = 44, className, rounded = 14 }: { src?: string | null; name: string; size?: number; className?: string; rounded?: number }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden border border-line bg-blush-lt font-serif font-bold text-brand", className)}
      style={{ width: size, height: size, borderRadius: rounded, fontSize: size * 0.38 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1)}
    </div>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
export function Empty({ sticker = "p2", title, desc, action }: { sticker?: string; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <Sticker k={sticker} size={86} />
      <div className="mt-2 text-[13px] font-semibold text-ink">{title}</div>
      {desc && <div className="mt-1.5 text-[11px] text-mute">{desc}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── 모바일 상단바 ─── */
export function TopBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center border-b border-line bg-white/90 px-4 backdrop-blur">
      {back ? (
        <Link href={back} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink" aria-label="뒤로">
          ‹
        </Link>
      ) : (
        <span className="w-8" />
      )}
      <div className="flex-1 text-center font-serif text-[15px] font-bold text-ink">{title}</div>
      <div className="flex w-8 items-center justify-end text-[15px] text-blush">{right}</div>
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { l: string; t: "brand" | "green" | "mute" | "red" | "gold" }> = {
    CONFIRMED: { l: "예약확정", t: "brand" },
    COMPLETED: { l: "방문완료", t: "green" },
    CANCELLED: { l: "취소", t: "mute" },
    NOSHOW: { l: "노쇼", t: "red" },
  };
  const m = map[status] ?? { l: status, t: "mute" as const };
  return <Chip tone={m.t}>{m.l}</Chip>;
}

export function GradeChip({ grade }: { grade: string }) {
  return <Chip tone={grade === "VIP" ? "gold" : grade === "단골" ? "brand" : "mute"}>{grade}</Chip>;
}
