import { NextResponse, type NextRequest } from "next/server";

function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  );
}

export function middleware(req: NextRequest) {
  if (shouldSkip(req.nextUrl.pathname)) return NextResponse.next();

  const password = process.env.SITE_PASSWORD;
  const user = process.env.SITE_USER ?? "reader";

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("SITE_PASSWORD is required in production.", { status: 503 });
    }
    return NextResponse.next();
  }

  const expected = `Basic ${btoa(`${user}:${password}`)}`;
  if (req.headers.get("authorization") === expected) return NextResponse.next();

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "www-authenticate": 'Basic realm="Daily Reading Triage"'
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
