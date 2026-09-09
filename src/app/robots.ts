import type { MetadataRoute } from "next";

/**
 * 검색엔진에 열어 두는 곳은 파는 페이지뿐이다.
 * 매장 화면은 로그인 뒤에만 열리고, 콘솔·직원 화면은 검색에 나올 이유가 없다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/signup", "/demo", "/agent/join", "/platform/terms"], disallow: ["/api/", "/platform/", "/agent/", "/secret-garden/", "/*/admin", "/*/staff", "/*/login"] },
    ],
    sitemap: "https://www.catchgirl.kr/sitemap.xml",
    host: "https://www.catchgirl.kr",
  };
}
