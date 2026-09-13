"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input } from "@/components/ui";
import { useToast } from "@/components/providers";
import { deleteMyAccount } from "../actions";

/** 마이페이지 맨 아래 — 계정 삭제. 한 번 더 PIN 과 '삭제' 를 받아서 실수로 누르지 않게 한다. */
export function DeleteAccount({ slug, protectedDemo }: { slug: string; protectedDemo: boolean }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();
  const { toast } = useToast();

  if (!open) {
    return (
      <div className="flex items-center gap-3 rounded-[20px] border border-line bg-card p-4">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-ink">계정 삭제</div>
          <div className="mt-0.5 text-[11px] leading-[1.6] text-mute">닉네임·PIN과 내가 쓴 글을 지우고 이 앱에서 나가요</div>
        </div>
        <Button size="sm" variant="danger" onClick={() => setOpen(true)}>삭제하기</Button>
      </div>
    );
  }

  const submit = () =>
    start(async () => {
      const r = await deleteMyAccount(slug, pin, confirmText);
      if (r && !r.ok) toast(r.error, "error");
    });

  return (
    <div className="rounded-[20px] border border-bad/40 bg-card p-4">
      <div className="text-[13px] font-bold text-bad">정말 계정을 삭제할까요?</div>
      <ul className="mt-2 flex flex-col gap-1 text-[11px] leading-[1.7] text-ink">
        <li>· 닉네임과 PIN, 내가 쓴 후기·댓글, 찜·추천, 남은 쿠폰이 바로 지워져요.</li>
        <li>· 앞으로 잡힌 예약은 모두 취소돼요.</li>
        <li>· 지난 방문 기록은 매장의 매출 기록이라 이름을 지운 채로 남아요.</li>
        <li>· 되돌릴 수 없어요. 다시 쓰려면 매장에서 새 연결코드를 받아야 해요.</li>
      </ul>
      {protectedDemo && (
        <div className="mt-3 rounded-xl bg-well px-3 py-2 text-[11px] leading-[1.6] text-mute">
          체험용 샘플 계정은 삭제할 수 없어요. 연결코드로 새 계정을 만들어 삭제를 시험해 보세요.
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="PIN">
          <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="확인" hint="삭제라고 적기">
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="삭제" />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" className="flex-1" loading={pending} disabled={!pin || confirmText.trim() !== "삭제"} onClick={submit}>
          계정 삭제
        </Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setPin(""); setConfirmText(""); }}>취소</Button>
      </div>
    </div>
  );
}
