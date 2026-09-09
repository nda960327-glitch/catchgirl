/**
 * 손님에게 건네는 명함형 연결 카드.
 *
 * 앞면 하나에 다 들어간다: 매장, "앱 깔면 얼마 할인", QR, 연결코드 칸, 세 단계.
 * 코드 칸은 비워 두면 직원이 네임펜으로 적고, 코드를 주면 인쇄돼 나온다.
 * 크기는 바깥에서 width 로 정하고 안쪽 글자는 컨테이너 단위(cqw)라 명함(90mm)이든 화면이든 같은 비율이다.
 */
export function InviteCard({
  storeName, logoUrl, amount, qr, code, url, width = "360px", theme,
}: {
  storeName: string;
  logoUrl?: string | null;
  amount: number;
  qr: string;
  code?: string | null;
  url: string;
  width?: string;
  /** 매장 메인 컬러·바탕 — 없으면 기본 로즈 */
  theme?: { brand: string; ink: string; paper: string; line: string; gold: string };
}) {
  const t = theme ?? { brand: "#B4586A", ink: "#3A2830", paper: "#FCF7F6", line: "#F0E4E5", gold: "#C8A46A" };
  const won = amount > 0 ? `${amount.toLocaleString("ko-KR")}원` : "";
  return (
    <div
      className="invite-card relative overflow-hidden"
      style={{ width, aspectRatio: "9 / 5", containerType: "inline-size", background: t.paper, color: t.ink, borderRadius: "3.5cqw", border: `0.4cqw solid ${t.line}`, fontFamily: "Pretendard, -apple-system, system-ui, sans-serif" }}
    >
      {/* 왼쪽 띠 */}
      <div className="absolute inset-y-0 left-0" style={{ width: "1.6cqw", background: t.brand }} />
      <div className="flex h-full" style={{ padding: "5cqw 5cqw 5cqw 6.5cqw", gap: "4cqw" }}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center" style={{ gap: "2cqw" }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" style={{ width: "8cqw", height: "8cqw", borderRadius: "2cqw", objectFit: "cover" }} />
            ) : (
              <span style={{ width: "8cqw", height: "8cqw", borderRadius: "2cqw", background: t.brand, display: "inline-block" }} />
            )}
            <span className="truncate font-bold" style={{ fontSize: "4.2cqw", color: t.gold, letterSpacing: "0.02em" }}>{storeName}</span>
          </div>
          <div className="font-bold" style={{ fontSize: "7cqw", lineHeight: 1.2, marginTop: "3cqw", fontFamily: "'Nanum Myeongjo', Georgia, serif" }}>
            {amount > 0 ? <>앱 깔면<br /><span style={{ color: t.brand }}>{won} 할인</span></> : <>우리 매장 앱,<br /><span style={{ color: t.brand }}>여기서 시작</span></>}
          </div>
          <div className="inline-flex items-center self-start font-bold" style={{ fontSize: "2.6cqw", marginTop: "2cqw", padding: "0.8cqw 2cqw", borderRadius: "99px", background: "#E8F6EE", color: "#2E8B57" }}>
            실명·전화번호 안 받아요 · 닉네임과 PIN만
          </div>
          <ol className="mt-auto" style={{ fontSize: "2.9cqw", lineHeight: 1.5, opacity: 0.85 }}>
            <li>① QR 찍고 <b>처음이에요</b> 누르기</li>
            <li>② 옆의 <b>연결코드</b> 넣고 닉네임·PIN 정하기</li>
            <li>③ 끝. 설치 없이 열려요{amount > 0 ? " · 쿠폰이 바로 들어와요" : ""}</li>
          </ol>
          <div style={{ fontSize: "2.3cqw", opacity: 0.55, marginTop: "1.2cqw", lineHeight: 1.4 }}>개인정보를 안 받으니 앱이 털려도 새어 나갈 게 없어요 · 지갑에 넣어 두고 QR만 찍어도 돼요 · 잃어버리면 매장에서 코드를 다시 알려 드려요 · 만 19세 이상만</div>
        </div>
        <div className="flex shrink-0 flex-col items-center" style={{ width: "30cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="앱 QR" style={{ width: "26cqw", height: "26cqw", borderRadius: "2cqw", background: "#fff" }} />
          <div style={{ fontSize: "2.4cqw", opacity: 0.6, marginTop: "0.8cqw", maxWidth: "30cqw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url.replace(/^https?:\/\//, "")}</div>
          <div style={{ fontSize: "2.6cqw", fontWeight: 700, marginTop: "2cqw", opacity: 0.7 }}>연결코드</div>
          <div
            className="flex items-center justify-center font-mono font-bold"
            style={{ width: "30cqw", height: "10cqw", marginTop: "0.8cqw", border: `0.5cqw dashed ${t.brand}`, borderRadius: "2cqw", fontSize: code ? "6.5cqw" : "3cqw", letterSpacing: code ? "0.25em" : 0, color: code ? t.brand : "transparent", background: "#fff" }}
          >
            {code || "____"}
          </div>
        </div>
      </div>
    </div>
  );
}
