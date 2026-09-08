import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";

/**
 * 새 매장 첫 화면의 할 일 목록.
 *
 * 세팅은 매장이 직접 한다 — 그래서 무엇을 아직 안 했는지가 대시보드 맨 위에 보여야 한다.
 * 데이터를 보고 스스로 채워지는 목록이라 누를 버튼이 없다. 다 하면 사라진다.
 */
export async function SetupChecklist({ slug, storeId, logoUrl, createdAt }: { slug: string; storeId: string; logoUrl: string | null; createdAt: Date }) {
  // 오래된 매장에는 안 띄운다 — 다 채우고도 남을 시간이다
  if (Date.now() - createdAt.getTime() > 1000 * 60 * 60 * 24 * 120) return null;

  const [staff, staffWithPhoto, schedules, customers, rooms] = await Promise.all([
    prisma.staff.count({ where: { storeId, isActive: true } }),
    prisma.staff.count({ where: { storeId, isActive: true, NOT: { photos: "[]" } } }),
    prisma.staffSchedule.count({ where: { staff: { storeId } } }),
    prisma.customer.count({ where: { storeId } }),
    prisma.room.count({ where: { storeId, isActive: true, NOT: { name: { endsWith: "번 룸" } } } }),
  ]);

  const items = [
    { done: !!logoUrl, label: "매장 로고 올리기", hint: "앱 아이콘과 화면 색이 이 로고를 따라가요", href: `/${slug}/admin/settings` },
    { done: staff > 0, label: "캐치걸 등록하기", hint: staff > 0 && staffWithPhoto < staff ? `${staff - staffWithPhoto}명은 아직 사진이 없어요` : "이름·시급·프로필·제공 옵션", href: `/${slug}/admin/staff?edit=new` },
    { done: schedules > 0, label: "출근 요일 잡기", hint: "요일별로 나올 수 있는 사람을 정해야 손님 화면에 떠요", href: `/${slug}/admin/staff/schedule` },
    { done: rooms > 0, label: "룸 이름 바꾸기", hint: "'1번 룸' 대신 매장에서 부르는 이름으로", href: `/${slug}/admin/settings` },
    { done: customers > 0, label: "기존 손님 옮기기", hint: "닉네임 목록을 붙여 넣으면 연결코드가 한꺼번에 나와요", href: `/${slug}/admin/customers` },
    { done: false, label: "큐알 인쇄해서 붙이기", hint: "손님·직원용 주소와 큐알은 매장 설정 맨 아래에 있어요", href: `/${slug}/admin/settings#links`, optional: true },
  ];
  const left = items.filter((i) => !i.done && !i.optional).length;
  if (left === 0) return null;

  return (
    <Card className="mt-4 border-gold/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] font-bold text-ink">문 열기 전에 채워 두세요</div>
        <div className="text-[11px] text-mute">{items.length - left - 1}/{items.length - 1} 완료 · 30분이면 끝나요</div>
      </div>
      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link href={i.href} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${i.done ? "border-line/60 bg-well text-mute" : "border-line bg-card hover:border-brand"}`}>
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i.done ? "bg-ok text-white" : "border border-line text-mute"}`}>{i.done ? "✓" : ""}</span>
              <span className="min-w-0">
                <span className={`block text-[12px] font-bold ${i.done ? "line-through" : "text-ink"}`}>{i.label}{i.optional ? " (선택)" : ""}</span>
                <span className="block text-[10px] leading-[1.6] text-mute">{i.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
