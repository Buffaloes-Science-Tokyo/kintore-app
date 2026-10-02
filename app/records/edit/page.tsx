import Link from "next/link";
import { prisma } from "@/lib/db";
import { WorkoutForm } from "@/components/LogForms";

export const dynamic = "force-dynamic";

/** 過去のトレーニング記録（同じ日 × 種目のセット群）の編集 */
export default async function EditWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const memberId = Number(sp.member);
  const dateStr = sp.date ?? "";
  const exercise = sp.exercise ?? "";
  const date = new Date(dateStr);

  const fromLog = sp.from === "log";
  const backHref = fromLog
    ? "/log"
    : `/records?view=training${sp.member ? `&member=${sp.member}` : ""}`;

  const member =
    Number.isInteger(memberId) && memberId > 0
      ? await prisma.member.findUnique({ where: { id: memberId } })
      : null;
  const logs =
    member && exercise && !Number.isNaN(date.getTime())
      ? await prisma.workoutLog.findMany({
          where: {
            memberId: member.id,
            exercise,
            date: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) },
          },
          orderBy: { setNumber: "asc" },
        })
      : [];

  return (
    <>
      <h1 className="page-title">トレーニング記録の編集</h1>
      <p className="page-desc">
        <Link href={backHref}>← {fromLog ? "記録する" : "記録一覧"}に戻る</Link>
      </p>

      {!member || logs.length === 0 ? (
        <div className="card">
          <p className="empty">編集対象の記録が見つかりません（削除済みの可能性があります）</p>
        </div>
      ) : (
        <WorkoutForm
          memberId={member.id}
          memberName={member.name}
          returnTo={fromLog ? "log" : undefined}
          initial={{
            date: dateStr,
            exercise,
            bodyPart: logs[0].bodyPart ?? "",
            sets: logs.map((l) => ({ weightKg: l.weightKg, reps: l.reps })),
          }}
        />
      )}
    </>
  );
}
