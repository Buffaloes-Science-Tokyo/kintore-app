"use client";

import { useState } from "react";
import { saveCurrentMember, useCurrentMember } from "@/lib/currentMember";

type MemberItem = { id: number; name: string; role: string };

export default function NamePicker({ members }: { members: MemberItem[] }) {
  const current = useCurrentMember();
  const [query, setQuery] = useState("");

  const filtered = members.filter((m) => m.name.includes(query.trim()));

  return (
    <div>
      <input
        placeholder="名前で検索…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="member-grid">
        {filtered.map((m) => (
          <button
            key={m.id}
            className={
              (current?.id === m.id ? "selected " : "") +
              (m.role === "view" ? "role-view" : "")
            }
            onClick={() => saveCurrentMember(m)}
          >
            {m.name}
            {m.role === "view" ? " 👀" : ""}
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="empty">
          該当する部員がいません。「部員管理」から登録してください。
        </p>
      )}
      {current && (
        <p className="corr-note">
          選択中: <span className="corr-value">{current.name}</span>（
          {current.role === "input" ? "入力できます" : "閲覧のみ"}）
        </p>
      )}
    </div>
  );
}
