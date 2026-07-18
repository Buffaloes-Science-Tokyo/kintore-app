import { prisma } from "@/lib/db";

// 指定した部員・日付の実施メニュー（トレーニング/MAX/体重）を返す
export async function GET(request: Request) {
  const url = new URL(request.url);
  const memberId = Number(url.searchParams.get("member"));
  const dateStr = url.searchParams.get("date") ?? "";
  const date = new Date(dateStr);
  if (!Number.isInteger(memberId) || memberId <= 0 || Number.isNaN(date.getTime())) {
    return Response.json({ error: "invalid params" }, { status: 400 });
  }
  const next = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const range = { gte: date, lt: next };

  const [logs, maxes, weights] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { memberId, date: range },
      orderBy: [{ createdAt: "asc" }, { setNumber: "asc" }],
    }),
    prisma.maxRecord.findMany({ where: { memberId, date: range } }),
    prisma.bodyWeight.findMany({ where: { memberId, date: range } }),
  ]);

  // 種目ごとにまとめる
  const sessions: {
    exercise: string;
    sets: { weightKg: number; reps: number }[];
    volume: number;
  }[] = [];
  const byExercise = new Map<string, (typeof sessions)[number]>();
  for (const log of logs) {
    let s = byExercise.get(log.exercise);
    if (!s) {
      s = { exercise: log.exercise, sets: [], volume: 0 };
      byExercise.set(log.exercise, s);
      sessions.push(s);
    }
    s.sets.push({ weightKg: log.weightKg, reps: log.reps });
    s.volume += log.weightKg * log.reps;
  }

  return Response.json({
    sessions,
    maxes: maxes.map((m) => ({
      exercise: m.exercise,
      weightKg: m.weightKg,
      injured: m.injured,
    })),
    weights: weights.map((w) => w.weightKg),
  });
}
