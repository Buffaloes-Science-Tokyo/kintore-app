"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { saveCurrentMember, useCurrentMember } from "@/lib/currentMember";

const LINKS = [
  { href: "/", label: "記録する", short: "記録", icon: "✏️" },
  { href: "/dashboard", label: "ダッシュボード", short: "ダッシュ", icon: "🎯" },
  { href: "/charts/max", label: "MAX×KPI", short: "MAX", icon: "📈" },
  { href: "/charts/weight", label: "体重グラフ", short: "体重", icon: "⚖️" },
  { href: "/records", label: "記録一覧", short: "一覧", icon: "📋" },
  { href: "/members", label: "部員管理", short: "部員", icon: "👥" },
];

export type NavMember = { id: number; name: string; role: string };

export default function NavBar({ members }: { members: NavMember[] }) {
  const pathname = usePathname();
  const member = useCurrentMember();

  function switchMember(idStr: string) {
    const m = members.find((x) => String(x.id) === idStr);
    saveCurrentMember(m ? { id: m.id, name: m.name, role: m.role } : null);
  }

  return (
    <>
      {/* PC: ヘッダー内の横並びナビ */}
      <nav className="nav-links">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : ""}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* どのページからでも人を切り替えられるドロップダウン */}
      <div className="current-user">
        <select
          className="member-switch"
          value={member ? String(member.id) : ""}
          onChange={(e) => switchMember(e.target.value)}
          aria-label="名前を切り替え"
        >
          <option value="">名前を選択…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.role === "view" ? " 👀" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* スマホ: 画面下の固定タブナビ */}
      <nav className="bottom-nav">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : ""}
          >
            <span className="icon">{l.icon}</span>
            <span className="label">{l.short}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
