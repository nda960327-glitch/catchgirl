"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";
import { useToast } from "@/components/providers";
import { importCustomers, type ImportedRow } from "../../actions";

/**
 * 기존 손님 한 번에 옮기기.
 *
 * 카톡·전화로 관리하던 손님 목록을 한 줄에 한 명씩 붙여 넣으면 연결코드가 한꺼번에 나온다.
 * 매장이 직접 30분이면 끝내는 게 목표라, 형식은 "닉네임" 하나만 있어도 되고
 * 뒤에 쉼표로 연락처나 메모를 붙일 수 있다.
 */
export function ImportButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ rows: ImportedRow[]; skipped: string[] } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const submit = () =>
    start(async () => {
      const r = await importCustomers(slug, text);
      if (!r.ok) return toast(r.error, "error");
      setResult(r.data!);
      toast(`${r.data!.rows.length}명 등록했어요`, "success");
      router.refresh();
    });

  const copyAll = async () => {
    if (!result) return;
    const body = result.rows.map((r) => `${r.nickname}  연결코드 ${r.code}`).join("\n");
    try { await navigator.clipboard.writeText(body); toast("복사했어요", "success"); } catch { toast("복사가 안 돼요. 화면을 캡처해 주세요.", "error"); }
  };

  const close = () => { setOpen(false); setResult(null); setText(""); };

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>기존 손님 한 번에 옮기기</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={close}>
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-paper p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            {!result ? (
              <>
                <div className="text-[15px] font-bold text-ink">기존 손님 한 번에 옮기기</div>
                <p className="mt-1 text-[12px] leading-[1.8] text-mute">
                  한 줄에 한 명씩 붙여 넣으세요. <b className="text-ink">닉네임</b>만 있어도 되고, 쉼표 뒤에 연락처나 메모를 적으면 관리자 메모에 들어가요 (손님에겐 안 보여요).
                </p>
                <div className="mt-2 rounded-xl bg-well px-3 py-2 font-mono text-[11px] leading-[1.8] text-mute">
                  길동<br />
                  민수, 010-0000-0000<br />
                  대표님, @telegram, 김사장 소개 · 목요일 단골
                </div>
                <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="여기에 붙여 넣기" className="mt-3 font-mono text-[12px]" />
                <div className="mt-1 text-[11px] text-mute">{lines.length}명 · 한 번에 300명까지</div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={submit} loading={pending} disabled={lines.length === 0 || lines.length > 300}>연결코드 {lines.length ? `${lines.length}개 ` : ""}만들기</Button>
                  <Button variant="ghost" onClick={close}>취소</Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[15px] font-bold text-ink">{result.rows.length}명 등록했어요</div>
                <p className="mt-1 text-[12px] leading-[1.8] text-mute">
                  손님에게 연결코드를 알려 주세요. 앱 첫 화면 <b className="text-ink">&ldquo;처음이에요&rdquo;</b>에서 코드를 넣고 닉네임과 PIN을 정하면 시작돼요. 코드는 고객 목록에서도 언제든 볼 수 있어요.
                </p>
                <div className="mt-3 max-h-[46dvh] overflow-y-auto rounded-2xl border border-line bg-card">
                  <table className="w-full text-[12px]">
                    <tbody>
                      {result.rows.map((r) => (
                        <tr key={r.id} className="border-b border-line/60 last:border-0">
                          <td className="px-3 py-2 font-semibold text-ink">{r.nickname}</td>
                          <td className="px-3 py-2 font-mono text-[14px] font-bold tracking-[.2em] text-brand">{r.code}</td>
                          <td className="px-3 py-2 text-right text-[11px] text-mute">{r.memo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.skipped.length > 0 && (
                  <div className="mt-2 text-[11px] text-mute">건너뜀 {result.skipped.length}줄 (이미 있는 닉네임이거나 비어 있음): {result.skipped.slice(0, 8).join(", ")}{result.skipped.length > 8 ? " …" : ""}</div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button onClick={copyAll}>목록 복사</Button>
                  <Button variant="ghost" onClick={close}>닫기</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
