import { prisma } from "@/lib/db";

// 指定した部員・月の目標を返す（目標入力フォームのプリフィル用）
export async function GET(request: Request) {
  const url = new URL(request.url);
  const memberId = Number(url.searchParams.get("member"));
  const month = url.searchParams.get("month") ?? "";
  if (!Number.isInteger(memberId) || memberId <= 0 || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: "invalid params" }, { status: 400 });
  }

  const goal = await prisma.goal.findUnique({
    where: { memberId_month: { memberId, month } },
  });

  return Response.json({
    goal: goal
      ? {
          targetWeightKg: goal.targetWeightKg,
          targetSquat: goal.targetSquat,
          targetClean: goal.targetClean,
          targetBench: goal.targetBench,
        }
      : null,
  });
}
