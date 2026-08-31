# 캐치걸 (Catch Girl) — 캐치걸 지정 실시간 예약 시스템 MVP

캐치테이블처럼 고객이 **날짜 → 캐치걸 → 시간대**를 골라 실시간으로 예약하고,
매장은 관리자 페이지에서 직원·예약·고객을 관리하는 멀티테넌트 웹앱입니다.

| 역할 | 진입 경로 | 데모 계정 |
|---|---|---|
| 고객 | `/secret-garden` | 닉네임 **유나** / 휴대폰 **010-1111-0001** (단골 7회) · 닉네임 **제이** / **010-2222-0002** (노쇼 2회) |
| 캐치걸 | `/secret-garden/staff` | **junhee** / **1234** (태리 `taeri`, 아인 `ain`) |
| 관리자 | `/secret-garden/admin` | **admin@catchgirl.app** / **1234** |

---

## 1. 설치 · 실행

```bash
npm install
npx prisma generate
npx prisma db push        # SQLite dev.db 생성
npm run db:seed           # 매장 1 · 캐치걸 3 · 고객 5 · 예약 25건 · 후기/댓글/찜
npm run dev               # http://localhost:3000 → /secret-garden 으로 리다이렉트
```

한 번에: `npm run setup && npm run dev`

- 시드를 다시 돌리려면 `npm run db:reset` (DB 초기화 + 재시드).
- 시드는 **실행한 날짜 기준**으로 오늘 예약(준희 15:30/19:00/21:30, 태리 18:00/20:00, 아인 19:30)을 넣습니다.
- `npm run dev` 상태에서 `npx tsx scripts/concurrency-test.ts` 를 실행하면 **같은 슬롯 5명 동시 예약 → 1건만 성공**을 확인할 수 있습니다.

### 환경 변수 (`.env`)
```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="catch-girl-dev-secret-change-me"
```

---

## 2. 기술 스택

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS** — 고객 화면 모바일 퍼스트, 관리자 데스크톱 대응
- **Prisma + SQLite** (로컬 MVP) — Supabase(Postgres)로 옮길 땐 `prisma/schema.prisma` 의 `provider = "postgresql"` 로 바꾸고 `DATABASE_URL` 만 Supabase 연결 문자열로 교체 (스키마 동일, JSON 배열 컬럼은 String 으로 호환)
- **TanStack Query** — 슬롯 5초 폴링(실시간 갱신). Supabase Realtime 구독으로 교체할 지점은 `booking-flow.tsx` 의 `useQuery` 한 곳
- **Recharts** — 대시보드 차트
- 인증: 역할별 JWT 쿠키(`jose`) 3종 — `cg_customer` / `cg_staff` / `cg_admin`. `middleware.ts` 에서 `/{slug}/admin`, `/{slug}/staff` RBAC 차단
- 이미지: 클라이언트 리사이즈(1280px) + 썸네일(320px) 생성 후 `/api/upload` → `public/uploads/` (Supabase Storage 로 교체 지점)

---

## 3. 화면 목록 (16)

**고객 (8)** — `/{slug}`
| 경로 | 화면 |
|---|---|
| `/` | 홈 (로고·오늘 영업 배지·오늘 예약 가능한 캐치걸 카드) |
| `/bartenders` | 캐치걸 목록 |
| `/bartenders/[id]` | 캐치걸 상세 — 사진 캐러셀 · 태그 · 소개 · 평점 · **후기 탭 / 댓글 탭(대댓글 1뎁스)** · 찜 · 신고 · 하단 고정 CTA |
| `/book/[staffId]` | 예약 3스텝 — 날짜 선택(휴무 회색) → 시간 선택(🟢가능/🔴마감/⚪근무외, 5초 폴링) → 정보 입력(닉네임·인원·목적·요청) |
| `/done/[id]` | 예약 완료 (예약번호 · .ics 캘린더 추가 · 취소) |
| `/me` | 마이페이지 — 등급 배지 · 예정/완료/취소 탭 · 후기 쓰기 · 취소 · 찜 목록 · 내 후기 |
| `/login` | 휴대폰 + 닉네임 (실명 불필요) |
| `/review/[id]` | 후기 작성 (완료 예약만, 사진 첨부) |

**캐치걸 (2)** — `/{slug}/staff`
| `/staff` | 내 예약 캘린더 (본인 예약만) + 근무 스케줄 |
| `/staff/reviews` | 내 후기 · 댓글 답글 |

**관리자 (6)** — `/{slug}/admin`
| `/admin` | 대시보드 — KPI 4종 · 캐치걸×시간 간트 타임라인 · 주간 추이 · 점유율 |
| `/admin/reservations` | 예약 관리 — 리스트/캘린더 토글 · 검색 필터 · 전화 예약 생성 · 수정 · 상태 변경(방문완료/노쇼/취소) |
| `/admin/staff` | 직원 관리 — 등록/수정/비활성화 · 사진 다중 업로드 · 요일별 근무 · 특정일 휴무 · 동시 접객 · 실적 |
| `/admin/customers` | 고객 관리 — 방문/최근 방문일/취소/노쇼/재방문 · 정렬/필터(재방문순·노쇼순·휴면) · 상세(히스토리·주 지정 캐치걸·관리자 메모·블랙리스트) |
| `/admin/reviews` | 후기/댓글 — 신고 검토 · 숨김 · 캐치걸 대신 답글 |
| `/admin/settings` | 매장 설정(화이트라벨) — 로고·커버·컬러·매장명·영업시간·슬롯 단위·휴무·취소/노쇼 정책 + 라이브 미리보기 |

---

## 4. 핵심 구현 포인트

### 동시성 제어 (`src/lib/reservations.ts`)
- `Reservation.slotKey = "{staffId}|{startTime ISO}|{seq}"` 에 **UNIQUE** 제약. seq 는 `0 ~ capacityPerSlot-1` 이라 동시 접객 N팀을 지원하며, capacity=1 이면 `UNIQUE(store_id, staff_id, start_time)` 과 동일하게 동작.
- 생성은 **Serializable 트랜잭션** 안에서 `count → insert`. 레이스가 나면 UNIQUE 위반(P2002) → `SlotConflictError` → 화면에 "방금 다른 분이 예약했어요" 토스트 + 슬롯 자동 새로고침.
- Postgres 에서는 주석 처리된 `SELECT ... FOR UPDATE` 한 줄을 살리면 행 잠금까지 적용.
- 취소 시 `slotKey = null` 로 반납 → 자리가 즉시 다시 열림.

### 알림 (`src/lib/notifications.ts`)
`NotificationService` 인터페이스 + `ConsoleNotificationService` (콘솔 로그 + 화면 토스트). 예약 완료/취소/1시간 전 리마인드 이벤트. 카카오 알림톡·SMS 는 같은 인터페이스 구현체로 교체.

### 파생 지표 (`src/lib/metrics.ts`)
- 재방문 수 = `COMPLETED` 건수 − 1 · 등급: 1~4 신규 / 5~9 단골 / 10↑ VIP
- 캐치걸 평점 = 숨김 처리되지 않은 후기 평균 · 재방문 유도율 · 노쇼율
- 노쇼 3회 이상 자동 경고, 휴면 = 최근 3개월 미방문

### 고객 데이터 수집
고객 필수 정보는 닉네임+휴대폰. 이름·이메일·생년월일·성별·인스타그램·방문 경로는 선택 입력이며, 매장(관리자·캐치걸) 화면에는 휴대폰 번호 등 고객 정보가 마스킹 없이 전부 표시되고 관리자가 직접 수정할 수 있다.

---

## 5. 디렉터리

```
prisma/schema.prisma      데이터 모델 (Store·Staff·StaffSchedule·StaffOff·Customer·Reservation·Review·Comment·Favorite·AdminUser)
prisma/seed.ts            데모 시드
src/middleware.ts         RBAC (admin/staff 영역)
src/lib/                  auth · db · slots(슬롯 계산) · reservations(동시성) · metrics · notifications · store · image-client
src/app/[slug]/(customer) 고객 앱 (모바일 프레임)
src/app/[slug]/staff      캐치걸 포털
src/app/[slug]/admin      관리자 대시보드
src/app/api/slots         슬롯 폴링 API · api/upload 이미지 · api/reservations REST
scripts/concurrency-test.ts
```

---

## 6. Phase 2 (미구현, 확장 지점만)
결제·선입금 · 카카오 알림톡(`NotificationService` 구현체) · 리뷰 포인트/쿠폰 · 웨이팅 · POS 연동 · 다국어 · Supabase Realtime/Storage 전환
