import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function requestHeaders(request: NextRequest, locale: "en" | "es") {
  const headers = new Headers(request.headers);
  headers.set("x-datasec-locale", locale);
  return headers;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/es" || pathname.startsWith("/es/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    url.searchParams.set("lang", "es");
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders(request, "es") },
    });
  }

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    url.searchParams.set("lang", "en");
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: { headers: requestHeaders(request, "en") },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|widget/|api/|.*\\..*).*)",
  ],
};
