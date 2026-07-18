// チームパスワードから認証クッキー用トークンを生成（proxy と login の両方で使う）
let cached: string | null = null;

export async function teamToken(): Promise<string> {
  if (cached) return cached;
  const data = new TextEncoder().encode(
    `buffaloes-auth:${process.env.TEAM_PASSWORD ?? ""}`
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  cached = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return cached;
}

export const AUTH_COOKIE = "buffaloes_auth";
