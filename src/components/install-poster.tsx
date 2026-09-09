/**
 * 손님에게 보여 주는 포스터 — 카운터·테이블·화장실 거울 옆에 붙인다.
 * 한 줄로 끝나야 한다: 찍으면 끝. 글자는 세로 A4 기준 비율(cqw)로 잡아 어느 크기로 찍어도 같다.
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
      <div className="absolute inset-x-0 top-0" style={{ height: "2.2cqw", background: t.brand }} />
      <div className="flex h-full flex-col items-center text-center" style={{ padding: "9cqw 8cqw 7cqw" }}>
        <div className="flex items-center" style={{ gap: "2cqw" }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" style={{ width: "9cqw", height: "9cqw", borderRadius: "2.4cqw", objectFit: "cover" }} />
          ) : (
            <span style={{ width: "9cqw", height: "9cqw", borderRadius: "2.4cqw", background: t.brand, display: "inline-block" }} />
          )}
          <span className="font-bold" style={{ fontSize: "5cqw", color: t.gold }}>{storeName}</span>
        </div>

        <div className="font-bold" style={{ fontSize: "15cqw", lineHeight: 1.05, marginTop: "6cqw", fontFamily: "'Nanum Myeongjo', Georgia, serif" }}>
          찍으면<br /><span style={{ color: t.brand }}>끝.</span>
        </div>
        <div style={{ fontSize: "4.2cqw", marginTop: "3cqw", opacity: 0.8, lineHeight: 1.5 }}>
          설치 아니에요. 그냥 열려요.<br />앱스토어도, 전화번호도 필요 없어요.
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR" style={{ width: "52cqw", height: "52cqw", marginTop: "6cqw", borderRadius: "4cqw", background: "#fff", border: `0.8cqw solid ${t.line}` }} />

        {amount > 0 && (
          <div className="font-bold" style={{ fontSize: "5.6cqw", marginTop: "5cqw", padding: "2cqw 6cqw", borderRadius: "99px", background: t.brand, color: "#fff" }}>
            지금 찍으면 {won} 쿠폰
          </div>
        )}

        <div className="grid w-full" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: "2cqw", marginTop: "6cqw" }}>
          {[["1", "찍고"], ["2", "코드 넣고"], ["3", "끝"]].map(([n, l]) => (
            <div key={n} style={{ background: "#fff", border: `0.4cqw solid ${t.line}`, borderRadius: "3cqw", padding: "3cqw 1cqw" }}>
              <div className="font-bold" style={{ fontSize: "7cqw", color: t.brand, lineHeight: 1 }}>{n}</div>
              <div className="font-bold" style={{ fontSize: "3.8cqw", marginTop: "1.2cqw" }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "3.2cqw", marginTop: "2.5cqw", opacity: 0.7 }}>코드는 직원에게 받으세요 · 30초면 돼요</div>

        <div className="mt-auto font-bold" style={{ fontSize: "3.4cqw", padding: "1.6cqw 4cqw", borderRadius: "99px", background: "#E8F6EE", color: "#2E8B57" }}>
          실명·전화번호 안 받아요 · 닉네임과 PIN만 · 털릴 개인정보가 없어요
        </div>
      </div>
    </div>
  );
}
