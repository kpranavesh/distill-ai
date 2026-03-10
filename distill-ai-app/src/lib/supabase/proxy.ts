import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth proxy: refresh session and redirect unauthenticated users to /login,
 * or redirect authenticated users away from /login.
 */
export async function runAuthProxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isLogin = request.nextUrl.pathname === "/login";
    const isAuthCallback = request.nextUrl.pathname.startsWith("/auth/");

    if (user && isLogin) {
      response = NextResponse.redirect(new URL("/", request.url));
      return response;
    }

    if (!user && !isLogin && !isAuthCallback) {
      response = NextResponse.redirect(new URL("/login", request.url));
      return response;
    }

    return response;
  } catch {
    return NextResponse.next({ request });
  }
}
