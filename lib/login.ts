"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, teamToken } from "./authToken";
import type { ActionResult } from "./actions";

export async function loginWithTeamPassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (!process.env.TEAM_PASSWORD || password !== process.env.TEAM_PASSWORD) {
    return { ok: false, message: "パスワードが違います" };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, await teamToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180, // 半年間は再入力不要
    path: "/",
  });
  redirect("/");
}
