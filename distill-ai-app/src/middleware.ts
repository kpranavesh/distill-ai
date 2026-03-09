import { type NextRequest } from "next/server";
import { runAuthProxy } from "@/lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  return await runAuthProxy(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
