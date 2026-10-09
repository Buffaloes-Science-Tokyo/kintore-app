import { prisma } from "@/lib/db";
import { csvResponse, monthRange, parseMonth, sortMembersForReport } from "@/lib/report";

// 月次体重レポートCSV: 部員ごと（行）× その月の日付（列）の体重記録
// /api/weight-report?month=2026-06 （省略時は今月）
export async function GET(request: Request) {
  const url = new URL(request.url);
  const month =
    parseMonth(url.searchParams.get("month")) ?? new Date().toISOString().slice(0, 7);
  const { start, end } = monthRange(month);

  const [members, goals, weights] = await Promise.all([
    prisma.member.findMany({ where: { role: "input" } }),
    prisma.goal.findMany({ where: { month } }),
    prisma.bodyWeight.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
  ]);
  sortMembersForReport(members);

  const goalBy = new Map(goals.map((g) => [g.memberId, g.targetWeightKg]));

  // 同じ日に複数記録がある場合は最後の記録を採用
  const memberIds = new Set(members.map((m) => m.id));
  const weightBy = new Map<string, number>(); // "memberId|YYYY-MM-DD"
  const recordedDays = new Set<string>();
  for (const w of weights) {
    if (!memberIds.has(w.memberId)) continue;
    const day = w.date.toISOString().slice(0, 10);
    weightBy.set(`${w.memberId}|${day}`, w.weightKg);
    recordedDays.add(day);
  }

  // 誰も体重を記録していない日の列は出さない
  const days = [...recordedDays].sort();

  const header = [
    "名前",
    "ポジション",
    "目標体重(kg)",
    ...days.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`),
  ];
  const rows = members.map((m) => [
    m.name,
    m.position ?? "",
    goalBy.get(m.id) ?? "",
    ...days.map((d) => weightBy.get(`${m.id}|${d}`) ?? ""),
  ]);

  return csvResponse([header, ...rows], `buffaloes_weight_${month}.csv`);
}
