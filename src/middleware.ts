import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtre rapide : redirige vers /connexion en l'absence de cookie de session.
 * La validation réelle de la session (base de données) et les permissions
 * sont toujours vérifiées côté serveur dans chaque page, action et route API.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("rcm_session");
  const { pathname, search } = req.nextUrl;
  if (!hasSession && pathname !== "/connexion") {
    const url = req.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = pathname === "/" ? "" : `?suite=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/).*)"],
};
