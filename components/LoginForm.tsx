"use client";

import { useActionState } from "react";
import { loginWithTeamPassword } from "@/lib/login";

export default function LoginForm() {
  const [result, action, pending] = useActionState(loginWithTeamPassword, null);

  return (
    <form action={action}>
      <label className="field">
        <span>チームパスワード</span>
        <input
          type="password"
          name="password"
          placeholder="部のLINEで共有されたパスワード"
          autoFocus
          required
        />
      </label>
      <button className="primary" disabled={pending}>
        {pending ? "確認中…" : "入る"}
      </button>
      {result && !result.ok && (
        <p className="form-message ng">{result.message}</p>
      )}
    </form>
  );
}
