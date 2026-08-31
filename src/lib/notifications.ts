/**
 * NotificationService — MVP는 콘솔 로그 + 화면 토스트.
 * Phase 2: KakaoAlimtalkNotificationService / SmsNotificationService 를 같은 인터페이스로 구현해 교체.
 */
export type NotificationEvent =
  | { type: "RESERVATION_CONFIRMED"; to: string; customerName: string; staffName: string; when: string; code: string }
  | { type: "RESERVATION_CANCELLED"; to: string; customerName: string; staffName: string; when: string; code: string }
  | { type: "REMINDER_1H"; to: string; customerName: string; staffName: string; when: string; code: string };

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
    console.log(`\n📨 [Notification → ${e.to}] ${message}\n`);
    return { ok: true, message };
  }
}

// Phase 2 확장 지점 — 구현하지 않음
// export class KakaoAlimtalkNotificationService implements NotificationService { ... }
// export class SmsNotificationService implements NotificationService { ... }

let _svc: NotificationService | null = null;
export function notificationService(): NotificationService {
  if (!_svc) _svc = new ConsoleNotificationService();
  return _svc;
}
