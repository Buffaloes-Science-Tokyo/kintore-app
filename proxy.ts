import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, teamToken } from "@/lib/authToken";

// チームパスワードで認証済み（クッキーあり）でなければ /login へ
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await teamToken())) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // ログインページと静的アセット以外のすべて（APIも含む）を保護する
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
