import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "캐치걸 — 바 전용 전담 바텐더 지명 예약 앱";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** 카톡·문자·검색에 링크가 펼쳐질 때 보이는 그림. 글자만으로 만든다 (폰트 파일 없이 뜨게). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #FCF7F6 0%, #F3E9EA 100%)", color: "#3A2830", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#B4586A" }} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>캐치걸</div>
          <div style={{ fontSize: 22, color: "#9A868D", marginLeft: 8 }}>catchgirl.kr</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>바 전용 전담 바텐더<br />지명 예약 앱</div>
          <div style={{ fontSize: 30, color: "#6B5560", lineHeight: 1.4 }}>우리 매장 로고로 깔리는 앱 세 개 · 초기 투자 0원 · 월 10만원 · 첫 달 무료</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["합법 바만 · 허가 확인 후 승인", "손님 실명·번호 안 받음", "QR 찍으면 끝"].map((t) => (
            <div key={t} style={{ fontSize: 22, padding: "12px 22px", borderRadius: 999, background: "#B4586A", color: "#fff" }}>{t}</div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
