/**
 * 서버 시작 시 한 번 실행된다 (Next.js instrumentation).
 *
 * 이 앱의 시각 계산 — 영업시간, 슬롯, "지난 시간" 판정, 오늘 범위 — 은 전부
 * 서버의 로컬 시간대를 따른다. 배포 환경(Vercel 등)은 기본이 UTC 라서
 * 그대로 두면 스케줄이 9시간 통째로 밀린다.
 *
 * Vercel 은 TZ 를 예약어로 막아 환경변수로 지정할 수 없으므로 여기서 직접 세운다.
 * Node 는 process.env.TZ 변경을 이후 Date 연산에 반영한다.
 */
export function register() {
  process.env.TZ = process.env.APP_TZ || "Asia/Seoul";
}
