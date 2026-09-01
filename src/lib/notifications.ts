/**
 * NotificationService — 콘솔 로그 + 화면 토스트.
 *
 * 고객 연락처(휴대폰·이메일)를 수집하지 않으므로 문자/알림톡 같은 외부 발송은 하지 않는다.
 * 알림은 매장 내부(관리자·캐치걸 화면)와 고객 본인의 마이페이지에서 확인하는 용도다.
 */
export type NotificationEvent =
  | { type: "RESERVATION_CONFIRMED"; customerName: string; staffName: string; when: string; code: string }
  | { type: "RESERVATION_CANCELLED"; customerName: string; staffName: string; when: string; code: string }
  | { type: "REMINDER_1H"; customerName: string; staffName: string; when: string; code: string };

export interface NotificationService {
  send(event: NotificationEvent): Promise<{ ok: boolean; message: string }>;
}

export function renderMessage(e: NotificationEvent): string {
  switch (e.type) {
    case "RESERVATION_CONFIRMED":
      return `[캐치걸] ${e.customerName}님, ${e.when} ${e.staffName} 캐치걸 예약이 확정됐어요. (NO. ${e.code})`;
    case "RESERVATION_CANCELLED":
      return `[캐치걸] ${e.customerName}님, ${e.when} ${e.staffName} 캐치걸 예약이 취소됐어요. (NO. ${e.code})`;
    case "REMINDER_1H":
      return `[캐치걸] ${e.customerName}님, 1시간 뒤 ${e.staffName} 캐치걸와의 약속이에요. (${e.when})`;
  }
}

export class ConsoleNotificationService implements NotificationService {
  async send(e: NotificationEvent) {
    const message = renderMessage(e);
    console.log(`\n📨 [Notification → ${e.customerName}] ${message}\n`);
    return { ok: true, message };
  }
}

let _svc: NotificationService | null = null;
export function notificationService(): NotificationService {
  if (!_svc) _svc = new ConsoleNotificationService();
  return _svc;
}
