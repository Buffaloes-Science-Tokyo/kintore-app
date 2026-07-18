import { prisma } from "@/lib/db";
import { MAX_EXERCISES, POSITIONS } from "@/lib/exercises";

// 月次レポートCSV: 部員ごとの目標と実績（体重・MAX3種目）
// /api/report?month=2026-06 （省略時は先月）
export async function GET(request: Request) {
  const url = new URL(request.url);
  let month = url.searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    const now = new Date();
    month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7);
  }
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const range = { gte: start, lt: end };

  const [members, goals, weights, maxes] = await Promise.all([
    prisma.member.findMany({ where: { role: "input" }, orderBy: { name: "asc" } }),
    prisma.goal.findMany({ where: { month } }),
    prisma.bodyWeight.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    prisma.maxRecord.findMany({ where: { date: range } }),
  ]);

  // 並び順: Lines → Backs → Skills（未設定は最後）、ポジション内は4年→1年
  const posOrder = new Map(POSITIONS.map((p, i) => [p, i]));
  members.sort((a, b) => {
    const pa = a.position != null ? posOrder.get(a.position)! : 99;
    const pb = b.position != null ? posOrder.get(b.position)! : 99;
    if (pa !== pb) return pa - pb;
    const ga = a.grade ?? 0;
    const gb = b.grade ?? 0;
    if (ga !== gb) return gb - ga;
    return a.name.localeCompare(b.name, "ja");
  });

  const goalBy = new Map(goals.map((g) => [g.memberId, g]));

  // 月内の最終体重（昇順で上書き＝最後の記録が残る）
  const weightBy = new Map<number, number>();
  for (const w of weights) weightBy.set(w.memberId, w.weightKg);

  // 月内のベストMAXと怪我フラグ
  const maxBy = new Map<string, number>(); // "memberId|exercise"
  const injuredBy = new Set<string>();
  for (const r of maxes) {
    const key = `${r.memberId}|${r.exercise}`;
    if (r.weightKg != null) {
      maxBy.set(key, Math.max(r.weightKg, maxBy.get(key) ?? 0));
    } else if (r.injured) {
      injuredBy.add(key);
    }
  }

  const fmt = (v: number | null | undefined) => (v != null ? String(v) : "");
  const goalKeys = {
    スクワット: "targetSquat",
    パワークリーン: "targetClean",
    ベンチプレス: "targetBench",
  } as const;

  const header = [
    "名前",
    "ポジション",
    "学年",
    "目標体重(kg)",
    "実績体重(kg)",
    "体重差(kg)",
    ...MAX_EXERCISES.flatMap((e) => [`${e}目標(kg)`, `${e}実績(kg)`, `${e}達成`]),
  ];

  const rows = members.map((m) => {
    const goal = goalBy.get(m.id);
    const actualW = weightBy.get(m.id);
    const targetW = goal?.targetWeightKg;
    const diffW =
      actualW != null && targetW != null
        ? Math.round((actualW - targetW) * 10) / 10
        : null;

    const maxCols = MAX_EXERCISES.flatMap((e) => {
      const key = `${m.id}|${e}`;
      const target = goal?.[goalKeys[e as keyof typeof goalKeys]] as
        | number
        | null
        | undefined;
      const actual = maxBy.get(key);
      const injured = !actual && injuredBy.has(key);
      const achieved =
        target != null && actual != null ? (actual >= target ? "○" : "×") : injured ? "怪我" : "";
      return [fmt(target), injured ? "怪我" : fmt(actual), achieved];
    });

    return [
      m.name,
      m.position ?? "",
      m.grade ? `${m.grade}年` : "",
      fmt(targetW),
      fmt(actualW),
      diffW != null ? (diffW > 0 ? `+${diffW}` : String(diffW)) : "",
      ...maxCols,
    ];
  });

  // Excelで文字化けしないようBOM付きUTF-8で出力
  const csv =
    "﻿" + [header, ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="buffaloes_report_${month}.csv"`,
    },
  });
}
