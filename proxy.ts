import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (ex-middleware) : renouvelle la session Supabase à chaque requête et protège les espaces connectés.
 * Les contrôles d'accès réels restent en base (RLS) et dans les pages ; ceci n'est qu'un premier filtre.
 */
const PROTECTED = ["/evenements", "/organisations", "/profil", "/bienvenue", "/gestion", "/admin"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // projet non configuré (ex. démonstration du système visuel)

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims() vérifie la signature du jeton et le renouvelle si nécessaire.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const target = request.nextUrl.clone();
    target.pathname = "/connexion";
    target.search = `?suite=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(target);
  }
  if (signedIn && path === "/connexion") {
    const target = request.nextUrl.clone();
    target.pathname = "/evenements";
    target.search = "";
    return NextResponse.redirect(target);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons/|fonts/|sw\\.js|manifest\\.webmanifest|icon\\.svg|apple-icon\\.png|favicon\\.ico).*)",
  ],
};
