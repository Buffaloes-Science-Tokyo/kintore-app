"use client";

import { useActionState } from "react";
import { addMember } from "@/lib/actions";
import { POSITIONS } from "@/lib/exercises";

export default function MemberForm() {
  const [result, action, pending] = useActionState(addMember, null);

  return (
    <form action={action}>
      <label className="field">
        <span>名前</span>
        <input name="name" placeholder="例: 山田 太郎" required />
      </label>
      <label className="field">
        <span>ポジション</span>
        <select name="position" defaultValue="">
          <option value="">未設定（マネージャーなど）</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>学年</span>
        <select name="grade" defaultValue="">
          <option value="">未設定</option>
          {[1, 2, 3, 4].map((g) => (
            <option key={g} value={g}>
              {g}年
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>権限</span>
        <select name="role" defaultValue="input">
          <option value="input">入力できる（選手など）</option>
          <option value="view">閲覧のみ（マネージャー・OBなど）</option>
        </select>
      </label>
      <button className="primary" disabled={pending}>
        {pending ? "登録中…" : "部員を登録する"}
      </button>
      {result && (
        <p className={`form-message ${result.ok ? "ok" : "ng"}`}>
          {result.message}
        </p>
      )}
    </form>
  );
}
