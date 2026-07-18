import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import FilterBar from "@/components/FilterBar";
import { formatSets, groupSessions } from "@/lib/sessions";
import { lastWeeks, mondayOf, weekLabel } from "@/lib/weekly";

export const dynamic = "force-dynamic";

/** 追加機能: 部員全員のトレーニング記録を横断で見るページ */
export default async function AllRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;

  const [members, exerciseRows] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    prisma.workoutLog.findMany({
      select: { exercise: true },
      distinct: ["exercise"],
      orderBy: { exercise: "asc" },
    }),
  ]);
  const exercises = exerciseRows.map((r) => r.exercise);

  const memberId = members.find((m) => String(m.id) === sp.member)?.id;
  const exercise = exercises.includes(sp.exercise ?? "") ? sp.exercise : undefined;

  const logs = await prisma.workoutLog.findMany({
    where: {
      ...(memberId && { memberId }),
      ...(exercise && { exercise }),
    },
    orderBy: [{ date: "desc" }, { setNumber: "asc" }],
    take: 300,
    include: { member: true },
  });
  const sessions = groupSessions(logs).slice(0, 30);

  // 週あたりのトレーニング回数（直近4週・日数ベース）
  const weeks = lastWeeks(4);
  const attendanceLogs = await prisma.workoutLog.findMany({
    where: { date: { gte: new Date(weeks[0]) } },
    select: { memberId: true, date: true },
  });
  const daysByMemberWeek = new Map<number, Map<number, Set<string>>>();
  for (const log of attendanceLogs) {
    const w = mondayOf(log.date);
    if (!daysByMemberWeek.has(log.memberId)) daysByMemberWeek.set(log.memberId, new Map());
    const byWeek = daysByMemberWeek.get(log.memberId)!;
    if (!byWeek.has(w)) byWeek.set(w, new Set());
    byWeek.get(w)!.add(log.date.toISOString().slice(0, 10));
  }
  const inputMembers = members.filter((m) => m.role === "input");

  return (
    <>
      <h1 className="page-title">みんなの記録</h1>
      <p className="page-desc">
        部員全員のトレーニング記録を横断で確認できます。
        自分の記録だけ見るなら <Link href="/records">記録一覧 →</Link>
      </p>

      <div className="card">
        <h2>🗓 週あたりのトレーニング回数（直近4週）</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>名前</th>
                {weeks.map((w, i) => (
                  <th key={w}>
                    {weekLabel(w)}
                    {i === weeks.length - 1 && "（今週）"}
                  </th>
                ))}
                <th>週平均</th>
              </tr>
            </thead>
            <tbody>
              {inputMembers.map((m) => {
                const byWeek = daysByMemberWeek.get(m.id);
                const values = weeks.map((w) => byWeek?.get(w)?.size ?? 0);
                // 今週はまだ途中なので平均は先週までの3週で計算
                const past = values.slice(0, -1);
                const avg = Math.round((past.reduce((a, b) => a + b, 0) / past.length) * 10) / 10;
                return (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    {values.map((v, i) => (
                      <td key={i} className={v === 0 ? "zero-week" : ""}>
                        {v > 0 ? `${v}回` : "—"}
                      </td>
                    ))}
                    <td>
                      <b>{avg}回</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="corr-note">同じ日に複数種目やっても1回とカウント。週平均は先週までの3週間の平均</p>
      </div>

      <div className="card">
        <h2>🏋️ 全員のトレーニング記録</h2>
        <Suspense>
          <FilterBar
            fields={[
              {
                name: "member",
                label: "部員",
                value: memberId ? String(memberId) : "",
                options: [
                  { value: "", label: "全員" },
                  ...members.map((m) => ({ value: String(m.id), label: m.name })),
                ],
              },
              {
                name: "exercise",
                label: "種目",
                value: exercise ?? "",
                options: [
                  { value: "", label: "すべての種目" },
                  ...exercises.map((e) => ({ value: e, label: e })),
                ],
              },
            ]}
          />
        </Suspense>
        {sessions.length === 0 ? (
          <p className="empty">条件に合う記録がありません</p>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>名前</th>
                  <th>部位</th>
                  <th>種目</th>
                  <th>セット内容（kg×回）</th>
                  <th>ボリューム</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.key}>
                    <td>{s.date.toISOString().slice(0, 10)}</td>
                    <td>{s.memberName}</td>
                    <td>{s.bodyPart ?? "—"}</td>
                    <td>{s.exercise}</td>
                    <td>{formatSets(s.sets)}</td>
                    <td>{Math.round(s.volume).toLocaleString()}kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
