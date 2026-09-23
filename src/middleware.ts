import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAllowed, requirementFor, type Role } from "@/lib/rbac";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Refreshes the session cookie when needed. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const requirement = requirementFor(pathname);
  if (requirement === null) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (requirement !== "signed_in") {
    const { data } = await supabase.rpc("my_roles");
    const roles = ((data ?? []) as Array<{ role: Role }>).map((r) => r.role);
    if (!isAllowed(roles, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/forbidden";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)"],
};
