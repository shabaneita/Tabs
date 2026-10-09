import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./lib/env";
import { safeNext } from "./lib/nav";

const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/auth", "/invite", "/offline", "/setup"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/**
 * Refreshes the Supabase session cookie and performs optimistic routing.
 * This is a UX convenience only — data access is enforced by Postgres RLS.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isSupabaseConfigured) {
    if (pathname === "/setup" || pathname === "/offline") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() validates the JWT with the auth server (getSession() would not).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirectWithCookies(url, response);
  }
  if (user && AUTH_PAGES.includes(pathname)) {
    const next = request.nextUrl.searchParams.get("next");
    return redirectWithCookies(new URL(safeNext(next), request.url), response);
  }
  return response;
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const res = NextResponse.redirect(url);
  for (const c of from.cookies.getAll()) res.cookies.set(c);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest|robots.txt|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)"],
};
