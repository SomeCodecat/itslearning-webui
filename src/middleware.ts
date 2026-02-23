import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Exclude API, static, and public routes from auth check
  const isPublicPath =
    pathname.includes("/login") ||
    pathname.includes("/setup") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes("favicon.ico");

  if (isPublicPath) {
    return intlMiddleware(request);
  }

  // 2. Check for Session Cookie
  const hasSession = request.cookies.has("auth_session");

  if (!hasSession) {
    // Redirect to login
    // We need to handle locale if present, defaults to /en/login
    const locale = request.cookies.get("NEXT_LOCALE")?.value || "en";
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // 3. Continue with Intl
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(de|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
