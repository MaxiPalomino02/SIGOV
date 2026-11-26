import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { isOficial } from "@/lib/cargos";

const LOGIN_ROUTE = "/login";
const ADMIN_ROUTE = "/admin";
const INICIO_ROUTE = "/inicio";
const GUARDIAS_ROUTE = "/guardias";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isLoginRoute =
    pathname === LOGIN_ROUTE || pathname.startsWith(`${LOGIN_ROUTE}/`);

  if (isLoginRoute) {
    if (session) {
      return NextResponse.redirect(new URL(INICIO_ROUTE, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL(LOGIN_ROUTE, request.url));
  }

  const esAdmin =
    pathname === ADMIN_ROUTE || pathname.startsWith(`${ADMIN_ROUTE}/`);
  if (esAdmin && !isOficial(session.cargo)) {
    return NextResponse.redirect(new URL(GUARDIAS_ROUTE, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|icon-.*\\.png|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
