import { POSITIONS } from "@/lib/exercises";

type SortableMember = { name: string; position: string | null; grade: number | null };

/** レポートの並び順: Lines → Backs → Skills（未設定は最後）、ポジション内は4年→1年 */
export function sortMembersForReport<T extends SortableMember>(members: T[]): T[] {
  const posOrder = new Map(POSITIONS.map((p, i) => [p, i]));
  return members.sort((a, b) => {
    const pa = a.position != null ? posOrder.get(a.position) ?? 98 : 99;
    const pb = b.position != null ? posOrder.get(b.position) ?? 98 : 99;
    if (pa !== pb) return pa - pb;
    const ga = a.grade ?? 0;
    const gb = b.grade ?? 0;
    if (ga !== gb) return gb - ga;
    return a.name.localeCompare(b.name, "ja");
  });
}

/** "2026-06" 形式なら返し、そうでなければ null */
export function parseMonth(value: string | null): string | null {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

/** 月の範囲（UTC, [start, end)） */
export function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Excelで文字化けしないようBOM付きUTF-8のCSVレスポンスを返す */
export function csvResponse(rows: (string | number)[][], filename: string) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
