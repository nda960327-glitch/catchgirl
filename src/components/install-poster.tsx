/**
 * 손님에게 보여 주는 포스터 — 카운터·테이블·화장실 거울 옆에 붙인다.
 * 한 줄로 끝나야 한다: 찍으면 끝. 글자는 세로 A4 기준 비율(cqw)로 잡아 어느 크기로 찍어도 같다.
 * 세로 합이 141cqw(297/210) 안에 들어가야 잘리지 않는다 — 여백까지 합쳐 약 135cqw 로 맞춰 두었다.
 */
export function InstallPoster({
  storeName, logoUrl, amount, qr, width = "360px", theme,
}: {
  storeName: string;
  logoUrl?: string | null;
  amount: number;
  qr: string;
  width?: string;
  theme?: { brand: string; ink: string; paper: string; line: string; gold: string };
}) {
  const t = theme ?? { brand: "#B4586A", ink: "#3A2830", paper: "#FCF7F6", line: "#F0E4E5", gold: "#C8A46A" };
  const won = `${amount.toLocaleString("ko-KR")}원`;
  return (
    <div
      className="install-poster relative overflow-hidden"
      style={{ width, aspectRatio: "210 / 297", containerType: "inline-size", background: t.paper, color: t.ink, borderRadius: "3cqw", border: `0.3cqw solid ${t.line}`, fontFamily: "Pretendard, -apple-system, system-ui, sans-serif" }}
    >
      <div className="absolute inset-x-0 top-0" style={{ height: "2cqw", background: t.brand }} />
      <div className="flex h-full flex-col items-center text-center" style={{ padding: "6cqw 7cqw 5cqw" }}>
        {/* 매장 */}
        <div className="flex items-center" style={{ gap: "1.8cqw" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: "7cqw", height: "7cqw", borderRadius: "2cqw", objectFit: "cover" }} />
          ) : (
            <span style={{ width: "7cqw", height: "7cqw", borderRadius: "2cqw", background: t.brand, display: "inline-block" }} />
          )}
          <span className="font-bold" style={{ fontSize: "4.4cqw", color: t.gold }}>{storeName}</span>
        </div>

        {/* 한 줄 */}
        <div className="font-bold" style={{ fontSize: "11.5cqw", lineHeight: 1.05, marginTop: "3cqw", fontFamily: "'Nanum Myeongjo', Georgia, serif" }}>
          찍으면 <span style={{ color: t.brand }}>끝.</span>
        </div>
        <div style={{ fontSize: "3.4cqw", marginTop: "1.6cqw", opacity: 0.8, lineHeight: 1.45 }}>
          설치 아니에요. 그냥 열려요.<br />앱스토어도, 전화번호도 필요 없어요.
        </div>

        {/* QR */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR" style={{ width: "40cqw", height: "40cqw", marginTop: "3.5cqw", borderRadius: "3.5cqw", background: "#fff", border: `0.7cqw solid ${t.line}` }} />
        <div style={{ fontSize: "2.8cqw", marginTop: "1.4cqw", opacity: 0.6 }}>폰 카메라로 그냥 비추세요</div>

        {/* 쿠폰 */}
        {amount > 0 && (
          <div className="font-bold" style={{ fontSize: "4.6cqw", marginTop: "3cqw", padding: "1.6cqw 5cqw", borderRadius: "99px", background: t.brand, color: "#fff" }}>
            지금 찍으면 {won} 쿠폰
          </div>
        )}

        {/* 세 단계 */}
        <div className="grid w-full" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "1.8cqw", marginTop: "3.5cqw" }}>
          {[["1", "찍고"], ["2", "코드 넣고"], ["3", "끝"]].map(([n, l]) => (
            <div key={n} style={{ background: "#fff", border: `0.35cqw solid ${t.line}`, borderRadius: "2.6cqw", padding: "2.2cqw 1cqw" }}>
              <div className="font-bold" style={{ fontSize: "5.6cqw", color: t.brand, lineHeight: 1 }}>{n}</div>
              <div className="font-bold" style={{ fontSize: "3.2cqw", marginTop: "1cqw" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "2.8cqw", marginTop: "1.8cqw", opacity: 0.7 }}>코드는 직원에게 받으세요 · 30초면 돼요</div>

        {/* 안심 */}
        <div className="font-bold" style={{ fontSize: "2.9cqw", marginTop: "3cqw", padding: "1.4cqw 3.5cqw", borderRadius: "99px", background: "#E8F6EE", color: "#2E8B57", lineHeight: 1.3 }}>
          실명·전화번호 안 받아요 · 닉네임과 PIN만 · 털릴 개인정보가 없어요
        </div>
      </div>
    </div>
  );
}
